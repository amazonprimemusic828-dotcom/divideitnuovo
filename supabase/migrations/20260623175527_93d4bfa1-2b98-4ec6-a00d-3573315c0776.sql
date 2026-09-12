
-- USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  phone_e164 TEXT,
  phone_verified_at TIMESTAMPTZ,
  trust_level INT NOT NULL DEFAULT 0,
  trust_badges TEXT[] NOT NULL DEFAULT '{}',
  notify_email BOOL NOT NULL DEFAULT true,
  notify_push BOOL NOT NULL DEFAULT true,
  notify_marketing BOOL NOT NULL DEFAULT false,
  notify_new_member BOOL NOT NULL DEFAULT true,
  notify_payment BOOL NOT NULL DEFAULT true,
  notify_chat BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_profiles_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS user_profiles_touch ON public.user_profiles;
CREATE TRIGGER user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_touch_updated_at();

-- PHONE VERIFICATIONS
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_verifications_user_created
  ON public.phone_verifications (user_id, created_at DESC);

GRANT SELECT ON public.phone_verifications TO authenticated;
GRANT ALL ON public.phone_verifications TO service_role;

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phone_verifications_select_own" ON public.phone_verifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- TRUST BADGES helper
CREATE OR REPLACE FUNCTION public.award_trust_badge(_user_id UUID, _badge TEXT, _points INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, trust_badges, trust_level)
  VALUES (_user_id, ARRAY[_badge], LEAST(100, GREATEST(0, _points)))
  ON CONFLICT (user_id) DO UPDATE
  SET trust_badges = CASE
        WHEN _badge = ANY(public.user_profiles.trust_badges)
          THEN public.user_profiles.trust_badges
        ELSE array_append(public.user_profiles.trust_badges, _badge)
      END,
      trust_level = CASE
        WHEN _badge = ANY(public.user_profiles.trust_badges)
          THEN public.user_profiles.trust_level
        ELSE LEAST(100, public.user_profiles.trust_level + _points)
      END,
      updated_at = now();
END $$;

-- Trigger: payment success -> +15 payment_verified
CREATE OR REPLACE FUNCTION public.trust_on_paid_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(NEW.user_email) LIMIT 1;
    IF v_uid IS NOT NULL THEN
      PERFORM public.award_trust_badge(v_uid, 'payment_verified', 15);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trust_payments_paid ON public.payments;
CREATE TRIGGER trust_payments_paid AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trust_on_paid_payment();
