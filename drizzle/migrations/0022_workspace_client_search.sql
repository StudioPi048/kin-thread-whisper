-- Escopo, busca e posição são resolvidos antes de devolver a página.
CREATE FUNCTION public.search_workspace_clients(
  _status text DEFAULT 'active',
  _search text DEFAULT '',
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 24,
  _details boolean DEFAULT false,
  _without_upcoming boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH needle AS (
    SELECT btrim(COALESCE(_search, '')) AS raw,
      (SELECT string_agg(word[1], '.*' ORDER BY ordinal)
        FROM regexp_matches(
          left(translate(lower(normalize(btrim(COALESCE(_search, '')))),
            'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), 96),
          '[[:alnum:]]+', 'g'
        ) WITH ORDINALITY AS token(word, ordinal)) AS pattern
  ), matched AS MATERIALIZED (
    SELECT c.id, c.full_name, c.preferred_name, c.status, c.created_at,
      c.birth_date, c.birthplace, c.email, c.phone, c.presenting_complaint, c.consent_given_at, c.tags
    FROM public.clients c
    CROSS JOIN needle s
    WHERE c.professional_id = auth.uid()
      AND c.status::text = _status
      AND (s.raw = '' OR
        translate(lower(normalize(concat_ws(' ', c.full_name, c.preferred_name,
          CASE WHEN _details THEN concat_ws(' ', c.birthplace, c.email, c.phone, c.presenting_complaint,
            array_to_string(c.tags, ' ')) END))),
          'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') ~ s.pattern)
      AND (NOT _without_upcoming OR NOT EXISTS (
        SELECT FROM public.clinical_sessions a
        WHERE a.client_id = c.id AND a.user_id = auth.uid() AND a.status <> 'deleting'
          AND (a.clinical_status = 'scheduled' OR a.clinical_status IS NULL)
          AND a.session_date >= now()
      ))
  ), page AS (
    SELECT *
    FROM matched
    ORDER BY CASE WHEN _details THEN created_at END DESC,
      CASE WHEN NOT _details THEN full_name END, id
    OFFSET greatest(COALESCE(_offset, 0), 0) LIMIT least(greatest(COALESCE(_limit, 24), 1), 100)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM matched),
    'clients', COALESCE((
      SELECT jsonb_agg(
        CASE WHEN _details THEN to_jsonb(p) - 'created_at'
          ELSE jsonb_build_object('id', p.id, 'full_name', p.full_name,
            'preferred_name', p.preferred_name, 'status', p.status) END
        ORDER BY CASE WHEN _details THEN p.created_at END DESC,
          CASE WHEN NOT _details THEN p.full_name END, p.id
      ) FROM page p
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.search_workspace_clients(text, text, integer, integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_workspace_clients(text, text, integer, integer, boolean, boolean) TO authenticated;
