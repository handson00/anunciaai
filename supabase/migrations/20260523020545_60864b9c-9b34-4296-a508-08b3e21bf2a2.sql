
DROP POLICY IF EXISTS "Public can view ad author rows" ON public.profiles;

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT p.user_id, p.name, p.store_name, p.avatar_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.ads a
  WHERE a.user_id = p.user_id
    AND a.status IN ('published', 'sold')
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
