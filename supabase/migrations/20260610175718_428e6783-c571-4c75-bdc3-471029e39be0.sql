
-- Lock down sensitive columns at column level so RLS row access doesn't leak them.
-- Edge functions use service_role and remain unaffected.

REVOKE SELECT (invite_code, admin_email, stripe_account_id, credentials_ciphertext, credentials_iv, credentials_tag)
  ON public.groups FROM authenticated, anon;

REVOKE SELECT (stripe_customer_id, stripe_subscription_id)
  ON public.memberships FROM authenticated, anon;

-- Owner-only RPC to fetch sensitive group fields (for admin UI: invite_code sharing, stripe status)
CREATE OR REPLACE FUNCTION public.get_group_admin_details(_group_id uuid)
RETURNS TABLE (
  id uuid,
  invite_code text,
  admin_email text,
  stripe_account_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.invite_code, g.admin_email, g.stripe_account_id
  FROM public.groups g
  WHERE g.id = _group_id
    AND public.is_group_admin(_group_id)
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_admin_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_admin_details(uuid) TO authenticated;

-- Owner-only RPC to read own membership stripe ids (or admin can read any in their group)
CREATE OR REPLACE FUNCTION public.get_membership_stripe_ids(_membership_id uuid)
RETURNS TABLE (
  id uuid,
  stripe_customer_id text,
  stripe_subscription_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.stripe_customer_id, m.stripe_subscription_id
  FROM public.memberships m
  WHERE m.id = _membership_id
    AND (
      lower(m.user_email) = public.current_email()
      OR public.is_group_admin(m.group_id)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_membership_stripe_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_membership_stripe_ids(uuid) TO authenticated;
