-- Impede reservar ou confirmar um áudio novo se o cancelamento venceu a corrida.
-- O áudio que já estava confirmado continua no histórico da sessão.
CREATE FUNCTION public.reject_canceled_session_audio_attachment()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.clinical_status IS DISTINCT FROM 'canceled' OR NEW.audio_path IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'A sessão foi cancelada. Selecione um destino autorizado para guardar o áudio.' USING ERRCODE = '22023';
  END IF;
  IF NEW.audio_path IS DISTINCT FROM OLD.audio_path
     OR (OLD.status = 'awaiting_upload' AND NEW.status = 'draft') THEN
    RAISE EXCEPTION 'A sessão foi cancelada. Selecione um destino autorizado para guardar o áudio.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reject_canceled_session_audio_attachment
  BEFORE INSERT OR UPDATE OF audio_path, status ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.reject_canceled_session_audio_attachment();

CREATE OR REPLACE FUNCTION public.can_upload_reserved_session_audio(_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  session_row public.clinical_sessions;
BEGIN
  SELECT s.* INTO session_row FROM public.clinical_sessions s
    JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
   WHERE s.audio_path = _name AND s.user_id = auth.uid() AND s.status = 'awaiting_upload'
     AND s.clinical_status IS DISTINCT FROM 'canceled'
   FOR SHARE OF s;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(session_row.client_id::text, 2457));
  RETURN session_row.recording_consent_id IS NOT NULL
    AND session_row.recording_consent_id IS NOT DISTINCT FROM
       public.active_audio_consent_for_session(session_row.client_id, session_row.user_id, 'recording', session_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_session_audio_upload(_session_id uuid, _path text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  session_row public.clinical_sessions;
BEGIN
  SELECT s.* INTO session_row FROM public.clinical_sessions s
    JOIN public.clients c ON c.id = s.client_id AND c.professional_id = owner_id
   WHERE s.id = _session_id AND s.user_id = owner_id
   FOR UPDATE OF s;
  IF NOT FOUND OR _path IS NULL OR session_row.audio_path IS DISTINCT FROM _path
     OR pg_catalog.split_part(_path, '/', 1) <> owner_id::text
     OR pg_catalog.split_part(_path, '/', 2) <> session_row.client_id::text
     OR pg_catalog.split_part(_path, '/', 3) <> session_row.id::text THEN
    RETURN 'unavailable';
  END IF;
  IF session_row.status NOT IN ('awaiting_upload', 'draft', 'transcribing', 'structuring', 'ready', 'error') THEN
    RETURN 'unavailable';
  END IF;
  IF session_row.status = 'awaiting_upload' AND session_row.clinical_status = 'canceled' THEN
    RETURN 'canceled';
  END IF;
  IF NOT EXISTS (SELECT FROM storage.objects WHERE bucket_id = 'session-audio' AND name = _path) THEN
    RETURN 'missing';
  END IF;
  IF session_row.status = 'awaiting_upload' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(session_row.client_id::text, 2457));
    IF session_row.recording_consent_id IS NULL
       OR session_row.recording_consent_id IS DISTINCT FROM
          public.active_audio_consent_for_session(session_row.client_id, owner_id, 'recording', session_row.id) THEN
      RETURN 'consent';
    END IF;
    UPDATE public.clinical_sessions SET status = 'draft', error_message = NULL WHERE id = _session_id;
  END IF;
  RETURN 'confirmed';
END;
$$;

-- Um identificador por confirmação conserva a mesma decisão após uma resposta perdida.
ALTER TABLE public.audio_consent_events ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX audio_consent_events_unique_request
  ON public.audio_consent_events (professional_id, request_id) WHERE request_id IS NOT NULL;

CREATE FUNCTION public.record_audio_consent_idempotent(
  _request_id uuid, _client_id uuid, _scope text, _granted boolean, _source text,
  _session_id uuid DEFAULT NULL, _term_version text DEFAULT NULL, _document_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  prior public.audio_consent_events%ROWTYPE;
  saved_id uuid;
  term_version_value text := NULLIF(btrim(_term_version), '');
  document_ref_value text := NULLIF(btrim(_document_reference), '');
BEGIN
  IF caller IS NULL OR _request_id IS NULL OR NOT EXISTS (
    SELECT FROM public.clients c WHERE c.id = _client_id AND c.professional_id = caller
  ) THEN
    RAISE EXCEPTION 'Caso ou confirmação indisponível.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(caller::text || ':' || _request_id::text, 2460));
  SELECT * INTO prior FROM public.audio_consent_events e
    WHERE e.professional_id = caller AND e.request_id = _request_id;
  IF FOUND THEN
    IF ROW(prior.client_id, prior.scope, prior.granted, prior.source, prior.session_id,
           prior.term_version, prior.document_reference)
       IS DISTINCT FROM ROW(_client_id, _scope, _granted, _source, _session_id,
                           term_version_value, document_ref_value) THEN
      RAISE EXCEPTION 'Esta confirmação já foi registrada com outros dados.' USING ERRCODE = '22023';
    END IF;
    RETURN prior.id;
  END IF;
  IF _session_id IS NOT NULL AND NOT EXISTS (
    SELECT FROM public.clinical_sessions s
      WHERE s.id = _session_id AND s.client_id = _client_id AND s.user_id = caller
  ) THEN
    RAISE EXCEPTION 'Caso ou sessão indisponível.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 2457));
  INSERT INTO public.audio_consent_events (
    client_id, professional_id, scope, granted, source, session_id,
    term_version, document_reference, request_id
  ) VALUES (
    _client_id, caller, _scope, _granted, _source, _session_id,
    term_version_value, document_ref_value, _request_id
  ) RETURNING id INTO saved_id;
  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_audio_consent_idempotent(uuid, uuid, text, boolean, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audio_consent_idempotent(uuid, uuid, text, boolean, text, uuid, text, text) TO authenticated;
