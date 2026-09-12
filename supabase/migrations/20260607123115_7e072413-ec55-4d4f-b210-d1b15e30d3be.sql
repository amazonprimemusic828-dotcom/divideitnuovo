ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

INSERT INTO public.config (key, value) VALUES
  ('joiner_fee_cents', '99'),
  ('admin_payout_fee_percent', '0'),
  ('min_payout_cents', '1000'),
  ('hold_days', '25'),
  ('dunning_max_attempts', '3'),
  ('admin_emails', 'calcium9282@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;