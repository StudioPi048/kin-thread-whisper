-- 1. Extend genogram_persons with clinical fields
ALTER TABLE public.genogram_persons
  ADD COLUMN IF NOT EXISTS cause_of_death text,
  ADD COLUMN IF NOT EXISTS health_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS life_events jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Patterns detected table
CREATE TABLE IF NOT EXISTS public.patterns_detected (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'info',
  person_ids uuid[] NOT NULL DEFAULT '{}',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patterns_detected TO authenticated;
GRANT ALL ON public.patterns_detected TO service_role;

ALTER TABLE public.patterns_detected ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals view own patterns"
  ON public.patterns_detected FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = patterns_detected.client_id
              AND (c.professional_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Professionals insert own patterns"
  ON public.patterns_detected FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = patterns_detected.client_id
              AND c.professional_id = auth.uid())
  );

CREATE POLICY "Professionals update own patterns"
  ON public.patterns_detected FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = patterns_detected.client_id
              AND c.professional_id = auth.uid())
  );

CREATE POLICY "Professionals delete own patterns"
  ON public.patterns_detected FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.clients c
            WHERE c.id = patterns_detected.client_id
              AND c.professional_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS patterns_detected_client_idx ON public.patterns_detected(client_id);

CREATE TRIGGER update_patterns_detected_updated_at
  BEFORE UPDATE ON public.patterns_detected
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
