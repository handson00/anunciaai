CREATE OR REPLACE FUNCTION public.claim_publication_queue(_worker_id text, _limit integer DEFAULT 3)
RETURNS SETOF public.publication_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.publication_queue q
    WHERE q.status IN ('queued', 'retry')
      AND q.next_run_at <= now()
      AND (q.locked_at IS NULL OR q.locked_at < now() - interval '5 minutes')
      AND q.attempts < q.max_attempts
    ORDER BY q.created_at ASC
    LIMIT LEAST(GREATEST(_limit, 1), 10)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.publication_queue q
  SET status = 'processing',
      locked_at = now(),
      locked_by = _worker_id,
      attempts = q.attempts + 1,
      updated_at = now()
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_publication_queue(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_publication_queue(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_publication_queue(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_publication_queue(text, integer) TO service_role;