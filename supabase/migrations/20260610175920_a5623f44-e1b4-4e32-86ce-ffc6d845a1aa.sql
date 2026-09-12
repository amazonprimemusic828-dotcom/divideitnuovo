
-- 1. Hide stripe_price_id from members
REVOKE SELECT (stripe_price_id) ON public.groups FROM authenticated, anon;

-- 2. Remove direct client-side delete on groups (server/service_role only)
DROP POLICY IF EXISTS groups_delete_owner ON public.groups;

-- 3. Refund requests must reference a payment owned by the same email
DROP POLICY IF EXISTS refund_requests_insert_own ON public.refund_requests;
CREATE POLICY refund_requests_insert_own
ON public.refund_requests
FOR INSERT
TO authenticated
WITH CHECK (
  lower(user_email) = public.current_email()
  AND EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = refund_requests.payment_id
      AND lower(p.user_email) = public.current_email()
  )
);
