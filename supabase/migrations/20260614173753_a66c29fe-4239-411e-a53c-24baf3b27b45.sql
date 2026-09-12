CREATE OR REPLACE FUNCTION public.get_public_groups()
 RETURNS TABLE(id uuid, service_name text, service_type text, plan_type text, total_cost numeric, currency text, max_members integer, billing_date integer, description text, status text, is_public boolean, created_date timestamp with time zone, closed_at timestamp with time zone, owner_id uuid, member_count integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.id, g.service_name, g.service_type, g.plan_type,
         g.total_cost, g.currency, g.max_members, g.billing_date,
         g.description, g.status, g.is_public,
         g.created_date, g.closed_at, g.owner_id,
         COALESCE((SELECT COUNT(*)::int FROM public.memberships m
                   WHERE m.group_id = g.id
                     AND m.payment_status IN ('paid','pending')
                     AND lower(m.user_email) <> lower(g.admin_email)), 0)
  FROM public.groups g
  WHERE g.is_public = true AND g.status = 'active' AND g.closed_at IS NULL
  ORDER BY g.created_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_group(_id uuid)
 RETURNS TABLE(id uuid, service_name text, service_type text, plan_type text, total_cost numeric, currency text, max_members integer, billing_date integer, description text, status text, is_public boolean, created_date timestamp with time zone, closed_at timestamp with time zone, owner_id uuid, member_count integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.id, g.service_name, g.service_type, g.plan_type,
         g.total_cost, g.currency, g.max_members, g.billing_date,
         g.description, g.status, g.is_public,
         g.created_date, g.closed_at, g.owner_id,
         COALESCE((SELECT COUNT(*)::int FROM public.memberships m
                   WHERE m.group_id = g.id
                     AND m.payment_status IN ('paid','pending')
                     AND lower(m.user_email) <> lower(g.admin_email)), 0)
  FROM public.groups g
  WHERE g.id = _id
    AND (
      (g.is_public = true AND g.status = 'active' AND g.closed_at IS NULL)
      OR public.is_group_member(g.id)
      OR (g.owner_id IS NOT NULL AND g.owner_id = auth.uid())
    );
$$;