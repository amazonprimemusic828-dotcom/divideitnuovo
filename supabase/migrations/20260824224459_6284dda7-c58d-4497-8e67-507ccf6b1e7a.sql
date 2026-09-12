CREATE TABLE public.youtube_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  nickname text,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'qualified',
  google_email text,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  email_submitted_at timestamptz,
  invited_at timestamptz,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT youtube_rewards_user_unique UNIQUE (user_id)
);

CREATE INDEX youtube_rewards_month_idx ON public.youtube_rewards (month);

GRANT SELECT ON public.youtube_rewards TO authenticated;
GRANT ALL ON public.youtube_rewards TO service_role;

ALTER TABLE public.youtube_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reward readable" ON public.youtube_rewards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER youtube_rewards_touch
  BEFORE UPDATE ON public.youtube_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- posti rimasti nel mese corrente (unica fonte di verità)
CREATE OR REPLACE FUNCTION public.youtube_slots_left()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(0, 50 - (
    SELECT count(*)::int FROM public.youtube_rewards
     WHERE month = to_char(now(), 'YYYY-MM')
  ));
$$;

REVOKE ALL ON FUNCTION public.youtube_slots_left() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_slots_left() TO authenticated, anon, service_role;

-- prenota uno slot alla qualifica (3 amici confermati: pagamento + ingresso gruppo)
CREATE OR REPLACE FUNCTION public.youtube_try_qualify(_user_id uuid, _user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
  v_confirmed int;
  v_used int;
  v_nick text;
  v_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.youtube_rewards WHERE user_id = _user_id) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::int INTO v_confirmed
    FROM public.referrals r
    JOIN public.memberships m ON lower(m.user_email) = lower(r.referred_email)
   WHERE r.referrer_id = _user_id
     AND r.status = 'confirmed'
     AND m.payment_status = 'paid'
     AND m.group_id IS NOT NULL;

  IF v_confirmed < 3 THEN RETURN NULL; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('youtube_rewards_' || v_month));

  SELECT count(*)::int INTO v_used FROM public.youtube_rewards WHERE month = v_month;
  IF v_used >= 50 THEN RETURN NULL; END IF;

  SELECT nickname INTO v_nick FROM public.contest_participants WHERE user_id = _user_id;

  INSERT INTO public.youtube_rewards (user_id, user_email, nickname, month, status)
  VALUES (_user_id, _user_email, v_nick, v_month, 'qualified')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_email, type, title, content, link, read, created_date)
    VALUES (_user_email, 'referral', 'Hai sbloccato YouTube Premium!',
            'Inserisci la tua email Google nella pagina Invita: riceverai l''invito entro 24 ore.',
            '/Referral', false, now());
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.youtube_try_qualify(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_try_qualify(uuid, text) TO service_role;

-- stato personale premio + contatore
CREATE OR REPLACE FUNCTION public.youtube_my_status()
RETURNS TABLE(slots_left integer, confirmed_friends integer, reward_id uuid, status text, google_email text, invited_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.youtube_slots_left(),
    (SELECT count(*)::int
       FROM public.referrals r
       JOIN public.memberships m ON lower(m.user_email) = lower(r.referred_email)
      WHERE r.referrer_id = auth.uid() AND r.status = 'confirmed'
        AND m.payment_status = 'paid' AND m.group_id IS NOT NULL),
    y.id, y.status, y.google_email, y.invited_at
  FROM (SELECT 1) x
  LEFT JOIN public.youtube_rewards y ON y.user_id = auth.uid()
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.youtube_my_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_my_status() TO authenticated, service_role;

-- l'utente invia la propria email Google
CREATE OR REPLACE FUNCTION public.youtube_submit_email(_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN 'invalid_email'; END IF;

  UPDATE public.youtube_rewards
     SET google_email = lower(trim(_email)),
         status = CASE WHEN status = 'invited' THEN status ELSE 'email_submitted' END,
         email_submitted_at = now()
   WHERE user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN 'not_qualified'; END IF;
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.youtube_submit_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_submit_email(text) TO authenticated;

-- elenco admin
CREATE OR REPLACE FUNCTION public.youtube_admin_list()
RETURNS TABLE(id uuid, user_email text, nickname text, google_email text, month text, status text,
              qualified_at timestamptz, email_submitted_at timestamptz, invited_at timestamptz, slots_left integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT y.id, y.user_email, y.nickname, y.google_email, y.month, y.status,
         y.qualified_at, y.email_submitted_at, y.invited_at, public.youtube_slots_left()
  FROM public.youtube_rewards y
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY (y.status = 'email_submitted') DESC, y.email_submitted_at DESC NULLS LAST, y.qualified_at DESC;
$$;

REVOKE ALL ON FUNCTION public.youtube_admin_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_admin_list() TO authenticated;

-- admin segna come invitato
CREATE OR REPLACE FUNCTION public.youtube_mark_invited(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN 'forbidden'; END IF;
  UPDATE public.youtube_rewards
     SET status = 'invited', invited_at = now(), invited_by = auth.uid()
   WHERE id = _id
   RETURNING user_email INTO v_email;
  IF v_email IS NULL THEN RETURN 'not_found'; END IF;

  INSERT INTO public.notifications (user_email, type, title, content, link, read, created_date)
  VALUES (v_email, 'referral', 'Invito YouTube Premium inviato',
          'Controlla la tua casella Google: l''invito a YouTube Premium è stato inviato.',
          '/Referral', false, now());
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.youtube_mark_invited(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.youtube_mark_invited(uuid) TO authenticated;

-- aggancio alla conferma referral esistente
CREATE OR REPLACE FUNCTION public.confirm_referral_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE source_referral_id = r.id) THEN
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
  END IF;

  -- premio YouTube Premium: prenota lo slot alla terza conferma
  PERFORM public.youtube_try_qualify(r.referrer_id, r.referrer_email);

  RETURN NEW;
END $function$;