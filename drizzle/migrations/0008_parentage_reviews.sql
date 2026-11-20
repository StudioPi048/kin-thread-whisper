ALTER TABLE public.genogram_persons
  ADD COLUMN parentage_reviewed boolean NOT NULL DEFAULT false;

CREATE TABLE public.genogram_parentage_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_number bigint GENERATED ALWAYS AS IDENTITY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.genogram_persons(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('confirm', 'edit', 'undo')),
  source text NOT NULL CHECK (source IN (
    'unverified', 'client_report', 'family_report', 'document', 'professional_observation', 'other'
  )),
  note text,
  before_links jsonb NOT NULL,
  after_links jsonb NOT NULL,
  before_reviewed boolean NOT NULL,
  after_reviewed boolean NOT NULL,
  undone_review_id uuid REFERENCES public.genogram_parentage_reviews(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX genogram_parentage_reviews_child_idx
  ON public.genogram_parentage_reviews (client_id, child_id, review_number DESC);

ALTER TABLE public.genogram_parentage_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.genogram_parentage_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.genogram_parentage_reviews TO authenticated;
CREATE POLICY own_genogram_parentage_reviews ON public.genogram_parentage_reviews
  FOR SELECT TO authenticated USING (
    professional_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.professional_id = auth.uid()
    )
  );

CREATE FUNCTION public.genogram_parentage_would_cycle(
  _client_id uuid, _parent_id uuid, _child_id uuid, _ignore_link_id uuid
) RETURNS boolean
LANGUAGE sql
SET search_path = ''
AS $$
  WITH RECURSIVE descendants(person_id) AS (
    SELECT _child_id
    UNION
    SELECT r.to_person_id FROM public.genogram_relationships r
    JOIN descendants d ON d.person_id = r.from_person_id
    WHERE r.client_id = _client_id AND r.relationship_type = 'parent'
      AND r.id IS DISTINCT FROM _ignore_link_id
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE person_id = _parent_id);
$$;

REVOKE ALL ON FUNCTION public.genogram_parentage_would_cycle(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.genogram_parentage_would_cycle(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- The same lock covers the existing relationship forms and cascaded deletes.
-- A direct mutation has already acquired a row lock on UPDATE/DELETE. Trying
-- the case lock instead of waiting lets the caller retry without lock inversion.
CREATE FUNCTION public.guard_genogram_parentage_write() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _client_id uuid;
  _structural boolean := true;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.relationship_type <> 'parent' THEN RETURN OLD; END IF;
    _client_id := OLD.client_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.relationship_type <> 'parent' AND NEW.relationship_type <> 'parent' THEN RETURN NEW; END IF;
    IF NEW.client_id <> OLD.client_id THEN
      RAISE EXCEPTION 'A filiação pertence ao mesmo dossiê.' USING ERRCODE = '22023';
    END IF;
    _client_id := OLD.client_id;
    _structural := OLD.relationship_type <> NEW.relationship_type
      OR OLD.from_person_id <> NEW.from_person_id OR OLD.to_person_id <> NEW.to_person_id;
  ELSE
    IF NEW.relationship_type <> 'parent' THEN RETURN NEW; END IF;
    _client_id := NEW.client_id;
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended(_client_id::text, 8008)) THEN
    RAISE EXCEPTION 'A filiação deste dossiê está sendo alterada. Atualize e tente de novo.'
      USING ERRCODE = '40001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.relationship_type <> 'parent' THEN RETURN NEW; END IF;

  IF NEW.from_person_id = NEW.to_person_id THEN
    RAISE EXCEPTION 'Escolha duas pessoas diferentes.' USING ERRCODE = '22023';
  END IF;
  IF (
    SELECT count(*) FROM public.genogram_persons p
    WHERE p.client_id = _client_id AND p.id IN (NEW.from_person_id, NEW.to_person_id)
  ) <> 2 THEN
    RAISE EXCEPTION 'Escolha pessoas cadastradas neste dossiê.' USING ERRCODE = '22023';
  END IF;

  IF _structural THEN
    IF EXISTS (
      SELECT 1 FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.relationship_type = 'parent'
        AND r.to_person_id = NEW.to_person_id AND r.from_person_id = NEW.from_person_id
        AND r.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Essa filiação já está registrada.' USING ERRCODE = '22023';
    END IF;
    IF (
      SELECT count(DISTINCT r.from_person_id) FROM public.genogram_relationships r
      WHERE r.client_id = _client_id AND r.relationship_type = 'parent'
        AND r.to_person_id = NEW.to_person_id AND r.id IS DISTINCT FROM NEW.id
    ) >= 2 THEN
      RAISE EXCEPTION 'Uma pessoa pode ter até duas filiações registradas.' USING ERRCODE = '22023';
    END IF;
    IF public.genogram_parentage_would_cycle(_client_id, NEW.from_person_id, NEW.to_person_id, NEW.id) THEN
      RAISE EXCEPTION 'Essa ligação criaria um ciclo. Confira quem é genitor e quem é filho.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Revision tokens must change even when separate writers run in the same millisecond.
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  END IF;
  RETURN NEW;
END;
$$;

-- Runs after the original trg_genogram_rel_updated timestamp trigger.
CREATE TRIGGER zz_guard_genogram_parentage_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.genogram_relationships
  FOR EACH ROW EXECUTE FUNCTION public.guard_genogram_parentage_write();

CREATE FUNCTION public.genogram_parentage_links(_client_id uuid, _child_id uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
  FROM public.genogram_relationships r
  WHERE r.client_id = _client_id AND r.to_person_id = _child_id AND r.relationship_type = 'parent';
$$;

REVOKE ALL ON FUNCTION public.genogram_parentage_links(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.review_parentage(
  _client_id uuid,
  _child_id uuid,
  _expected jsonb,
  _parents jsonb,
  _decision text,
  _source text,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _owner uuid := auth.uid();
  _before jsonb;
  _before_reviewed boolean;
  _actual_version jsonb;
  _expected_version jsonb;
  _desired record;
  _existing public.genogram_relationships%ROWTYPE;
  _review_id uuid;
BEGIN
  PERFORM c.id FROM public.clients c
  JOIN public.genogram_persons p ON p.client_id = c.id AND p.id = _child_id
  WHERE c.id = _client_id AND c.professional_id = _owner
  FOR NO KEY UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossiê ou pessoa indisponível.' USING ERRCODE = '42501';
  END IF;

  IF _decision IS NULL OR _decision NOT IN ('confirm', 'edit')
     OR _source IS NULL OR _source NOT IN (
       'unverified', 'client_report', 'family_report', 'document', 'professional_observation', 'other'
     )
     OR length(_note) > 3000
     OR jsonb_typeof(_expected) IS DISTINCT FROM 'array'
     OR jsonb_typeof(_parents) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Confira a filiação e a fonte informadas.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_parents) > 2 THEN
    RAISE EXCEPTION 'Uma pessoa pode ter até duas filiações registradas.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id::text, 8008));
  SELECT p.parentage_reviewed INTO _before_reviewed FROM public.genogram_persons p
  WHERE p.id = _child_id AND p.client_id = _client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pessoa indisponível neste dossiê.' USING ERRCODE = '42501';
  END IF;
  _before := public.genogram_parentage_links(_client_id, _child_id);
  SELECT COALESCE(jsonb_agg(jsonb_build_array(r.id, r.updated_at) ORDER BY r.id), '[]'::jsonb)
    INTO _actual_version
  FROM jsonb_populate_recordset(NULL::public.genogram_relationships, _before) r;
  SELECT COALESCE(jsonb_agg(jsonb_build_array(v.id, v."updatedAt") ORDER BY v.id), '[]'::jsonb)
    INTO _expected_version
  FROM jsonb_to_recordset(_expected) AS v(id uuid, "updatedAt" timestamptz);
  IF _expected_version IS DISTINCT FROM _actual_version THEN
    RAISE EXCEPTION 'A filiação mudou desde que você abriu a ficha. Atualize antes de confirmar.'
      USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_parents) AS p("personId" uuid, kind text)
    WHERE p."personId" IS NULL OR p."personId" = _child_id
      OR (p.kind IS NOT NULL AND p.kind NOT IN ('biological', 'adoptive', 'foster', 'stepparent', 'unknown'))
      OR NOT EXISTS (
        SELECT 1 FROM public.genogram_persons member
        WHERE member.id = p."personId" AND member.client_id = _client_id
      )
  ) THEN
    RAISE EXCEPTION 'Escolha pessoas diferentes deste dossiê e confira a natureza da filiação.'
      USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_parents) AS p("personId" uuid)
    GROUP BY p."personId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Escolha cada genitor apenas uma vez.' USING ERRCODE = '22023';
  END IF;
  IF _decision = 'confirm' AND EXISTS (
    SELECT 1 FROM jsonb_populate_recordset(NULL::public.genogram_relationships, _before) AS r
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(_parents) AS p("personId" uuid, kind text)
      WHERE p."personId" = r.from_person_id AND (p.kind IS NULL OR p.kind = r.qualifier)
    )
  ) THEN
    RAISE EXCEPTION 'Use Corrigir filiação para remover ou alterar um vínculo registrado.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.genogram_relationships r
  WHERE r.client_id = _client_id AND r.to_person_id = _child_id AND r.relationship_type = 'parent'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(_parents) AS p("personId" uuid)
      WHERE p."personId" = r.from_person_id
    );

  FOR _desired IN SELECT * FROM jsonb_to_recordset(_parents) AS p("personId" uuid, kind text) LOOP
    IF public.genogram_parentage_would_cycle(_client_id, _desired."personId", _child_id, NULL) THEN
      RAISE EXCEPTION 'Essa ligação criaria um ciclo. Confira quem é genitor e quem é filho.'
        USING ERRCODE = '22023';
    END IF;
    SELECT r.* INTO _existing FROM public.genogram_relationships r
    WHERE r.client_id = _client_id AND r.to_person_id = _child_id AND r.relationship_type = 'parent'
      AND r.from_person_id = _desired."personId"
    ORDER BY r.created_at, r.id LIMIT 1;

    IF _existing.id IS NULL THEN
      IF _desired.kind IS NULL THEN
        RAISE EXCEPTION 'Informe a natureza da nova filiação.' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.genogram_relationships (client_id, from_person_id, to_person_id, relationship_type, qualifier)
      VALUES (_client_id, _desired."personId", _child_id, 'parent', _desired.kind);
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.genogram_relationships r
        WHERE r.client_id = _client_id AND r.to_person_id = _child_id AND r.relationship_type = 'parent'
          AND r.from_person_id = _desired."personId" AND r.id <> _existing.id
      ) THEN
        RAISE EXCEPTION 'Há vínculos duplicados para uma das pessoas selecionadas. Revise os vínculos duplicados na ficha.'
          USING ERRCODE = '22023';
      END IF;
      IF _desired.kind IS NOT NULL AND _desired.kind IS DISTINCT FROM _existing.qualifier THEN
        UPDATE public.genogram_relationships SET qualifier = _desired.kind WHERE id = _existing.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.genogram_persons SET parentage_reviewed = true
  WHERE id = _child_id AND NOT parentage_reviewed;

  INSERT INTO public.genogram_parentage_reviews (
    client_id, child_id, professional_id, decision, source, note,
    before_links, after_links, before_reviewed, after_reviewed
  )
  VALUES (
    _client_id, _child_id, _owner, _decision, _source, NULLIF(btrim(_note), ''),
    _before, public.genogram_parentage_links(_client_id, _child_id), _before_reviewed, true
  ) RETURNING id INTO _review_id;
  RETURN _review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_parentage(uuid, uuid, jsonb, jsonb, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_parentage(uuid, uuid, jsonb, jsonb, text, text, text) TO authenticated;

CREATE FUNCTION public.undo_parentage_review(_client_id uuid, _review_id uuid)
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
      -- Existing rows can only have their nature changed by review_parentage.
      UPDATE public.genogram_relationships SET qualifier = _link.qualifier
      WHERE id = _link.id AND qualifier IS DISTINCT FROM _link.qualifier;
    ELSE
      _link.updated_at := clock_timestamp();
      INSERT INTO public.genogram_relationships SELECT (_link).*;
    END IF;
  END LOOP;

  UPDATE public.genogram_persons SET parentage_reviewed = _review.before_reviewed
  WHERE id = _review.child_id AND parentage_reviewed IS DISTINCT FROM _review.before_reviewed;

  INSERT INTO public.genogram_parentage_reviews (
    client_id, child_id, professional_id, decision, source, note,
    before_links, after_links, before_reviewed, after_reviewed, undone_review_id
  )
  VALUES (
    _client_id, _review.child_id, _owner, 'undo', COALESCE(_metadata.source, 'unverified'), _metadata.note,
    _current, public.genogram_parentage_links(_client_id, _review.child_id),
    _current_reviewed, _review.before_reviewed, _review.id
  ) RETURNING id INTO _new_review_id;
  RETURN _new_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_parentage_review(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_parentage_review(uuid, uuid) TO authenticated;
