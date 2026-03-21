
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.app_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
