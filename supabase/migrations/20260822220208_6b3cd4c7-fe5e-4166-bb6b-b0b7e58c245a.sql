CREATE OR REPLACE FUNCTION public.storage_cover_visible(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.cover_image_url IS NOT NULL
      AND position(_object_name IN g.cover_image_url) > 0
      AND (
        (g.is_public = true AND g.status = 'active' AND g.closed_at IS NULL)
        OR (g.owner_id IS NOT NULL AND g.owner_id = auth.uid())
        OR public.is_group_member(g.id)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.storage_cover_visible(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_cover_visible(text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view group covers" ON storage.objects;

CREATE POLICY "Group covers visible to allowed viewers"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'group-covers'
  AND (
    ((storage.foldername(name))[1] = (auth.uid())::text)
    OR public.storage_cover_visible(name)
  )
);