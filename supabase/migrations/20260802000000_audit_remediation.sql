-- ============================================================================
-- AUDIT REMEDIATION — SECURITY_AUDIT_DIVIDEIT.md
-- Fixes: punto 1 (memberships), punto 4 (groups leak), punto 5 (USING(true)),
--        punto 8 (payment race/UNIQUE), punto 9 (roles).
-- NOTE: RLS is currently disabled by the operator and will be re-enabled
--       manually after this migration. Policies defined here take effect
--       as soon as RLS is re-enabled.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PUNTO 1 (CRITICO): memberships must NEVER be writable from the client.
-- Creation/updates happen only via Edge Functions (service_role bypasses RLS).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "memberships_insert" ON public.memberships;
DROP POLICY IF EXISTS "memberships_update" ON public.memberships;
DROP POLICY IF EXISTS "memberships_delete" ON public.memberships;
DROP POLICY IF EXISTS "Users can insert their own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Anyone can insert memberships" ON public.memberships;
-- SELECT policy (own rows or admin of the group) is kept / recreated defensively:
DROP POLICY IF EXISTS "memberships_select" ON public.memberships;
CREATE POLICY "memberships_select" ON public.memberships
  FOR SELECT TO authenticated
  USING (
    lower(user_email) = public.current_email()
    OR public.is_group_admin(group_id)
  );

-- Belt & braces: trigger that blocks payment_status='paid' unless a matching
-- paid payment row exists (protects even against future permissive policies).
CREATE OR REPLACE FUNCTION public.enforce_paid_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.payment_status, '') <> 'paid') THEN
    -- service_role writes are trusted (Edge Functions finalize payments)
    IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' IS DISTINCT FROM 'service_role' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.group_id = NEW.group_id
          AND lower(p.user_email) = lower(NEW.user_email)
          AND p.status IN ('paid', 'completed')
      ) THEN
        RAISE EXCEPTION 'payment_status=paid requires a matching paid payment';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_paid_membership ON public.memberships;
CREATE TRIGGER trg_enforce_paid_membership
  BEFORE INSERT OR UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_membership();

-- ----------------------------------------------------------------------------
-- PUNTO 4 (ALTO): groups SELECT restricted to members/admin.
-- Public browsing goes exclusively through the get_public_groups RPC.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "groups_select_members" ON public.groups;
DROP POLICY IF EXISTS "Anyone can view groups" ON public.groups;
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON public.groups;
CREATE POLICY "groups_select_members" ON public.groups
  FOR SELECT TO authenticated
  USING ( public.is_group_member(id) OR public.is_group_admin(id) );

-- Revoke sensitive columns even from authenticated (RPCs use SECURITY DEFINER)
REVOKE SELECT (admin_email, stripe_account_id, invite_code, owner_id)
  ON public.groups FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- PUNTO 5 (ALTO): drop ALL legacy permissive policies (USING(true)/CHECK(true))
-- on user-data tables. Policies OR together, so old ones must be dropped.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.support_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.support_messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can view waitlist" ON public.waitlist;

-- Scoped replacements (created only if the helper functions exist)
DO $$
BEGIN
  -- support_tickets: own rows only
  EXECUTE 'CREATE POLICY "tickets_select_own" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (lower(user_email) = public.current_email())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "tickets_insert_own" ON public.support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (lower(user_email) = public.current_email())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "support_messages_select_own" ON public.support_messages
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND lower(t.user_email) = public.current_email()
    ))';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "support_messages_insert_own" ON public.support_messages
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND lower(t.user_email) = public.current_email()
    ))';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "messages_select_group_members" ON public.messages
    FOR SELECT TO authenticated
    USING (public.is_group_member(group_id) OR public.is_group_admin(group_id))';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- messages INSERT stays server-side only (chat-messages Edge Function w/ service role)

-- ----------------------------------------------------------------------------
-- PUNTO 8 (MEDIO): idempotent payment finalization — UNIQUE per user/group/month
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_user_group_month
  ON public.payments (lower(user_email), group_id, billing_month)
  WHERE status IN ('paid', 'completed');

-- ----------------------------------------------------------------------------
-- PUNTO 9 (MEDIO): consolidate roles in user_roles (UUID-based).
-- Helper used by Edge Functions to check admin/operator via verified uid.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;

-- user_roles must never be client-writable
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- OPERATOR DASHBOARD: operators/admins (verified via user_roles, NOT client
-- claims) can view and manage ALL support tickets and messages. These policies
-- are what actually protects /OperatorDashboard — the React check is only UX.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('operator', 'admin')
  );
$$;
REVOKE ALL ON FUNCTION public.is_operator() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated, service_role;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "tickets_operator_select" ON public.support_tickets
    FOR SELECT TO authenticated USING (public.is_operator())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "tickets_operator_update" ON public.support_tickets
    FOR UPDATE TO authenticated
    USING (public.is_operator()) WITH CHECK (public.is_operator())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "support_messages_operator_select" ON public.support_messages
    FOR SELECT TO authenticated USING (public.is_operator())';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE POLICY "support_messages_operator_insert" ON public.support_messages
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator() AND sender_type = ''operator'' AND sender_id = auth.uid()::text)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users must NOT be able to spoof operator messages: tighten the user insert
-- policy to force sender_type=user on client inserts.
DROP POLICY IF EXISTS "support_messages_insert_own" ON public.support_messages;
DO $$
BEGIN
  EXECUTE 'CREATE POLICY "support_messages_insert_own" ON public.support_messages
    FOR INSERT TO authenticated
    WITH CHECK (
      sender_type = ''user''
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = support_messages.ticket_id
          AND lower(t.user_email) = public.current_email()
      )
    )';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
