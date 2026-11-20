-- Keep the original reference in existing cases where older clients could create
-- two flagged people concurrently. Their cards, notes and links are preserved.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY client_id ORDER BY created_at, id) AS position
  FROM public.genogram_persons WHERE is_proband
)
UPDATE public.genogram_persons AS p SET is_proband = false
FROM ranked WHERE ranked.id = p.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS genogram_one_proband_per_client
  ON public.genogram_persons (client_id) WHERE is_proband;

CREATE OR REPLACE FUNCTION public.ensure_genogram_proband(_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _client public.clients%ROWTYPE;
  _person public.genogram_persons%ROWTYPE;
  _name text;
  _preferred text;
  _gender text;
BEGIN
  SELECT c.* INTO _client
  FROM public.clients c
  WHERE c.id = _client_id AND c.professional_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO _person FROM public.genogram_persons p
  WHERE p.client_id = _client_id
    AND (p.is_proband OR lower(btrim(p.relationship_to_proband)) IN
      ('consulente', 'consultante', 'paciente', 'proband', 'cliente', 'eu', 'self'))
  ORDER BY p.is_proband DESC, p.created_at, p.id
  LIMIT 1
  FOR UPDATE;

  _name := COALESCE(NULLIF(btrim(_client.full_name), ''), _person.full_name, '');
  _preferred := NULLIF(btrim(_client.preferred_name), '');
  _gender := COALESCE(NULLIF(btrim(_client.gender), ''), 'desconhecido');

  IF _person.id IS NULL THEN
    INSERT INTO public.genogram_persons
      (client_id, full_name, preferred_name, birth_date, gender, is_proband, relationship_to_proband)
    VALUES (_client_id, _name, _preferred, _client.birth_date, _gender, true, 'Consulente')
    RETURNING id INTO _person.id;
  ELSE
    UPDATE public.genogram_persons
    SET full_name = _name,
        preferred_name = _preferred,
        birth_date = _client.birth_date,
        gender = _gender,
        is_proband = true,
        relationship_to_proband = 'Consulente'
    WHERE id = _person.id
      AND (full_name, preferred_name, birth_date, gender, is_proband, relationship_to_proband)
          IS DISTINCT FROM (_name, _preferred, _client.birth_date, _gender, true, 'Consulente'::text);
  END IF;
  RETURN _person.id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_genogram_proband(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_genogram_proband(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_genogram_proband_after_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- A atualização cadastral do titular e a do mapa são o mesmo commit.
  IF auth.uid() = NEW.professional_id THEN
    PERFORM public.ensure_genogram_proband(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_genogram_proband_after_client_update ON public.clients;
CREATE TRIGGER sync_genogram_proband_after_client_update
AFTER UPDATE OF full_name, preferred_name, birth_date, gender ON public.clients
FOR EACH ROW WHEN (
  (OLD.full_name, OLD.preferred_name, OLD.birth_date, OLD.gender)
  IS DISTINCT FROM (NEW.full_name, NEW.preferred_name, NEW.birth_date, NEW.gender)
)
EXECUTE FUNCTION public.sync_genogram_proband_after_client_update();

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
    client_id, full_name, relationship_to_proband, gender, birth_date, gestational_weeks,
    death_date, is_deceased, health_conditions, occupation, vices, temperament, birth_order, notes
  )
  SELECT _client_id, btrim(r.full_name), r.relationship_to_proband, r.gender, r.birth_date,
         r.gestational_weeks, r.death_date, COALESCE(r.is_deceased, false) OR r.death_date IS NOT NULL,
         COALESCE(r.health_conditions, '{}'::text[]), r.occupation, r.vices, r.temperament,
         r.birth_order, r.notes
  FROM jsonb_to_recordset(_rows) AS r(
    full_name text, relationship_to_proband text, gender text, birth_date date, gestational_weeks text,
    death_date date, is_deceased boolean, health_conditions text[], occupation text, vices text,
    temperament text, birth_order integer, notes text
  );
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.import_genogram_persons(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_genogram_persons(uuid, jsonb, boolean) TO authenticated;
