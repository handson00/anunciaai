-- Add foreign key constraints to publication_logs
ALTER TABLE public.publication_logs
ADD CONSTRAINT fk_publication_logs_ad
FOREIGN KEY (ad_id) 
REFERENCES public.ads(id)
ON DELETE SET NULL;

ALTER TABLE public.publication_logs
ADD CONSTRAINT fk_publication_logs_group
FOREIGN KEY (group_id) 
REFERENCES public.community_groups(id)
ON DELETE SET NULL;
