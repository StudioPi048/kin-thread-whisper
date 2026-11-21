CREATE OR REPLACE FUNCTION public.list_timeline_cases(
  _status text DEFAULT 'active', _search text DEFAULT '', _offset integer DEFAULT 0
)
RETURNS TABLE (id uuid, full_name text, preferred_name text, has_events boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH search AS (
    SELECT btrim(_search) AS raw, (
      SELECT string_agg(word[1], '.*' ORDER BY ordinal)
      FROM regexp_matches(
        left(translate(lower(normalize(btrim(_search))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), 96),
        '[[:alnum:]]+',
        'g'
      ) WITH ORDINALITY AS token(word, ordinal)
    ) AS pattern
  ), visible AS (
    SELECT c.id, c.full_name, c.preferred_name
      FROM public.clients c
      CROSS JOIN search s
      WHERE c.professional_id = auth.uid() AND c.status::text = _status
        AND (
          s.raw = ''
          OR translate(lower(normalize(c.full_name)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') ~ s.pattern
          OR translate(lower(normalize(c.preferred_name)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') ~ s.pattern
        )
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
