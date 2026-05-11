ALTER TYPE public.ad_status ADD VALUE IF NOT EXISTS 'sold';

-- Ensure the column doesn't already exist before adding it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ads' AND column_name = 'is_sold') THEN
        ALTER TABLE public.ads ADD COLUMN is_sold BOOLEAN DEFAULT false;
    END IF;
END $$;