
DROP POLICY IF EXISTS memberships_update_admin ON public.memberships;
DROP POLICY IF EXISTS memberships_update_own ON public.memberships;
DROP POLICY IF EXISTS memberships_update_admin_role ON public.memberships;

CREATE POLICY memberships_update_owner ON public.memberships
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = memberships.group_id AND g.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = memberships.group_id AND g.owner_id = auth.uid()));

CREATE POLICY memberships_update_admin_norole ON public.memberships
FOR UPDATE TO authenticated
USING (
  public.is_group_admin(memberships.group_id)
  AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = memberships.group_id AND g.owner_id = auth.uid())
)
WITH CHECK (
  public.is_group_admin(memberships.group_id)
  AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = memberships.group_id AND g.owner_id = auth.uid())
  AND role = (SELECT m2.role FROM public.memberships m2 WHERE m2.id = memberships.id)
);

CREATE POLICY memberships_update_self ON public.memberships
FOR UPDATE TO authenticated
USING (lower(user_email) = public.current_email())
WITH CHECK (
  lower(user_email) = public.current_email()
  AND role = (SELECT m2.role FROM public.memberships m2 WHERE m2.id = memberships.id)
  AND payment_status = (SELECT m2.payment_status FROM public.memberships m2 WHERE m2.id = memberships.id)
);

CREATE POLICY audit_log_no_update ON public.audit_log
AS RESTRICTIVE FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS refund_requests_update_admin ON public.refund_requests;

CREATE POLICY refund_requests_update_admin ON public.refund_requests
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = refund_requests.payment_id
      AND public.is_group_admin(p.group_id)
  )
  AND lower(user_email) <> public.current_email()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = refund_requests.payment_id
      AND public.is_group_admin(p.group_id)
  )
  AND lower(user_email) <> public.current_email()
);
