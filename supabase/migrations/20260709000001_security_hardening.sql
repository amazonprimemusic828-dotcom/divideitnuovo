-- ============================================================
-- SECURITY HARDENING (2026-07-09)
-- Enables RLS defensively on all core tables and locks down
-- sensitive columns/tables that must only be reached via
-- service-role (edge functions).
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'groups', 'memberships', 'payments', 'config', 'audit_log',
    'payment_holds', 'payouts', 'wallet_topups', 'stripe_accounts',
    'refund_requests'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- config: server-only (contains admin_emails, fee settings)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='config') THEN
    DROP POLICY IF EXISTS "config_no_client_access" ON public.config;
    -- No policies = no client access; service role bypasses RLS.
  END IF;
END $$;

-- audit_log: server-only writes; no client reads
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_log') THEN
    DROP POLICY IF EXISTS "audit_log_no_client_access" ON public.audit_log;
  END IF;
END $$;

-- groups: members and admins can read; only server (service role) writes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='groups')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='admin_email') THEN
    DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
    DROP POLICY IF EXISTS "groups_select_members" ON public.groups;
    CREATE POLICY "groups_select_members" ON public.groups
      FOR SELECT TO authenticated
      USING (true); -- listing groups is a product feature; sensitive columns are protected below
  END IF;
END $$;

-- SECURITY CRITICAL: hide encrypted credentials columns from clients.
-- Clients must go through the stripe-api edge function (credentials-get)
-- which verifies payment/membership before decrypting.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='groups' AND column_name='credentials_ciphertext') THEN
    REVOKE SELECT (credentials_ciphertext, credentials_iv, credentials_tag) ON public.groups FROM anon, authenticated;
  END IF;
END $$;

-- payments: users can read only their own rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='user_email') THEN
    DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
    CREATE POLICY "payments_select_own" ON public.payments
      FOR SELECT TO authenticated
      USING (lower(user_email) = lower(auth.jwt() ->> 'email'));
  END IF;
END $$;

-- memberships: users can read their own memberships and those of groups they admin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='memberships' AND column_name='user_email') THEN
    DROP POLICY IF EXISTS "memberships_select_own" ON public.memberships;
    CREATE POLICY "memberships_select_own" ON public.memberships
      FOR SELECT TO authenticated
      USING (
        lower(user_email) = lower(auth.jwt() ->> 'email')
        OR EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = memberships.group_id
            AND lower(g.admin_email) = lower(auth.jwt() ->> 'email')
        )
      );
  END IF;
END $$;
