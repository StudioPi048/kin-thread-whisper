import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";

export interface ClinicalIntelData {
  client: { full_name: string; presenting_complaint: string | null } | null;
  persons: PersonRow[];
  relationships: RelationshipRow[];
}

/** Etiquetas e gênero de um modelo vazio não representam uma pessoa cadastrada. */
export function hasFamilyRecordData(person: PersonRow) {
  return Boolean(
    person.is_proband ||
    person.full_name.trim() ||
    person.preferred_name?.trim() ||
    person.birth_date ||
    person.birth_date_partial ||
    person.death_date ||
    person.death_date_partial ||
    person.is_deceased ||
    person.cause_of_death?.trim() ||
    person.gestational_weeks?.trim() ||
    person.health_conditions?.length ||
    person.occupation?.trim() ||
    person.vices?.trim() ||
    person.temperament?.trim() ||
    person.birth_order != null ||
    person.notes?.trim() ||
    person.tags?.length ||
    (Array.isArray(person.life_events) && person.life_events.length > 0),
  );
}

/** Fichas com vínculos explícitos continuam no mapa mesmo sem nome ou data. */
export function getMappablePersons(persons: PersonRow[], relationships: RelationshipRow[]) {
  const linkedIds = new Set(
    relationships.flatMap((relationship) => [
      relationship.from_person_id,
      relationship.to_person_id,
    ]),
  );
  return persons.filter((person) => linkedIds.has(person.id) || hasFamilyRecordData(person));
}

/** Única queryFn/queryKey para evidências de um caso — mesmo formato em todas as telas. */
export const clinicalIntelQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["clinical-intel", clientId] as const,
    enabled: !!clientId,
    queryFn: async (): Promise<ClinicalIntelData> => {
      const [clientRes, personsRes, relsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("full_name, presenting_complaint")
          .eq("id", clientId)
          .maybeSingle(),
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (personsRes.error) throw personsRes.error;
      if (relsRes.error) throw relsRes.error;
      return {
        client: clientRes.data,
        persons: (personsRes.data ?? []) as PersonRow[],
        relationships: (relsRes.data ?? []) as RelationshipRow[],
      };
    },
  });

/** Após qualquer mutação de familiares/vínculos: todas as telas que leem evidências se atualizam. */
export function invalidateCase(qc: QueryClient, clientId: string) {
  return Promise.all([
    ...[
      "genogram",
      "clinical-intel",
      "case-dashboard",
      "client-genogram",
      "genogram-count",
      "client-genogram-count",
      "genogram-gallery-preview",
    ].map((key) => qc.invalidateQueries({ queryKey: [key, clientId] })),
    qc.invalidateQueries({ queryKey: ["genograms-list"] }),
    qc.invalidateQueries({ queryKey: ["timelines-list"] }),
  ]);
}
