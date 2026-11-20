CREATE TABLE public.audio_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id),
  scope text NOT NULL CHECK (scope IN ('recording', 'external_processing')),
  granted boolean NOT NULL,
  source text NOT NULL CHECK (source IN ('verbal', 'written', 'documented')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audio_consent_events_latest_idx
  ON public.audio_consent_events (client_id, scope, revision DESC);

ALTER TABLE public.audio_consent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audio_consent_events FROM anon, authenticated;
GRANT SELECT ON public.audio_consent_events TO authenticated;
CREATE POLICY "Professionals read consent history for own clients"
  ON public.audio_consent_events FOR SELECT TO authenticated
  USING (professional_id = auth.uid() AND EXISTS (
    SELECT FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid()
  ));

CREATE FUNCTION public.record_audio_consent(
  _client_id uuid, _scope text, _granted boolean, _source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Caso indisponível' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 2457));
  INSERT INTO public.audio_consent_events (client_id, professional_id, scope, granted, source)
  VALUES (_client_id, auth.uid(), _scope, _granted, _source);
END;
$$;
REVOKE ALL ON FUNCTION public.record_audio_consent(uuid, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audio_consent(uuid, text, boolean, text) TO authenticated;

ALTER TABLE public.clinical_sessions
  ADD COLUMN recording_consent_id uuid REFERENCES public.audio_consent_events(id) ON DELETE SET NULL,
  ADD COLUMN processing_consent_id uuid REFERENCES public.audio_consent_events(id) ON DELETE SET NULL;

CREATE FUNCTION public.validate_session_audio_attachment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  active_grant uuid;
BEGIN
  IF NEW.audio_path IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.audio_path IS NOT DISTINCT FROM OLD.audio_path
       AND NEW.recording_consent_id IS NOT DISTINCT FROM OLD.recording_consent_id
       AND NEW.client_id = OLD.client_id AND NEW.user_id = OLD.user_id AND NEW.id = OLD.id THEN
      RETURN NEW;
    END IF;
  END IF;
  SELECT CASE WHEN granted THEN id END INTO active_grant
    FROM public.audio_consent_events
   WHERE client_id = NEW.client_id AND professional_id = NEW.user_id AND scope = 'recording'
   ORDER BY revision DESC LIMIT 1;
  IF auth.uid() IS DISTINCT FROM NEW.user_id
     OR active_grant IS NULL OR active_grant IS DISTINCT FROM NEW.recording_consent_id
     OR split_part(NEW.audio_path, '/', 1) <> NEW.user_id::text
     OR split_part(NEW.audio_path, '/', 2) <> NEW.client_id::text
     OR split_part(NEW.audio_path, '/', 3) <> NEW.id::text THEN
    RAISE EXCEPTION 'Autorização de gravação indisponível' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_session_audio_attachment
  BEFORE INSERT OR UPDATE OF audio_path, recording_consent_id, client_id, user_id, id
  ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_audio_attachment();

-- Require a reserved session and the current grant even for direct Storage uploads.
-- A restrictive policy also applies when other permissive policies match.
CREATE POLICY "Session audio requires current recording consent"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'session-audio' OR EXISTS (
    SELECT 1
      FROM public.clinical_sessions s
      JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
     WHERE s.user_id = auth.uid() AND s.audio_path = name AND s.status = 'awaiting_upload'
       AND s.recording_consent_id = (
         SELECT CASE WHEN e.granted THEN e.id END FROM public.audio_consent_events e
          WHERE e.client_id = s.client_id AND e.scope = 'recording'
          ORDER BY e.revision DESC LIMIT 1
       )
  ));
