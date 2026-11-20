ALTER TABLE public.client_intakes
  ADD COLUMN IF NOT EXISTS field_context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(field_context) = 'object'),
  ADD COLUMN IF NOT EXISTS last_field_edited text;

ALTER TABLE public.audio_consent_events
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS term_version text CHECK (length(term_version) <= 100),
  ADD COLUMN IF NOT EXISTS document_reference text CHECK (length(document_reference) <= 500);

CREATE OR REPLACE FUNCTION public.record_audio_consent_details(
  _client_id uuid, _scope text, _granted boolean, _source text,
  _session_id uuid DEFAULT NULL, _term_version text DEFAULT NULL, _document_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()
  ) OR (_session_id IS NOT NULL AND NOT EXISTS (
    SELECT FROM public.clinical_sessions s
    WHERE s.id = _session_id AND s.client_id = _client_id AND s.user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'Caso ou sessão indisponível' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 2457));
  INSERT INTO public.audio_consent_events (
    client_id, professional_id, scope, granted, source, session_id, term_version, document_reference
  ) VALUES (
    _client_id, auth.uid(), _scope, _granted, _source, _session_id,
    NULLIF(btrim(_term_version), ''), NULLIF(btrim(_document_reference), '')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.record_audio_consent_details(uuid, text, boolean, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_audio_consent_details(uuid, text, boolean, text, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.active_audio_consent_for_session(
  _client_id uuid, _professional_id uuid, _scope text, _session_id uuid
)
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT CASE WHEN e.granted THEN e.id END
    FROM public.audio_consent_events e
   WHERE e.client_id = _client_id AND e.professional_id = _professional_id
     AND e.scope = _scope AND (e.session_id IS NULL OR e.session_id = _session_id)
   ORDER BY e.revision DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.active_audio_consent_for_session(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_audio_consent_for_session(uuid, uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_session_audio_attachment()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
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
  active_grant := public.active_audio_consent_for_session(NEW.client_id, NEW.user_id, 'recording', NEW.id);
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

DROP POLICY IF EXISTS "Session audio requires current recording consent" ON storage.objects;
CREATE POLICY "Session audio requires current recording consent"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'session-audio' OR EXISTS (
    SELECT 1
      FROM public.clinical_sessions s
      JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
     WHERE s.user_id = auth.uid() AND s.audio_path = name AND s.status = 'awaiting_upload'
       AND s.recording_consent_id = public.active_audio_consent_for_session(
         s.client_id, s.user_id, 'recording', s.id
       )
  ));

ALTER TABLE public.clinical_sessions
  ADD COLUMN IF NOT EXISTS processing_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(transcript_segments) = 'array'),
  ADD COLUMN IF NOT EXISTS transcript_reviews jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(transcript_reviews) = 'object');

CREATE OR REPLACE FUNCTION public.mesa_pending_clinical_records()
RETURNS TABLE (id uuid, client_id uuid, session_date timestamptz, title text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT s.id, s.client_id, s.session_date, s.title
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
  WHERE s.user_id = auth.uid() AND s.session_date <= now()
    AND (s.clinical_status = 'pending_record' OR (
      s.clinical_status IS NULL AND NULLIF(btrim(s.manual_notes), '') IS NULL AND s.ai_reviewed_at IS NULL
    ))
  ORDER BY s.session_date DESC, s.id
  LIMIT 5;
$$;
REVOKE ALL ON FUNCTION public.mesa_pending_clinical_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mesa_pending_clinical_records() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_timeline_cases(
  _status text DEFAULT 'active', _search text DEFAULT '', _offset integer DEFAULT 0
)
RETURNS TABLE (id uuid, full_name text, preferred_name text, has_events boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH visible AS (
    SELECT c.id, c.full_name, c.preferred_name
      FROM public.clients c
      WHERE c.professional_id = auth.uid() AND c.status::text = _status
        AND position(
          translate(lower(left(btrim(_search), 120)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
          IN translate(lower(concat_ws(' ', c.full_name, c.preferred_name)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
        ) > 0
      ORDER BY c.full_name, c.id
      OFFSET greatest(_offset, 0) LIMIT 13
  )
  SELECT v.id, v.full_name, v.preferred_name,
    EXISTS (
      SELECT FROM public.genogram_persons p WHERE p.client_id = v.id AND (
        p.birth_date IS NOT NULL OR p.death_date IS NOT NULL OR p.is_deceased
        OR p.birth_date_partial IS NOT NULL OR p.death_date_partial IS NOT NULL
        OR p.notes LIKE '%[Importação] Nascimento informado:%'
        OR p.notes LIKE '%[Importação] Falecimento informado:%'
        OR CASE WHEN jsonb_typeof(p.life_events) = 'array' THEN jsonb_array_length(p.life_events) > 0 ELSE false END
      )
    ) OR EXISTS (
      SELECT FROM public.genogram_relationships r
      WHERE r.client_id = v.id AND r.relationship_type = 'union' AND (r.start_date IS NOT NULL OR r.end_date IS NOT NULL)
    )
    FROM visible v ORDER BY v.full_name, v.id;
$$;
REVOKE ALL ON FUNCTION public.list_timeline_cases(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_timeline_cases(text, text, integer) TO authenticated;
