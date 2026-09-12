-- 1. Fix chat notification link (was /group/<id> → 404)
CREATE OR REPLACE FUNCTION public.notify_group_members_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_email text;
  v_service_name text;
  v_preview text;
  v_rec record;
  v_existing uuid;
  v_link text;
BEGIN
  SELECT lower(email) INTO v_sender_email FROM auth.users WHERE id = NEW.sender_uid::uuid;

  SELECT service_name INTO v_service_name FROM public.groups WHERE id = NEW.group_id;
  IF v_service_name IS NULL THEN
    v_service_name := 'Gruppo';
  END IF;

  v_preview := left(coalesce(NEW.message, ''), 120);
  v_link := '/GroupDetail?id=' || NEW.group_id::text;

  FOR v_rec IN
    SELECT DISTINCT lower(user_email) AS email
    FROM public.memberships
    WHERE group_id = NEW.group_id
      AND lower(user_email) IS DISTINCT FROM coalesce(v_sender_email, '')
  LOOP
    SELECT id INTO v_existing
    FROM public.notifications
    WHERE lower(user_email) = v_rec.email
      AND group_id = NEW.group_id
      AND type = 'message'
      AND read = false
    ORDER BY created_date DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.notifications
      SET title = 'Nuovo messaggio in ' || v_service_name,
          content = coalesce(NEW.sender_name, 'Un membro') || ': ' || v_preview,
          link = v_link,
          created_date = now()
      WHERE id = v_existing;
    ELSE
      INSERT INTO public.notifications (user_email, type, title, content, link, group_id, read, created_date)
      VALUES (v_rec.email, 'message', 'Nuovo messaggio in ' || v_service_name,
              coalesce(NEW.sender_name, 'Un membro') || ': ' || v_preview,
              v_link, NEW.group_id, false, now());
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_group_members_on_message() FROM PUBLIC, anon, authenticated;

-- 2. Deferred member removal
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS removal_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS removal_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS removal_requested_by text;

CREATE OR REPLACE FUNCTION public.request_member_removal(_membership_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m record;
  v_effective timestamptz;
  v_service text;
BEGIN
  SELECT * INTO v_m FROM public.memberships WHERE id = _membership_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'Iscrizione non trovata'; END IF;
  IF NOT public.is_group_admin(v_m.group_id) THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
  IF v_m.role = 'admin' THEN RAISE EXCEPTION 'Non puoi rimuovere l''amministratore'; END IF;

  v_effective := greatest(
    coalesce(v_m.current_period_end, v_m.access_expires_at,
             (coalesce(v_m.joined_date, current_date)::timestamptz + interval '30 days')),
    now()
  );

  UPDATE public.memberships
  SET removal_requested_at = now(),
      removal_effective_at = v_effective,
      removal_requested_by = public.current_email(),
      auto_renew = false
  WHERE id = _membership_id;

  SELECT service_name INTO v_service FROM public.groups WHERE id = v_m.group_id;

  INSERT INTO public.notifications (user_email, type, title, content, link, group_id, read, created_date)
  VALUES (lower(v_m.user_email), 'membership',
          'Accesso in scadenza: ' || coalesce(v_service, 'gruppo'),
          'L''amministratore ha programmato la tua rimozione. Manterrai l''accesso fino al ' ||
            to_char(v_effective, 'DD/MM/YYYY') || ', poi lo slot verrà liberato.',
          '/GroupDetail?id=' || v_m.group_id::text, v_m.group_id, false, now());

  RETURN v_effective;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_member_removal(_membership_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_gid uuid;
BEGIN
  SELECT group_id INTO v_gid FROM public.memberships WHERE id = _membership_id;
  IF v_gid IS NULL THEN RAISE EXCEPTION 'Iscrizione non trovata'; END IF;
  IF NOT public.is_group_admin(v_gid) THEN RAISE EXCEPTION 'Non autorizzato'; END IF;

  UPDATE public.memberships
  SET removal_requested_at = NULL, removal_effective_at = NULL, removal_requested_by = NULL
  WHERE id = _membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_scheduled_removals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rec record; v_count integer := 0; v_service text;
BEGIN
  FOR v_rec IN
    SELECT * FROM public.memberships
    WHERE removal_effective_at IS NOT NULL
      AND removal_effective_at <= now()
      AND role <> 'admin'
    LIMIT 500
  LOOP
    SELECT service_name INTO v_service FROM public.groups WHERE id = v_rec.group_id;
    DELETE FROM public.memberships WHERE id = v_rec.id;
    INSERT INTO public.notifications (user_email, type, title, content, link, group_id, read, created_date)
    VALUES (lower(v_rec.user_email), 'membership',
            'Rimosso da ' || coalesce(v_service, 'gruppo'),
            'Il periodo pagato è terminato e l''amministratore aveva programmato la tua rimozione.',
            '/BrowseGroups', v_rec.group_id, false, now());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.request_member_removal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_member_removal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_scheduled_removals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_member_removal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_member_removal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_removals() TO service_role;

-- 3. Expose removal info in the members listing RPC
DROP FUNCTION IF EXISTS public.get_group_members(uuid);
CREATE FUNCTION public.get_group_members(_group_id uuid)
RETURNS TABLE(
  id uuid, group_id uuid, user_email text, user_name text, user_avatar_url text,
  role text, payment_status text, joined_date date, created_date timestamptz,
  cred_status text, cred_status_at timestamptz, cred_issue_note text,
  removal_requested_at timestamptz, removal_effective_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.group_id, m.user_email, m.user_name, m.user_avatar_url,
         m.role, m.payment_status, m.joined_date, m.created_date,
         m.cred_status, m.cred_status_at, m.cred_issue_note,
         m.removal_requested_at, m.removal_effective_at
  FROM public.memberships m
  WHERE m.group_id = _group_id
    AND (public.is_group_member(_group_id) OR public.is_group_admin(_group_id) OR public.is_operator())
  ORDER BY m.created_date DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.get_group_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_members(uuid) TO authenticated, service_role;

-- 4. Auto payout preferences
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS auto_payout_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_payout_min_cents integer NOT NULL DEFAULT 1000;