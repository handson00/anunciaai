CREATE TABLE IF NOT EXISTS public.publication_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid REFERENCES public.ads(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  message text,
  photo_url text,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  api_response jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.publication_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'publication_queue'
      AND policyname = 'Admins can manage publication queue'
  ) THEN
    CREATE POLICY "Admins can manage publication queue"
    ON public.publication_queue
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'publication_queue'
      AND policyname = 'Users can view own queued publications'
  ) THEN
    CREATE POLICY "Users can view own queued publications"
    ON public.publication_queue
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.ads
        WHERE ads.id = publication_queue.ad_id
          AND ads.user_id = auth.uid()
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publication_queue_status_next_run
ON public.publication_queue (status, next_run_at, created_at);

CREATE INDEX IF NOT EXISTS idx_publication_queue_ad_id
ON public.publication_queue (ad_id);

CREATE INDEX IF NOT EXISTS idx_publication_queue_group_id
ON public.publication_queue (group_id);

DROP TRIGGER IF EXISTS update_publication_queue_updated_at ON public.publication_queue;
CREATE TRIGGER update_publication_queue_updated_at
BEFORE UPDATE ON public.publication_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();