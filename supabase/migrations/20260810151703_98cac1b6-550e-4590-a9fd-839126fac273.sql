ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS cred_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cred_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS cred_issue_note text;

DROP FUNCTION IF EXISTS public.get_group_members(uuid);

CREATE OR REPLACE FUNCTION public.get_group_members(_group_id uuid)
 RETURNS TABLE(id uuid, group_id uuid, user_email text, user_name text, user_avatar_url text, role text, payment_status text, joined_date date, created_date timestamp with time zone, cred_status text, cred_status_at timestamp with time zone, cred_issue_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.group_id, m.user_email, m.user_name,
         m.user_avatar_url, m.role, m.payment_status,
         m.joined_date, m.created_date,
         m.cred_status, m.cred_status_at, m.cred_issue_note
  FROM public.memberships m
  WHERE m.group_id = _group_id
    AND (public.is_group_member(_group_id) OR public.is_group_admin(_group_id))
  ORDER BY m.joined_date DESC;
$function$;

CREATE OR REPLACE FUNCTION public.set_credential_status(_group_id uuid, _status text, _note text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := public.current_email();
BEGIN
  IF v_email = '' THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _status NOT IN ('pending','verified','issue') THEN RAISE EXCEPTION 'invalid_status'; END IF;

  UPDATE public.memberships
     SET cred_status = _status,
         cred_status_at = now(),
         cred_issue_note = CASE WHEN _status = 'issue' THEN left(coalesce(_note,''), 500) ELSE NULL END
   WHERE group_id = _group_id
     AND lower(user_email) = v_email;

  IF NOT FOUND THEN RAISE EXCEPTION 'membership_not_found'; END IF;
  RETURN _status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_credential_status(_group_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.memberships
     SET cred_status = 'pending', cred_status_at = now(), cred_issue_note = NULL
   WHERE group_id = _group_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;