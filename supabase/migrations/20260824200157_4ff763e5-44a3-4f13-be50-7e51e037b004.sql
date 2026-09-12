-- 1. referral code on profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_referral_code_key
  ON public.user_profiles (upper(referral_code)) WHERE referral_code IS NOT NULL;

-- 2. referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referrer_email text NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  referred_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CONSTRAINT no_self_referral CHECK (referrer_id <> referred_id),
  CONSTRAINT referrals_status_check CHECK (status IN ('pending','confirmed','rejected'))
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select_own" ON public.referrals;
CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);

-- 3. wallet_transactions: link to referral (idempotency backstop)
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS source_referral_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_source_referral_key
  ON public.wallet_transactions (source_referral_id) WHERE source_referral_id IS NOT NULL;

-- 4. get or create my referral code
CREATE OR REPLACE FUNCTION public.referral_get_my_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  em text;
  v_code text;
  v_try text;
  i int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT referral_code INTO v_code FROM public.user_profiles WHERE user_id = uid;
  IF v_code IS NOT NULL AND v_code <> '' THEN RETURN v_code; END IF;

  SELECT lower(email) INTO em FROM auth.users WHERE id = uid;

  LOOP
    i := i + 1;
    v_try := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=OI01lL', 'ABCDXYZWQ'), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE upper(referral_code) = v_try
    ) OR i > 20;
  END LOOP;

  PERFORM set_config('app.trusted_profile_write', 'on', true);
  INSERT INTO public.user_profiles (user_id, user_email, referral_code)
  VALUES (uid, em, v_try)
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.user_profiles.referral_code, v_try)
  RETURNING referral_code INTO v_code;
  PERFORM set_config('app.trusted_profile_write', 'off', true);

  RETURN v_code;
END $$;

REVOKE ALL ON FUNCTION public.referral_get_my_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_get_my_code() TO authenticated, service_role;

-- 5. claim referral (called right after signup / oauth callback)
CREATE OR REPLACE FUNCTION public.claim_referral(code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(code, '')));
  v_ref_user uuid;
  v_ref_email text;
  v_my_email text;
  v_created timestamptz;
BEGIN
  IF uid IS NULL OR v_code = '' THEN RETURN 'ignored'; END IF;

  SELECT p.user_id, lower(coalesce(p.user_email, u.email))
    INTO v_ref_user, v_ref_email
  FROM public.user_profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE upper(p.referral_code) = v_code
  LIMIT 1;

  IF v_ref_user IS NULL OR v_ref_user = uid THEN RETURN 'ignored'; END IF;

  SELECT created_at, lower(email) INTO v_created, v_my_email
  FROM auth.users WHERE id = uid;

  -- anti-abuse: only brand new accounts can claim
  IF v_created IS NULL OR v_created < now() - interval '1 hour' THEN RETURN 'too_late'; END IF;

  INSERT INTO public.referrals (referrer_id, referrer_email, referred_id, referred_email)
  VALUES (v_ref_user, coalesce(v_ref_email, ''), uid, coalesce(v_my_email, ''))
  ON CONFLICT (referred_id) DO NOTHING;

  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated, service_role;

-- 6. confirm + credit when the referred user joins a group
CREATE OR REPLACE FUNCTION public.confirm_referral_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_uid uuid;
  v_today_count int;
  v_tx uuid;
  v_updated int;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(NEW.user_email) LIMIT 1;
  IF v_uid IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO r FROM public.referrals
   WHERE referred_id = v_uid AND status = 'pending'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- daily cap: max 10 confirmed bonuses per referrer per day
  SELECT count(*) INTO v_today_count FROM public.referrals
   WHERE referrer_id = r.referrer_id
     AND status = 'confirmed'
     AND confirmed_at > now() - interval '24 hours';
  IF v_today_count >= 10 THEN RETURN NEW; END IF;

  UPDATE public.referrals
     SET status = 'confirmed', confirmed_at = now()
   WHERE id = r.id AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_referral_id = r.id) THEN
    RETURN NEW;
  END IF;

  SELECT w.tx_id INTO v_tx
  FROM public.wallet_credit(
    r.referrer_email, 100, 'referral_bonus',
    'Bonus invito amico', NULL, NEW.group_id, NULL, NULL, 'system'
  ) w;

  UPDATE public.wallet_transactions SET source_referral_id = r.id WHERE id = v_tx;

  INSERT INTO public.notifications (user_email, type, title, content, link, group_id, read, created_date)
  VALUES (r.referrer_email, 'referral', 'Bonus invito accreditato',
          'Un amico che hai invitato è entrato in un gruppo: +1,00 € nel tuo portafoglio.',
          '/Referral', NEW.group_id, false, now());

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_confirm_referral ON public.memberships;
CREATE TRIGGER trg_confirm_referral
AFTER INSERT ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.confirm_referral_on_join();

-- 7. summary for the referral page
CREATE OR REPLACE FUNCTION public.referral_my_summary()
RETURNS TABLE(
  referral_code text,
  total_invites int,
  pending_invites int,
  confirmed_invites int,
  earned_cents bigint,
  pending_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT p.referral_code FROM public.user_profiles p WHERE p.user_id = auth.uid()),
    (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = auth.uid()),
    (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = auth.uid() AND r.status = 'pending'),
    (SELECT count(*)::int FROM public.referrals r WHERE r.referrer_id = auth.uid() AND r.status = 'confirmed'),
    (SELECT COALESCE(sum(t.amount_cents), 0)::bigint FROM public.wallet_transactions t
      WHERE t.type = 'referral_bonus'
        AND t.source_referral_id IN (SELECT r.id FROM public.referrals r WHERE r.referrer_id = auth.uid())),
    (SELECT (count(*) * 100)::bigint FROM public.referrals r WHERE r.referrer_id = auth.uid() AND r.status = 'pending')
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.referral_my_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_my_summary() TO authenticated, service_role;