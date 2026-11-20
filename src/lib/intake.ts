import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ClientIntake = Tables<"client_intakes">;
export type ClientIntakeInsert = TablesInsert<"client_intakes">;

export type PartnerEntry = {
  name?: string;
  description?: string;
  birth_date?: string;
  union_date?: string;
  separation_date?: string;
  causes?: string;
};

export type ChildEntry = {
  name?: string;
  birth_date?: string;
  death_date?: string;
  gestational_order?: string;
  gestational_weeks?: string;
  relationship_notes?: string;
  aborted?: boolean;
};

export type SiblingEntry = {
  name?: string;
  birth_date?: string;
  death_date?: string;
  birth_order?: string;
  characteristics?: string;
};

export type TattooEntry = {
  location?: string;
  side?: string;
  date?: string;
  meaning?: string;
  photo_url?: string;
};

export type WorkEntry = {
  role?: string;
  start_date?: string;
  end_date?: string;
  experience?: string;
};

export const INTAKE_SECTIONS = [
  { id: "opening", label: "Abertura" },
  { id: "personal", label: "Dados pessoais" },
  { id: "relationships", label: "Uniões & filhos" },
  { id: "body", label: "Marcas corporais" },
  { id: "origins", label: "Concepção · gestação · parto" },
  { id: "subjective", label: "Missão & subjetivo" },
  { id: "siblings", label: "Irmãos & pais" },
  { id: "professional", label: "Vida profissional" },
  { id: "clan_checklist", label: "Clã: incidências" },
  { id: "clan_narratives", label: "Clã: narrativas & segredos" },
  { id: "additional", label: "Adicionais & átomo social" },
] as const;

export type IntakeSectionId = (typeof INTAKE_SECTIONS)[number]["id"];

export const INTAKE_QUESTION_LABELS = {
  presenting_intention: "Intenção do atendimento — o que ele(a) quer ser visto?",
  signature_notes: "Observações sobre a grafia / assinatura",
  full_name: "Nome completo",
  name_chooser: "Quem escolheu o nome",
  name_intention: "Intenção do nome",
  name_repetition_in_family: "Repetição do nome no clã",
  birth_datetime: "Data, local e hora de nascimento",
  birth_place: "Local de nascimento",
  religion: "Religião",
  education: "Escolaridade",
  profession: "Profissão",
  ethnicity_maternal: "Etnia materna",
  ethnicity_paternal: "Etnia paterna",
  union_date: "Data do casamento / marco",
  relationships_count: "Nº de relacionamentos / separações",
  moles_notes: "Pintas / manchas grandes",
  scars_notes: "Cicatrizes",
  ear_stretcher: "Alargador (quando colocou)",
  piercings: "Piercing (quando colocou)",
  missing_limbs: "Falta de membros",
  extra_or_inverted_limbs: "Membros supranumerários ou de lateralidade invertida",
  conception_notes: "Concepção — programada? notícia no clã?",
  pregnancy_notes: "Gestação — preocupações, notícias impactantes, doenças, quedas",
  birth_notes: "Parto — tipo, duração, complicações",
  parents_financial_mother: "Financeiro — mãe",
  parents_financial_father: "Financeiro — pai",
  parents_emotional_mother: "Emocional — mãe",
  parents_emotional_father: "Emocional — pai",
  parents_professional_mother: "Profissional — mãe",
  parents_professional_father: "Profissional — pai",
  historical_context_at_birth: "Contexto histórico / social no nascimento",
  life_mission: "Missão de vida (primeiro pensamento)",
  childhood_traumas: "Traumas de infância",
  childhood_dream_profession: "Profissão dos sonhos na infância",
  disliked_patterns: "Padrões que não gosta em si",
  siblings_relationship: "Como foi/é a relação com os irmãos",
  siblings_deaths_notes:
    "Falecimentos de irmãos antes/depois do cliente (inclusive abortos e natimortos)",
  parents_siblings_deaths: "Falecimentos precoces / abortos de irmãos dos pais",
  parents_relationship: "Relação com os pais — segurança, apoio nas decisões",
  school_events: "Eventos marcantes no ambiente escolar",
  own_abortions: "Abortos do(a) cliente — quantos e em que idades",
  own_illnesses: "Enfermidades e acidentes — breve relato com idades",
  formal_education: "Formação acadêmica (seja específico)",
  future_perspective: "Perspectiva futura",
  clan_other_observations: "Outras observações",
  clan_important_events: "Eventos importantes ocorridos ou contados na família",
  clan_bonds_ruptures: "Ligações — aproximação, intensidade, afastamento, ódio, repúdio",
  clan_repeated_stories: "Histórias contadas repetidamente / através de gerações",
  clan_secrets: "Segredos — o que se sabe, supõe ou intui que não é comentado",
  favorite_childhood_games: "Brincadeiras preferidas na infância",
  childhood_fears: "Medos na infância",
  recurring_dreams: "Sonhos / pesadelos reiterados",
  marking_fairy_tales: "Contos de fada / histórias marcantes",
  dental_agenesis: "Agenesia de dente (qual?)",
  dental_root_canal: "Canal em algum dente (qual?)",
  cultural_heritage_maternal: "Herança cultural materna",
  cultural_heritage_paternal: "Herança cultural paterna",
  social_atom_object: "Objeto marcante (nome e significado)",
  social_atom_book: "Livro marcante",
  social_atom_pet: "Animal de estimação",
  social_atom_historic_moment: "Momento histórico marcante",
  social_atom_music: "Música que marcou",
  social_atom_close_people: "Pessoas mais próximas",
  social_atom_symbols: "Símbolos, ideias, ideologias importantes",
  social_atom_other: "Outras memórias do clã",
} satisfies Partial<Record<keyof ClientIntake, string>>;

export const INTAKE_ANSWER_STATUS = {
  unknown: "Desconhecido",
  pending: "A confirmar",
  not_applicable: "Não se aplica",
} as const;

export const INTAKE_ANSWER_SOURCE = {
  client: "Relato do consultante",
  family: "Relato de familiar",
  document: "Documento",
  observation: "Observação da profissional",
} as const;

export type IntakeContextKey = "status" | "source" | "note";
export type IntakeAnswerContext = Partial<Record<IntakeContextKey, string>>;

export function answerContext(intake: Partial<ClientIntake>, field: string): IntakeAnswerContext {
  const metadata = intake.field_context;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const context = Object.hasOwn(metadata, field) ? metadata[field] : null;
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  return {
    status: typeof context.status === "string" ? context.status : undefined,
    source: typeof context.source === "string" ? context.source : undefined,
    note: typeof context.note === "string" ? context.note : undefined,
  };
}

export function isIntakeSection(value: unknown): value is IntakeSectionId {
  return INTAKE_SECTIONS.some(({ id }) => id === value);
}

export function findIntakeQuestions(query: string) {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const term = normalize(query.trim());
  if (!term) return [];
  const labels: Partial<Record<keyof ClientIntake, string>> = INTAKE_QUESTION_LABELS;
  return INTAKE_SECTIONS.flatMap<{
    section: (typeof INTAKE_SECTIONS)[number];
    field?: keyof ClientIntake;
    label: string;
  }>((section) => {
    const matches = SECTION_FIELDS[section.id].flatMap((field) => {
      const label = labels[field];
      return label && normalize(label).includes(term) ? [{ section, field, label }] : [];
    });
    if (matches.length) return matches;
    return normalize(section.label).includes(term)
      ? [{ section, field: undefined, label: section.label }]
      : [];
  });
}

// Fields per section — used for progress calculation.
export const SECTION_FIELDS: Record<IntakeSectionId, (keyof ClientIntake)[]> = {
  opening: ["presenting_intention", "signature_notes"],
  personal: [
    "full_name",
    "name_chooser",
    "name_intention",
    "name_repetition_in_family",
    "birth_datetime",
    "birth_place",
    "gender",
    "religion",
    "education",
    "profession",
    "ethnicity_maternal",
    "ethnicity_paternal",
  ],
  relationships: ["civil_status", "union_date", "relationships_count", "partners", "children"],
  body: [
    "tattoos",
    "moles_notes",
    "scars_notes",
    "ear_stretcher",
    "piercings",
    "missing_limbs",
    "extra_or_inverted_limbs",
  ],
  origins: [
    "conception_notes",
    "pregnancy_notes",
    "birth_notes",
    "parents_financial_mother",
    "parents_financial_father",
    "parents_emotional_mother",
    "parents_emotional_father",
    "parents_professional_mother",
    "parents_professional_father",
    "historical_context_at_birth",
  ],
  subjective: [
    "life_mission",
    "childhood_traumas",
    "childhood_dream_profession",
    "disliked_patterns",
  ],
  siblings: [
    "siblings_relationship",
    "siblings",
    "siblings_deaths_notes",
    "parents_siblings_deaths",
    "parents_relationship",
    "school_events",
    "own_abortions",
    "own_illnesses",
  ],
  professional: [
    "work_history",
    "formal_education",
    "education_chosen_by_self",
    "future_perspective",
  ],
  clan_checklist: [
    "clan_homicides",
    "clan_suicides",
    "clan_alcoholism",
    "clan_chemical_dependency",
    "clan_mental_illness",
    "clan_physical_disability",
    "clan_epilepsy",
    "clan_autism",
    "clan_respiratory",
    "clan_cardiovascular",
    "clan_surgeries",
    "clan_car_accidents",
    "clan_cancer",
    "clan_stroke",
    "clan_incest",
    "clan_migrants",
    "clan_homosexuality",
    "clan_other_observations",
  ],
  clan_narratives: [
    "clan_important_events",
    "clan_bonds_ruptures",
    "clan_repeated_stories",
    "clan_secrets",
  ],
  additional: [
    "favorite_childhood_games",
    "childhood_fears",
    "recurring_dreams",
    "marking_fairy_tales",
    "dental_agenesis",
    "dental_root_canal",
    "cultural_heritage_maternal",
    "cultural_heritage_paternal",
    "social_atom_object",
    "social_atom_book",
    "social_atom_pet",
    "social_atom_historic_moment",
    "social_atom_music",
    "social_atom_close_people",
    "social_atom_symbols",
    "social_atom_other",
  ],
};

export function calculateCompletion(intake: Partial<ClientIntake>): number {
  const allFields = Object.values(SECTION_FIELDS).flat();
  const filled = allFields.filter((f) => isFilled(intake[f]) || answerResolved(intake, f)).length;
  return Math.round((filled / allFields.length) * 100);
}

/** Valor explícito para "não se sabe" — conta como respondido, distinto de vazio. */
export const INTAKE_UNKNOWN = "Desconhecido";

const isFilled = (v: unknown) => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

function answerResolved(intake: Partial<ClientIntake>, field: keyof ClientIntake) {
  const { status } = answerContext(intake, field);
  return status === "unknown" || status === "not_applicable";
}

export function sectionCompletion(intake: Partial<ClientIntake>, id: IntakeSectionId) {
  const fields = SECTION_FIELDS[id];
  const filled = fields.filter((f) => isFilled(intake[f]) || answerResolved(intake, f)).length;
  const unknown = fields.filter(
    (f) => intake[f] === INTAKE_UNKNOWN || answerContext(intake, f).status === "unknown",
  ).length;
  return { filled, unknown, total: fields.length };
}
