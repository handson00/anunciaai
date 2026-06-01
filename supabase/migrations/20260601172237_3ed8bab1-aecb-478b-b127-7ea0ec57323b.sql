
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_slug text;

CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(
    lower(public.unaccent(coalesce(_input, ''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_store_slug(_base text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  base := public.slugify(_base);
  IF base IS NULL OR length(base) < 3 THEN
    base := 'loja-' || substr(replace(_user_id::text,'-',''), 1, 6);
  END IF;
  IF length(base) > 30 THEN
    base := substr(base, 1, 30);
  END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE store_slug = candidate AND user_id <> _user_id) LOOP
    i := i + 1;
    candidate := base || '-' || i::text;
  END LOOP;
  RETURN candidate;
END;
$$;

UPDATE public.profiles
SET store_slug = public.generate_unique_store_slug(COALESCE(store_name, name), user_id)
WHERE store_slug IS NULL;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_store_slug_key UNIQUE (store_slug);

CREATE OR REPLACE FUNCTION public.set_profile_store_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_slug IS NULL OR length(trim(NEW.store_slug)) = 0 THEN
    NEW.store_slug := public.generate_unique_store_slug(
      COALESCE(NEW.store_name, NEW.name),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_store_slug ON public.profiles;
CREATE TRIGGER trg_profiles_store_slug
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_store_slug();

DROP FUNCTION IF EXISTS public.get_public_advertisers(uuid[]);
CREATE FUNCTION public.get_public_advertisers(_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text, store_name text, avatar_url text, store_slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.store_name, p.avatar_url, p.store_slug
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.ads a
      WHERE a.user_id = p.user_id
        AND a.status IN ('published', 'sold')
    );
$$;

CREATE OR REPLACE FUNCTION public.get_advertiser_by_slug(_slug text)
RETURNS TABLE(user_id uuid, name text, store_name text, avatar_url text, store_slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.store_name, p.avatar_url, p.store_slug
  FROM public.profiles p
  WHERE p.store_slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_advertisers(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_advertiser_by_slug(text) TO anon, authenticated;
