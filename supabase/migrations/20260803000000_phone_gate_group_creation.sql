-- ============================================================================
-- PHONE VERIFICATION GATE ON GROUP CREATION (server-side, not just UI)
-- La verifica è legata all'UTENTE (user_profiles.phone_verified_at), non al
-- gruppo. Se l'utente è verificato il gruppo si crea all'istante a costo zero;
-- se non lo è, l'INSERT viene rifiutato dal database stesso.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_phone_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND phone_verified_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_phone_verified() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_phone_verified() TO authenticated, service_role;

-- Replace the group INSERT policy: ownership check + phone verified
DROP POLICY IF EXISTS "groups_insert_own_owner_id" ON public.groups;
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "groups_insert_verified_owner" ON public.groups
    FOR INSERT TO authenticated
    WITH CHECK (
      owner_id = auth.uid()
      AND public.is_phone_verified()
    )';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
