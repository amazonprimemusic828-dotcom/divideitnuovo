
DROP VIEW IF EXISTS public.groups_public CASCADE;

CREATE OR REPLACE FUNCTION public.get_public_groups()
RETURNS TABLE(
  id uuid, service_name text, service_type text, plan_type text,
  total_cost numeric, currency text, max_members integer, billing_date integer,
  description text, status text, is_public boolean,
  created_date timestamptz, closed_at timestamptz, owner_id uuid,
  member_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.id, g.service_name, g.service_type, g.plan_type,
         g.total_cost, g.currency, g.max_members, g.billing_date,
         g.description, g.status, g.is_public,
         g.created_date, g.closed_at, g.owner_id,
         COALESCE((SELECT COUNT(*)::int FROM public.memberships m
                   WHERE m.group_id = g.id AND m.payment_status IN ('paid','pending')), 0)
  FROM public.groups g
  WHERE g.is_public = true AND g.status = 'active' AND g.closed_at IS NULL
  ORDER BY g.created_date DESC;
$$;
REVOKE ALL ON FUNCTION public.get_public_groups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_groups() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_group(_id uuid)
RETURNS TABLE(
  id uuid, service_name text, service_type text, plan_type text,
  total_cost numeric, currency text, max_members integer, billing_date integer,
  description text, status text, is_public boolean,
  created_date timestamptz, closed_at timestamptz, owner_id uuid,
  member_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.id, g.service_name, g.service_type, g.plan_type,
         g.total_cost, g.currency, g.max_members, g.billing_date,
         g.description, g.status, g.is_public,
         g.created_date, g.closed_at, g.owner_id,
         COALESCE((SELECT COUNT(*)::int FROM public.memberships m
                   WHERE m.group_id = g.id AND m.payment_status IN ('paid','pending')), 0)
  FROM public.groups g
  WHERE g.id = _id
    AND (
      (g.is_public = true AND g.status = 'active' AND g.closed_at IS NULL)
      OR public.is_group_member(g.id)
      OR (g.owner_id IS NOT NULL AND g.owner_id = auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.get_public_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_group(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS memberships_select_self_or_member ON public.memberships;

CREATE POLICY memberships_select_self_or_admin ON public.memberships
  FOR SELECT TO authenticated
  USING (
    lower(user_email) = current_email()
    OR public.is_group_admin(group_id)
  );

CREATE OR REPLACE FUNCTION public.get_group_members(_group_id uuid)
RETURNS TABLE(
  id uuid, group_id uuid, user_email text, user_name text,
  user_avatar_url text, role text, payment_status text,
  joined_date date, created_date timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.group_id, m.user_email, m.user_name,
         m.user_avatar_url, m.role, m.payment_status,
         m.joined_date, m.created_date
  FROM public.memberships m
  WHERE m.group_id = _group_id
    AND (public.is_group_member(_group_id) OR public.is_group_admin(_group_id))
  ORDER BY m.joined_date DESC;
$$;
REVOKE ALL ON FUNCTION public.get_group_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_members(uuid) TO authenticated;

DROP POLICY IF EXISTS memberships_update_admin ON public.memberships;
CREATE POLICY memberships_update_admin ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (
    public.is_group_admin(group_id)
    AND role = ANY (ARRAY['member','admin'])
    AND payment_status = (SELECT m.payment_status FROM public.memberships m WHERE m.id = memberships.id)
    AND group_id       = (SELECT m.group_id       FROM public.memberships m WHERE m.id = memberships.id)
    AND user_email     = (SELECT m.user_email     FROM public.memberships m WHERE m.id = memberships.id)
    AND NOT (stripe_customer_id     IS DISTINCT FROM (SELECT m.stripe_customer_id     FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT m.stripe_subscription_id FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (dunning_attempts       IS DISTINCT FROM (SELECT m.dunning_attempts       FROM public.memberships m WHERE m.id = memberships.id))
    AND NOT (current_period_end     IS DISTINCT FROM (SELECT m.current_period_end     FROM public.memberships m WHERE m.id = memberships.id))
    AND (
      role = (SELECT m.role FROM public.memberships m WHERE m.id = memberships.id)
      OR role = 'member'
      OR (
        role = 'admin'
        AND EXISTS (SELECT 1 FROM public.groups g
                    WHERE g.id = memberships.group_id AND g.owner_id = auth.uid())
      )
    )
  );
