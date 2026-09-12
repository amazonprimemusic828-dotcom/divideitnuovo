-- Fix membership grants, group uniqueness and add waitlist queue position helpers

-- 1) Data API grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

-- 2) Allow an admin to run more than one group per service (only one *open* group
--    per admin/service/plan at a time)
DROP INDEX IF EXISTS public.unique_group_per_admin_service;
CREATE UNIQUE INDEX IF NOT EXISTS unique_open_group_per_admin_service
  ON public.groups (lower(admin_email), lower(service_name), lower(coalesce(plan_type, '')))
  WHERE status IN ('active', 'pending');

-- 3) Queue statistics for a service (+ optional plan)
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
  ORDER BY w.created_at ASC
  LIMIT 1;

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

  SELECT COALESCE(sum(GREATEST(0, g.max_members - public.count_active_slots(g.id))), 0)::int
    INTO _free
  FROM public.groups g
  WHERE lower(g.service_name) = lower(_service)
    AND g.status = 'active'
    AND (_plan IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan));

  SELECT g.max_members INTO _size
  FROM public.groups g
  WHERE lower(g.service_name) = lower(_service)
    AND (_plan IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan))
  ORDER BY g.created_date DESC NULLS LAST
  LIMIT 1;

  -- max_members includes the admin; the queue is only for paying participants.
  _size := GREATEST(COALESCE(NULLIF(_size, 0), 6) - 1, 1);

  RETURN QUERY SELECT
    _pos,
    _total,
    _free,
    _size,
    CASE WHEN _pos <= _free THEN 0
         ELSE ceil((_pos - _free)::numeric / _size)::int
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_queue_info(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_queue_info(text, text, text) TO authenticated, service_role;

-- Match only the exact selected subscription plan.
DROP FUNCTION IF EXISTS public.match_and_lock_group(text, text);
CREATE OR REPLACE FUNCTION public.match_and_lock_group(
  _service_name text,
  _user_email text,
  _plan_type text DEFAULT NULL
) RETURNS TABLE(out_group_id uuid, out_lock_id uuid, out_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_user_email));
  v_group_id uuid;
  v_lock_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.group_slot_locks l
    JOIN public.groups g ON g.id = l.group_id
    WHERE lower(l.user_email) = v_email AND l.expires_at > now()
      AND lower(g.service_name) = lower(_service_name)
      AND (_plan_type IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan_type))
  ) THEN RAISE EXCEPTION 'lock_already_exists'; END IF;

  SELECT g.id INTO v_group_id
  FROM public.groups g
  LEFT JOIN public.admin_trust_scores t ON lower(t.user_email) = lower(g.admin_email)
  WHERE g.status = 'active' AND g.closed_at IS NULL AND g.is_public = true
    AND lower(g.service_name) = lower(_service_name)
    AND (_plan_type IS NULL OR lower(coalesce(g.plan_type, '')) = lower(_plan_type))
    AND public.count_active_slots(g.id) < g.max_members
    AND lower(g.admin_email) <> v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = g.id AND lower(m.user_email) = v_email
        AND m.payment_status IN ('paid','pending')
    )
  ORDER BY COALESCE(t.score, 100) DESC, g.created_date ASC
  FOR UPDATE OF g SKIP LOCKED LIMIT 1;

  IF v_group_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.group_slot_locks (group_id, user_email)
  VALUES (v_group_id, v_email)
  RETURNING id, expires_at INTO v_lock_id, v_expires;
  out_group_id := v_group_id; out_lock_id := v_lock_id; out_expires_at := v_expires;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.match_and_lock_group(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_and_lock_group(text, text, text) TO authenticated, service_role;
