-- Fix ad-photos storage: restrict uploads to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload ad photos" ON storage.objects;
CREATE POLICY "Users can upload to own folder in ad-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ad-photos' 
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Also restrict updates/deletes to own folder
DROP POLICY IF EXISTS "Users can update own ad photos" ON storage.objects;
CREATE POLICY "Users can update own ad photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ad-photos' 
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete own ad photos" ON storage.objects;
CREATE POLICY "Users can delete own ad photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ad-photos' 
  AND (storage.foldername(name))[1] = (auth.uid())::text
);