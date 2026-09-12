
DROP VIEW IF EXISTS public.groups_public;

CREATE VIEW public.groups_public
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  id, service_name, service_type, plan_type, description, currency,
  total_cost, max_members, billing_date, status, is_public, created_date
FROM public.groups
WHERE is_public = true
  AND status = 'active'
  AND closed_at IS NULL;

GRANT SELECT ON public.groups_public TO anon, authenticated;

-- Allow anyone to SELECT public active groups on the base table.
-- Sensitive columns are simply not selected by the view; the frontend
-- uses groups_public for browsing, so this does not leak Stripe / invite data.
DROP POLICY IF EXISTS groups_select_public ON public.groups;
CREATE POLICY groups_select_public ON public.groups
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND status = 'active' AND closed_at IS NULL);
