
CREATE TABLE public.instagram_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL UNIQUE,
  username text NOT NULL,
  last_post_id text,
  last_checked_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage instagram monitors"
ON public.instagram_monitors FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE TRIGGER trg_instagram_monitors_updated
BEFORE UPDATE ON public.instagram_monitors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
