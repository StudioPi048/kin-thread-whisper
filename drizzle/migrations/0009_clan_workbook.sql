ALTER TABLE public.genogram_persons
  ADD COLUMN clan_reference text CHECK (clan_reference ~ '^[A-Za-z0-9_-]{1,80}$'),
  ADD COLUMN birth_date_partial text,
  ADD COLUMN death_date_partial text,
  ADD CONSTRAINT genogram_birth_precision CHECK (
    birth_date_partial IS NULL OR (birth_date IS NULL AND
      birth_date_partial ~ '^([0-9]{4}|[0-9]{1,2}[/ .-][0-9]{1,4}|[0-9]{4}–[0-9]{4})$')
  ),
  ADD CONSTRAINT genogram_death_precision CHECK (
    death_date_partial IS NULL OR (death_date IS NULL AND
      death_date_partial ~ '^([0-9]{4}|[0-9]{1,2}[/ .-][0-9]{1,4}|[0-9]{4}–[0-9]{4})$')
  );
CREATE UNIQUE INDEX genogram_persons_clan_reference
  ON public.genogram_persons (client_id, clan_reference) WHERE clan_reference IS NOT NULL;

ALTER TABLE public.genogram_relationships
  ADD COLUMN clan_reference text CHECK (clan_reference ~ '^[A-Za-z0-9_-]{1,80}$');
CREATE UNIQUE INDEX genogram_relationships_clan_reference
  ON public.genogram_relationships (client_id, clan_reference) WHERE clan_reference IS NOT NULL;

-- Reconcile explicit workbook identities within a single dossier and transaction.
-- Omitted cells and omitted links do not erase recorded data.
CREATE FUNCTION public.import_clan_workbook(
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

  FOR _item IN
    SELECT * FROM jsonb_to_recordset(_links) AS x(
      key text, relationship_id uuid, expected_updated_at timestamptz, from_key text, to_key text,
      relationship_type text, qualifier text, start_date date, end_date date, notes text
    )
  LOOP
    _from_id := (_references ->> _item.from_key)::uuid;
    _to_id := (_references ->> _item.to_key)::uuid;
    IF _from_id IS NULL OR _to_id IS NULL OR _from_id = _to_id
       OR _item.relationship_type IS NULL OR _item.relationship_type NOT IN ('union', 'sibling', 'emotional')
       OR _item.end_date < _item.start_date THEN
      RAISE EXCEPTION 'Confira os IDs, o tipo e as datas da aba Vínculos.' USING ERRCODE = '22023';
    END IF;
    IF _item.relationship_id IS NOT NULL THEN
      SELECT r.* INTO _existing_link FROM public.genogram_relationships r
       WHERE r.client_id = _client_id AND r.id = _item.relationship_id FOR UPDATE;
      IF NOT FOUND OR _existing_link.updated_at IS DISTINCT FROM _item.expected_updated_at
         OR (_existing_link.from_person_id, _existing_link.to_person_id, _existing_link.relationship_type)
             IS DISTINCT FROM (_from_id, _to_id, _item.relationship_type) THEN
        RAISE EXCEPTION 'Um vínculo mudou desde a prévia. Atualize antes de importar.' USING ERRCODE = '40001';
      END IF;
      UPDATE public.genogram_relationships
      SET qualifier = _item.qualifier, start_date = _item.start_date, end_date = _item.end_date,
          notes = _item.notes,
          clan_reference = COALESCE(_existing_link.clan_reference, NULLIF(_item.key, _existing_link.id::text))
      WHERE client_id = _client_id AND id = _item.relationship_id;
      _related := _related + 1;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND (r.from_person_id, r.to_person_id, r.relationship_type) =
        (_from_id, _to_id, _item.relationship_type)
        AND (r.qualifier, r.start_date, r.end_date, r.notes) IS NOT DISTINCT FROM
          (_item.qualifier, _item.start_date, _item.end_date, _item.notes)
    ) THEN
      INSERT INTO public.genogram_relationships (
        client_id, clan_reference, from_person_id, to_person_id, relationship_type, qualifier, start_date, end_date, notes
      ) VALUES (
        _client_id, _item.key, _from_id, _to_id, _item.relationship_type, _item.qualifier,
        _item.start_date, _item.end_date, _item.notes
      );
      _related := _related + 1;
    END IF;
  END LOOP;

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
    PERFORM public.review_parentage(_client_id, _person_id, _item.expected, _parent_choices,
      'edit', 'document', 'Filiação conferida na prévia de importação da planilha do clã.');
    _reviewed := _reviewed + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', _inserted, 'updated', _updated, 'related', _related, 'reviewed', _reviewed);
END;
$$;

REVOKE ALL ON FUNCTION public.import_clan_workbook(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_clan_workbook(uuid, jsonb, jsonb, jsonb) TO authenticated;

-- The legacy CSV path also preserves the original precision.
CREATE OR REPLACE FUNCTION public.import_genogram_persons(
  _client_id uuid, _rows jsonb, _replace boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  -- O lock da linha pai também serializa a inserção de relações que referenciam
  -- o dossiê enquanto a substituição verifica vínculos e remove os registros.
  PERFORM c.id FROM public.clients c
  WHERE c.id = _client_id AND c.professional_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Nenhuma linha válida para importar.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha válida para importar.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_rows) AS r(
      full_name text, relationship_to_proband text, birth_date date, death_date date
    )
    WHERE NULLIF(btrim(r.full_name), '') IS NULL
       OR lower(btrim(r.relationship_to_proband)) IN
         ('consulente', 'consultante', 'paciente', 'proband', 'cliente', 'eu', 'self')
       OR r.death_date < r.birth_date
  ) THEN
    RAISE EXCEPTION 'Confira os nomes, as datas e a linha da pessoa consultante na prévia.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public.ensure_genogram_proband(_client_id);
  IF _replace THEN
    IF EXISTS (
      SELECT 1 FROM public.genogram_relationships r WHERE r.client_id = _client_id
    ) THEN
      RAISE EXCEPTION 'Há vínculos registrados. Adicione as linhas ou edite a planilha atual.'
        USING ERRCODE = '55000';
    END IF;
    DELETE FROM public.genogram_persons WHERE client_id = _client_id AND is_proband = false;
  END IF;

  INSERT INTO public.genogram_persons (
    client_id, full_name, relationship_to_proband, gender, birth_date, birth_date_partial, gestational_weeks,
    death_date, death_date_partial, is_deceased, health_conditions, occupation, vices, temperament, birth_order, notes
  )
  SELECT _client_id, btrim(r.full_name), r.relationship_to_proband, r.gender, r.birth_date, r.birth_date_partial,
         r.gestational_weeks, r.death_date, r.death_date_partial,
         COALESCE(r.is_deceased, false) OR r.death_date IS NOT NULL OR r.death_date_partial IS NOT NULL,
         COALESCE(r.health_conditions, '{}'::text[]), r.occupation, r.vices, r.temperament,
         r.birth_order, r.notes
  FROM jsonb_to_recordset(_rows) AS r(
    full_name text, relationship_to_proband text, gender text, birth_date date, birth_date_partial text, gestational_weeks text,
    death_date date, death_date_partial text, is_deceased boolean, health_conditions text[], occupation text, vices text,
    temperament text, birth_order integer, notes text
  );
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.import_genogram_persons(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_genogram_persons(uuid, jsonb, boolean) TO authenticated;
