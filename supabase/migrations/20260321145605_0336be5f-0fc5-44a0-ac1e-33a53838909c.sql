
-- Fix overly permissive insert policy on publication_logs
DROP POLICY "System can insert logs" ON public.publication_logs;
CREATE POLICY "Users can insert logs for own ads" ON public.publication_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ads WHERE ads.id = publication_logs.ad_id AND ads.user_id = auth.uid()));
