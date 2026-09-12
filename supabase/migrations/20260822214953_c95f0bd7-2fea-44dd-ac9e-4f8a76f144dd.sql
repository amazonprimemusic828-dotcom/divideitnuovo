-- 1) Audit log: nessuna scrittura dal client
DROP POLICY IF EXISTS "audit_log_insert_service" ON public.audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon, authenticated;

-- 2) SECURITY DEFINER: revoca globale + allowlist delle sole funzioni chiamate dal frontend
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Funzioni pubbliche (vetrina gruppi, invito)
GRANT EXECUTE ON FUNCTION public.get_public_groups() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_group(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_by_invite_code(text) TO anon, authenticated;

-- Funzioni riservate agli utenti autenticati
GRANT EXECUTE ON FUNCTION public.get_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rating_summary(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_membership_auto_renew(uuid, boolean) TO authenticated;

-- Helper usati dentro le policy RLS (devono restare eseguibili nel contesto utente)
GRANT EXECUTE ON FUNCTION public.current_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_operator() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rental_can_read_credentials(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_phone_verified() TO authenticated;

-- 3) GraphQL non utilizzato dal frontend: chiudi l'API GraphQL ai ruoli pubblici
REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA graphql_public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated;