-- Aplica a configuração final da planilha em uma transação, independentemente da ordem das linhas.
CREATE OR REPLACE FUNCTION public.import_clan_workbook(
  _client_id uuid,
  _people jsonb,
  _links jsonb,
  _parentages jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _item record;
  _current public.genogram_persons%ROWTYPE;
  _desired public.genogram_persons%ROWTYPE;
  _existing_link public.genogram_relationships%ROWTYPE;
  _person_id uuid;
  _from_id uuid;
  _to_id uuid;
  _references jsonb;
  _parent_choices jsonb;
  _parent_plan jsonb := '[]'::jsonb;
  _seen_link_ids uuid[] := '{}'::uuid[];
  _reserved_orders integer[];
  _temporary_order integer;
  _seen_ids uuid[] := '{}'::uuid[];
  _seen_keys text[] := '{}'::text[];
  _inserted integer := 0;
  _updated integer := 0;
  _related integer := 0;
  _reviewed integer := 0;
BEGIN
  PERFORM c.id FROM public.clients c
  WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_people) IS DISTINCT FROM 'array'
     OR jsonb_typeof(_links) IS DISTINCT FROM 'array'
     OR jsonb_typeof(_parentages) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_people) > 2000 OR jsonb_array_length(_links) > 8000
     OR jsonb_array_length(_parentages) > 2000 THEN
    RAISE EXCEPTION 'Confira as abas e o tamanho da planilha.' USING ERRCODE = '22023';
  END IF;

  _person_id := public.ensure_genogram_proband(_client_id);
  SELECT COALESCE(jsonb_object_agg(p.id::text, p.id), '{}'::jsonb) ||
         COALESCE(jsonb_object_agg(p.clan_reference, p.id) FILTER (WHERE p.clan_reference IS NOT NULL), '{}'::jsonb)
    INTO _references FROM public.genogram_persons p WHERE p.client_id = _client_id;
  _references := _references || jsonb_build_object('consultante', _person_id);

  FOR _item IN
    SELECT * FROM jsonb_to_recordset(_people)
      AS x(key text, person_id uuid, expected_updated_at timestamptz, patch jsonb)
  LOOP
    IF _item.key IS NULL OR _item.key !~ '^[A-Za-z0-9_-]{1,80}$'
       OR _item.key = ANY(_seen_keys) OR jsonb_typeof(_item.patch) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'A aba Pessoas contém um ID ausente, inválido ou duplicado.' USING ERRCODE = '22023';
    END IF;
    _seen_keys := array_append(_seen_keys, _item.key);
    IF (_references ->> _item.key)::uuid IS NOT NULL
       AND (_references ->> _item.key)::uuid IS DISTINCT FROM _item.person_id THEN
      RAISE EXCEPTION 'O ID da planilha já está associado a outra pessoa. Confira a prévia.' USING ERRCODE = '40001';
    END IF;

    IF _item.person_id IS NOT NULL THEN
      SELECT p.* INTO _current FROM public.genogram_persons p
      WHERE p.client_id = _client_id AND p.id = _item.person_id FOR UPDATE;
      IF NOT FOUND OR _item.person_id = ANY(_seen_ids) THEN
        RAISE EXCEPTION 'Confira a correspondência das pessoas neste dossiê.' USING ERRCODE = '22023';
      END IF;
      IF _current.updated_at IS DISTINCT FROM _item.expected_updated_at THEN
        RAISE EXCEPTION 'Uma pessoa mudou desde a prévia. Atualize a planilha antes de importar.' USING ERRCODE = '40001';
      END IF;
      IF _current.is_proband AND _item.patch <> '{}'::jsonb THEN
        RAISE EXCEPTION 'Edite a pessoa consultante no cadastro do dossiê.' USING ERRCODE = '22023';
      END IF;
    ELSE
      _current := NULL;
    END IF;

    IF NOT COALESCE(_current.is_proband, false) THEN
      _desired := jsonb_populate_record(_current, _item.patch);
      IF NULLIF(btrim(_desired.full_name), '') IS NULL
         OR lower(btrim(_desired.relationship_to_proband)) IN
            ('consulente', 'consultante', 'paciente', 'proband', 'cliente', 'eu', 'self')
         OR _desired.death_date < _desired.birth_date THEN
        RAISE EXCEPTION 'Confira o nome, o parentesco e as datas na aba Pessoas.' USING ERRCODE = '22023';
      END IF;
      IF _current.id IS NULL THEN
        INSERT INTO public.genogram_persons (
          client_id, clan_reference, full_name, preferred_name, gender, relationship_to_proband,
          birth_date, birth_date_partial, death_date, death_date_partial, is_deceased,
          cause_of_death, gestational_weeks, health_conditions, occupation, vices,
          temperament, birth_order, notes
        ) VALUES (
          _client_id, _item.key, btrim(_desired.full_name), _desired.preferred_name, _desired.gender,
          _desired.relationship_to_proband, _desired.birth_date, _desired.birth_date_partial,
          _desired.death_date, _desired.death_date_partial, COALESCE(_desired.is_deceased, false)
            OR _desired.death_date IS NOT NULL OR _desired.death_date_partial IS NOT NULL,
          _desired.cause_of_death, _desired.gestational_weeks, COALESCE(_desired.health_conditions, '{}'::text[]),
          _desired.occupation, _desired.vices, _desired.temperament, _desired.birth_order, _desired.notes
        ) RETURNING id INTO _current.id;
        _inserted := _inserted + 1;
      ELSIF _item.patch <> '{}'::jsonb OR (_current.clan_reference IS NULL AND _item.key <> _current.id::text) THEN
        UPDATE public.genogram_persons SET
          clan_reference = COALESCE(_current.clan_reference, NULLIF(_item.key, _current.id::text)),
          full_name = btrim(_desired.full_name), preferred_name = _desired.preferred_name,
          gender = _desired.gender, relationship_to_proband = _desired.relationship_to_proband,
          birth_date = _desired.birth_date, birth_date_partial = _desired.birth_date_partial,
          death_date = _desired.death_date, death_date_partial = _desired.death_date_partial,
          is_deceased = COALESCE(_desired.is_deceased, false) OR _desired.death_date IS NOT NULL OR _desired.death_date_partial IS NOT NULL,
          cause_of_death = _desired.cause_of_death, gestational_weeks = _desired.gestational_weeks,
          health_conditions = COALESCE(_desired.health_conditions, '{}'::text[]),
          occupation = _desired.occupation, vices = _desired.vices, temperament = _desired.temperament,
          birth_order = _desired.birth_order, notes = _desired.notes
        WHERE client_id = _client_id AND id = _current.id;
        _updated := _updated + 1;
      END IF;
    END IF;
    _seen_ids := array_append(_seen_ids, _current.id);
    _references := _references || jsonb_build_object(_item.key, _current.id);
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT x.marriage_order), '{}'::integer[]) INTO _reserved_orders
  FROM jsonb_to_recordset(_links) AS x(marriage_order integer) WHERE x.marriage_order IS NOT NULL;

  FOR _item IN
    SELECT * FROM jsonb_to_recordset(_links) AS x(
      key text, relationship_id uuid, expected_updated_at timestamptz, from_key text, to_key text,
      relationship_type text, qualifier text, start_date date, end_date date, notes text,
      marriage_order integer, marriage_order_present boolean
    )
  LOOP
    _from_id := (_references ->> _item.from_key)::uuid;
    _to_id := (_references ->> _item.to_key)::uuid;
    IF _from_id IS NULL OR _to_id IS NULL OR _from_id = _to_id
       OR _item.relationship_type IS NULL OR _item.relationship_type NOT IN ('union', 'sibling', 'emotional')
       OR _item.end_date < _item.start_date
       OR (_item.marriage_order IS NOT NULL AND
           (_item.relationship_type <> 'union' OR _item.marriage_order NOT BETWEEN 1 AND 32767)) THEN
      RAISE EXCEPTION 'Confira os IDs, o tipo e as datas da aba Vínculos.' USING ERRCODE = '22023';
    END IF;
    IF _item.relationship_id IS NOT NULL THEN
      SELECT r.* INTO _existing_link FROM public.genogram_relationships r
       WHERE r.client_id = _client_id AND r.id = _item.relationship_id FOR UPDATE;
      IF NOT FOUND OR _item.relationship_id = ANY(_seen_link_ids)
         OR _existing_link.updated_at IS DISTINCT FROM _item.expected_updated_at
         OR (_existing_link.from_person_id, _existing_link.to_person_id, _existing_link.relationship_type)
             IS DISTINCT FROM (_from_id, _to_id, _item.relationship_type) THEN
        RAISE EXCEPTION 'Um vínculo mudou desde a prévia. Atualize antes de importar.' USING ERRCODE = '40001';
      END IF;
      _seen_link_ids := array_append(_seen_link_ids, _item.relationship_id);
      -- Liberar os ordinais antigos antes de atribuir os novos permite trocas
      -- como 1 ↔ 2 sob o índice único, sem alterar a identidade da união.
      IF _existing_link.relationship_type = 'union' AND _item.marriage_order_present
         AND _existing_link.marriage_order IS DISTINCT FROM _item.marriage_order THEN
        SELECT candidate INTO _temporary_order
        FROM generate_series(32767, 1, -1) AS candidate
        WHERE NOT (candidate = ANY(_reserved_orders)) AND NOT EXISTS (
          SELECT 1 FROM public.genogram_relationships r
          WHERE r.client_id = _client_id AND r.relationship_type = 'union'
            AND LEAST(r.from_person_id, r.to_person_id) = LEAST(_from_id, _to_id)
            AND GREATEST(r.from_person_id, r.to_person_id) = GREATEST(_from_id, _to_id)
            AND r.marriage_order = candidate
        )
        LIMIT 1;
        IF _temporary_order IS NULL THEN
          RAISE EXCEPTION 'Não há uma ordem temporária livre para trocar estas uniões.' USING ERRCODE = '22023';
        END IF;
        UPDATE public.genogram_relationships SET marriage_order = _temporary_order
        WHERE client_id = _client_id AND id = _item.relationship_id;
      END IF;
    END IF;
  END LOOP;

  FOR _item IN
    SELECT * FROM jsonb_to_recordset(_links) AS x(
      key text, relationship_id uuid, expected_updated_at timestamptz, from_key text, to_key text,
      relationship_type text, qualifier text, start_date date, end_date date, notes text,
      marriage_order integer, marriage_order_present boolean
    )
  LOOP
    _from_id := (_references ->> _item.from_key)::uuid;
    _to_id := (_references ->> _item.to_key)::uuid;
    IF _item.relationship_id IS NOT NULL THEN
      SELECT r.* INTO _existing_link FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.id = _item.relationship_id;
      UPDATE public.genogram_relationships
      SET qualifier = _item.qualifier, start_date = _item.start_date, end_date = _item.end_date,
          notes = _item.notes,
          marriage_order = CASE WHEN _item.marriage_order_present THEN _item.marriage_order
                                ELSE _existing_link.marriage_order END,
          clan_reference = COALESCE(_existing_link.clan_reference, NULLIF(_item.key, _existing_link.id::text))
      WHERE client_id = _client_id AND id = _item.relationship_id;
      _related := _related + 1;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND (r.from_person_id, r.to_person_id, r.relationship_type) =
        (_from_id, _to_id, _item.relationship_type)
        AND (r.qualifier, r.start_date, r.end_date, r.notes) IS NOT DISTINCT FROM
          (_item.qualifier, _item.start_date, _item.end_date, _item.notes)
        AND (NOT COALESCE(_item.marriage_order_present, false)
             OR r.marriage_order IS NOT DISTINCT FROM _item.marriage_order)
    ) THEN
      INSERT INTO public.genogram_relationships (
        client_id, clan_reference, from_person_id, to_person_id, relationship_type, qualifier, start_date, end_date, notes,
        marriage_order
      ) VALUES (
        _client_id, _item.key, _from_id, _to_id, _item.relationship_type, _item.qualifier,
        _item.start_date, _item.end_date, _item.notes, _item.marriage_order
      );
      _related := _related + 1;
    END IF;
  END LOOP;

  IF jsonb_array_length(_parentages) > 0 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 8008));
  END IF;
  FOR _item IN
    SELECT * FROM jsonb_to_recordset(_parentages) AS x(child_key text, expected jsonb, parents jsonb)
  LOOP
    _person_id := (_references ->> _item.child_key)::uuid;
    IF _person_id IS NULL OR jsonb_typeof(_item.parents) IS DISTINCT FROM 'array'
       OR jsonb_array_length(_item.parents) = 0 THEN
      RAISE EXCEPTION 'A filiação precisa identificar a pessoa e ao menos um genitor.' USING ERRCODE = '22023';
    END IF;
    SELECT jsonb_agg(jsonb_build_object('personId', _references ->> p.key, 'kind', p.kind))
      INTO _parent_choices FROM jsonb_to_recordset(_item.parents) AS p(key text, kind text);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(_parent_plan) AS existing
      WHERE existing->>'child' = _person_id::text
    ) THEN
      RAISE EXCEPTION 'A mesma pessoa tem dois planos de filiação.' USING ERRCODE = '22023';
    END IF;
    _parent_plan := _parent_plan || jsonb_build_array(jsonb_build_object(
      'child', _person_id, 'expected', _item.expected, 'parents', _parent_choices
    ));
  END LOOP;

  FOR _item IN
    WITH RECURSIVE changes AS (
      SELECT * FROM jsonb_to_recordset(_parent_plan) AS p(child uuid, expected jsonb, parents jsonb)
    ), final_links AS (
      SELECT r.from_person_id AS parent, r.to_person_id AS child
      FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.relationship_type = 'parent'
        AND NOT EXISTS (SELECT 1 FROM changes c WHERE c.child = r.to_person_id)
      UNION ALL
      SELECT (p->>'personId')::uuid, c.child
      FROM changes c CROSS JOIN LATERAL jsonb_array_elements(c.parents) p
      WHERE p->>'personId' IS NOT NULL
    ), ancestors(child, ancestor) AS (
      SELECT c.child, l.parent FROM changes c JOIN final_links l ON l.child = c.child
      UNION
      SELECT a.child, l.parent FROM ancestors a JOIN final_links l ON l.child = a.ancestor
    )
    SELECT c.*, COALESCE(bool_or(a.ancestor = c.child), false) AS closes_cycle
    FROM changes c LEFT JOIN ancestors a ON a.child = c.child
    GROUP BY c.child, c.expected, c.parents
    -- Um ancestral no estado final sempre tem menos ancestrais que o filho.
    -- Aplicá-lo primeiro deixa os guardas de ciclo ativos durante todo o lote.
    ORDER BY count(a.ancestor), c.child
  LOOP
    IF _item.closes_cycle THEN
      RAISE EXCEPTION 'As filiações propostas criam um ciclo. Confira a aba Vínculos.'
        USING ERRCODE = '22023';
    END IF;
    PERFORM public.review_parentage(_client_id, _item.child, _item.expected, _item.parents,
      'edit', 'unverified', 'Origem: planilha do clã. Filiação conferida na prévia de importação.');
    _reviewed := _reviewed + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', _inserted, 'updated', _updated, 'related', _related, 'reviewed', _reviewed);
END;
$$;

CREATE FUNCTION public.remove_empty_clan_rows(_client_id uuid, _candidates jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _removed integer;
BEGIN
  IF jsonb_typeof(_candidates) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Confira as linhas selecionadas.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()) THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;

  -- Adquirir os locks antes de revalidar vínculos, inclusive os criados durante a seleção.
  PERFORM p.id FROM public.genogram_persons p
  JOIN jsonb_to_recordset(_candidates) AS v(id uuid, updated_at timestamptz)
    ON v.id = p.id AND v.updated_at = p.updated_at
  WHERE p.client_id = _client_id AND NOT p.is_proband
  ORDER BY p.id FOR UPDATE OF p;

  DELETE FROM public.genogram_persons p
  USING jsonb_to_recordset(_candidates) AS v(id uuid, updated_at timestamptz)
  WHERE v.id = p.id AND v.updated_at = p.updated_at AND p.client_id = _client_id
    AND NOT p.is_proband AND NOT p.parentage_reviewed AND NOT p.is_deceased
    AND NULLIF(btrim(p.full_name), '') IS NULL AND NULLIF(btrim(p.preferred_name), '') IS NULL
    AND p.birth_date IS NULL AND p.birth_date_partial IS NULL
    AND p.death_date IS NULL AND p.death_date_partial IS NULL
    AND NULLIF(btrim(p.cause_of_death), '') IS NULL AND NULLIF(btrim(p.gestational_weeks), '') IS NULL
    AND COALESCE(cardinality(p.health_conditions), 0) = 0
    AND NULLIF(btrim(p.occupation), '') IS NULL AND NULLIF(btrim(p.vices), '') IS NULL
    AND NULLIF(btrim(p.temperament), '') IS NULL AND p.birth_order IS NULL
    AND NULLIF(btrim(p.notes), '') IS NULL AND COALESCE(cardinality(p.tags), 0) = 0
    AND CASE WHEN jsonb_typeof(p.life_events) = 'array' THEN jsonb_array_length(p.life_events) = 0
             ELSE p.life_events IS NULL OR p.life_events = 'null'::jsonb END
    AND NOT EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND (r.from_person_id = p.id OR r.to_person_id = p.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.genogram_parentage_reviews r
      WHERE r.client_id = _client_id AND r.child_id = p.id
    );
  GET DIAGNOSTICS _removed = ROW_COUNT;
  RETURN _removed;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_empty_clan_rows(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_empty_clan_rows(uuid, jsonb) TO authenticated, service_role;
