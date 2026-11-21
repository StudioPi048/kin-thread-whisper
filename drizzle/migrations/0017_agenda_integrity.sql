-- A mesma regra de ocupação é usada pelo agendamento e pela reativação.
CREATE FUNCTION public.agenda_busy_slots(_owner uuid, _now timestamptz, _include_archived uuid)
RETURNS TABLE (id uuid, client_id uuid, start_at timestamptz, end_at timestamptz,
  patient text, updated_at timestamptz, duration_minutes integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT s.id, s.client_id, s.session_date,
    s.session_date + make_interval(mins => duration.minutes),
    COALESCE(NULLIF(c.preferred_name, ''), c.full_name), s.updated_at, duration.minutes
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = _owner
  CROSS JOIN LATERAL (
    SELECT COALESCE(s.planned_duration_minutes,
      CASE WHEN s.status = 'scheduled' AND s.duration_seconds > 0
        THEN GREATEST(10, round(s.duration_seconds / 60.0)::integer) END, 60) AS minutes
  ) AS duration
  WHERE s.user_id = _owner AND s.status <> 'deleting'
    AND (c.status = 'active' OR c.id = _include_archived)
    AND (s.clinical_status IN ('scheduled', 'in_progress') OR (s.clinical_status IS NULL AND s.session_date > _now));
$$;

REVOKE ALL ON FUNCTION public.agenda_busy_slots(uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_busy_slots(uuid, timestamptz, uuid) TO authenticated;

CREATE FUNCTION public.manage_clinical_appointment_v2(
  _action text,
  _session_id uuid,
  _client_id uuid DEFAULT NULL,
  _start timestamptz DEFAULT NULL,
  _duration_minutes integer DEFAULT NULL,
  _time_zone text DEFAULT NULL,
  _title text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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
    IF _session.id IS NULL OR _session.status = 'deleting' THEN
      RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE = '42501';
    END IF;
    IF _action = 'cancel' AND _session.clinical_status = 'canceled' THEN
      RETURN jsonb_build_object('ok', true, 'sessionId', _session.id, 'clientId', _session.client_id, 'startISO', _session.session_date);
    END IF;
    IF _expected_updated_at IS NOT NULL AND _session.updated_at IS DISTINCT FROM _expected_updated_at THEN
      -- Resubmitting an already applied move after a lost response is safe.
      IF _action = 'reschedule' AND _session.clinical_status = 'scheduled'
         AND _session.session_date = _start AND _session.planned_duration_minutes = _duration_minutes
         AND _session.time_zone = _time_zone THEN
        RETURN jsonb_build_object('ok', true, 'sessionId', _session.id, 'clientId', _session.client_id, 'startISO', _session.session_date);
      END IF;
      RETURN jsonb_build_object('ok', false, 'errors', jsonb_build_array('O atendimento mudou. Atualize a Agenda e confira o horário antes de tentar novamente.'),
        'conflicts', '[]'::jsonb, 'stale', true, 'currentStartISO', _session.session_date);
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
    SELECT 1 FROM public.clients c WHERE c.id = _case_id AND c.professional_id = _owner AND (c.status = 'active' OR _action = 'reschedule')
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
    SELECT s.id, s.start_at AS "startISO", s.patient
    FROM public.agenda_busy_slots(_owner, _now, CASE WHEN _action = 'reschedule' THEN _case_id END) s
    WHERE s.id <> _session_id
      AND s.start_at < _start + make_interval(mins => _duration_minutes)
      AND _start < s.end_at
    ORDER BY s.start_at, s.id
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

REVOKE ALL ON FUNCTION public.manage_clinical_appointment_v2(text, uuid, uuid, timestamptz, integer, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_clinical_appointment_v2(text, uuid, uuid, timestamptz, integer, text, text, timestamptz) TO authenticated;

-- Clientes antigos continuam usando a regra atualizada de disponibilidade.
CREATE OR REPLACE FUNCTION public.manage_clinical_appointment(
  _action text, _session_id uuid, _client_id uuid DEFAULT NULL,
  _start timestamptz DEFAULT NULL, _duration_minutes integer DEFAULT NULL,
  _time_zone text DEFAULT NULL, _title text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  SELECT public.manage_clinical_appointment_v2(_action, _session_id, _client_id,
    _start, _duration_minutes, _time_zone, _title, NULL);
$$;

CREATE FUNCTION public.check_agenda_on_dossier_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _now timestamptz;
  _blocked jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  -- Serializa arquivamento e reativação com o agendamento do profissional.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.professional_id::text, 6041));
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  _now := clock_timestamp();
  WITH slots AS MATERIALIZED (
    SELECT * FROM public.agenda_busy_slots(NEW.professional_id, _now, NEW.id)
  )
  SELECT jsonb_agg(to_jsonb(slot) ORDER BY slot."startISO", slot.id)
    INTO _blocked
  FROM (
    SELECT pending.id, pending.start_at AS "startISO", pending.updated_at AS "updatedAt",
           pending.duration_minutes AS "durationMin", existing.patient AS "conflictName",
           existing.start_at AS "conflictStartISO"
    FROM slots pending
    CROSS JOIN LATERAL (
      SELECT other.patient, other.start_at
      FROM slots other
      WHERE other.id <> pending.id
        AND other.start_at < pending.end_at AND pending.start_at < other.end_at
      ORDER BY other.start_at, other.id
      LIMIT 1
    ) AS existing
    WHERE pending.client_id = NEW.id AND pending.end_at > _now
    ORDER BY pending.start_at, pending.id
    LIMIT 5
  ) AS slot;

  IF _blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Reagende os atendimentos em conflito antes de reativar o dossiê.'
      USING ERRCODE = '23P01', DETAIL = _blocked::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_agenda_on_dossier_status_change
  BEFORE UPDATE OF status ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.check_agenda_on_dossier_status_change();

CREATE FUNCTION public.list_pending_clinical_records_v2(_offset integer DEFAULT 0, _limit integer DEFAULT 31)
RETURNS TABLE (
  id uuid, client_id uuid, session_date timestamptz, title text, client_name text, overdue boolean,
  updated_at timestamptz, status text, clinical_status text, duration_seconds integer, planned_duration_minutes integer
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT p.id, p.client_id, p.session_date, p.title, p.client_name, p.overdue,
    s.updated_at, s.status, s.clinical_status, s.duration_seconds, s.planned_duration_minutes
  FROM public.list_pending_clinical_records(_offset, _limit) p
  JOIN public.clinical_sessions s ON s.id = p.id
  ORDER BY p.session_date DESC, p.id;
$$;

REVOKE ALL ON FUNCTION public.list_pending_clinical_records_v2(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_clinical_records_v2(integer, integer) TO authenticated;
