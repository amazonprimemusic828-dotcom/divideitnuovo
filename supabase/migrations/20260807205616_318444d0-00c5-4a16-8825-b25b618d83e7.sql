CREATE OR REPLACE FUNCTION public.set_membership_auto_renew(_membership_id uuid, _value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_group uuid;
BEGIN
  SELECT lower(m.user_email), m.group_id INTO v_email, v_group
  FROM public.memberships m WHERE m.id = _membership_id;

  IF v_email IS NULL THEN RAISE EXCEPTION 'membership_not_found'; END IF;

  IF v_email <> public.current_email() AND NOT public.is_group_admin(v_group) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  UPDATE public.memberships SET auto_renew = _value WHERE id = _membership_id;
  RETURN _value;
END;
$$;

REVOKE ALL ON FUNCTION public.set_membership_auto_renew(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_membership_auto_renew(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_membership_auto_renew(uuid, boolean) TO service_role;