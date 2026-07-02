-- =========================================================
-- Etapa 3 · Genossociograma vivo
-- =========================================================

-- Pessoas do genossociograma ------------------------------------------------
CREATE TABLE public.genogram_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  preferred_name text,
  gender text,                       -- feminino | masculino | nao_binario | outro | desconhecido
  birth_date date,
  death_date date,
  is_deceased boolean NOT NULL DEFAULT false,
  is_proband boolean NOT NULL DEFAULT false,  -- paciente-índice
  occupation text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX genogram_persons_client_idx ON public.genogram_persons(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genogram_persons TO authenticated;
GRANT ALL ON public.genogram_persons TO service_role;

ALTER TABLE public.genogram_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY genogram_persons_owner_select ON public.genogram_persons
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_persons.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_persons_owner_insert ON public.genogram_persons
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_persons.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_persons_owner_update ON public.genogram_persons
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_persons.client_id AND c.professional_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_persons.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_persons_owner_delete ON public.genogram_persons
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_persons.client_id AND c.professional_id = auth.uid()
  ));

CREATE TRIGGER trg_genogram_persons_updated
  BEFORE UPDATE ON public.genogram_persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Relações do genossociograma -----------------------------------------------
CREATE TABLE public.genogram_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_person_id uuid NOT NULL REFERENCES public.genogram_persons(id) ON DELETE CASCADE,
  to_person_id uuid NOT NULL REFERENCES public.genogram_persons(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,     -- parent | union | sibling | emotional
  qualifier text,                      -- marriage | divorce | cohabitation | engagement | rupture | fusion | conflict | distance | close | grief | biological | adoptive | foster
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT genogram_rel_not_self CHECK (from_person_id <> to_person_id),
  CONSTRAINT genogram_rel_type_check CHECK (relationship_type IN ('parent','union','sibling','emotional'))
);

CREATE INDEX genogram_rel_client_idx ON public.genogram_relationships(client_id);
CREATE INDEX genogram_rel_from_idx ON public.genogram_relationships(from_person_id);
CREATE INDEX genogram_rel_to_idx ON public.genogram_relationships(to_person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genogram_relationships TO authenticated;
GRANT ALL ON public.genogram_relationships TO service_role;

ALTER TABLE public.genogram_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY genogram_rel_owner_select ON public.genogram_relationships
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_relationships.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_rel_owner_insert ON public.genogram_relationships
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_relationships.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_rel_owner_update ON public.genogram_relationships
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_relationships.client_id AND c.professional_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_relationships.client_id AND c.professional_id = auth.uid()
  ));

CREATE POLICY genogram_rel_owner_delete ON public.genogram_relationships
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = genogram_relationships.client_id AND c.professional_id = auth.uid()
  ));

CREATE TRIGGER trg_genogram_rel_updated
  BEFORE UPDATE ON public.genogram_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
