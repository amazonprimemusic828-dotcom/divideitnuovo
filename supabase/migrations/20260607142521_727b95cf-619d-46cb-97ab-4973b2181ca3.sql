ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS owner_id uuid;

UPDATE public.groups g
SET owner_id = u.id
FROM auth.users u
WHERE g.owner_id IS NULL
  AND lower(g.admin_email) = lower(u.email);

ALTER TABLE public.groups
DROP CONSTRAINT IF EXISTS groups_owner_id_required;

ALTER TABLE public.groups
ADD CONSTRAINT groups_owner_id_required
CHECK (owner_id IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION public.set_group_owner_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;

  IF NEW.owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a group';
  END IF;

  IF NEW.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot create a group for another user';
  END IF;

  NEW.admin_email := lower(trim(NEW.admin_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_group_owner_from_auth_trigger ON public.groups;
CREATE TRIGGER set_group_owner_from_auth_trigger
BEFORE INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.set_group_owner_from_auth();

CREATE OR REPLACE FUNCTION public.is_group_admin(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups
    WHERE id = _group_id
      AND (
        owner_id = auth.uid()
        OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
      )
  ) AND (auth.uid() IS NOT NULL OR public.current_email() <> '')
$$;

DROP POLICY IF EXISTS "groups_select_admin_or_member" ON public.groups;
DROP POLICY IF EXISTS "groups_select_public_or_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_own_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_admin" ON public.groups;

CREATE POLICY "groups_select_public_or_member_or_owner"
ON public.groups FOR SELECT TO authenticated
USING (
  is_public = true
  OR owner_id = auth.uid()
  OR public.is_group_member(id)
  OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
);

CREATE POLICY "groups_insert_own_owner_id"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id = auth.uid()
);

CREATE POLICY "groups_update_owner"
ON public.groups FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
)
WITH CHECK (
  owner_id = auth.uid()
  OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
);

CREATE POLICY "groups_delete_owner"
ON public.groups FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (owner_id IS NULL AND lower(admin_email) = public.current_email())
);