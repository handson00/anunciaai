ALTER TABLE public.publication_queue
ADD COLUMN IF NOT EXISTS log_id uuid REFERENCES public.publication_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_publication_queue_log_id
ON public.publication_queue (log_id);