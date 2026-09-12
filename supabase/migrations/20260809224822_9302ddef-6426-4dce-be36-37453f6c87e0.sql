CREATE POLICY "Anyone can view group covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-covers');

CREATE POLICY "Users can upload their own group covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own group covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'group-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own group covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'group-covers' AND (storage.foldername(name))[1] = auth.uid()::text);