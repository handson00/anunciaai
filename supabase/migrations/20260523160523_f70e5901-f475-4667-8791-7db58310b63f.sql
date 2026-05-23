CREATE OR REPLACE FUNCTION public.try_acquire_publication_worker(_worker_id text, _ttl_seconds integer DEFAULT 120)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.publication_queue_locks
  SET locked_until = now() + make_interval(secs => LEAST(GREATEST(_ttl_seconds, 30), 300)),
      locked_by = _worker_id,
      updated_at = now()
  WHERE name = 'uazapi'
    AND locked_until < now();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.try_acquire_publication_worker(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_publication_worker(text, integer) TO service_role;