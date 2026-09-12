
-- 1. groups SELECT: remove is_public branch
DROP POLICY IF EXISTS groups_select_public_or_member_or_owner ON public.groups;
CREATE POLICY groups_select_member_or_owner ON public.groups
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_group_member(id)
    OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
  );

-- Ensure the public view is readable
GRANT SELECT ON public.groups_public TO anon, authenticated;

-- 2. memberships UPDATE: self can only change user_name / user_avatar_url; admins can change anything
DROP POLICY IF EXISTS memberships_update_self_or_admin ON public.memberships;

CREATE POLICY memberships_update_self_safe ON public.memberships
  FOR UPDATE TO authenticated
  USING (lower(user_email) = public.current_email())
  WITH CHECK (
    lower(user_email) = public.current_email()
    AND role = (SELECT role FROM public.memberships m WHERE m.id = memberships.id)
    AND payment_status = (SELECT payment_status FROM public.memberships m WHERE m.id = memberships.id)
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.memberships m WHERE m.id = memberships.id)
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.memberships m WHERE m.id = memberships.id)
    AND dunning_attempts IS NOT DISTINCT FROM (SELECT dunning_attempts FROM public.memberships m WHERE m.id = memberships.id)
    AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM public.memberships m WHERE m.id = memberships.id)
    AND group_id = (SELECT group_id FROM public.memberships m WHERE m.id = memberships.id)
    AND user_email = (SELECT user_email FROM public.memberships m WHERE m.id = memberships.id)
  );

CREATE POLICY memberships_update_admin ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));

-- 3. audit_log: explicit deny for client insert/delete
CREATE POLICY audit_log_no_insert ON public.audit_log
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY audit_log_no_delete ON public.audit_log
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);
