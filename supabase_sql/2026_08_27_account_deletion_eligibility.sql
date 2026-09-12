-- ============================================================
-- DivideIt · Account deletion eligibility + auto-delete
-- Idempotent: safe to re-run
-- ============================================================

CREATE OR REPLACE FUNCTION public.account_deletion_eligibility()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _owned int := 0;
  _joined int := 0;
  _balance bigint := 0;
  _hold bigint := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'error', 'auth');
  END IF;

  SELECT lower(COALESCE(up.user_email, u.email))
    INTO _email
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id = _uid;

  SELECT count(*) INTO _owned
    FROM public.groups g
   WHERE lower(g.admin_email) = _email
     AND COALESCE(g.status,'active') <> 'closed'
     AND g.closed_at IS NULL;

  SELECT count(*) INTO _joined
    FROM public.memberships m
    JOIN public.groups g ON g.id = m.group_id
   WHERE lower(m.user_email) = _email
     AND COALESCE(m.role,'member') <> 'admin'
     AND COALESCE(g.status,'active') <> 'closed'
     AND g.closed_at IS NULL;

  SELECT COALESCE(w.balance_cents,0) INTO _balance
    FROM public.user_wallets w WHERE lower(w.user_email) = _email;

  SELECT COALESCE(sum(l.net_amount * 100)::bigint, 0) INTO _hold
    FROM public.wallet_ledger l
   WHERE lower(l.owner_email) = _email
     AND l.payout_at IS NULL
     AND l.refunded_at IS NULL
     AND COALESCE(l.status,'pending') IN ('pending','hold');

  RETURN jsonb_build_object(
    'eligible', (_owned = 0 AND _joined = 0 AND COALESCE(_balance,0) = 0 AND COALESCE(_hold,0) = 0),
    'owned_groups', _owned,
    'joined_groups', _joined,
    'balance_cents', COALESCE(_balance,0),
    'hold_cents', COALESCE(_hold,0)
  );
END; $$;

REVOKE ALL ON FUNCTION public.account_deletion_eligibility() FROM public;
GRANT EXECUTE ON FUNCTION public.account_deletion_eligibility() TO authenticated;

-- Request: blocks when not eligible, auto-deletes when fully clean
CREATE OR REPLACE FUNCTION public.account_deletion_request(_reason text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _elig jsonb;
  _keep timestamptz := now() + interval '10 years';
BEGIN
  IF _uid IS NULL THEN RETURN 'auth'; END IF;

  IF EXISTS (SELECT 1 FROM public.account_deletion_requests WHERE user_id=_uid AND status='pending') THEN
    RETURN 'exists';
  END IF;

  _elig := public.account_deletion_eligibility();
  IF NOT COALESCE((_elig->>'eligible')::boolean, false) THEN
    RETURN 'blocked';
  END IF;

  SELECT lower(COALESCE(up.user_email, u.email)) INTO _email
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON up.user_id = u.id
   WHERE u.id = _uid;

  -- Nothing outstanding: delete immediately, no operator approval needed
  INSERT INTO public.account_deletion_requests(user_id, user_email, reason, status, reviewed_at, retention_until, operator_note)
  VALUES (_uid, _email, NULLIF(btrim(_reason),''), 'approved', now(), _keep,
          'Eliminazione automatica: nessun gruppo attivo e saldo a zero');

  UPDATE public.user_profiles
     SET deleted_at = now(), deletion_purge_after = _keep, updated_at = now()
   WHERE user_id = _uid;

  IF _email IS NOT NULL THEN
    INSERT INTO public.notifications(user_email, type, title, content)
    VALUES (_email, 'system', 'Account eliminato',
      'Il tuo account è stato eliminato automaticamente. I dati obbligatori (fatturazione e pagamenti) restano conservati per il periodo previsto dalla legge, poi verranno cancellati definitivamente.');
  END IF;

  RETURN 'deleted';
END; $$;

REVOKE ALL ON FUNCTION public.account_deletion_request(text) FROM public;
GRANT EXECUTE ON FUNCTION public.account_deletion_request(text) TO authenticated;
