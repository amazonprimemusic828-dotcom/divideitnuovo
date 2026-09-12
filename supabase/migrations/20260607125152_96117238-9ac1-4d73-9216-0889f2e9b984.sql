
-- ============================================================
-- MIGRATION: Lock down RLS with real Supabase Auth (auth.email())
-- ============================================================

-- 1) Rewrite helper functions to use auth.email() (Supabase Auth)
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT lower(coalesce(auth.email(), '')) $$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND lower(admin_email) = public.current_email()
  ) AND public.current_email() <> ''
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_email() <> '' AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = _group_id AND lower(user_email) = public.current_email()
  )
$$;

-- 2) Drop ALL existing policies on data tables
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'groups','memberships','messages','notifications','payments',
        'wallet_ledger','refund_requests','audit_log',
        'support_tickets','support_messages','trust_scores','config'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) Revoke anon access on all data tables (only authenticated + service_role)
REVOKE ALL ON public.groups, public.memberships, public.messages,
              public.notifications, public.payments, public.wallet_ledger,
              public.refund_requests, public.audit_log,
              public.support_tickets, public.support_messages,
              public.trust_scores, public.config
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.groups, public.memberships, public.messages,
  public.notifications, public.payments, public.wallet_ledger,
  public.refund_requests, public.support_tickets, public.support_messages
TO authenticated;

-- Read-only for users on these
GRANT SELECT ON public.trust_scores, public.config TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated; -- own rows only via policy

GRANT ALL ON
  public.groups, public.memberships, public.messages, public.notifications,
  public.payments, public.wallet_ledger, public.refund_requests,
  public.audit_log, public.support_tickets, public.support_messages,
  public.trust_scores, public.config
TO service_role;

-- Make sure RLS is enabled
ALTER TABLE public.groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4) POLICIES
-- ============================================================

-- GROUPS -----------------------------------------------------
CREATE POLICY "groups_select_public_or_member"
ON public.groups FOR SELECT TO authenticated
USING (
  is_public = true
  OR lower(admin_email) = public.current_email()
  OR public.is_group_member(id)
);

CREATE POLICY "groups_insert_own_admin"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (lower(admin_email) = public.current_email());

CREATE POLICY "groups_update_admin"
ON public.groups FOR UPDATE TO authenticated
USING (lower(admin_email) = public.current_email())
WITH CHECK (lower(admin_email) = public.current_email());

CREATE POLICY "groups_delete_admin"
ON public.groups FOR DELETE TO authenticated
USING (lower(admin_email) = public.current_email());

-- MEMBERSHIPS ------------------------------------------------
CREATE POLICY "memberships_select_self_or_member"
ON public.memberships FOR SELECT TO authenticated
USING (
  lower(user_email) = public.current_email()
  OR public.is_group_member(group_id)
  OR public.is_group_admin(group_id)
);

CREATE POLICY "memberships_insert_self"
ON public.memberships FOR INSERT TO authenticated
WITH CHECK (lower(user_email) = public.current_email());

CREATE POLICY "memberships_update_self_or_admin"
ON public.memberships FOR UPDATE TO authenticated
USING (
  lower(user_email) = public.current_email()
  OR public.is_group_admin(group_id)
);

CREATE POLICY "memberships_delete_self_or_admin"
ON public.memberships FOR DELETE TO authenticated
USING (
  lower(user_email) = public.current_email()
  OR public.is_group_admin(group_id)
);

-- MESSAGES ---------------------------------------------------
CREATE POLICY "messages_select_group_member"
ON public.messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id) OR public.is_group_admin(group_id));

CREATE POLICY "messages_insert_group_member"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (public.is_group_member(group_id) OR public.is_group_admin(group_id));

CREATE POLICY "messages_update_own"
ON public.messages FOR UPDATE TO authenticated
USING (public.is_group_member(group_id))
WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "messages_delete_own_or_admin"
ON public.messages FOR DELETE TO authenticated
USING (public.is_group_admin(group_id));

-- NOTIFICATIONS ----------------------------------------------
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT TO authenticated
USING (lower(user_email) = public.current_email());

CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE TO authenticated
USING (lower(user_email) = public.current_email())
WITH CHECK (lower(user_email) = public.current_email());

CREATE POLICY "notifications_delete_own"
ON public.notifications FOR DELETE TO authenticated
USING (lower(user_email) = public.current_email());
-- INSERT only via service_role (edge functions)

-- PAYMENTS ---------------------------------------------------
CREATE POLICY "payments_select_own_or_group_admin"
ON public.payments FOR SELECT TO authenticated
USING (
  lower(user_email) = public.current_email()
  OR public.is_group_admin(group_id)
);
-- INSERT/UPDATE/DELETE only via service_role (Stripe edge fn)

-- WALLET_LEDGER ----------------------------------------------
CREATE POLICY "wallet_ledger_select_own"
ON public.wallet_ledger FOR SELECT TO authenticated
USING (lower(owner_email) = public.current_email());
-- INSERT/UPDATE/DELETE only via service_role

-- REFUND_REQUESTS --------------------------------------------
CREATE POLICY "refund_requests_select_own_or_admin"
ON public.refund_requests FOR SELECT TO authenticated
USING (
  lower(user_email) = public.current_email()
  OR EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = refund_requests.payment_id
      AND public.is_group_admin(p.group_id)
  )
);

CREATE POLICY "refund_requests_insert_own"
ON public.refund_requests FOR INSERT TO authenticated
WITH CHECK (lower(user_email) = public.current_email());

CREATE POLICY "refund_requests_update_admin"
ON public.refund_requests FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = refund_requests.payment_id
      AND public.is_group_admin(p.group_id)
  )
);

-- AUDIT_LOG --------------------------------------------------
CREATE POLICY "audit_log_select_own"
ON public.audit_log FOR SELECT TO authenticated
USING (lower(actor_email) = public.current_email());
-- INSERT/UPDATE/DELETE only via service_role

-- SUPPORT_TICKETS --------------------------------------------
CREATE POLICY "support_tickets_select_own"
ON public.support_tickets FOR SELECT TO authenticated
USING (lower(user_email) = public.current_email());

CREATE POLICY "support_tickets_insert_own"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (lower(user_email) = public.current_email());

CREATE POLICY "support_tickets_update_own"
ON public.support_tickets FOR UPDATE TO authenticated
USING (lower(user_email) = public.current_email())
WITH CHECK (lower(user_email) = public.current_email());

-- SUPPORT_MESSAGES -------------------------------------------
CREATE POLICY "support_messages_select_own_ticket"
ON public.support_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND lower(t.user_email) = public.current_email()
  )
);

CREATE POLICY "support_messages_insert_own_ticket"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND lower(t.user_email) = public.current_email()
  )
);

-- TRUST_SCORES -----------------------------------------------
CREATE POLICY "trust_scores_select_all_auth"
ON public.trust_scores FOR SELECT TO authenticated
USING (true);
-- writes only via service_role

-- CONFIG -----------------------------------------------------
CREATE POLICY "config_select_all_auth"
ON public.config FOR SELECT TO authenticated
USING (true);
-- writes only via service_role
