
DROP POLICY IF EXISTS memberships_insert_self ON public.memberships;

CREATE POLICY memberships_insert_self ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (
  lower(user_email) = current_email()
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL
  AND (dunning_attempts IS NULL OR dunning_attempts = 0)
  AND (cost_per_month IS NULL OR cost_per_month = 0)
  AND (
    -- Regular member join
    (role = 'member' AND payment_status = 'pending')
    OR
    -- Group owner self-enrolling as admin at creation time
    (
      role = 'admin'
      AND payment_status IN ('paid','pending')
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = memberships.group_id
          AND g.owner_id = auth.uid()
      )
    )
  )
);
