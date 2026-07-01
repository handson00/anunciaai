
CREATE INDEX IF NOT EXISTS idx_ads_user_created ON public.ads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_status_created ON public.ads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON public.ads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_groups_active ON public.community_groups (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_instagram_monitors_active ON public.instagram_monitors (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_publication_queue_status_created ON public.publication_queue (status, created_at) WHERE status IN ('queued','retry');
ANALYZE public.ads;
ANALYZE public.publication_queue;
ANALYZE public.publication_logs;
ANALYZE public.community_groups;
ANALYZE public.instagram_monitors;
