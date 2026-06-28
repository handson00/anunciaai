
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text,
  group_ids uuid[] NOT NULL DEFAULT '{}',
  message_type text NOT NULL CHECK (message_type IN ('text','image','video','document','audio','poll','buttons')),
  text text,
  media_url text,
  file_name text,
  poll_options jsonb,
  buttons jsonb,
  scheduled_at timestamptz NOT NULL,
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  next_run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','sent','cancelled','error')),
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam agendamentos"
  ON public.scheduled_messages FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX idx_scheduled_messages_due ON public.scheduled_messages (next_run_at) WHERE status = 'pending';

CREATE TRIGGER trg_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
