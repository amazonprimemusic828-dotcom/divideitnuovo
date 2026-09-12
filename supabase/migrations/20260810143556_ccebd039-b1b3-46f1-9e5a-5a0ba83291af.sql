CREATE TABLE public.user_credential_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  iterations integer NOT NULL DEFAULT 210000,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.user_credential_pins TO service_role;

ALTER TABLE public.user_credential_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to credential pins"
  ON public.user_credential_pins
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER user_credential_pins_touch
  BEFORE UPDATE ON public.user_credential_pins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();