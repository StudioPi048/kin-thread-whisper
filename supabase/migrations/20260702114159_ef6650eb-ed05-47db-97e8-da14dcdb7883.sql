CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  preferred_name text,
  birth_date date,
  gender text CHECK (gender IN ('feminino','masculino','nao_binario','outro','nao_informado')),
  birthplace text,
  phone text,
  email text,
  presenting_complaint text,
  clinical_notes text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  consent_given_at timestamptz,
  consent_notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE INDEX clients_professional_id_idx ON public.clients (professional_id);
CREATE INDEX clients_professional_status_idx ON public.clients (professional_id, status);
CREATE INDEX clients_full_name_trgm_idx ON public.clients USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX clients_created_at_idx ON public.clients (created_at DESC);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_owner_select" ON public.clients FOR SELECT TO authenticated USING (professional_id = auth.uid());
CREATE POLICY "clients_owner_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (professional_id = auth.uid());
CREATE POLICY "clients_owner_update" ON public.clients FOR UPDATE TO authenticated USING (professional_id = auth.uid()) WITH CHECK (professional_id = auth.uid());
CREATE POLICY "clients_owner_delete" ON public.clients FOR DELETE TO authenticated USING (professional_id = auth.uid());

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();