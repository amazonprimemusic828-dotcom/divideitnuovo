
-- 1) Remove the over-broad public SELECT policy on groups.
-- Authenticated users continue to read full rows of groups they own or are members of
-- via the existing groups_select_member_or_owner policy. Public discovery (anon &
-- authenticated) is served exclusively by the safe groups_public view below.
DROP POLICY IF EXISTS groups_select_public ON public.groups;

-- 2) Rebuild groups_public as a SECURITY DEFINER view (security_invoker=off) so it
-- exposes ONLY safe columns to anon/authenticated, regardless of base-table RLS.
-- security_barrier=true prevents predicate pushdown leaks.
DROP VIEW IF EXISTS public.groups_public;
CREATE VIEW public.groups_public
  WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id,
  service_name,
  service_type,
  plan_type,
  description,
  currency,
  total_cost,
  max_members,
  billing_date,
  status,
  is_public,
  created_date,
  closed_at
FROM public.groups
WHERE is_public = true
  AND status = 'active'
  AND closed_at IS NULL;

GRANT SELECT ON public.groups_public TO anon, authenticated;

-- 3) Revoke anon SELECT on config (anon has no matching RLS policy and shouldn't
-- read config; only authenticated users may read the whitelisted public keys).
REVOKE SELECT ON public.config FROM anon;

-- 4) Tighten messages UPDATE: only the original sender can modify a message.
DROP POLICY IF EXISTS messages_update_own ON public.messages;
CREATE POLICY messages_update_own
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_uid = auth.uid()::text)
  WITH CHECK (sender_uid = auth.uid()::text);

-- Note: mark_messages_read() is SECURITY DEFINER and continues to update read_by
-- for messages the caller did NOT send (it runs as postgres, bypassing this policy).
