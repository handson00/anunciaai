
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_advertisers(_user_ids uuid[])
RETURNS TABLE (user_id uuid, name text, store_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.store_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.ads a
      WHERE a.user_id = p.user_id
        AND a.status IN ('published', 'sold')
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_advertisers(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_advertisers(uuid[]) TO anon, authenticated;
