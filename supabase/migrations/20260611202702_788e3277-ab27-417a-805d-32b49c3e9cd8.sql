
-- ============================================================
-- 1) GROUPS: revoke sensitive columns from non-service roles
-- ============================================================
REVOKE SELECT (
  invite_code,
  admin_email,
  stripe_account_id,
  stripe_price_id,
  stripe_payouts_enabled,
  stripe_charges_enabled,
  stripe_requirements_due,
  credentials_ciphertext,
  credentials_iv,
  credentials_tag,
  credentials_updated_at
) ON public.groups FROM authenticated;
REVOKE SELECT (
  invite_code,
  admin_email,
  stripe_account_id,
  stripe_price_id,
  stripe_payouts_enabled,
  stripe_charges_enabled,
  stripe_requirements_due,
  credentials_ciphertext,
  credentials_iv,
  credentials_tag,
  credentials_updated_at
) ON public.groups FROM anon;

-- Add SELECT policy that lets anyone read public, active, open groups
-- (sensitive columns are already blocked at the column level above).
DROP POLICY IF EXISTS groups_select_public ON public.groups;
CREATE POLICY groups_select_public ON public.groups
  FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    AND status = 'active'
    AND closed_at IS NULL
  );

-- ============================================================
-- 2) MEMBERSHIPS: hide other members' Stripe IDs
-- ============================================================
REVOKE SELECT (stripe_customer_id, stripe_subscription_id)
  ON public.memberships FROM authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id)
  ON public.memberships FROM anon;
-- Owner of the row and the group admin can still read those columns
-- through the existing SECURITY DEFINER RPC `get_membership_stripe_ids`.

-- ============================================================
-- 3) Recreate groups_public with security_invoker = on
--    (fixes Supabase linter "Security Definer View")
-- ============================================================
DROP VIEW IF EXISTS public.groups_public CASCADE;
CREATE VIEW public.groups_public
  WITH (security_invoker = on, security_barrier = true)
AS
  SELECT
    id, service_name, service_type, plan_type,
    total_cost, currency, max_members, billing_date,
    description, status, is_public,
    created_date, closed_at, owner_id
  FROM public.groups
  WHERE is_public = true
    AND status = 'active'
    AND closed_at IS NULL;

GRANT SELECT ON public.groups_public TO anon, authenticated;

-- ============================================================
-- 4) SUPPORT_TICKETS: forbid users from changing privileged fields
-- ============================================================
DROP POLICY IF EXISTS support_tickets_update_own ON public.support_tickets;
CREATE POLICY support_tickets_update_own ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (lower(user_email) = current_email())
  WITH CHECK (
    lower(user_email) = current_email()
    AND priority           = (SELECT t.priority           FROM public.support_tickets t WHERE t.id = support_tickets.id)
    AND status             = (SELECT t.status             FROM public.support_tickets t WHERE t.id = support_tickets.id)
    AND category           = (SELECT t.category           FROM public.support_tickets t WHERE t.id = support_tickets.id)
    AND ai_attempted       IS NOT DISTINCT FROM (SELECT t.ai_attempted       FROM public.support_tickets t WHERE t.id = support_tickets.id)
    AND ai_resolution      IS NOT DISTINCT FROM (SELECT t.ai_resolution      FROM public.support_tickets t WHERE t.id = support_tickets.id)
    AND assigned_operator  IS NOT DISTINCT FROM (SELECT t.assigned_operator  FROM public.support_tickets t WHERE t.id = support_tickets.id)
  );
