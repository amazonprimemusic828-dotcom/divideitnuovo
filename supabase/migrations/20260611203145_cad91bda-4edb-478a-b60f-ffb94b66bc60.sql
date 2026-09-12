
-- ============================================================
-- 1) Drop the permissive base-table policy: public groups must
--    be reached exclusively through the safe `groups_public` view.
-- ============================================================
DROP POLICY IF EXISTS groups_select_public ON public.groups;

-- ============================================================
-- 2) Recreate `groups_public` as a SAFE view that exposes only
--    non-sensitive columns and selects public/active rows itself.
--    We use security_invoker=off so non-members (and anon) can
--    still browse public groups without a base-table SELECT policy.
--    Sensitive columns simply do not exist in the view, and the
--    view's WHERE clause enforces is_public + active + open.
-- ============================================================
DROP VIEW IF EXISTS public.groups_public CASCADE;
CREATE VIEW public.groups_public
  WITH (security_invoker = off, security_barrier = true)
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

COMMENT ON VIEW public.groups_public IS
  'Safe public projection of public.groups. Exposes only non-sensitive columns. '
  'Uses security_invoker=off intentionally so the discovery surface for unauthenticated '
  'and non-member browsing does not require a permissive base-table SELECT policy '
  '(which would otherwise leak invite_code, admin_email, stripe_* and credentials_* '
  'columns even with column-level revokes). The Supabase linter flags this as '
  '"Security Definer View" — accepted pattern documented in security memory.';

-- ============================================================
-- 3) stripe_webhook_events — confirm: service-role-only by design.
--    RLS stays enabled with no user policy. Documenting intent.
-- ============================================================
COMMENT ON TABLE public.stripe_webhook_events IS
  'Internal Stripe webhook idempotency log. Written and read only by the '
  'edge function via service_role. RLS is enabled with NO user-facing policy '
  'on purpose: anon/authenticated have no read or write access. Accepted pattern '
  'documented in security memory.';
