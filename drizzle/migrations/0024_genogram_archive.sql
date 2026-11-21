ALTER TABLE public.genogram_persons
  ADD COLUMN archived_at timestamptz,
  ADD CONSTRAINT genogram_proband_not_archived CHECK (archived_at IS NULL OR NOT is_proband);

CREATE TABLE public.genogram_removed_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  restored_at timestamptz
);

CREATE INDEX genogram_removed_relationships_client_idx
  ON public.genogram_removed_relationships (client_id, removed_at DESC, id DESC);

ALTER TABLE public.genogram_removed_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.genogram_removed_relationships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.genogram_removed_relationships TO authenticated;
CREATE POLICY own_genogram_removed_relationships ON public.genogram_removed_relationships
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.professional_id = auth.uid()
    )
  );

-- The archive and all direct relationship writers share the parentage lock.
-- Use try-locks in row triggers so a writer with a row lock cannot deadlock
-- against an RPC that already holds the case lock.
CREATE FUNCTION public.guard_genogram_archived_person() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = OLD.client_id) THEN RETURN OLD; END IF;
    IF NOT pg_try_advisory_xact_lock(hashtextextended(OLD.client_id::text, 8008)) THEN
      RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
        USING ERRCODE = '40001';
    END IF;
    IF OLD.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Restaure o familiar arquivado antes de remover sua ficha.'
        USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      JOIN public.genogram_persons p ON p.id = CASE WHEN r.from_person_id = OLD.id
        THEN r.to_person_id ELSE r.from_person_id END
      WHERE r.client_id = OLD.client_id AND (r.from_person_id = OLD.id OR r.to_person_id = OLD.id)
        AND p.archived_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Restaure os familiares arquivados ligados à pessoa antes de remover a ficha.'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    IF NOT pg_try_advisory_xact_lock(hashtextextended(OLD.client_id::text, 8008)) THEN
      RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
        USING ERRCODE = '40001';
    END IF;
    NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  ELSIF OLD.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Restaure o familiar arquivado antes de editar sua ficha.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_guard_genogram_archived_person
  BEFORE UPDATE OR DELETE ON public.genogram_persons
  FOR EACH ROW EXECUTE FUNCTION public.guard_genogram_archived_person();

CREATE FUNCTION public.guard_genogram_archived_relationship() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- During a cascade from an explicitly removed person or dossier, the
    -- missing record cannot be restored as a detached relationship.
    IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = OLD.client_id)
       OR (SELECT count(*) FROM public.genogram_persons p
           WHERE p.id IN (OLD.from_person_id, OLD.to_person_id)) <> 2 THEN
      RETURN OLD;
    END IF;
    IF NOT pg_try_advisory_xact_lock(hashtextextended(OLD.client_id::text, 8008)) THEN
      RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
        USING ERRCODE = '40001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.genogram_persons p
      WHERE p.id IN (OLD.from_person_id, OLD.to_person_id) AND p.archived_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Restaure os familiares arquivados antes de remover este vínculo.'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended(NEW.client_id::text, 8008)) THEN
    RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
      USING ERRCODE = '40001';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      RAISE EXCEPTION 'O vínculo pertence ao mesmo dossiê.' USING ERRCODE = '22023';
    END IF;
    -- A stale edit must not detach a link that was archived after opening it,
    -- even when the proposed replacement person is active.
    IF EXISTS (
      SELECT 1 FROM public.genogram_persons p
      WHERE p.id IN (OLD.from_person_id, OLD.to_person_id) AND p.archived_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Restaure os familiares arquivados antes de editar este vínculo.'
        USING ERRCODE = '55000';
    END IF;
    IF NEW.relationship_type <> 'parent' THEN
      NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
    END IF;
  END IF;
  IF (
    SELECT count(*) FROM public.genogram_persons p
    WHERE p.client_id = NEW.client_id AND p.archived_at IS NULL
      AND p.id IN (NEW.from_person_id, NEW.to_person_id)
  ) <> 2 THEN
    RAISE EXCEPTION 'Escolha duas pessoas ativas neste dossiê. Se necessário, restaure o familiar arquivado.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zy_guard_genogram_archived_relationship
  BEFORE INSERT OR UPDATE OR DELETE ON public.genogram_relationships
  FOR EACH ROW EXECUTE FUNCTION public.guard_genogram_archived_relationship();

CREATE FUNCTION public.record_genogram_relationship_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- A cascade of a person or dossier permanently removed has no restorable link.
  IF OLD.relationship_type = 'parent' OR NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = OLD.client_id
  ) OR (
    SELECT count(*) FROM public.genogram_persons p
    WHERE p.id IN (OLD.from_person_id, OLD.to_person_id)
  ) <> 2 THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.genogram_removed_relationships (client_id, snapshot)
    VALUES (OLD.client_id, to_jsonb(OLD));
  RETURN OLD;
END;
$$;

CREATE TRIGGER record_genogram_relationship_removal
  AFTER DELETE ON public.genogram_relationships
  FOR EACH ROW EXECUTE FUNCTION public.record_genogram_relationship_removal();

CREATE FUNCTION public.purge_removed_relationships_for_deleted_person() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.genogram_removed_relationships h WHERE h.client_id = OLD.client_id
    AND OLD.id::text IN (h.snapshot->>'from_person_id', h.snapshot->>'to_person_id');
  RETURN OLD;
END;
$$;

CREATE TRIGGER purge_removed_relationships_for_deleted_person
  AFTER DELETE ON public.genogram_persons
  FOR EACH ROW EXECUTE FUNCTION public.purge_removed_relationships_for_deleted_person();

CREATE FUNCTION public.set_genogram_person_archived(
  _client_id uuid, _person_id uuid, _expected timestamptz, _archived boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _person public.genogram_persons%ROWTYPE;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF _archived IS NULL OR _expected IS NULL THEN
    RAISE EXCEPTION 'Confira a ação e a versão do familiar.' USING ERRCODE = '22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(_client_id::text, 8008)) THEN
    RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
      USING ERRCODE = '40001';
  END IF;

  SELECT p.* INTO _person FROM public.genogram_persons p
    WHERE p.client_id = _client_id AND p.id = _person_id FOR NO KEY UPDATE;
  IF NOT FOUND OR _person.is_proband THEN
    RAISE EXCEPTION 'Escolha um familiar do dossiê. A pessoa consultante permanece no mapa.'
      USING ERRCODE = '22023';
  END IF;
  IF _person.updated_at IS DISTINCT FROM _expected THEN
    RAISE EXCEPTION 'A ficha mudou em outra aba. Atualize e confira o familiar.'
      USING ERRCODE = '40001';
  END IF;
  IF (_person.archived_at IS NOT NULL) = _archived THEN RETURN to_jsonb(_person); END IF;

  UPDATE public.genogram_persons p
  SET archived_at = CASE WHEN _archived THEN clock_timestamp() END
  WHERE p.id = _person.id RETURNING p.* INTO _person;
  RETURN to_jsonb(_person);
END;
$$;

CREATE FUNCTION public.remove_nonparental_genogram_relationship(
  _client_id uuid, _relationship_id uuid, _expected timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  _removed_id uuid;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(_client_id::text, 8008)) THEN
    RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
      USING ERRCODE = '40001';
  END IF;

  DELETE FROM public.genogram_relationships r
  WHERE r.client_id = _client_id AND r.id = _relationship_id
    AND r.relationship_type <> 'parent' AND r.updated_at = _expected;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O vínculo mudou, já foi removido ou exige revisão de filiação.'
      USING ERRCODE = '40001';
  END IF;
  SELECT h.id INTO _removed_id FROM public.genogram_removed_relationships h
  WHERE h.client_id = _client_id AND h.snapshot->>'id' = _relationship_id::text
    AND h.restored_at IS NULL
  ORDER BY h.removed_at DESC, h.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível guardar o vínculo para restauração.' USING ERRCODE = '55000';
  END IF;
  RETURN _removed_id;
END;
$$;

CREATE FUNCTION public.undo_genogram_relationship_removal(
  _client_id uuid, _removal_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  _removal public.genogram_removed_relationships%ROWTYPE;
  _link public.genogram_relationships%ROWTYPE;
BEGIN
  PERFORM c.id FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = auth.uid() FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(_client_id::text, 8008)) THEN
    RAISE EXCEPTION 'O genossociograma está sendo alterado. Atualize e tente novamente.'
      USING ERRCODE = '40001';
  END IF;
  SELECT h.* INTO _removal FROM public.genogram_removed_relationships h
  WHERE h.client_id = _client_id AND h.id = _removal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo removido indisponível.' USING ERRCODE = '22023';
  END IF;
  _link := jsonb_populate_record(NULL::public.genogram_relationships, _removal.snapshot);
  IF _link.client_id IS DISTINCT FROM _client_id OR _link.relationship_type = 'parent' THEN
    RAISE EXCEPTION 'Vínculo removido indisponível.' USING ERRCODE = '22023';
  END IF;

  IF _removal.restored_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.genogram_relationships r WHERE r.id = _link.id AND r.client_id = _client_id
    ) THEN
      RETURN _link.id;
    END IF;
    RAISE EXCEPTION 'Este vínculo foi removido novamente. Consulte a remoção mais recente.'
      USING ERRCODE = '40001';
  END IF;
  IF (
    SELECT count(*) FROM public.genogram_persons p
    WHERE p.client_id = _client_id AND p.archived_at IS NULL
      AND p.id IN (_link.from_person_id, _link.to_person_id)
  ) <> 2 THEN
    RAISE EXCEPTION 'Os dois familiares precisam estar ativos para restaurar este vínculo.'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.genogram_relationships r
    WHERE r.client_id = _client_id AND r.relationship_type = _link.relationship_type AND (
      (_link.relationship_type = 'union' AND
        (LEAST(r.from_person_id, r.to_person_id), GREATEST(r.from_person_id, r.to_person_id),
         COALESCE(r.marriage_order, 0)) =
        (LEAST(_link.from_person_id, _link.to_person_id), GREATEST(_link.from_person_id, _link.to_person_id),
         COALESCE(_link.marriage_order, 0))
      ) OR (_link.relationship_type <> 'union'
        AND (r.from_person_id, r.to_person_id) = (_link.from_person_id, _link.to_person_id)
        AND (r.qualifier, r.start_date, r.end_date, r.notes) IS NOT DISTINCT FROM
          (_link.qualifier, _link.start_date, _link.end_date, _link.notes)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Já existe um vínculo equivalente. Confira o mapa antes de restaurar.'
      USING ERRCODE = '23505';
  END IF;

  _link.updated_at := GREATEST(clock_timestamp(), _link.updated_at + interval '1 microsecond');
  BEGIN
    INSERT INTO public.genogram_relationships SELECT (_link).*;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um vínculo com a mesma identificação. Confira o mapa antes de restaurar.'
      USING ERRCODE = '23505';
  END;
  UPDATE public.genogram_removed_relationships h SET restored_at = clock_timestamp()
    WHERE h.id = _removal.id;
  RETURN _link.id;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_genogram_archived_person() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_genogram_archived_relationship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_genogram_relationship_removal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_removed_relationships_for_deleted_person() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_genogram_person_archived(uuid, uuid, timestamptz, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_nonparental_genogram_relationship(uuid, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_genogram_relationship_removal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_genogram_person_archived(uuid, uuid, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_nonparental_genogram_relationship(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_genogram_relationship_removal(uuid, uuid) TO authenticated;

-- Excel represents the active tree. Keep the archived data in the dossier,
-- including a complete parentage history for restoration.
CREATE OR REPLACE FUNCTION public.get_clan_workbook_snapshot(_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH permitted AS (
    SELECT c.id FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()
  ), active_people AS (
    SELECT p.* FROM public.genogram_persons p JOIN permitted c ON c.id = p.client_id
    WHERE p.archived_at IS NULL
  ), partial_parentage AS (
    SELECT DISTINCT r.to_person_id AS child_id
    FROM public.genogram_relationships r
    JOIN permitted c ON c.id = r.client_id
    JOIN public.genogram_persons parent ON parent.id = r.from_person_id AND parent.client_id = r.client_id
    WHERE r.relationship_type = 'parent' AND parent.archived_at IS NOT NULL
  ), last_review AS (
    SELECT DISTINCT ON (r.child_id) r.*
    FROM public.genogram_parentage_reviews r
    JOIN active_people child ON child.id = r.child_id AND child.client_id = r.client_id
    WHERE NOT EXISTS (
      SELECT 1 FROM partial_parentage partial WHERE partial.child_id = r.child_id
    )
    ORDER BY r.child_id, r.review_number DESC
  )
  SELECT jsonb_build_object(
    'persons', COALESCE((
      SELECT jsonb_agg(
        CASE WHEN partial.child_id IS NULL THEN to_jsonb(p)
             ELSE to_jsonb(p) || jsonb_build_object('parentage_reviewed', false) END
        ORDER BY p.id
      )
      FROM active_people p LEFT JOIN partial_parentage partial ON partial.child_id = p.id
    ), '[]'::jsonb),
    'relationships', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.genogram_relationships r
      JOIN active_people a ON a.client_id = r.client_id AND a.id = r.from_person_id
      JOIN active_people b ON b.client_id = r.client_id AND b.id = r.to_person_id
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(to_jsonb(last_review) ORDER BY last_review.child_id) FROM last_review
    ), '[]'::jsonb)
  ) FROM permitted;
$$;

-- A legacy spreadsheet replacement only removes active, unlinked rows.
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
    DELETE FROM public.genogram_persons
    WHERE client_id = _client_id AND NOT is_proband AND archived_at IS NULL;
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
