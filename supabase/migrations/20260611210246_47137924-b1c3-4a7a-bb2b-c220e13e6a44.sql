
-- 1) Revoke direct admin SELECT on memberships; replace with self-only policy.
DROP POLICY IF EXISTS memberships_select_self_or_admin ON public.memberships;
DROP POLICY IF EXISTS memberships_select_self ON public.memberships;
CREATE POLICY memberships_select_self ON public.memberships
  FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_email());

-- Revoke direct column access to Stripe IDs from authenticated (kept for service_role).
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.memberships FROM authenticated;

-- 2) Drop the weaker duplicate self-update policy.
DROP POLICY IF EXISTS memberships_update_self ON public.memberships;

-- 3) Harden is_group_admin to require auth.uid() unconditionally.
CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.groups
    WHERE id = _group_id
      AND (
        owner_id = auth.uid()
        OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
      )
  )
$function$;
