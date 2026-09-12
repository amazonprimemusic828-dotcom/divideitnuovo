-- Matchmaking must use the stable service_type (e.g. "Prime Video") while
-- service_name may contain the display label including the selected plan.

CREATE OR REPLACE FUNCTION public.reserve_group_seat(
  _group_id uuid,
  _user_email text,
  _user_name text,
  _user_avatar_url text
)
RETURNS TABLE(membership_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_count integer;
  v_existing record;
  v_new_id uuid;
  v_email text := lower(trim(_user_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'invalid_email'; END IF;

  SELECT g.id, g.max_members, g.status AS group_status, g.closed_at, g.admin_email
    INTO v_group
  FROM public.groups g
  WHERE g.id = _group_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF v_group.group_status <> 'active' OR v_group.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_closed';
  END IF;

  SELECT m.id, m.payment_status INTO v_existing
  FROM public.memberships m
  WHERE m.group_id = _group_id AND lower(m.user_email) = v_email
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.payment_status = 'paid' THEN RAISE EXCEPTION 'already_member'; END IF;
    membership_id := v_existing.id;
    status := 'reused';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.memberships m
  WHERE m.group_id = _group_id
    AND m.payment_status IN ('paid', 'pending')
    AND lower(m.user_email) <> lower(v_group.admin_email);

  -- max_members is the number of paying participant slots; the admin is not
  -- included in this count.
  IF v_count >= v_group.max_members THEN RAISE EXCEPTION 'seat_full'; END IF;

  INSERT INTO public.memberships (
    group_id, user_email, user_name, user_avatar_url,
    role, payment_status, joined_date
  ) VALUES (
    _group_id, v_email, _user_name, _user_avatar_url,
    'member', 'pending', current_date
  )
  RETURNING id INTO v_new_id;

  membership_id := v_new_id;
  status := 'reserved';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_group_seat(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_group_seat(uuid, text, text, text) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.match_and_lock_group(text, text, text);
CREATE FUNCTION public.match_and_lock_group(
  _service_name text,
  _user_email text,
  _plan_type text DEFAULT NULL
) RETURNS TABLE(
  out_group_id uuid,
  out_lock_id uuid,
  out_expires_at timestamptz,
  out_available_groups int,
  out_available_slots int,
  out_trust_score int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_user_email));
  v_group_id uuid;
  v_lock_id uuid;
  v_expires timestamptz;
  v_available_groups int;
  v_available_slots int;
  v_trust_score int;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'invalid_email'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_slot_locks l
    JOIN public.groups g ON g.id = l.group_id
    WHERE lower(l.user_email) = v_email
      AND l.expires_at > now()
      AND lower(coalesce(g.service_type, g.service_name)) = lower(_service_name)
      AND (_plan_type IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan_type))
  ) THEN RAISE EXCEPTION 'lock_already_exists'; END IF;

  SELECT count(*)::int,
         COALESCE(sum(GREATEST(g.max_members - public.count_active_slots(g.id), 0)), 0)::int
    INTO v_available_groups, v_available_slots
  FROM public.groups g
  WHERE g.status = 'active'
    AND g.closed_at IS NULL
    AND g.is_public = true
    AND lower(coalesce(g.service_type, g.service_name)) = lower(_service_name)
    AND (_plan_type IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan_type))
    AND public.count_active_slots(g.id) < g.max_members
    AND lower(g.admin_email) <> v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = g.id AND lower(m.user_email) = v_email
        AND m.payment_status IN ('paid', 'pending')
    );

  SELECT g.id, COALESCE(t.score, 100)
    INTO v_group_id, v_trust_score
  FROM public.groups g
  LEFT JOIN public.admin_trust_scores t ON lower(t.user_email) = lower(g.admin_email)
  WHERE g.status = 'active'
    AND g.closed_at IS NULL
    AND g.is_public = true
    AND lower(coalesce(g.service_type, g.service_name)) = lower(_service_name)
    AND (_plan_type IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan_type))
    AND public.count_active_slots(g.id) < g.max_members
    AND lower(g.admin_email) <> v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = g.id AND lower(m.user_email) = v_email
        AND m.payment_status IN ('paid', 'pending')
    )
  ORDER BY COALESCE(t.score, 100) DESC, g.created_date ASC
  FOR UPDATE OF g SKIP LOCKED
  LIMIT 1;

  IF v_group_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.group_slot_locks (group_id, user_email)
  VALUES (v_group_id, v_email)
  RETURNING id, expires_at INTO v_lock_id, v_expires;

  RETURN QUERY SELECT v_group_id, v_lock_id, v_expires,
    v_available_groups, v_available_slots, v_trust_score;
END;
$$;

REVOKE ALL ON FUNCTION public.match_and_lock_group(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_and_lock_group(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.waitlist_queue_info(
  _service text,
  _plan text DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS TABLE (
  queue_position int,
  total_waiting int,
  free_slots int,
  typical_size int,
  groups_ahead int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _my_created timestamptz;
  _pos int;
  _total int;
  _free int;
  _size int;
BEGIN
  SELECT count(*)::int INTO _total
  FROM public.waitlist w
  WHERE lower(w.service_name) = lower(_service)
    AND w.status = 'waiting'
    AND (_plan IS NULL OR lower(coalesce(w.plan_type, '')) = lower(_plan));

  SELECT w.created_at INTO _my_created
  FROM public.waitlist w
  WHERE lower(w.service_name) = lower(_service)
    AND w.status = 'waiting'
    AND _email IS NOT NULL
    AND lower(w.user_email) = lower(_email)
    AND (_plan IS NULL OR lower(coalesce(w.plan_type, '')) = lower(_plan))
  ORDER BY w.created_at ASC LIMIT 1;

  IF _my_created IS NULL THEN
    _pos := _total + 1;
  ELSE
    SELECT count(*)::int + 1 INTO _pos
    FROM public.waitlist w
    WHERE lower(w.service_name) = lower(_service)
      AND w.status = 'waiting'
      AND (_plan IS NULL OR lower(coalesce(w.plan_type, '')) = lower(_plan))
      AND w.created_at < _my_created;
  END IF;

  SELECT COALESCE(sum(GREATEST(g.max_members - public.count_active_slots(g.id), 0)), 0)::int
    INTO _free
  FROM public.groups g
  WHERE lower(coalesce(g.service_type, g.service_name)) = lower(_service)
    AND g.status = 'active' AND g.closed_at IS NULL AND g.is_public = true
    AND (_plan IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan));

  SELECT g.max_members INTO _size
  FROM public.groups g
  WHERE lower(coalesce(g.service_type, g.service_name)) = lower(_service)
    AND (_plan IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan))
  ORDER BY g.created_date DESC NULLS LAST LIMIT 1;

  _size := GREATEST(COALESCE(NULLIF(_size, 0), 5), 1);
  RETURN QUERY SELECT _pos, _total, _free, _size,
    CASE WHEN _pos <= _free THEN 0
         ELSE ceil((_pos - _free)::numeric / _size)::int
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_queue_info(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_queue_info(text, text, text) TO authenticated, service_role;

-- Server-side fallback: process every paid waitlist entry even when the group
-- creator closes the browser before the immediate post-create request finishes.
DO $$
DECLARE
  _cron_secret text;
BEGIN
  SELECT substring(command from '"x-cron-secret":"([^"]+)"') INTO _cron_secret
  FROM cron.job
  WHERE command LIKE '%x-cron-secret%'
  LIMIT 1;

  IF _cron_secret IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'process-paid-waitlist';

    PERFORM cron.schedule(
      'process-paid-waitlist',
      '* * * * *',
      format($command$
        SELECT net.http_post(
          url := 'https://pcumuxuqdxzvtcorbtuo.supabase.co/functions/v1/stripe-api',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', %L
          ),
          body := jsonb_build_object('action', 'waitlist-process-all')
        );
      $command$, _cron_secret)
    );
  ELSE
    RAISE EXCEPTION 'CRON_SECRET source job not found';
  END IF;
END;
$$;