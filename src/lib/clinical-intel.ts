import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";
import { readCasePages } from "@/lib/read-case-pages";

export interface ClinicalIntelData {
  client: { full_name: string; presenting_complaint: string | null } | null;
  persons: PersonRow[];
  relationships: RelationshipRow[];
  archivedPersons?: PersonRow[];
  archivedRelationships?: RelationshipRow[];
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

function mapRecords(persons: readonly PersonRow[], relationships: readonly RelationshipRow[]) {
  const linkedIds = new Set(
    relationships.flatMap((relationship) => [
      relationship.from_person_id,
      relationship.to_person_id,
    ]),
  );
  return persons.filter((person) => linkedIds.has(person.id) || hasFamilyRecordData(person));
}

/** Fichas ativas com vínculos explícitos continuam no mapa mesmo sem nome ou data. */
export function getMappablePersons(persons: PersonRow[], relationships: RelationshipRow[]) {
  return mapRecords(persons, relationships).filter((person) => !person.archived_at);
}

export function splitFamilyRecords(persons: PersonRow[], relationships: RelationshipRow[]) {
  const archivedPersons = persons.filter((person) => person.archived_at);
  if (archivedPersons.length === 0)
    return { persons, relationships, archivedPersons, archivedRelationships: [] };
  const archivedIds = new Set(archivedPersons.map(({ id }) => id));
  const archivedRelationships: RelationshipRow[] = [];
  const visibleRelationships: RelationshipRow[] = [];
  for (const link of relationships) {
    const touchesArchive =
      archivedIds.has(link.from_person_id) || archivedIds.has(link.to_person_id);
    (touchesArchive ? archivedRelationships : visibleRelationships).push(link);
  }
  return {
    persons: persons.filter(({ id }) => !archivedIds.has(id)),
    relationships: visibleRelationships,
    archivedPersons,
    archivedRelationships,
  };
}

/** A linhagem registrada orienta gerações mesmo quando uma ficha está arquivada. */
export function getGenogramTopology(family: Omit<ClinicalIntelData, "client">) {
  const rels = [...family.relationships, ...(family.archivedRelationships ?? [])];
  return {
    persons: mapRecords([...family.persons, ...(family.archivedPersons ?? [])], rels),
    rels,
  };
}

/** Única queryFn/queryKey para evidências de um caso — mesmo formato em todas as telas. */
export const clinicalIntelQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["clinical-intel", clientId] as const,
    enabled: !!clientId,
    queryFn: async (): Promise<ClinicalIntelData> => {
      const [clientRes, persons, relationships] = await Promise.all([
        supabase
          .from("clients")
          .select("full_name, presenting_complaint")
          .eq("id", clientId)
          .maybeSingle(),
        readCasePages(
          (after, limit) => {
            const page = supabase
              .from("genogram_persons")
              .select("*")
              .eq("client_id", clientId)
              .order("id")
              .limit(limit);
            return after ? page.gt("id", after) : page;
          },
          (person) => person.id,
        ),
        readCasePages(
          (after, limit) => {
            const page = supabase
              .from("genogram_relationships")
              .select("*")
              .eq("client_id", clientId)
              .order("id")
              .limit(limit);
            return after ? page.gt("id", after) : page;
          },
          (relationship) => relationship.id,
        ),
      ]);
      if (clientRes.error) throw clientRes.error;
      return {
        client: clientRes.data,
        ...splitFamilyRecords(persons, relationships),
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
      "genogram-removed-relationships",
    ].map((key) => qc.invalidateQueries({ queryKey: [key, clientId] })),
    qc.invalidateQueries({ queryKey: ["genograms-list"] }),
    qc.invalidateQueries({ queryKey: ["timelines-list"] }),
    qc.invalidateQueries({ queryKey: ["mesa-onboarding-counts"] }),
  ]);
}
