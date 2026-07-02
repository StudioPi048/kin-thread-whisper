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
  const filled = allFields.filter((f) => {
    const v = intake[f];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
  return Math.round((filled / allFields.length) * 100);
}
