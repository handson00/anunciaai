CREATE TABLE IF NOT EXISTS public.publication_queue_locks (
  name text PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT 'epoch'::timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.publication_queue_locks (name)
VALUES ('uazapi')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.publication_queue_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'publication_queue_locks'
      AND policyname = 'Admins can view publication queue locks'
  ) THEN
    CREATE POLICY "Admins can view publication queue locks"
    ON public.publication_queue_locks
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.try_acquire_publication_worker(_worker_id text, _ttl_seconds integer DEFAULT 120)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean;
BEGIN
  UPDATE public.publication_queue_locks
  SET locked_until = now() + make_interval(secs => LEAST(GREATEST(_ttl_seconds, 30), 300)),
      locked_by = _worker_id,
      updated_at = now()
  WHERE name = 'uazapi'
    AND locked_until < now();

  GET DIAGNOSTICS acquired = ROW_COUNT;
  RETURN acquired;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_publication_worker(_worker_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.publication_queue_locks
  SET locked_until = 'epoch'::timestamptz,
      locked_by = null,
      updated_at = now()
  WHERE name = 'uazapi'
    AND locked_by = _worker_id;
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_publication_worker(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.release_publication_worker(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_publication_worker(text) FROM anon;
REVOKE ALL ON FUNCTION public.release_publication_worker(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_publication_worker(text) TO service_role;