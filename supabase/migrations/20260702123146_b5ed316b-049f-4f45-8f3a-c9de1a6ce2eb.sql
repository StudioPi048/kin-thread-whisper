
ALTER TABLE public.genogram_persons
  ADD COLUMN IF NOT EXISTS relationship_to_proband TEXT,
  ADD COLUMN IF NOT EXISTS temperament TEXT,
  ADD COLUMN IF NOT EXISTS vices TEXT,
  ADD COLUMN IF NOT EXISTS gestational_weeks TEXT,
  ADD COLUMN IF NOT EXISTS birth_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_genogram_persons_relationship
  ON public.genogram_persons(client_id, relationship_to_proband);
