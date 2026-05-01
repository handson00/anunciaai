-- Add link and capacity tracking to community_groups
ALTER TABLE public.community_groups 
ADD COLUMN IF NOT EXISTS link TEXT,
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 250,
ADD COLUMN IF NOT EXISTS current_members INTEGER DEFAULT 0;

-- Update existing groups with example links if they are null
UPDATE public.community_groups SET link = 'https://chat.whatsapp.com/B9O0S0I0Z0A0P0H0O0N0E0' WHERE link IS NULL;