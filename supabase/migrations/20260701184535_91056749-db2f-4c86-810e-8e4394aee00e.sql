
-- 1) user_features
CREATE TABLE public.user_features (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_key)
);

GRANT SELECT ON public.user_features TO authenticated;
GRANT ALL ON public.user_features TO service_role;

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own features"
  ON public.user_features FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins manage features"
  ON public.user_features FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_user_features_updated
  BEFORE UPDATE ON public.user_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) has_feature helper
CREATE OR REPLACE FUNCTION public.has_feature(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_features
    WHERE user_id = _user_id AND feature_key = _key AND enabled = true
  ) OR EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND is_admin = true
  );
$$;

-- 3) ad_schedules
CREATE TABLE public.ad_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL UNIQUE REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  times text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_schedules TO authenticated;
GRANT ALL ON public.ad_schedules TO service_role;

ALTER TABLE public.ad_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner selects own schedules"
  ON public.ad_schedules FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Owner with feature can insert schedules"
  ON public.ad_schedules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_feature(auth.uid(), 'ad_scheduling'));

CREATE POLICY "Owner with feature can update schedules"
  ON public.ad_schedules FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.has_feature(auth.uid(), 'ad_scheduling'))
  WITH CHECK (auth.uid() = user_id AND public.has_feature(auth.uid(), 'ad_scheduling'));

CREATE POLICY "Owner deletes own schedules"
  ON public.ad_schedules FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE TRIGGER trg_ad_schedules_updated
  BEFORE UPDATE ON public.ad_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ad_schedules_active ON public.ad_schedules(active) WHERE active = true;

-- 4) ad_schedule_runs (dedupe per day/slot)
CREATE TABLE public.ad_schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.ad_schedules(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  slot text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok',
  detail text,
  UNIQUE (schedule_id, run_date, slot)
);

GRANT SELECT ON public.ad_schedule_runs TO authenticated;
GRANT ALL ON public.ad_schedule_runs TO service_role;

ALTER TABLE public.ad_schedule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own runs"
  ON public.ad_schedule_runs FOR SELECT TO authenticated
  USING (
    EXISTS(SELECT 1 FROM public.ad_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.is_admin()))
  );
