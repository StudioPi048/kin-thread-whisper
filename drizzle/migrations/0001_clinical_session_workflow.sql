ALTER TABLE public.clinical_sessions
  ADD COLUMN IF NOT EXISTS clinical_status text,
  ADD COLUMN IF NOT EXISTS manual_notes text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS time_zone text;
ALTER TABLE public.clinical_sessions
  ADD CONSTRAINT clinical_sessions_clinical_status_chk
  CHECK (clinical_status IS NULL OR clinical_status IN ('scheduled','in_progress','pending_record','completed'));
ALTER TABLE public.clinical_sessions
  ADD CONSTRAINT clinical_sessions_planned_duration_chk
  CHECK (planned_duration_minutes IS NULL OR planned_duration_minutes BETWEEN 10 AND 480);