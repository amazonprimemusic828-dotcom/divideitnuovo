
-- Groups: credentials cifrate, prezzo Stripe, chiusura
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS credentials_ciphertext text,
  ADD COLUMN IF NOT EXISTS credentials_iv text,
  ADD COLUMN IF NOT EXISTS credentials_tag text,
  ADD COLUMN IF NOT EXISTS credentials_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Memberships: subscription/customer Stripe + dunning
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_attempts integer NOT NULL DEFAULT 0;

-- Race condition lock sui posti
CREATE OR REPLACE FUNCTION public.reserve_group_seat(
  _group_id uuid,
  _user_email text,
  _user_name text,
  _user_avatar_url text
)
RETURNS TABLE(membership_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_count integer;
  v_existing record;
  v_new_id uuid;
  v_email text := lower(trim(_user_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Lock atomico sulla riga del gruppo
  SELECT id, max_members, status, closed_at, admin_email
    INTO v_group
  FROM public.groups
  WHERE id = _group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  IF v_group.status <> 'active' OR v_group.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'group_closed';
  END IF;

  -- Già membro?
  SELECT id, payment_status INTO v_existing
  FROM public.memberships
  WHERE group_id = _group_id AND lower(user_email) = v_email
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.payment_status = 'paid' THEN
      RAISE EXCEPTION 'already_member';
    END IF;
    -- Ri-uso la membership pending esistente
    RETURN QUERY SELECT v_existing.id, 'reused'::text;
    RETURN;
  END IF;

  -- Conta posti occupati (paid o pending) escluso l'admin
  SELECT count(*) INTO v_count
  FROM public.memberships
  WHERE group_id = _group_id
    AND payment_status IN ('paid', 'pending')
    AND lower(user_email) <> lower(v_group.admin_email);

  -- L'admin occupa 1 posto implicito
  IF v_count + 1 >= v_group.max_members THEN
    RAISE EXCEPTION 'seat_full';
  END IF;

  -- Inserisco membership pending
  INSERT INTO public.memberships (
    group_id, user_email, user_name, user_avatar_url,
    role, payment_status, joined_date
  )
  VALUES (
    _group_id, v_email, _user_name, _user_avatar_url,
    'member', 'pending', current_date
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, 'reserved'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_group_seat(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_group_seat(uuid, text, text, text) TO authenticated, service_role;

-- Indici utili
CREATE INDEX IF NOT EXISTS idx_memberships_group_status ON public.memberships(group_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_memberships_stripe_sub ON public.memberships(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_groups_closed_at ON public.groups(closed_at);
