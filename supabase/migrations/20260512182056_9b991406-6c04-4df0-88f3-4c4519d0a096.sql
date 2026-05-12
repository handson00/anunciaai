-- Add message column and make ad_id nullable
ALTER TABLE public.publication_logs 
ADD COLUMN IF NOT EXISTS message TEXT,
ALTER COLUMN ad_id DROP NOT NULL;

-- Add index for performance when querying logs
CREATE INDEX IF NOT EXISTS idx_publication_logs_created_at ON public.publication_logs (created_at DESC);
