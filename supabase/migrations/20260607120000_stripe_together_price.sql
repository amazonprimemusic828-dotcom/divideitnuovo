-- ============================================================
-- DivideIt · Together Price model migration
-- Run with: supabase db push  (after copying into your own supabase/migrations/)
-- Or: psql "$DATABASE_URL" -f supabase_sql/2026_06_07_stripe_together_price.sql
-- ============================================================

-- 1. Group account state
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Track stripe transfer id on ledger
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text;

-- 3. Seed config defaults (idempotent)
INSERT INTO public.config (key, value) VALUES
  ('joiner_fee_cents', '99'),
  ('admin_payout_fee_percent', '0'),
  ('min_payout_cents', '1000'),
  ('hold_days', '25'),
  ('dunning_max_attempts', '3'),
  ('admin_emails', '')
ON CONFLICT (key) DO NOTHING;

-- 4. Set admin_emails: REPLACE with your admin email(s), comma-separated
-- UPDATE public.config SET value = 'tu@divideit.app,altro@admin.com' WHERE key = 'admin_emails';
