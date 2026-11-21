CREATE OR REPLACE FUNCTION public.pending_clinical_record_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT count(*)
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
  WHERE s.user_id = auth.uid() AND c.status = 'active' AND s.status <> 'deleting' AND s.session_date <= now()
    AND (s.clinical_status IN ('scheduled', 'pending_record') OR (
      s.clinical_status IS NULL AND NULLIF(btrim(s.manual_notes), '') IS NULL AND s.ai_reviewed_at IS NULL
    ));
$$;

CREATE OR REPLACE FUNCTION public.list_pending_clinical_records(_offset integer DEFAULT 0, _limit integer DEFAULT 31)
RETURNS TABLE (id uuid, client_id uuid, session_date timestamptz, title text, client_name text, overdue boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT s.id, s.client_id, s.session_date, s.title,
    COALESCE(NULLIF(c.preferred_name, ''), c.full_name),
    COALESCE(s.clinical_status = 'scheduled', false)
  FROM public.clinical_sessions s
  JOIN public.clients c ON c.id = s.client_id AND c.professional_id = auth.uid()
  WHERE s.user_id = auth.uid() AND c.status = 'active' AND s.status <> 'deleting' AND s.session_date <= now()
    AND (s.clinical_status IN ('scheduled', 'pending_record') OR (
      s.clinical_status IS NULL AND NULLIF(btrim(s.manual_notes), '') IS NULL AND s.ai_reviewed_at IS NULL
    ))
  ORDER BY s.session_date DESC, s.id
  LIMIT LEAST(101, GREATEST(1, _limit))
  OFFSET GREATEST(0, _offset);
$$;

REVOKE ALL ON FUNCTION public.list_pending_clinical_records(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_clinical_records(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.mesa_pending_clinical_records()
RETURNS TABLE (id uuid, client_id uuid, session_date timestamptz, title text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT p.id, p.client_id, p.session_date, p.title
  FROM public.list_pending_clinical_records(0, 5) AS p;
$$;
