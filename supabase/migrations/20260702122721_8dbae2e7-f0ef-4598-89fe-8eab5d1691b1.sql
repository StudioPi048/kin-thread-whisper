
CREATE TABLE public.client_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Abertura
  presenting_intention TEXT,
  signature_notes TEXT,

  -- 1) Dados pessoais
  full_name TEXT,
  name_chooser TEXT,
  name_intention TEXT,
  name_repetition_in_family TEXT,
  birth_datetime TIMESTAMPTZ,
  birth_place TEXT,
  gender TEXT,
  religion TEXT,
  education TEXT,
  profession TEXT,
  ethnicity_maternal TEXT,
  ethnicity_paternal TEXT,

  -- Estado civil / uniões
  civil_status TEXT, -- 'married' | 'stable_union' | 'single' | 'divorced' | 'widowed'
  union_date DATE,
  relationships_count INTEGER,
  partners JSONB DEFAULT '[]'::jsonb,
  -- [{ name, description, birth_date, union_date, separation_date, causes }]

  -- Filhos
  children JSONB DEFAULT '[]'::jsonb,
  -- [{ name, birth_date, death_date, gestational_order, gestational_weeks, relationship_notes, aborted }]

  -- Marcas pessoais
  tattoos JSONB DEFAULT '[]'::jsonb,           -- [{ location, side, date, photo_url, meaning }]
  moles_notes TEXT,
  scars_notes TEXT,
  ear_stretcher TEXT,
  piercings TEXT,
  missing_limbs TEXT,
  extra_or_inverted_limbs TEXT,

  -- Concepção / gestação / parto
  conception_notes TEXT,
  pregnancy_notes TEXT,
  birth_notes TEXT,
  parents_financial_mother TEXT,
  parents_financial_father TEXT,
  parents_emotional_mother TEXT,
  parents_emotional_father TEXT,
  parents_professional_mother TEXT,
  parents_professional_father TEXT,
  historical_context_at_birth TEXT,

  -- Subjetivos
  life_mission TEXT,
  childhood_traumas TEXT,
  childhood_dream_profession TEXT,
  disliked_patterns TEXT,

  -- Irmãos
  siblings_relationship TEXT,
  siblings JSONB DEFAULT '[]'::jsonb,
  -- [{ name, birth_date, death_date, birth_order, characteristics }]
  siblings_deaths_notes TEXT,
  parents_siblings_deaths TEXT,

  -- Relação com pais e escola
  parents_relationship TEXT,
  school_events TEXT,

  -- Saúde própria
  own_abortions TEXT,
  own_illnesses TEXT,

  -- Vida profissional
  work_history JSONB DEFAULT '[]'::jsonb,
  -- [{ role, start_date, end_date, experience }]
  formal_education TEXT,
  education_chosen_by_self BOOLEAN,
  future_perspective TEXT,

  -- 2) Dados do clã (checklist com pessoas relacionadas)
  clan_homicides TEXT,
  clan_suicides TEXT,
  clan_alcoholism TEXT,
  clan_chemical_dependency TEXT,
  clan_mental_illness TEXT,
  clan_physical_disability TEXT,
  clan_epilepsy TEXT,
  clan_autism TEXT,
  clan_respiratory TEXT,
  clan_cardiovascular TEXT,
  clan_surgeries TEXT,
  clan_car_accidents TEXT,
  clan_cancer TEXT,
  clan_stroke TEXT,
  clan_incest TEXT,
  clan_migrants TEXT,
  clan_homosexuality TEXT,
  clan_other_observations TEXT,

  -- Narrativas do clã
  clan_important_events TEXT,
  clan_bonds_ruptures TEXT,
  clan_repeated_stories TEXT,
  clan_secrets TEXT,

  -- 3) Adicionais / átomo social
  favorite_childhood_games TEXT,
  childhood_fears TEXT,
  recurring_dreams TEXT,
  marking_fairy_tales TEXT,
  dental_agenesis TEXT,
  dental_root_canal TEXT,
  cultural_heritage_maternal TEXT,
  cultural_heritage_paternal TEXT,

  -- Átomo social (livre)
  social_atom_object TEXT,
  social_atom_book TEXT,
  social_atom_pet TEXT,
  social_atom_historic_moment TEXT,
  social_atom_music TEXT,
  social_atom_close_people TEXT,
  social_atom_symbols TEXT,
  social_atom_other TEXT,

  -- Progresso
  completion_percentage INTEGER DEFAULT 0,
  last_section_edited TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_intakes TO authenticated;
GRANT ALL ON public.client_intakes TO service_role;

ALTER TABLE public.client_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals manage own client intakes"
ON public.client_intakes FOR ALL
TO authenticated
USING (auth.uid() = professional_id)
WITH CHECK (auth.uid() = professional_id);

CREATE TRIGGER update_client_intakes_updated_at
BEFORE UPDATE ON public.client_intakes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_client_intakes_client_id ON public.client_intakes(client_id);
