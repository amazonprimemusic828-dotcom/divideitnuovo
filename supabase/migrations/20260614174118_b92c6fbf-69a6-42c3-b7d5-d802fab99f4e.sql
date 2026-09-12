CREATE OR REPLACE FUNCTION public.reserve_group_seat(_group_id uuid, _user_email text, _user_name text, _user_avatar_url text)
 RETURNS TABLE(membership_id uuid, status text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_group record;
  v_count integer;
  v_existing record;
  v_new_id uuid;
  v_email text := lower(trim(_user_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'invalid_email'; END IF;

  SELECT g.id, g.max_members, g.status AS group_status, g.closed_at, g.admin_email
    INTO v_group FROM public.groups g WHERE g.id = _group_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF v_group.group_status <> 'active' OR v_group.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_closed';
  END IF;

  SELECT m.id, m.payment_status INTO v_existing
  FROM public.memberships m
  WHERE m.group_id = _group_id AND lower(m.user_email) = v_email LIMIT 1;

  IF FOUND THEN
    IF v_existing.payment_status = 'paid' THEN RAISE EXCEPTION 'already_member'; END IF;
    membership_id := v_existing.id; status := 'reused'; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.memberships m
  WHERE m.group_id = _group_id
    AND m.payment_status IN ('paid', 'pending')
    AND lower(m.user_email) <> lower(v_group.admin_email);

  IF v_count >= v_group.max_members THEN RAISE EXCEPTION 'seat_full'; END IF;

  INSERT INTO public.memberships (group_id, user_email, user_name, user_avatar_url, role, payment_status, joined_date)
  VALUES (_group_id, v_email, _user_name, _user_avatar_url, 'member', 'pending', current_date)
  RETURNING id INTO v_new_id;

  membership_id := v_new_id; status := 'reserved'; RETURN NEXT;
END;
$function$;