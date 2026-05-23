
-- 1) Replace overly-broad public SELECT on profiles with a safe view
DROP POLICY IF EXISTS "Public can view ad author public info" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT p.user_id, p.name, p.store_name, p.avatar_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.ads a
  WHERE a.user_id = p.user_id
    AND a.status IN ('published', 'sold')
);

-- Allow public ad author lookup via the view; the view itself runs as invoker,
-- so we add a narrow SELECT policy that exposes only profiles of users with
-- public ads. The application should query public_profiles, not profiles.
CREATE POLICY "Public can view ad author rows"
ON public.profiles
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.ads
    WHERE ads.user_id = profiles.user_id
      AND ads.status IN ('published', 'sold')
  )
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Validate group_id on publication_logs inserts
DROP POLICY IF EXISTS "Users can insert logs for own ads" ON public.publication_logs;
CREATE POLICY "Users can insert logs for own ads"
ON public.publication_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ads
    WHERE ads.id = publication_logs.ad_id
      AND ads.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.community_groups
    WHERE community_groups.id = publication_logs.group_id
  )
);

-- 3) Fix mutable search_path on remaining functions
ALTER FUNCTION public.ads_search_vector_update() SET search_path = public;
ALTER FUNCTION public.ensure_single_join_group_link() SET search_path = public;

-- 4) Restrict EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
