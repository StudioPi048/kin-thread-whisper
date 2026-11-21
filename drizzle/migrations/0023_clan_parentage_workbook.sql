ALTER TABLE public.genogram_parentage_reviews
  ADD COLUMN workbook_import boolean NOT NULL DEFAULT false,
  ADD COLUMN imported_review_key text,
  ADD COLUMN imported_review_created_at timestamptz,
  ADD COLUMN imported_review_decision text;

-- All three collections share the same database snapshot, including the latest
-- review token for children whose parent list is empty.
CREATE FUNCTION public.get_clan_workbook_snapshot(_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'persons', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.genogram_persons p
      WHERE p.client_id = c.id
    ), '[]'::jsonb),
    'relationships', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.genogram_relationships r
      WHERE r.client_id = c.id
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(to_jsonb(last_review) ORDER BY last_review.child_id)
      FROM (
        SELECT DISTINCT ON (r.child_id) r.*
        FROM public.genogram_parentage_reviews r
        WHERE r.client_id = c.id
        ORDER BY r.child_id, r.review_number DESC
      ) last_review
    ), '[]'::jsonb)
  )
  FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_clan_workbook_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clan_workbook_snapshot(uuid) TO authenticated;

-- The ordinary workbook writer owns person reconciliation and non-parent links.
-- This version adds parentage snapshots and their audit entries in the same transaction.
CREATE FUNCTION public.import_clan_workbook_v2(
  _client_id uuid, _people jsonb, _links jsonb, _parentages jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _owner uuid := auth.uid();
  _counts jsonb;
  _references jsonb;
  _group jsonb;
  _choice jsonb;
  _restore jsonb;
  _original jsonb;
  _plan jsonb := '[]'::jsonb;
  _parents jsonb;
  _row record;
  _child uuid;
  _parent uuid;
  _before jsonb;
  _before_reviewed boolean;
  _after_reviewed boolean;
  _latest_review uuid;
  _version jsonb;
  _expected jsonb;
  _link jsonb;
  _stored public.genogram_relationships%ROWTYPE;
  _kind text;
  _reference text;
  _start date;
  _end date;
  _notes text;
  _processed integer := 0;
BEGIN
  PERFORM c.id FROM public.clients c
  WHERE c.id = _client_id AND c.professional_id = _owner FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_parentages) IS DISTINCT FROM 'array' OR jsonb_array_length(_parentages) > 2000 THEN
    RAISE EXCEPTION 'Confira a aba de filiações.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT FROM jsonb_array_elements(_parentages) AS a(value)
    WHERE value ? 'restore' OR value ? 'expected_review_id'
      OR EXISTS (SELECT FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(value->'parents') = 'array' THEN value->'parents' ELSE '[]'::jsonb END
      ) AS p(item) WHERE item ? 'link')
  ) THEN
    RETURN public.import_clan_workbook(_client_id, _people, _links, _parentages);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 8008));
  _counts := public.import_clan_workbook(_client_id, _people, _links, '[]'::jsonb);
  SELECT COALESCE(jsonb_object_agg(p.id::text, p.id), '{}'::jsonb)
    || COALESCE(jsonb_object_agg(p.clan_reference, p.id) FILTER (WHERE p.clan_reference IS NOT NULL), '{}'::jsonb)
    || COALESCE(jsonb_object_agg('consultante', p.id) FILTER (WHERE p.is_proband), '{}'::jsonb)
    INTO _references FROM public.genogram_persons p WHERE p.client_id = _client_id;
  -- A reconciled row can use an alternate workbook key for an existing person.
  SELECT _references || COALESCE(jsonb_object_agg(p.key, p.person_id), '{}'::jsonb)
  INTO _references FROM jsonb_to_recordset(_people) AS p(key text, person_id uuid)
  WHERE p.person_id IS NOT NULL;

  FOR _group IN SELECT value FROM jsonb_array_elements(_parentages) LOOP
    _child := (_references->>(_group->>'child_key'))::uuid;
    _restore := _group->'restore';
    IF jsonb_typeof(_restore) = 'null' THEN _restore := NULL; END IF;
    IF _child IS NULL OR jsonb_typeof(_group->'expected') IS DISTINCT FROM 'array'
      OR jsonb_typeof(_group->'parents') IS DISTINCT FROM 'array'
      OR jsonb_array_length(_group->'parents') > 2
      OR (_restore IS NULL AND jsonb_array_length(_group->'parents') = 0)
      OR (_restore IS NOT NULL AND (
        jsonb_typeof(_restore) IS DISTINCT FROM 'object'
        OR jsonb_typeof(_restore->'reviewed') IS DISTINCT FROM 'boolean'
        OR jsonb_typeof(_group->'expected_reviewed') IS DISTINCT FROM 'boolean'
        OR NOT (_group ? 'expected_review_id')
        OR (_restore ? 'review' AND jsonb_typeof(_restore->'review') NOT IN ('object', 'null'))
      )) THEN
      RAISE EXCEPTION 'Confira a pessoa, a situação da revisão e até dois genitores.'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT FROM jsonb_array_elements(_plan) AS g(value) WHERE value->>'child' = _child::text
    ) THEN
      RAISE EXCEPTION 'A mesma pessoa tem dois planos de filiação.' USING ERRCODE = '22023';
    END IF;

    _parents := '[]'::jsonb;
    FOR _choice IN SELECT value FROM jsonb_array_elements(_group->'parents') LOOP
      _parent := (_references->>(_choice->>'key'))::uuid;
      IF _parent IS NULL OR _parent = _child OR EXISTS (
        SELECT FROM jsonb_array_elements(_parents) AS p(value)
        WHERE value->>'personId' = _parent::text
      ) THEN
        RAISE EXCEPTION 'Cada genitor precisa identificar uma pessoa diferente neste dossiê.'
          USING ERRCODE = '22023';
      END IF;
      _parents := _parents || jsonb_build_array(_choice || jsonb_build_object('personId', _parent));
    END LOOP;
    _plan := _plan || jsonb_build_array(_group || jsonb_build_object('child', _child, 'parents', _parents));
  END LOOP;

  -- A workbook ID belongs to its original pair, including links superseded by this import.
  IF EXISTS (
    SELECT FROM jsonb_array_elements(_plan) g(value)
    CROSS JOIN LATERAL jsonb_array_elements(g.value->'parents') p(item)
    WHERE p.item->'link' IS NOT NULL AND jsonb_typeof(p.item->'link') <> 'null'
      AND (jsonb_typeof(p.item->'link') <> 'object' OR (
        (p.item->'link'->>'key') IS NOT NULL AND (p.item->'link'->>'key') !~ '^[A-Za-z0-9_-]{1,80}$'
      ) OR EXISTS (
        SELECT FROM public.genogram_relationships r
        WHERE r.client_id = _client_id
          AND (r.id::text = p.item->'link'->>'key' OR r.clan_reference = p.item->'link'->>'key')
          AND (r.relationship_type, r.from_person_id, r.to_person_id)
            IS DISTINCT FROM ('parent'::text, (p.item->>'personId')::uuid, (g.value->>'child')::uuid)
      ))
  ) OR EXISTS (
    SELECT FROM jsonb_array_elements(_plan) g(value)
    CROSS JOIN LATERAL jsonb_array_elements(g.value->'parents') p(item)
    WHERE (p.item->'link'->>'key') IS NOT NULL
    GROUP BY p.item->'link'->>'key' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O ID do vínculo está repetido ou pertence a outra relação. Confira a aba Vínculos.'
      USING ERRCODE = '22023';
  END IF;

  FOR _row IN
    WITH RECURSIVE changes AS (
      SELECT (value->>'child')::uuid AS child, value AS plan FROM jsonb_array_elements(_plan)
    ), final_links AS (
      SELECT r.from_person_id AS parent, r.to_person_id AS child
      FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.relationship_type = 'parent'
        AND NOT EXISTS (SELECT FROM changes c WHERE c.child = r.to_person_id)
      UNION ALL
      SELECT (p.value->>'personId')::uuid, c.child
      FROM changes c CROSS JOIN LATERAL jsonb_array_elements(c.plan->'parents') p(value)
    ), ancestors(child, ancestor) AS (
      SELECT c.child, l.parent FROM changes c JOIN final_links l ON l.child = c.child
      UNION
      SELECT a.child, l.parent FROM ancestors a JOIN final_links l ON l.child = a.ancestor
    )
    SELECT c.child, c.plan, COALESCE(bool_or(a.ancestor = c.child), false) AS closes_cycle
    FROM changes c LEFT JOIN ancestors a ON a.child = c.child
    GROUP BY c.child, c.plan ORDER BY count(a.ancestor), c.child
  LOOP
    IF _row.closes_cycle THEN
      RAISE EXCEPTION 'As filiações propostas criam um ciclo. Confira a aba Vínculos.'
        USING ERRCODE = '22023';
    END IF;
    _child := _row.child;
    _group := _row.plan;
    _restore := _group->'restore';
    IF jsonb_typeof(_restore) = 'null' THEN _restore := NULL; END IF;
    _original := _restore->'review';
    IF jsonb_typeof(_original) = 'null' THEN _original := NULL; END IF;
    IF _original IS NOT NULL AND (
      (_original->>'original_id') IS NULL OR (_original->>'original_id') !~ '^[A-Za-z0-9_-]{1,80}$'
      OR (_original->>'source') IS NULL OR (_original->>'source') NOT IN (
        'unverified', 'client_report', 'family_report', 'document', 'professional_observation', 'other'
      )
      OR (_original->>'decision') IS NULL OR (_original->>'decision') NOT IN ('confirm', 'edit', 'undo')
      OR (_original->>'original_created_at') IS NULL
      OR NOT isfinite((_original->>'original_created_at')::timestamptz)
      OR length(_original->>'note') > 3000
    ) THEN
      RAISE EXCEPTION 'Confira a data, a ação e a fonte da revisão de filiação.' USING ERRCODE = '22023';
    END IF;

    SELECT p.parentage_reviewed INTO _before_reviewed FROM public.genogram_persons p
    WHERE p.client_id = _client_id AND p.id = _child FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa indisponível neste dossiê.' USING ERRCODE = '42501'; END IF;
    _before := public.genogram_parentage_links(_client_id, _child);
    SELECT id INTO _latest_review FROM public.genogram_parentage_reviews
    WHERE client_id = _client_id AND child_id = _child ORDER BY review_number DESC LIMIT 1;
    SELECT COALESCE(jsonb_agg(jsonb_build_array(r.id, r.updated_at) ORDER BY r.id), '[]'::jsonb)
      INTO _version FROM jsonb_populate_recordset(NULL::public.genogram_relationships, _before) r;
    SELECT COALESCE(jsonb_agg(jsonb_build_array(v.id, v."updatedAt") ORDER BY v.id), '[]'::jsonb)
      INTO _expected FROM jsonb_to_recordset(_group->'expected') AS v(id uuid, "updatedAt" timestamptz);
    IF _version IS DISTINCT FROM _expected OR (
      _group ? 'expected_review_id' AND _latest_review IS DISTINCT FROM (_group->>'expected_review_id')::uuid
    ) OR (
      _group ? 'expected_reviewed' AND _before_reviewed IS DISTINCT FROM (_group->>'expected_reviewed')::boolean
    ) THEN
      RAISE EXCEPTION 'A filiação ou sua revisão mudou desde a prévia. Atualize antes de importar.'
        USING ERRCODE = '40001';
    END IF;

    DELETE FROM public.genogram_relationships r
    WHERE r.client_id = _client_id AND r.to_person_id = _child AND r.relationship_type = 'parent'
      AND NOT EXISTS (
        SELECT FROM jsonb_array_elements(_group->'parents') AS p(value)
        WHERE (value->>'personId')::uuid = r.from_person_id
      );

    FOR _choice IN SELECT value FROM jsonb_array_elements(_group->'parents') LOOP
      _parent := (_choice->>'personId')::uuid;
      _kind := _choice->>'kind';
      _link := _choice->'link';
      IF jsonb_typeof(_link) = 'null' THEN _link := NULL; END IF;
      SELECT r.* INTO _stored FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.to_person_id = _child
        AND r.from_person_id = _parent AND r.relationship_type = 'parent';
      IF _kind IS NOT NULL AND _kind NOT IN ('biological', 'adoptive', 'foster', 'stepparent', 'unknown') THEN
        RAISE EXCEPTION 'Confira a natureza da filiação.' USING ERRCODE = '22023';
      END IF;
      IF _link IS NULL THEN
        _kind := COALESCE(_kind, CASE WHEN _stored.id IS NULL THEN 'unknown' ELSE _stored.qualifier END);
        _start := _stored.start_date;
        _end := _stored.end_date;
        _notes := _stored.notes;
        _reference := _stored.clan_reference;
      ELSE
        IF (_link->>'relationship_id') IS NOT NULL AND (
          _stored.id IS DISTINCT FROM (_link->>'relationship_id')::uuid
          OR _stored.updated_at IS DISTINCT FROM (_link->>'expected_updated_at')::timestamptz
        ) THEN
          RAISE EXCEPTION 'O vínculo mudou desde a prévia.' USING ERRCODE = '40001';
        END IF;
        _start := (_link->>'start_date')::date;
        _end := (_link->>'end_date')::date;
        _notes := _link->>'notes';
        _reference := COALESCE(_stored.clan_reference, NULLIF(_link->>'key', _stored.id::text));
        IF (_start IS NOT NULL AND NOT isfinite(_start)) OR (_end IS NOT NULL AND NOT isfinite(_end))
          OR _end < _start OR length(_notes) > 32767 THEN
          RAISE EXCEPTION 'Confira as datas e as observações do vínculo.' USING ERRCODE = '22023';
        END IF;
      END IF;

      IF _stored.id IS NULL THEN
        INSERT INTO public.genogram_relationships (
          client_id, from_person_id, to_person_id, relationship_type, qualifier,
          start_date, end_date, notes, clan_reference
        ) VALUES (_client_id, _parent, _child, 'parent', _kind, _start, _end, _notes, _reference);
      ELSIF (_stored.qualifier, _stored.start_date, _stored.end_date, _stored.notes, _stored.clan_reference)
        IS DISTINCT FROM (_kind, _start, _end, _notes, _reference) THEN
        UPDATE public.genogram_relationships SET qualifier = _kind,
          start_date = _start, end_date = _end, notes = _notes, clan_reference = _reference
        WHERE client_id = _client_id AND id = _stored.id;
      END IF;
    END LOOP;

    _after_reviewed := COALESCE((_restore->>'reviewed')::boolean, true);
    UPDATE public.genogram_persons SET parentage_reviewed = _after_reviewed
    WHERE client_id = _client_id AND id = _child AND parentage_reviewed IS DISTINCT FROM _after_reviewed;
    INSERT INTO public.genogram_parentage_reviews (
      client_id, child_id, professional_id, decision, source, note,
      before_links, after_links, before_reviewed, after_reviewed, workbook_import,
      imported_review_key, imported_review_created_at, imported_review_decision
    ) VALUES (
      _client_id, _child, _owner, 'edit', COALESCE(_original->>'source', 'unverified'),
      CASE WHEN _restore IS NULL THEN 'Origem: planilha do clã. Filiação conferida na prévia de importação.'
        ELSE _original->>'note' END,
      _before, public.genogram_parentage_links(_client_id, _child), _before_reviewed, _after_reviewed,
      _restore IS NOT NULL, _original->>'original_id', (_original->>'original_created_at')::timestamptz,
      _original->>'decision'
    );
    _processed := _processed + 1;
  END LOOP;

  RETURN _counts || jsonb_build_object('reviewed', _processed);
END;
$$;

REVOKE ALL ON FUNCTION public.import_clan_workbook_v2(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_clan_workbook_v2(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- Restore the original relationship fields along with the topology.
CREATE OR REPLACE FUNCTION public.undo_parentage_review(_client_id uuid, _review_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner uuid := auth.uid();
  _review public.genogram_parentage_reviews%ROWTYPE;
  _metadata public.genogram_parentage_reviews%ROWTYPE;
  _link public.genogram_relationships%ROWTYPE;
  _current jsonb;
  _current_reviewed boolean;
  _new_review_id uuid;
BEGIN
  PERFORM id FROM public.clients WHERE id = _client_id AND professional_id = _owner FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 8008));
  SELECT r.* INTO _review FROM public.genogram_parentage_reviews r
  WHERE r.id = _review_id AND r.client_id = _client_id AND r.professional_id = _owner
    AND r.decision IN ('confirm', 'edit');
  IF _review.id IS NULL THEN
    RAISE EXCEPTION 'Revisão indisponível.' USING ERRCODE = '42501';
  END IF;

  SELECT p.parentage_reviewed INTO _current_reviewed FROM public.genogram_persons p
  WHERE p.id = _review.child_id AND p.client_id = _client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pessoa indisponível neste dossiê.' USING ERRCODE = '42501';
  END IF;
  _current := public.genogram_parentage_links(_client_id, _review.child_id);
  IF _current IS DISTINCT FROM _review.after_links
     OR _current_reviewed IS DISTINCT FROM _review.after_reviewed OR EXISTS (
    SELECT 1 FROM public.genogram_parentage_reviews r
    WHERE r.client_id = _client_id AND r.child_id = _review.child_id AND r.review_number > _review.review_number
  ) THEN
    RAISE EXCEPTION 'A filiação mudou desde esta revisão. Confira o estado atual antes de alterar.'
      USING ERRCODE = '40001';
  END IF;

  SELECT r.* INTO _metadata FROM public.genogram_parentage_reviews r
  WHERE r.client_id = _client_id AND r.child_id = _review.child_id
    AND r.review_number < _review.review_number AND r.after_links = _review.before_links
    AND r.after_reviewed = _review.before_reviewed
  ORDER BY r.review_number DESC LIMIT 1;

  DELETE FROM public.genogram_relationships r
  WHERE r.client_id = _client_id AND r.to_person_id = _review.child_id AND r.relationship_type = 'parent'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(_review.before_links) AS old(id uuid) WHERE old.id = r.id
    );

  FOR _link IN SELECT * FROM jsonb_populate_recordset(NULL::public.genogram_relationships, _review.before_links) LOOP
    IF public.genogram_parentage_would_cycle(_client_id, _link.from_person_id, _review.child_id, NULL) THEN
      RAISE EXCEPTION 'Restaurar esta filiação criaria um ciclo. Confira os vínculos atuais.'
        USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      WHERE r.id = _link.id AND r.client_id = _client_id AND r.to_person_id = _review.child_id
        AND r.relationship_type = 'parent'
    ) THEN
      UPDATE public.genogram_relationships SET qualifier = _link.qualifier,
        start_date = _link.start_date, end_date = _link.end_date, notes = _link.notes,
        clan_reference = _link.clan_reference
      WHERE id = _link.id AND (qualifier, start_date, end_date, notes, clan_reference)
        IS DISTINCT FROM (_link.qualifier, _link.start_date, _link.end_date, _link.notes, _link.clan_reference);
    ELSE
      _link.updated_at := clock_timestamp();
      INSERT INTO public.genogram_relationships SELECT (_link).*;
    END IF;
  END LOOP;

  UPDATE public.genogram_persons SET parentage_reviewed = _review.before_reviewed
  WHERE id = _review.child_id AND parentage_reviewed IS DISTINCT FROM _review.before_reviewed;

  INSERT INTO public.genogram_parentage_reviews (
    client_id, child_id, professional_id, decision, source, note,
    before_links, after_links, before_reviewed, after_reviewed, undone_review_id, workbook_import,
    imported_review_key, imported_review_created_at, imported_review_decision
  )
  VALUES (
    _client_id, _review.child_id, _owner, 'undo', COALESCE(_metadata.source, 'unverified'), _metadata.note,
    _current, public.genogram_parentage_links(_client_id, _review.child_id),
    _current_reviewed, _review.before_reviewed, _review.id, COALESCE(_metadata.workbook_import, false),
    _metadata.imported_review_key, _metadata.imported_review_created_at, _metadata.imported_review_decision
  ) RETURNING id INTO _new_review_id;
  RETURN _new_review_id;
END;
$$;
