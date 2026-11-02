CREATE OR REPLACE FUNCTION public.import_genogram_persons(_client_id uuid, _rows jsonb, _replace boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()) THEN
    RAISE EXCEPTION 'client not accessible' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'no rows to import';
  END IF;

  -- Tudo numa transação: se o INSERT falhar, a remoção é desfeita (o original é preservado).
  IF _replace THEN
    DELETE FROM public.genogram_persons WHERE client_id = _client_id AND is_proband = false;
  END IF;

  INSERT INTO public.genogram_persons (
    client_id, full_name, relationship_to_proband, gender, birth_date, gestational_weeks,
    death_date, is_deceased, health_conditions, occupation, vices, temperament, birth_order, notes
  )
  SELECT _client_id, r.full_name, r.relationship_to_proband, r.gender, r.birth_date, r.gestational_weeks,
         r.death_date, COALESCE(r.is_deceased, false), COALESCE(r.health_conditions, '{}'::text[]),
         r.occupation, r.vices, r.temperament, r.birth_order, r.notes
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