-- Restore only the privileges required by existing RLS policies.
-- Do NOT grant public access to private tables such as memberships, messages or notifications.

-- current_email only wraps auth.email(); make it invoker-safe and callable by API roles.
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.email(), ''))
$$;

GRANT EXECUTE ON FUNCTION public.current_email() TO anon, authenticated;

-- These helpers are used inside authenticated RLS policies for groups,
-- memberships and messages. They must be executable by authenticated users,
-- otherwise PostgREST returns 42501 permission errors while evaluating RLS.
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid) FROM anon;

-- Keep public browsing limited to the safe view and active public group policy.
GRANT SELECT ON public.groups_public TO anon, authenticated;
GRANT SELECT ON public.groups TO authenticated;

-- Authenticated clients need relation privileges; RLS still restricts rows.
GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;

-- Preserve service-role backend access for Edge Functions/webhooks.
GRANT ALL ON public.groups TO service_role;
GRANT ALL ON public.groups_public TO service_role;
GRANT ALL ON public.memberships TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.notifications TO service_role;