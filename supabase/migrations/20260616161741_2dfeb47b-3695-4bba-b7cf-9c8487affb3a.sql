
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1) ADMIN TRUST SCORES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_trust_scores (
  user_email TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 100,
  last_bonus_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_trust_scores TO anon;
GRANT SELECT ON public.admin_trust_scores TO authenticated;
GRANT ALL ON public.admin_trust_scores TO service_role;

ALTER TABLE public.admin_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_scores_read_all"
  ON public.admin_trust_scores FOR SELECT
  USING (true);

-- ============================================================
-- 2) GROUP SLOT LOCKS (pessimistic 30s lock)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_slot_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_slot_locks_group_active
  ON public.group_slot_locks (group_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_locks_user
  ON public.group_slot_locks (user_email, expires_at);

GRANT SELECT, INSERT, DELETE ON public.group_slot_locks TO authenticated;
GRANT ALL ON public.group_slot_locks TO service_role;

ALTER TABLE public.group_slot_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_locks_own_read"
  ON public.group_slot_locks FOR SELECT
  USING (lower(user_email) = public.current_email());

-- ============================================================
-- 3) WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  service_name TEXT NOT NULL,
  plan_type TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','matched','expired','cancelled')),
  matched_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_service_status_created
  ON public.waitlist (service_name, status, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_user
  ON public.waitlist (user_email);

GRANT SELECT, INSERT, UPDATE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_own_read"
  ON public.waitlist FOR SELECT
  USING (lower(user_email) = public.current_email());

CREATE POLICY "waitlist_own_insert"
  ON public.waitlist FOR INSERT
  WITH CHECK (lower(user_email) = public.current_email());

CREATE POLICY "waitlist_own_cancel"
  ON public.waitlist FOR UPDATE
  USING (lower(user_email) = public.current_email())
  WITH CHECK (lower(user_email) = public.current_email());

-- ============================================================
-- 4) Helper: count active slots (members + active locks)
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_active_slots(_group_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT count(*)::int FROM public.memberships m
      JOIN public.groups g ON g.id = m.group_id
      WHERE m.group_id = _group_id
        AND m.payment_status IN ('paid','pending')
        AND lower(m.user_email) <> lower(g.admin_email)
    ), 0)
    +
    COALESCE((
      SELECT count(*)::int FROM public.group_slot_locks l
      WHERE l.group_id = _group_id AND l.expires_at > now()
    ), 0);
$$;

-- ============================================================
-- 5) RPC: match_and_lock_group
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_and_lock_group(
  _service_name text,
  _user_email text
) RETURNS TABLE(group_id uuid, lock_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_user_email));
  v_group_id uuid;
  v_lock_id uuid;
  v_expires timestamptz;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Reject if user already has active lock on same service
  IF EXISTS (
    SELECT 1
    FROM public.group_slot_locks l
    JOIN public.groups g ON g.id = l.group_id
    WHERE lower(l.user_email) = v_email
      AND l.expires_at > now()
      AND lower(g.service_name) = lower(_service_name)
  ) THEN
    RAISE EXCEPTION 'lock_already_exists';
  END IF;

  -- Find best candidate group
  SELECT g.id INTO v_group_id
  FROM public.groups g
  LEFT JOIN public.admin_trust_scores t ON lower(t.user_email) = lower(g.admin_email)
  WHERE g.status = 'active'
    AND g.closed_at IS NULL
    AND g.is_public = true
    AND lower(g.service_name) = lower(_service_name)
    AND public.count_active_slots(g.id) < g.max_members
    AND lower(g.admin_email) <> v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.group_id = g.id
        AND lower(m.user_email) = v_email
        AND m.payment_status IN ('paid','pending')
    )
  ORDER BY COALESCE(t.score, 100) DESC, g.created_date ASC
  FOR UPDATE OF g SKIP LOCKED
  LIMIT 1;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.group_slot_locks (group_id, user_email)
  VALUES (v_group_id, v_email)
  RETURNING id, expires_at INTO v_lock_id, v_expires;

  group_id := v_group_id;
  lock_id := v_lock_id;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_and_lock_group(text, text) TO authenticated, service_role;

-- ============================================================
-- 6) RPC: release lock
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_release_lock(_lock_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.group_slot_locks
  WHERE id = _lock_id
    AND (lower(user_email) = public.current_email() OR auth.role() = 'service_role');
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_release_lock(uuid) TO authenticated, service_role;

-- ============================================================
-- 7) RPC: confirm lock -> reserve seat
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_confirm_lock(
  _lock_id uuid,
  _user_name text,
  _user_avatar_url text
) RETURNS TABLE(membership_id uuid, group_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock record;
  v_mid uuid;
BEGIN
  SELECT * INTO v_lock FROM public.group_slot_locks WHERE id = _lock_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lock_not_found'; END IF;
  IF v_lock.expires_at < now() THEN RAISE EXCEPTION 'lock_expired'; END IF;

  -- Insert/upsert membership as pending (will be paid via webhook)
  INSERT INTO public.memberships (group_id, user_email, user_name, user_avatar_url, role, payment_status, joined_date)
  VALUES (v_lock.group_id, v_lock.user_email, _user_name, _user_avatar_url, 'member', 'pending', current_date)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_mid;

  IF v_mid IS NULL THEN
    SELECT id INTO v_mid FROM public.memberships
    WHERE group_id = v_lock.group_id AND lower(user_email) = lower(v_lock.user_email)
    LIMIT 1;
  END IF;

  DELETE FROM public.group_slot_locks WHERE id = _lock_id;

  membership_id := v_mid;
  group_id := v_lock.group_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_confirm_lock(uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- 8) Trust score automation
-- ============================================================
CREATE OR REPLACE FUNCTION public.trust_score_penalize(_admin_email text, _amount integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_admin_email));
  v_new integer;
BEGIN
  INSERT INTO public.admin_trust_scores (user_email, score)
  VALUES (v_email, GREATEST(0, 100 - _amount))
  ON CONFLICT (user_email) DO UPDATE
    SET score = GREATEST(0, public.admin_trust_scores.score - _amount),
        updated_at = now()
  RETURNING score INTO v_new;
  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trust_score_penalize(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.trust_score_award_longevity()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lower(g.admin_email) AS email
    FROM public.groups g
    WHERE g.status = 'active' AND g.closed_at IS NULL
      AND g.created_date < (now() - interval '30 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.refund_requests rr
        WHERE rr.group_id = g.id
          AND rr.created_at > (now() - interval '30 days')
      )
  LOOP
    INSERT INTO public.admin_trust_scores (user_email, score, last_bonus_at)
    VALUES (r.email, 102, now())
    ON CONFLICT (user_email) DO UPDATE
      SET score = LEAST(200, public.admin_trust_scores.score + 2),
          last_bonus_at = now(),
          updated_at = now()
    WHERE public.admin_trust_scores.last_bonus_at IS NULL
       OR public.admin_trust_scores.last_bonus_at < (now() - interval '30 days');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trust_score_award_longevity() TO service_role;

-- ============================================================
-- 9) Cleanup expired locks
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_slot_locks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH d AS (
    DELETE FROM public.group_slot_locks
    WHERE expires_at < now()
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM d;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_slot_locks() TO service_role;

-- ============================================================
-- 10) Schedule cron jobs
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-slot-locks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-slot-locks',
  '* * * * *',
  $$ SELECT public.cleanup_expired_slot_locks(); $$
);

DO $$
BEGIN
  PERFORM cron.unschedule('trust-score-longevity-bonus');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'trust-score-longevity-bonus',
  '0 3 * * *',
  $$ SELECT public.trust_score_award_longevity(); $$
);

-- updated_at trigger for waitlist & trust scores
CREATE TRIGGER tg_waitlist_updated
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tg_admin_trust_scores_updated
  BEFORE UPDATE ON public.admin_trust_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
