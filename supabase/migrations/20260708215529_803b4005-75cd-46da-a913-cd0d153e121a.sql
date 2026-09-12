
-- Global monthly SMS counter
CREATE TABLE IF NOT EXISTS public.sms_quota_monthly (
  year_month TEXT PRIMARY KEY,
  sent_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_quota_monthly TO authenticated;
GRANT ALL ON public.sms_quota_monthly TO service_role;

ALTER TABLE public.sms_quota_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_quota_read_all_auth" ON public.sms_quota_monthly
  FOR SELECT TO authenticated USING (true);

-- Atomic guard: checks user 24h window (max 3) + global monthly cap (10000).
-- If allowed, records an attempt and increments the monthly counter in one shot.
CREATE OR REPLACE FUNCTION public.sms_guard_try_consume(
  _user_id UUID,
  _phone TEXT,
  _monthly_cap INT DEFAULT 10000,
  _user_cap INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ym TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  user_count INT;
  first_in_window TIMESTAMPTZ;
  current_count INT;
BEGIN
  SELECT COUNT(*), MIN(created_at)
    INTO user_count, first_in_window
  FROM public.phone_verifications
  WHERE user_id = _user_id
    AND created_at > now() - interval '24 hours';

  IF user_count >= _user_cap THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'user_blocked',
      'blocked_until', (first_in_window + interval '24 hours')
    );
  END IF;

  INSERT INTO public.sms_quota_monthly (year_month, sent_count)
  VALUES (ym, 0)
  ON CONFLICT (year_month) DO NOTHING;

  SELECT sent_count INTO current_count
  FROM public.sms_quota_monthly
  WHERE year_month = ym FOR UPDATE;

  IF current_count >= _monthly_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_quota_exceeded');
  END IF;

  UPDATE public.sms_quota_monthly
     SET sent_count = sent_count + 1, updated_at = now()
   WHERE year_month = ym;

  INSERT INTO public.phone_verifications (user_id, phone_e164, code_hash, expires_at)
  VALUES (_user_id, _phone, 'firebase', now() + interval '10 minutes');

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_user', _user_cap - user_count - 1,
    'remaining_monthly', _monthly_cap - current_count - 1
  );
END;
$$;

-- Mark a phone as verified for the current user (called after Firebase confirms OTP).
CREATE OR REPLACE FUNCTION public.mark_phone_verified(_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  em TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT email INTO em FROM auth.users WHERE id = uid;

  INSERT INTO public.user_profiles (user_id, user_email, phone_e164, phone_verified_at, trust_badges)
  VALUES (uid, em, _phone, now(), ARRAY['phone_verified'])
  ON CONFLICT (user_id) DO UPDATE
    SET phone_e164 = _phone,
        phone_verified_at = now(),
        trust_badges = CASE
          WHEN 'phone_verified' = ANY(public.user_profiles.trust_badges)
            THEN public.user_profiles.trust_badges
          ELSE array_append(public.user_profiles.trust_badges, 'phone_verified')
        END;

  UPDATE public.phone_verifications
     SET verified_at = now()
   WHERE user_id = uid AND verified_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sms_guard_try_consume(UUID, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_phone_verified(TEXT) TO authenticated;
