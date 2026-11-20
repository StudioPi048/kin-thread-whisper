ALTER TABLE public.clinical_sessions
  DROP CONSTRAINT IF EXISTS clinical_sessions_clinical_status_chk;
ALTER TABLE public.clinical_sessions
  ADD CONSTRAINT clinical_sessions_clinical_status_chk
  CHECK (clinical_status IS NULL OR clinical_status IN (
    'scheduled', 'in_progress', 'pending_record', 'completed', 'canceled'
  ));

CREATE OR REPLACE FUNCTION public.manage_clinical_appointment(
  _action text,
  _session_id uuid,
  _client_id uuid DEFAULT NULL,
  _start timestamptz DEFAULT NULL,
  _duration_minutes integer DEFAULT NULL,
  _time_zone text DEFAULT NULL,
  _title text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _owner uuid := auth.uid();
  _session public.clinical_sessions%ROWTYPE;
  _case_id uuid;
  _now timestamptz;
  _conflicts jsonb;
BEGIN
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Sem sessão autenticada.' USING ERRCODE = '42501';
  END IF;
  IF _action IS NULL OR _action NOT IN ('schedule', 'reschedule', 'cancel') OR _session_id IS NULL THEN
    RAISE EXCEPTION 'Ação de agendamento inválida.' USING ERRCODE = '22023';
  END IF;

  -- Serializa a consulta de disponibilidade e a gravação de um profissional.
  PERFORM pg_advisory_xact_lock(hashtextextended(_owner::text, 6041));
  _now := clock_timestamp();

  SELECT s.* INTO _session
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = _owner
  WHERE s.id = _session_id AND s.user_id = _owner
  FOR UPDATE OF s;

  IF _action = 'schedule' AND _session.id IS NOT NULL THEN
    IF _session.client_id = _client_id AND _session.session_date = _start
       AND _session.planned_duration_minutes = _duration_minutes
       AND _session.time_zone = _time_zone AND _session.clinical_status = 'scheduled' THEN
      RETURN jsonb_build_object('ok', true, 'sessionId', _session.id, 'clientId', _session.client_id, 'startISO', _session.session_date);
    END IF;
    RAISE EXCEPTION 'Este agendamento já existe. Abra a agenda para conferi-lo.' USING ERRCODE = '22023';
  END IF;

  IF _action <> 'schedule' THEN
    IF _session.id IS NULL THEN
      RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE = '42501';
    END IF;
    IF _action = 'cancel' AND _session.clinical_status = 'canceled' THEN
      RETURN jsonb_build_object('ok', true, 'sessionId', _session.id, 'clientId', _session.client_id, 'startISO', _session.session_date);
    END IF;
    IF NOT COALESCE(_session.clinical_status = 'scheduled', _session.session_date > _now) THEN
      RAISE EXCEPTION 'Este atendimento não está agendado.' USING ERRCODE = '22023';
    END IF;
    IF _action = 'cancel' THEN
      UPDATE public.clinical_sessions SET clinical_status = 'canceled' WHERE id = _session.id;
      RETURN jsonb_build_object('ok', true, 'sessionId', _session.id, 'clientId', _session.client_id, 'startISO', _session.session_date);
    END IF;
  END IF;

  _case_id := CASE WHEN _action = 'schedule' THEN _client_id ELSE _session.client_id END;
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = _case_id AND c.professional_id = _owner AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Selecione um dossiê ativo da sua conta.' USING ERRCODE = '42501';
  END IF;
  IF _start IS NULL OR NOT isfinite(_start) OR _start <= _now
     OR _duration_minutes IS NULL OR _duration_minutes NOT BETWEEN 10 AND 480 THEN
    RAISE EXCEPTION 'Informe um horário futuro e uma duração entre 10 e 480 minutos.' USING ERRCODE = '22023';
  END IF;
  IF _time_zone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _time_zone) THEN
    RAISE EXCEPTION 'Fuso horário desconhecido.' USING ERRCODE = '22023';
  END IF;
  IF length(_title) > 120 THEN
    RAISE EXCEPTION 'Use até 120 caracteres no título.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(slot)), '[]'::jsonb) INTO _conflicts
  FROM (
    SELECT s.id, s.session_date AS "startISO", COALESCE(NULLIF(c.preferred_name, ''), c.full_name) AS patient
    FROM public.clinical_sessions s
    JOIN public.clients c ON c.id = s.client_id AND c.professional_id = _owner
    WHERE s.user_id = _owner AND s.id <> _session_id
      AND (s.clinical_status IN ('scheduled', 'in_progress') OR (s.clinical_status IS NULL AND s.session_date > _now))
      AND s.session_date < _start + make_interval(mins => _duration_minutes)
      AND _start < s.session_date + make_interval(mins => COALESCE(
        s.planned_duration_minutes,
        CASE WHEN s.status = 'scheduled' AND s.duration_seconds > 0
          THEN GREATEST(10, round(s.duration_seconds / 60.0)::int) END,
        60
      ))
    ORDER BY s.session_date, s.id
    LIMIT 5
  ) AS slot;

  IF jsonb_array_length(_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'errors', jsonb_build_array('Esse horário coincide com outro atendimento.'), 'conflicts', _conflicts);
  END IF;

  IF _action = 'schedule' THEN
    INSERT INTO public.clinical_sessions (
      id, client_id, user_id, session_date, title, status, clinical_status, planned_duration_minutes, time_zone
    ) VALUES (
      _session_id, _case_id, _owner, _start, COALESCE(NULLIF(btrim(_title), ''), 'Atendimento'),
      'draft', 'scheduled', _duration_minutes, _time_zone
    );
  ELSE
    UPDATE public.clinical_sessions
      SET session_date = _start, planned_duration_minutes = _duration_minutes, time_zone = _time_zone,
          clinical_status = 'scheduled'
      WHERE id = _session.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'sessionId', _session_id, 'clientId', _case_id, 'startISO', _start);
END;
$$;

REVOKE ALL ON FUNCTION public.manage_clinical_appointment(text, uuid, uuid, timestamptz, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_clinical_appointment(text, uuid, uuid, timestamptz, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pending_clinical_record_count() RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
  WHERE s.user_id = auth.uid() AND s.session_date <= now()
    AND (s.clinical_status = 'pending_record' OR (
      s.clinical_status IS NULL AND NULLIF(btrim(s.manual_notes), '') IS NULL AND s.ai_reviewed_at IS NULL
    ));
$$;

REVOKE ALL ON FUNCTION public.pending_clinical_record_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_clinical_record_count() TO authenticated;
