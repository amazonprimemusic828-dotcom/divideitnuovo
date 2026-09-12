-- 1. Tabella iscrizioni al contest
CREATE TABLE IF NOT EXISTS public.contest_participants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  nickname text NOT NULL,
  rules_version text NOT NULL DEFAULT 'v1',
  rules_accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contest_participants_nickname_key
  ON public.contest_participants (lower(nickname));

GRANT SELECT ON public.contest_participants TO authenticated;
GRANT ALL ON public.contest_participants TO service_role;

ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contest_select_own" ON public.contest_participants;
CREATE POLICY "contest_select_own" ON public.contest_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Impostazioni contest (tabella config esistente)
INSERT INTO public.config (key, value)
SELECT * FROM (VALUES
  ('contest_start', '2026-09-01T00:00:00+02:00'),
  ('contest_end',   '2026-11-30T23:59:59+01:00'),
  ('contest_rules_version', 'v1')
) AS v(key, value)
WHERE NOT EXISTS (SELECT 1 FROM public.config c WHERE c.key = v.key);

-- 3. Impostazioni leggibili dal client
CREATE OR REPLACE FUNCTION public.contest_settings()
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz, rules_version text, is_open boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT value::timestamptz FROM public.config WHERE key = 'contest_start'),
    (SELECT value::timestamptz FROM public.config WHERE key = 'contest_end'),
    COALESCE((SELECT value FROM public.config WHERE key = 'contest_rules_version'), 'v1'),
    now() BETWEEN (SELECT value::timestamptz FROM public.config WHERE key = 'contest_start')
              AND (SELECT value::timestamptz FROM public.config WHERE key = 'contest_end');
$$;

REVOKE ALL ON FUNCTION public.contest_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_settings() TO anon, authenticated, service_role;

-- 4. Iscrizione con accettazione obbligatoria del regolamento
CREATE OR REPLACE FUNCTION public.contest_join(_nickname text, _accept_rules boolean)
RETURNS TABLE(nickname text, rules_accepted_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := public.current_email();
  _nick text := btrim(coalesce(_nickname, ''));
  _ver text := COALESCE((SELECT value FROM public.config WHERE key = 'contest_rules_version'), 'v1');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Devi effettuare l''accesso per iscriverti al contest.';
  END IF;
  IF _accept_rules IS NOT TRUE THEN
    RAISE EXCEPTION 'Devi accettare il regolamento del contest.';
  END IF;
  IF length(_nick) < 3 OR length(_nick) > 20 THEN
    RAISE EXCEPTION 'Il nickname deve avere tra 3 e 20 caratteri.';
  END IF;
  IF _nick !~ '^[A-Za-z0-9 _.-]+$' THEN
    RAISE EXCEPTION 'Il nickname può contenere solo lettere, numeri, spazi e . _ -';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contest_participants p
    WHERE lower(p.nickname) = lower(_nick) AND p.user_id <> _uid
  ) THEN
    RAISE EXCEPTION 'Questo nickname è già in uso.';
  END IF;

  INSERT INTO public.contest_participants AS cp (user_id, user_email, nickname, rules_version, rules_accepted_at)
  VALUES (_uid, _email, _nick, _ver, now())
  ON CONFLICT (user_id) DO UPDATE
    SET nickname = EXCLUDED.nickname,
        user_email = EXCLUDED.user_email,
        rules_version = EXCLUDED.rules_version,
        rules_accepted_at = CASE
          WHEN cp.rules_version = EXCLUDED.rules_version THEN cp.rules_accepted_at
          ELSE now() END,
        updated_at = now();

  RETURN QUERY
    SELECT p.nickname, p.rules_accepted_at
    FROM public.contest_participants p
    WHERE p.user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.contest_join(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_join(text, boolean) TO authenticated, service_role;

-- 5. Conteggio "Utenti Attivi": 2 mensilità pagate nel periodo del contest
CREATE OR REPLACE FUNCTION public.contest_active_users(_referrer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT (SELECT value::timestamptz FROM public.config WHERE key = 'contest_start') AS s,
           (SELECT value::timestamptz FROM public.config WHERE key = 'contest_end') AS e
  )
  SELECT COALESCE(count(*), 0)::int FROM (
    SELECT r.referred_email
    FROM public.referrals r, w
    WHERE r.referrer_id = _referrer_id
      AND r.status = 'confirmed'
      AND r.created_at >= w.s
      AND r.created_at <= w.e
    GROUP BY r.referred_email
    HAVING (
      SELECT count(DISTINCT COALESCE(p.billing_month, p.id::text))
      FROM public.payments p, w
      WHERE lower(p.user_email) = lower(r.referred_email)
        AND p.status = 'paid'
        AND p.created_date >= w.s
    ) >= 2
  ) q;
$$;

REVOKE ALL ON FUNCTION public.contest_active_users(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_active_users(uuid) TO authenticated, service_role;

-- 6. Classifica pubblica: solo nickname, nessun dato identificativo
CREATE OR REPLACE FUNCTION public.contest_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(rank_position integer, nickname text, active_users integer, is_me boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY t.active_users DESC, t.joined ASC)::int AS rank_position,
    t.nickname,
    t.active_users,
    t.user_id = auth.uid() AS is_me
  FROM (
    SELECT p.user_id, p.nickname, p.created_at AS joined,
           public.contest_active_users(p.user_id) AS active_users
    FROM public.contest_participants p
  ) t
  ORDER BY t.active_users DESC, t.joined ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;

REVOKE ALL ON FUNCTION public.contest_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_leaderboard(integer) TO anon, authenticated, service_role;

-- 7. La propria iscrizione + conteggio personale
CREATE OR REPLACE FUNCTION public.contest_my_entry()
RETURNS TABLE(nickname text, rules_version text, rules_accepted_at timestamptz, active_users integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nickname, p.rules_version, p.rules_accepted_at,
         public.contest_active_users(p.user_id)
  FROM public.contest_participants p
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.contest_my_entry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contest_my_entry() TO authenticated, service_role;