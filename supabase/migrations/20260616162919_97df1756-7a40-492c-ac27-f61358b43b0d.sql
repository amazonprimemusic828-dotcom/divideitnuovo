DROP FUNCTION IF EXISTS public.match_and_lock_group(text, text);

CREATE OR REPLACE FUNCTION public.match_and_lock_group(
  _service_name text,
  _user_email text
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
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.group_slot_locks l
    JOIN public.groups g ON g.id = l.group_id
    WHERE lower(l.user_email) = v_email
      AND l.expires_at > now()
      AND lower(g.service_name) = lower(_service_name)
  ) THEN
    RAISE EXCEPTION 'lock_already_exists';
  END IF;

  SELECT g.id INTO v_group_id
  FROM public.groups g
  LEFT JOIN public.admin_trust_scores t ON lower(t.user_email) = lower(g.admin_email)
  WHERE g.status = 'active'
    AND g.closed_at IS NULL
    AND g.is_public = true
    AND lower(g.service_name) = lower(_service_name)
    AND public.count_active_slots(g.id) < g.max_members
    AND lower(g.admin_email) <> v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = g.id
        AND lower(m.user_email) = v_email
        AND m.payment_status IN ('paid','pending')
    )
  ORDER BY COALESCE(t.score, 100) DESC, g.created_date ASC
  FOR UPDATE OF g SKIP LOCKED
  LIMIT 1;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.group_slot_locks (group_id, user_email)
  VALUES (v_group_id, v_email)
  RETURNING group_slot_locks.id, group_slot_locks.expires_at INTO v_lock_id, v_expires;

  out_group_id := v_group_id;
  out_lock_id := v_lock_id;
  out_expires_at := v_expires;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_and_lock_group(text, text) TO authenticated, service_role;