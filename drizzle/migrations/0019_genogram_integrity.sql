-- Editor mutations that must update related rows together.
CREATE FUNCTION public.save_genogram_arrangement(
  _client_id uuid, _layout_id uuid, _expected timestamptz, _positions jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _layout public.genogram_layouts%ROWTYPE;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501'; END IF;

  IF jsonb_typeof(_positions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Confira as posições do mapa.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_positions) AS x(id uuid, x integer, y integer)
    LEFT JOIN public.genogram_persons p ON p.id = x.id AND p.client_id = _client_id
    WHERE p.id IS NULL OR x.x IS NULL OR x.y IS NULL
  ) THEN
    RAISE EXCEPTION 'Uma pessoa mudou desde que o mapa foi aberto. Atualize antes de salvar.' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO _layout FROM public.genogram_layouts l WHERE l.client_id = _client_id
  ORDER BY l.updated_at DESC, l.id ASC LIMIT 1 FOR UPDATE;
  IF (_layout.id, _layout.updated_at) IS DISTINCT FROM (_layout_id, _expected) THEN
    RAISE EXCEPTION 'O arranjo mudou em outra aba. O rascunho local foi preservado.' USING ERRCODE = '40001';
  END IF;
  IF _layout.is_fixed THEN
    RAISE EXCEPTION 'As posições já estão fixadas. Libere o arranjo antes de editar.' USING ERRCODE = '22023';
  END IF;
  IF _layout.id IS NULL THEN
    INSERT INTO public.genogram_layouts (client_id) VALUES (_client_id) RETURNING * INTO _layout;
  ELSE
    UPDATE public.genogram_layouts AS l SET updated_at = clock_timestamp()
      WHERE l.id = _layout.id RETURNING l.* INTO _layout;
  END IF;

  INSERT INTO public.genogram_node_positions (layout_id, node_id, node_type, x, y, layout_mode)
  SELECT _layout.id, p.id, 'person', p.x, p.y, 'MANUAL'
    FROM jsonb_to_recordset(_positions) AS p(id uuid, x integer, y integer)
  ON CONFLICT (layout_id, node_id) DO UPDATE
  SET x = excluded.x, y = excluded.y, node_type = 'person', layout_mode = 'MANUAL';
  RETURN to_jsonb(_layout);
END;
$$;

CREATE FUNCTION public.remove_genogram_selection(
  _client_id uuid, _people uuid[], _relationships uuid[], _expected jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _impact jsonb;
  _people_ids uuid[];
  _link_ids uuid[];
  _person_count integer;
  _link_count integer;
  _reviews integer;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 8008));
  SELECT coalesce(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO _people_ids
    FROM unnest(_people) AS s(id);
  SELECT coalesce(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO _link_ids
    FROM unnest(_relationships) AS s(id);
  IF cardinality(_people_ids) + cardinality(_link_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma pessoa ou vínculo.' USING ERRCODE = '22023';
  END IF;

  PERFORM p.id FROM public.genogram_persons p
    WHERE p.client_id = _client_id AND p.id = ANY(_people_ids) AND NOT p.is_proband FOR UPDATE;
  GET DIAGNOSTICS _person_count = ROW_COUNT;
  PERFORM r.id FROM public.genogram_relationships r WHERE r.client_id = _client_id
    AND r.id = ANY(_link_ids) AND r.relationship_type <> 'parent' FOR UPDATE;
  GET DIAGNOSTICS _link_count = ROW_COUNT;
  IF _person_count <> cardinality(_people_ids) OR _link_count <> cardinality(_link_ids) THEN
    RAISE EXCEPTION 'A seleção mudou ou inclui um item indisponível. Atualize e confira o mapa.' USING ERRCODE = '40001';
  END IF;

  SELECT count(*) INTO _link_count FROM public.genogram_relationships r
    WHERE r.client_id = _client_id AND (r.id = ANY(_link_ids)
      OR r.from_person_id = ANY(_people_ids) OR r.to_person_id = ANY(_people_ids));
  SELECT count(*) INTO _reviews FROM public.genogram_parentage_reviews r
    WHERE r.client_id = _client_id AND r.child_id = ANY(_people_ids);
  SELECT jsonb_build_object(
    'people', _person_count, 'relationships', _link_count, 'reviews', _reviews,
    'personVersions', (
      SELECT coalesce(jsonb_agg(jsonb_build_array(p.id, p.updated_at) ORDER BY p.id), '[]'::jsonb)
      FROM public.genogram_persons p WHERE p.id = ANY(_people_ids)
    ),
    'relationshipVersions', (
      SELECT coalesce(jsonb_agg(jsonb_build_array(r.id, r.updated_at) ORDER BY r.id), '[]'::jsonb)
      FROM public.genogram_relationships r WHERE r.client_id = _client_id AND (r.id = ANY(_link_ids)
        OR r.from_person_id = ANY(_people_ids) OR r.to_person_id = ANY(_people_ids))
    )
  ) INTO _impact;
  IF _expected IS NULL THEN RETURN _impact; END IF;
  IF _impact IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'Os vínculos ou a seleção mudaram. Confira novamente antes de remover.' USING ERRCODE = '40001';
  END IF;

  DELETE FROM public.genogram_relationships r WHERE r.client_id = _client_id AND r.id = ANY(_link_ids);
  DELETE FROM public.genogram_node_positions n USING public.genogram_layouts l
    WHERE n.layout_id = l.id AND l.client_id = _client_id AND n.node_id::text = ANY(_people_ids::text[]);
  DELETE FROM public.genogram_persons p WHERE p.client_id = _client_id AND p.id = ANY(_people_ids);
  RETURN _impact;
END;
$$;

CREATE FUNCTION public.create_genogram_relative(
  _client_id uuid, _person jsonb, _target_id uuid, _direction text, _kind text,
  _expected jsonb DEFAULT NULL, _replaces uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _new_id uuid;
  _desired public.genogram_persons%ROWTYPE;
  _parents jsonb;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR NO KEY UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.genogram_persons p WHERE p.client_id = _client_id AND p.id = _target_id
  ) THEN
    RAISE EXCEPTION 'Dossiê ou familiar indisponível.' USING ERRCODE = '42501';
  END IF;
  IF _direction IS NULL OR _direction NOT IN ('parent', 'child', 'sibling')
     OR _kind IS NULL OR (
       _direction = 'sibling' AND _kind NOT IN ('biological', 'twin', 'half', 'adoptive', 'unknown')
     ) OR (
       _direction <> 'sibling' AND _kind NOT IN ('biological', 'adoptive', 'foster', 'stepparent', 'unknown')
     ) THEN
    RAISE EXCEPTION 'Confira a direção e a natureza do vínculo.' USING ERRCODE = '22023';
  END IF;
  _desired := jsonb_populate_record(NULL::public.genogram_persons, _person);
  IF nullif(btrim(_desired.full_name), '') IS NULL OR _desired.death_date < _desired.birth_date THEN
    RAISE EXCEPTION 'Confira o nome e as datas do familiar.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.genogram_persons (
    client_id, full_name, preferred_name, gender, relationship_to_proband, birth_date, birth_date_partial,
    death_date, death_date_partial, is_deceased, cause_of_death, occupation, health_conditions, life_events, notes
  ) VALUES (
    _client_id, btrim(_desired.full_name), _desired.preferred_name, _desired.gender, _desired.relationship_to_proband,
    _desired.birth_date, _desired.birth_date_partial, _desired.death_date, _desired.death_date_partial,
    coalesce(_desired.is_deceased, false), _desired.cause_of_death, _desired.occupation,
    coalesce(_desired.health_conditions, '{}'::text[]), coalesce(_desired.life_events, '[]'::jsonb), _desired.notes
  ) RETURNING id INTO _new_id;

  IF _direction = 'sibling' THEN
    INSERT INTO public.genogram_relationships (client_id, from_person_id, to_person_id, relationship_type, qualifier)
      VALUES (_client_id, _target_id, _new_id, 'sibling', _kind);
  ELSIF _direction = 'child' THEN
    PERFORM public.review_parentage(_client_id, _new_id, '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('personId', _target_id, 'kind', _kind)),
      'edit', 'unverified', NULL);
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object('personId', r.from_person_id, 'kind', NULL::text)), '[]'::jsonb)
      INTO _parents FROM public.genogram_relationships r WHERE r.client_id = _client_id
      AND r.relationship_type = 'parent' AND r.to_person_id = _target_id
      AND r.from_person_id IS DISTINCT FROM _replaces;
    _parents := _parents || jsonb_build_array(jsonb_build_object('personId', _new_id, 'kind', _kind));
    PERFORM public.review_parentage(_client_id, _target_id, _expected, _parents, 'edit', 'unverified', NULL);
  END IF;
  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_genogram_arrangement(uuid, uuid, timestamptz, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_genogram_selection(uuid, uuid[], uuid[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_genogram_relative(uuid, jsonb, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_genogram_arrangement(uuid, uuid, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_genogram_selection(uuid, uuid[], uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_genogram_relative(uuid, jsonb, uuid, text, text, jsonb, uuid) TO authenticated;
