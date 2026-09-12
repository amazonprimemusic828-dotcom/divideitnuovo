-- =====================================================================
-- E2EE Vault: user key pairs + per-member wrapped vault keys
-- =====================================================================

CREATE TABLE public.user_public_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  public_key_jwk jsonb NOT NULL,
  -- private key wrapped with a key derived from the recovery code
  wrapped_private_key text NOT NULL,
  kdf_salt text NOT NULL,
  kdf_iterations integer NOT NULL DEFAULT 310000,
  -- optional second wrap using the account password
  pw_wrapped_private_key text,
  pw_kdf_salt text,
  pw_kdf_iterations integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_public_keys TO authenticated;
GRANT ALL ON public.user_public_keys TO service_role;

ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own key row select" ON public.user_public_keys
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own key row insert" ON public.user_public_keys
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own key row update" ON public.user_public_keys
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_public_keys_touch
  BEFORE UPDATE ON public.user_public_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------

CREATE TABLE public.group_vault_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  wrapped_vault_key text NOT NULL,
  ephemeral_public_jwk jsonb NOT NULL,
  vault_version integer NOT NULL DEFAULT 1,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, recipient_user_id)
);

CREATE INDEX idx_group_vault_keys_recipient ON public.group_vault_keys (recipient_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_vault_keys TO authenticated;
GRANT ALL ON public.group_vault_keys TO service_role;

ALTER TABLE public.group_vault_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault key select own or admin" ON public.group_vault_keys
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid() OR public.is_group_admin(group_id));

CREATE POLICY "vault key insert by admin" ON public.group_vault_keys
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id) AND granted_by = auth.uid());

CREATE POLICY "vault key update by admin" ON public.group_vault_keys
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

CREATE POLICY "vault key delete by admin" ON public.group_vault_keys
  FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));

CREATE TRIGGER group_vault_keys_touch
  BEFORE UPDATE ON public.group_vault_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------
-- Encrypted payload on groups (client-side ciphertext only)

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS vault_ciphertext text,
  ADD COLUMN IF NOT EXISTS vault_iv text,
  ADD COLUMN IF NOT EXISTS vault_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vault_updated_at timestamptz;

-- ---------------------------------------------------------------------
-- Helper functions

-- Expose ONLY the public key of a given user to authenticated callers.
CREATE OR REPLACE FUNCTION public.vault_get_public_key(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT k.public_key_jwk
  FROM public.user_public_keys k
  WHERE k.user_id = _user_id
    AND auth.uid() IS NOT NULL;
$$;

-- Members of a group (paid/pending, excluding the admin) with their public key,
-- so the admin can wrap the vault key for each of them. Admin-only.
CREATE OR REPLACE FUNCTION public.vault_group_recipients(_group_id uuid)
RETURNS TABLE(user_id uuid, user_email text, user_name text, public_key_jwk jsonb, has_key boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id,
         m.user_email,
         m.user_name,
         k.public_key_jwk,
         EXISTS (
           SELECT 1 FROM public.group_vault_keys v
           WHERE v.group_id = _group_id AND v.recipient_user_id = u.id
         )
  FROM public.memberships m
  JOIN public.groups g ON g.id = m.group_id
  JOIN auth.users u ON lower(u.email) = lower(m.user_email)
  LEFT JOIN public.user_public_keys k ON k.user_id = u.id
  WHERE m.group_id = _group_id
    AND m.payment_status IN ('paid','pending')
    AND lower(m.user_email) <> lower(g.admin_email)
    AND public.is_group_admin(_group_id);
$$;

-- Encrypted payload readable by the admin and by members with active access.
CREATE OR REPLACE FUNCTION public.vault_get_payload(_group_id uuid)
RETURNS TABLE(vault_ciphertext text, vault_iv text, vault_version integer, vault_updated_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.vault_ciphertext, g.vault_iv, g.vault_version, g.vault_updated_at
  FROM public.groups g
  WHERE g.id = _group_id
    AND (
      public.is_group_admin(_group_id)
      OR public.rental_can_read_credentials(_group_id, public.current_email())
    );
$$;

-- Admin stores the ciphertext (server never sees plaintext).
CREATE OR REPLACE FUNCTION public.vault_set_payload(_group_id uuid, _ciphertext text, _iv text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_version integer;
BEGIN
  IF NOT public.is_group_admin(_group_id) THEN
    RAISE EXCEPTION 'not_group_admin';
  END IF;

  UPDATE public.groups
     SET vault_ciphertext = _ciphertext,
         vault_iv = _iv,
         vault_version = GREATEST(vault_version, 1),
         vault_updated_at = now()
   WHERE id = _group_id
  RETURNING vault_version INTO v_version;

  RETURN v_version;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vault_get_public_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_group_recipients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_get_payload(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_set_payload(uuid, text, text) TO authenticated;