
CREATE TABLE public.clinical_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  duration_seconds INTEGER,
  audio_path TEXT,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  error_message TEXT,
  structured_note JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.clinical_sessions (client_id, session_date DESC);
CREATE INDEX ON public.clinical_sessions (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_sessions TO authenticated;
GRANT ALL ON public.clinical_sessions TO service_role;

ALTER TABLE public.clinical_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.clinical_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all sessions"
  ON public.clinical_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_clinical_sessions_updated_at
  BEFORE UPDATE ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
