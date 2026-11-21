ALTER TABLE public.clinical_sessions
  ADD COLUMN summary_stale boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.transcript_content_edits(reviews jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT coalesce(pg_catalog.jsonb_object_agg(r.key, CASE r.value->>'decision'
    WHEN 'excluded' THEN pg_catalog.to_jsonb(false)
    WHEN 'corrected' THEN pg_catalog.to_jsonb(pg_catalog.btrim(r.value->>'correction'))
  END), '{}'::jsonb)
  FROM pg_catalog.jsonb_each(reviews) r
  WHERE r.value->>'decision' = 'excluded'
     OR (r.value->>'decision' = 'corrected' AND pg_catalog.btrim(r.value->>'correction') <> '');
$$;

UPDATE public.clinical_sessions
  SET summary_stale = true, ai_reviewed_at = NULL
  WHERE structured_note IS NOT NULL
    AND public.transcript_content_edits(transcript_reviews) <> '{}'::jsonb;

CREATE FUNCTION public.invalidate_session_summary_on_transcript_edit()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.structured_note IS NOT NULL
     AND public.transcript_content_edits(NEW.transcript_reviews)
         IS DISTINCT FROM public.transcript_content_edits(OLD.transcript_reviews) THEN
    NEW.summary_stale := true;
  END IF;
  IF NEW.summary_stale THEN
    NEW.ai_reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invalidate_session_summary_on_transcript_edit
  BEFORE UPDATE OF transcript_reviews, summary_stale, ai_reviewed_at
  ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_session_summary_on_transcript_edit();

-- Se a autorização mudar durante uma chamada externa, a resposta não é
-- incorporada ao dossiê depois da revogação.
CREATE FUNCTION public.validate_session_processing_result()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF (OLD.status = 'transcribing' AND NEW.status = 'structuring')
     OR (OLD.status IN ('transcribing', 'structuring') AND NEW.status = 'ready') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.client_id::text, 2457));
    IF NEW.processing_consent_id IS NULL OR NEW.processing_consent_id IS DISTINCT FROM
       public.active_audio_consent_for_session(NEW.client_id, NEW.user_id, 'external_processing', NEW.id) THEN
      RAISE EXCEPTION 'Autorização de processamento indisponível.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_session_processing_result
  BEFORE UPDATE OF status ON public.clinical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_processing_result();

-- Uma reserva não pode ser encerrada entre a verificação da política e o
-- commit do objeto. A mesma linha garante a ordem das duas operações.
CREATE FUNCTION public.can_upload_reserved_session_audio(_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  session_row public.clinical_sessions;
BEGIN
  SELECT s.* INTO session_row FROM public.clinical_sessions s
    JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
   WHERE s.audio_path = _name AND s.user_id = auth.uid() AND s.status = 'awaiting_upload'
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

REVOKE ALL ON FUNCTION public.can_upload_reserved_session_audio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_reserved_session_audio(text) TO authenticated;
DROP POLICY IF EXISTS "Session audio requires current recording consent" ON storage.objects;
CREATE POLICY "Session audio requires current recording consent"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'session-audio' OR public.can_upload_reserved_session_audio(name));

-- A verificação usa o objeto já enviado e a mesma autorização da reserva.
-- A trava de caso é compartilhada com o registro das decisões de consentimento.
CREATE FUNCTION public.confirm_session_audio_upload(_session_id uuid, _path text)
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

-- O estado persistido mantém a limpeza retomável e impede novos envios.
CREATE FUNCTION public.begin_session_deletion(_session_id uuid)
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
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF session_row.audio_path IS NOT NULL
     AND pg_catalog.split_part(session_row.audio_path, '/', 1) <> owner_id::text THEN
    RAISE EXCEPTION 'O caminho do áudio desta sessão não pertence ao profissional.' USING ERRCODE = '42501';
  END IF;
  IF session_row.status <> 'deleting' THEN
    UPDATE public.clinical_sessions
      SET status = 'deleting', processing_attempt_id = NULL, processing_started_at = NULL
      WHERE id = _session_id;
  END IF;
  IF EXISTS (
    SELECT FROM public.clinical_sessions s
    WHERE s.id <> _session_id AND s.audio_path = session_row.audio_path AND s.status <> 'deleting'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN session_row.audio_path;
END;
$$;

CREATE FUNCTION public.finish_session_deletion(_session_id uuid)
RETURNS boolean
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
  IF NOT FOUND THEN
    RETURN true;
  END IF;
  IF session_row.status <> 'deleting' THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT FROM storage.objects o WHERE o.bucket_id = 'session-audio' AND o.name = session_row.audio_path
  ) AND NOT EXISTS (
    SELECT FROM public.clinical_sessions s
    WHERE s.id <> _session_id AND s.audio_path = session_row.audio_path AND s.status <> 'deleting'
  ) THEN
    RETURN false;
  END IF;
  DELETE FROM public.clinical_sessions WHERE id = _session_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_session_audio_upload(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.begin_session_deletion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_session_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_session_audio_upload(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_session_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_session_deletion(uuid) TO authenticated;
