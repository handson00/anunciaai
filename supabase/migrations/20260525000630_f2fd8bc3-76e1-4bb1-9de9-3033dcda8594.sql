CREATE TABLE public.instagram_posted (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL,
  group_id uuid NOT NULL,
  post_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (monitor_id, group_id, post_id)
);

CREATE INDEX idx_instagram_posted_lookup ON public.instagram_posted(monitor_id, post_id);

ALTER TABLE public.instagram_posted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage instagram_posted"
ON public.instagram_posted
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());