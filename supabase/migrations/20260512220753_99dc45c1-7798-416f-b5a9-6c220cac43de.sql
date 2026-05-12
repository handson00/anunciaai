-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON public.ads(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_category ON public.ads(category);
CREATE INDEX IF NOT EXISTS idx_publication_logs_ad_id ON public.publication_logs(ad_id);
CREATE INDEX IF NOT EXISTS idx_publication_logs_group_id ON public.publication_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Ensure the is_admin function is as fast as possible
-- It's already STABLE and uses the unique index on user_id, which is good.
