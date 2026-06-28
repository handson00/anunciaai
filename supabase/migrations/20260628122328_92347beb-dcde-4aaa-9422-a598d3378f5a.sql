CREATE POLICY "Admins manage scheduled-media uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'scheduled-media' AND public.is_admin());

CREATE POLICY "Admins read scheduled-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'scheduled-media' AND public.is_admin());

CREATE POLICY "Admins delete scheduled-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'scheduled-media' AND public.is_admin());