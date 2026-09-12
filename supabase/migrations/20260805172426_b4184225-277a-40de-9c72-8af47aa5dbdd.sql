ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS address_country text,
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  kind text NOT NULL,
  group_id uuid,
  dedupe_key text NOT NULL UNIQUE,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_send_log_service_only"
  ON public.email_send_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient_kind
  ON public.email_send_log (recipient_email, kind, created_at DESC);