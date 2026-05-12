-- Add full-text search column
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION ads_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tr_ads_search_vector ON public.ads;
CREATE TRIGGER tr_ads_search_vector
BEFORE INSERT OR UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION ads_search_vector_update();

-- Initial update for existing rows
UPDATE public.ads SET title = title;

-- Create GIN index for fast searching
CREATE INDEX IF NOT EXISTS idx_ads_search_vector ON public.ads USING GIN(search_vector);

-- Partial index for failed publications to make error dashboards faster
CREATE INDEX IF NOT EXISTS idx_publication_logs_error ON public.publication_logs(status) WHERE status = 'error';
