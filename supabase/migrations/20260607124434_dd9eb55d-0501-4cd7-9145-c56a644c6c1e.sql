
-- Rollback to permissive policies (app uses Firebase Auth, not Supabase Auth,
-- so auth.jwt() is null on all client-side queries).

-- GROUPS
DROP POLICY IF EXISTS "groups_select" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_admin" ON public.groups;
CREATE POLICY "Public groups readable" ON public.groups FOR SELECT USING (true);
CREATE POLICY "All authenticated can insert" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update own groups" ON public.groups FOR UPDATE USING (true);
CREATE POLICY "Admin can delete own groups" ON public.groups FOR DELETE USING (true);

-- MEMBERSHIPS
DROP POLICY IF EXISTS "memberships_select" ON public.memberships;
DROP POLICY IF EXISTS "memberships_insert" ON public.memberships;
DROP POLICY IF EXISTS "memberships_update" ON public.memberships;
DROP POLICY IF EXISTS "memberships_delete" ON public.memberships;
CREATE POLICY "All authenticated can read memberships" ON public.memberships FOR SELECT USING (true);
CREATE POLICY "All authenticated can insert memberships" ON public.memberships FOR INSERT WITH CHECK (true);
CREATE POLICY "Can update memberships" ON public.memberships FOR UPDATE USING (true);
CREATE POLICY "Can delete memberships" ON public.memberships FOR DELETE USING (true);

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_member" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete messages" ON public.messages FOR DELETE USING (true);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "All authenticated can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Can delete notifications" ON public.notifications FOR DELETE USING (true);

-- PAYMENTS
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "Users can read payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "All authenticated can insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Can update payments" ON public.payments FOR UPDATE USING (true);

-- WALLET LEDGER
DROP POLICY IF EXISTS "wallet_select_own" ON public.wallet_ledger;
CREATE POLICY "Users read own wallet" ON public.wallet_ledger FOR SELECT USING (true);
CREATE POLICY "Can insert wallet" ON public.wallet_ledger FOR INSERT WITH CHECK (true);
CREATE POLICY "Can update wallet" ON public.wallet_ledger FOR UPDATE USING (true);

-- REFUND REQUESTS
DROP POLICY IF EXISTS "refunds_select_own" ON public.refund_requests;
DROP POLICY IF EXISTS "refunds_insert_own" ON public.refund_requests;
CREATE POLICY "Users read own refunds" ON public.refund_requests FOR SELECT USING (true);
CREATE POLICY "Can insert refunds" ON public.refund_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Can update refunds" ON public.refund_requests FOR UPDATE USING (true);

-- AUDIT LOG
DROP POLICY IF EXISTS "audit_select_own" ON public.audit_log;
CREATE POLICY "Audit readable" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "Audit insertable" ON public.audit_log FOR INSERT WITH CHECK (true);

-- SUPPORT
DROP POLICY IF EXISTS "tickets_select_own" ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_insert_own" ON public.support_tickets;
DROP POLICY IF EXISTS "tickets_update_own" ON public.support_tickets;
CREATE POLICY "Support tickets accessible" ON public.support_tickets FOR SELECT USING (true);
CREATE POLICY "Support tickets insertable" ON public.support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Support tickets updatable" ON public.support_tickets FOR UPDATE USING (true);

DROP POLICY IF EXISTS "support_msg_select_own" ON public.support_messages;
DROP POLICY IF EXISTS "support_msg_insert_own" ON public.support_messages;
CREATE POLICY "Support messages accessible" ON public.support_messages FOR SELECT USING (true);
CREATE POLICY "Support messages insertable" ON public.support_messages FOR INSERT WITH CHECK (true);

-- TRUST SCORES
CREATE POLICY "All authenticated can insert trust_scores" ON public.trust_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own trust_scores" ON public.trust_scores FOR UPDATE USING (true);

-- Re-grant Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_ledger TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trust_scores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO anon, authenticated;
