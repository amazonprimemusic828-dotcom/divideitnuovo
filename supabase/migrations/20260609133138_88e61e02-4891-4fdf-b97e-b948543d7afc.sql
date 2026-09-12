
-- 1) groups_public view: only safe columns, only public active groups
DROP VIEW IF EXISTS public.groups_public;
CREATE VIEW public.groups_public
WITH (security_invoker = false, security_barrier = true)
AS
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
  created_date
FROM public.groups
WHERE is_public = true
  AND status = 'active'
  AND closed_at IS NULL;

GRANT SELECT ON public.groups_public TO anon, authenticated;

-- 2) Tighten memberships_update_admin: admin cannot change stripe_*, payment_status,
--    dunning_attempts, current_period_end, group_id, user_email; role only in (member, admin)
DROP POLICY IF EXISTS memberships_update_admin ON public.memberships;

CREATE POLICY memberships_update_admin ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (is_group_admin(group_id))
  WITH CHECK (
    is_group_admin(group_id)
    AND role IN ('member', 'admin')
    AND payment_status = (SELECT m.payment_status FROM public.memberships m WHERE m.id = memberships.id)
    AND group_id      = (SELECT m.group_id      FROM public.memberships m WHERE m.id = memberships.id)
    AND user_email    = (SELECT m.user_email    FROM public.memberships m WHERE m.id = memberships.id)
    AND NOT (stripe_customer_id     IS DISTINCT FROM (SELECT m.stripe_customer_id     FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT m.stripe_subscription_id FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (dunning_attempts       IS DISTINCT FROM (SELECT m.dunning_attempts       FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (current_period_end     IS DISTINCT FROM (SELECT m.current_period_end     FROM public.memberships m WHERE m.id = memberships.id))
  );

-- 3) Revoke wide EXECUTE on SECURITY DEFINER helpers; grant only what frontend needs
REVOKE EXECUTE ON FUNCTION public.current_email()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_group_owner_from_auth()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid, text)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_group_seat(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_group_by_invite_code(text)           FROM PUBLIC;

-- Re-grant only what the app actually calls from the client
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_group_seat(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_by_invite_code(text)            TO anon, authenticated;

-- 4) Hide sensitive tables from pg_graphql exposure (still reachable via PostgREST under RLS)
COMMENT ON TABLE public.audit_log   IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.memberships IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.messages    IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.payments    IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.wallet_ledger IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.stripe_webhook_events IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.refund_requests IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.support_messages IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.support_tickets IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.trust_scores IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.notifications IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.config IS E'@graphql({"visible": false})';
