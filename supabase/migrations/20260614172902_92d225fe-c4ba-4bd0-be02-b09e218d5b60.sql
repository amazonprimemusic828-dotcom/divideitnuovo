
-- Wallet closed-loop: tabelle credito utente + RPC atomiche

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_email text PRIMARY KEY,
  user_id uuid,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  total_credited_cents bigint NOT NULL DEFAULT 0,
  total_spent_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet" ON public.user_wallets
  FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  user_id uuid,
  type text NOT NULL CHECK (type IN ('refund_credit','checkout_spend','spend_reversal','adjustment')),
  amount_cents bigint NOT NULL, -- positivo = accredito, negativo = spesa
  balance_after_cents bigint NOT NULL,
  source_payment_id uuid,
  source_group_id uuid,
  source_ticket_id uuid,
  source_session_id text,
  description text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_email ON public.wallet_transactions (lower(user_email), created_at DESC);

GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());

-- RPC: accredita
CREATE OR REPLACE FUNCTION public.wallet_credit(
  _user_email text,
  _amount_cents bigint,
  _type text,
  _description text DEFAULT NULL,
  _source_payment_id uuid DEFAULT NULL,
  _source_group_id uuid DEFAULT NULL,
  _source_ticket_id uuid DEFAULT NULL,
  _source_session_id text DEFAULT NULL,
  _created_by text DEFAULT NULL
) RETURNS TABLE(balance_cents bigint, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(_user_email));
  v_new_balance bigint;
  v_tx_id uuid;
BEGIN
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  INSERT INTO public.user_wallets (user_email, balance_cents, total_credited_cents)
    VALUES (v_email, _amount_cents, _amount_cents)
    ON CONFLICT (user_email) DO UPDATE
      SET balance_cents = public.user_wallets.balance_cents + EXCLUDED.balance_cents,
          total_credited_cents = public.user_wallets.total_credited_cents + EXCLUDED.balance_cents,
          updated_at = now()
    RETURNING public.user_wallets.balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_transactions (user_email, type, amount_cents, balance_after_cents,
    source_payment_id, source_group_id, source_ticket_id, source_session_id, description, created_by)
    VALUES (v_email, _type, _amount_cents, v_new_balance,
      _source_payment_id, _source_group_id, _source_ticket_id, _source_session_id, _description, _created_by)
    RETURNING id INTO v_tx_id;

  balance_cents := v_new_balance; tx_id := v_tx_id; RETURN NEXT;
END $$;

-- RPC: spendi (atomico con lock)
CREATE OR REPLACE FUNCTION public.wallet_spend(
  _user_email text,
  _amount_cents bigint,
  _type text DEFAULT 'checkout_spend',
  _description text DEFAULT NULL,
  _source_group_id uuid DEFAULT NULL,
  _source_session_id text DEFAULT NULL
) RETURNS TABLE(balance_cents bigint, tx_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(trim(_user_email));
  v_current bigint;
  v_new_balance bigint;
  v_tx_id uuid;
BEGIN
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  SELECT w.balance_cents INTO v_current FROM public.user_wallets w
    WHERE w.user_email = v_email FOR UPDATE;
  IF v_current IS NULL OR v_current < _amount_cents THEN
    RAISE EXCEPTION 'insufficient_wallet_balance';
  END IF;
  v_new_balance := v_current - _amount_cents;
  UPDATE public.user_wallets
    SET balance_cents = v_new_balance,
        total_spent_cents = total_spent_cents + _amount_cents,
        updated_at = now()
    WHERE user_email = v_email;

  INSERT INTO public.wallet_transactions (user_email, type, amount_cents, balance_after_cents,
    source_group_id, source_session_id, description)
    VALUES (v_email, _type, -_amount_cents, v_new_balance,
      _source_group_id, _source_session_id, _description)
    RETURNING id INTO v_tx_id;

  balance_cents := v_new_balance; tx_id := v_tx_id; RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.wallet_get_balance(_user_email text)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(balance_cents, 0) FROM public.user_wallets
    WHERE user_email = lower(trim(_user_email));
$$;

REVOKE ALL ON FUNCTION public.wallet_credit FROM public;
REVOKE ALL ON FUNCTION public.wallet_spend FROM public;
GRANT EXECUTE ON FUNCTION public.wallet_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_spend TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_get_balance TO authenticated, service_role;
