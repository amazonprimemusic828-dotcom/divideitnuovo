
-- ============================================================
-- HARDENING: replace permissive USING(true) policies
-- Auth model: app uses email as primary user identifier
-- ============================================================

-- Helpers (stable + security definer)
CREATE OR REPLACE FUNCTION public.current_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND lower(admin_email) = public.current_email()
  ) AND public.current_email() <> ''
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_email() <> '' AND EXISTS (
    SELECT 1 FROM public.memberships
    WHERE group_id = _group_id AND lower(user_email) = public.current_email()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_email() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_email() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;

-- ============================================================
-- AUDIT LOG
-- ============================================================
DROP POLICY IF EXISTS "Audit readable" ON public.audit_log;
DROP POLICY IF EXISTS "Audit insertable" ON public.audit_log;
CREATE POLICY "audit_select_own" ON public.audit_log FOR SELECT TO authenticated
  USING (lower(actor_email) = public.current_email());
-- INSERT only via service_role (no policy for authenticated)

-- ============================================================
-- GROUPS
-- ============================================================
DROP POLICY IF EXISTS "Public groups readable" ON public.groups;
DROP POLICY IF EXISTS "All authenticated can insert" ON public.groups;
DROP POLICY IF EXISTS "Admin can update own groups" ON public.groups;
DROP POLICY IF EXISTS "Admin can delete own groups" ON public.groups;
CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated, anon
  USING (
    is_public = true
    OR lower(admin_email) = public.current_email()
    OR public.is_group_member(id)
  );
CREATE POLICY "groups_insert_admin" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (lower(admin_email) = public.current_email());
CREATE POLICY "groups_update_admin" ON public.groups FOR UPDATE TO authenticated
  USING (lower(admin_email) = public.current_email())
  WITH CHECK (lower(admin_email) = public.current_email());
CREATE POLICY "groups_delete_admin" ON public.groups FOR DELETE TO authenticated
  USING (lower(admin_email) = public.current_email());

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
DROP POLICY IF EXISTS "All authenticated can read memberships" ON public.memberships;
DROP POLICY IF EXISTS "All authenticated can insert memberships" ON public.memberships;
DROP POLICY IF EXISTS "Can update memberships" ON public.memberships;
DROP POLICY IF EXISTS "Can delete memberships" ON public.memberships;
CREATE POLICY "memberships_select" ON public.memberships FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email() OR public.is_group_admin(group_id));
CREATE POLICY "memberships_insert" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = public.current_email() OR public.is_group_admin(group_id));
CREATE POLICY "memberships_update" ON public.memberships FOR UPDATE TO authenticated
  USING (lower(user_email) = public.current_email() OR public.is_group_admin(group_id))
  WITH CHECK (lower(user_email) = public.current_email() OR public.is_group_admin(group_id));
CREATE POLICY "memberships_delete" ON public.memberships FOR DELETE TO authenticated
  USING (lower(user_email) = public.current_email() OR public.is_group_admin(group_id));

-- ============================================================
-- MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can delete messages" ON public.messages;
CREATE POLICY "messages_select_member" ON public.messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id) OR public.is_group_admin(group_id));
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id) OR public.is_group_admin(group_id));
-- No UPDATE/DELETE for users; service_role bypasses RLS for moderation

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "All authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Can delete notifications" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (lower(user_email) = public.current_email())
  WITH CHECK (lower(user_email) = public.current_email());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (lower(user_email) = public.current_email());
-- INSERT only via service_role

-- ============================================================
-- PAYMENTS
-- ============================================================
DROP POLICY IF EXISTS "Users can read payments" ON public.payments;
DROP POLICY IF EXISTS "All authenticated can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Can update payments" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated
  USING (
    lower(user_email) = public.current_email()
    OR (group_id IS NOT NULL AND public.is_group_admin(group_id))
  );
-- INSERT/UPDATE only via service_role (edge functions)

-- ============================================================
-- REFUND REQUESTS
-- ============================================================
DROP POLICY IF EXISTS "Users read own refunds" ON public.refund_requests;
DROP POLICY IF EXISTS "Can insert refunds" ON public.refund_requests;
DROP POLICY IF EXISTS "Can update refunds" ON public.refund_requests;
CREATE POLICY "refunds_select_own" ON public.refund_requests FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());
CREATE POLICY "refunds_insert_own" ON public.refund_requests FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = public.current_email());
-- UPDATE only via service_role (admin via edge function)

-- ============================================================
-- WALLET LEDGER
-- ============================================================
DROP POLICY IF EXISTS "Users read own wallet" ON public.wallet_ledger;
DROP POLICY IF EXISTS "Can insert wallet" ON public.wallet_ledger;
DROP POLICY IF EXISTS "Can update wallet" ON public.wallet_ledger;
CREATE POLICY "wallet_select_own" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (lower(owner_email) = public.current_email());
-- INSERT/UPDATE only via service_role

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
DROP POLICY IF EXISTS "Support tickets accessible" ON public.support_tickets;
DROP POLICY IF EXISTS "Support tickets insertable" ON public.support_tickets;
DROP POLICY IF EXISTS "Support tickets updatable" ON public.support_tickets;
CREATE POLICY "tickets_select_own" ON public.support_tickets FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());
CREATE POLICY "tickets_insert_own" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = public.current_email());
CREATE POLICY "tickets_update_own" ON public.support_tickets FOR UPDATE TO authenticated
  USING (lower(user_email) = public.current_email())
  WITH CHECK (lower(user_email) = public.current_email());

-- ============================================================
-- SUPPORT MESSAGES
-- ============================================================
DROP POLICY IF EXISTS "Support messages accessible" ON public.support_messages;
DROP POLICY IF EXISTS "Support messages insertable" ON public.support_messages;
CREATE POLICY "support_msg_select_own" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND lower(t.user_email) = public.current_email()
  ));
CREATE POLICY "support_msg_insert_own" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND lower(t.user_email) = public.current_email()
  ));

-- ============================================================
-- TRUST SCORES
-- ============================================================
DROP POLICY IF EXISTS "All can read trust_scores" ON public.trust_scores;
DROP POLICY IF EXISTS "All authenticated can insert trust_scores" ON public.trust_scores;
DROP POLICY IF EXISTS "Users can update own trust_scores" ON public.trust_scores;
CREATE POLICY "trust_select_all" ON public.trust_scores FOR SELECT TO authenticated, anon
  USING (true);
-- INSERT/UPDATE only via service_role

-- ============================================================
-- STRIPE WEBHOOK EVENTS - enable RLS, no policies (service_role only)
-- ============================================================
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIX SEARCH_PATH on existing SECURITY DEFINER / trigger functions
-- ============================================================
ALTER FUNCTION public.add_owner_as_member() SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_date() SET search_path = public;
ALTER FUNCTION public.prevent_delete_group_with_members() SET search_path = public;
ALTER FUNCTION public.prevent_delete_group_with_active_payments() SET search_path = public;
ALTER FUNCTION public.prevent_delete_group_with_other_members() SET search_path = public;

-- Revoke direct EXECUTE on internal/trigger functions
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_date() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_delete_group_with_members() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_delete_group_with_active_payments() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_delete_group_with_other_members() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid, text) FROM anon;

-- ============================================================
-- Remove anon visibility from sensitive tables (GraphQL schema lints)
-- ============================================================
REVOKE SELECT ON public.audit_log FROM anon;
REVOKE SELECT ON public.memberships FROM anon;
REVOKE SELECT ON public.messages FROM anon;
REVOKE SELECT ON public.notifications FROM anon;
REVOKE SELECT ON public.payments FROM anon;
REVOKE SELECT ON public.refund_requests FROM anon;
REVOKE SELECT ON public.wallet_ledger FROM anon;
REVOKE SELECT ON public.support_tickets FROM anon;
REVOKE SELECT ON public.support_messages FROM anon;
REVOKE SELECT ON public.stripe_webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.wallet_ledger FROM anon, authenticated;
REVOKE UPDATE ON public.refund_requests FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.trust_scores FROM anon, authenticated;
REVOKE INSERT ON public.notifications FROM anon, authenticated;
