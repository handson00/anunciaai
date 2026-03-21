
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-photos', 'ad-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

CREATE POLICY "Authenticated users can upload ad photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ad-photos');

CREATE POLICY "Public can view ad photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ad-photos');

CREATE POLICY "Users can delete own ad photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ad-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
