CREATE POLICY "Public can view ad author public info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ads
    WHERE ads.user_id = profiles.user_id
      AND ads.status IN ('published', 'sold')
  )
);