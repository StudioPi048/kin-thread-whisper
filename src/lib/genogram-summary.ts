import { getGenogramTopology, splitFamilyRecords } from "@/lib/clinical-intel";
import { buildLogicalGraph, getResolvedParents, type PersonEntity } from "@/lib/geno/build";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

export type GenogramPersonDTO = {
  id: string;
  fullName: string;
  preferredName: string | null;
  gender: string | null;
  isProband: boolean;
  isDeceased: boolean;
  hasBirthDate: boolean;
  hasDeathDate: boolean;
  relationshipTo: string | null; // relationship_to_proband
  role:
    | "proband"
    | "father"
    | "mother"
    | "grandfather"
    | "grandmother"
    | "sibling"
    | "child"
    | "spouse"
    | "other";
};

export type GenogramAlert = {
  severity: "info" | "warn" | "high";
  message: string;
};

export type ClientGenogramDTO = {
  hasGenogram: boolean;
  totalPersons: number;
  generations: {
    proband: GenogramPersonDTO | null;
    parents: GenogramPersonDTO[];
    grandparents: GenogramPersonDTO[];
    siblings: GenogramPersonDTO[];
    others: GenogramPersonDTO[];
  };
  alerts: GenogramAlert[];
};

const lastSurname = (fullName: string): string | null => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const skip = new Set(["de", "da", "do", "das", "dos", "e"]);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!skip.has(parts[i].toLowerCase())) return parts[i].toLowerCase();
  }
  return null;
};

export function summarizeCaseGenogram(
  persons: PersonRow[],
  relationships: RelationshipRow[],
): ClientGenogramDTO {
  const family = splitFamilyRecords(persons, relationships);
  const graph = buildLogicalGraph(getGenogramTopology(family));
  const mappable = Array.from(graph.persons.values(), ({ row }) => row);
  const root = graph.probandId ? graph.persons.get(graph.probandId) : undefined;
  const probandId =
    root &&
    (root.row.is_proband ||
      smartNormalizeRelationship(root.row.relationship_to_proband) === "Consulente")
      ? root.id
      : null;
  const parentsOf = (id: string) => getResolvedParents(graph, id).map((link) => link.personId);
  const parentIds = new Set(probandId ? parentsOf(probandId) : []);
  const grandparentIds = new Set([...parentIds].flatMap(parentsOf));

  function role(person: PersonEntity): GenogramPersonDTO["role"] {
    if (person.id === probandId) return "proband";
    const gender = person.row.gender?.toLowerCase();
    const tag = smartNormalizeRelationship(person.row.relationship_to_proband);
    if (parentIds.has(person.id)) {
      if (tag === "Pai" || gender === "m" || gender === "masculino") return "father";
      if (tag === "Mãe" || gender === "f" || gender === "feminino") return "mother";
    } else if (grandparentIds.has(person.id)) {
      if (tag.startsWith("Avô ") || gender === "m" || gender === "masculino") return "grandfather";
      if (tag.startsWith("Avó ") || gender === "f" || gender === "feminino") return "grandmother";
    } else if (probandId && graph.topRowIds.has(person.id)) {
      return "sibling";
    } else if (probandId && parentsOf(person.id).includes(probandId)) {
      return "child";
    } else if (tag === "Cônjuge") {
      return "spouse";
    }
    return "other";
  }

  const records = [...graph.persons.values()].map((p): GenogramPersonDTO => ({
    id: p.id,
    fullName: p.row.full_name,
    preferredName: p.row.preferred_name,
    gender: p.row.gender,
    isProband: p.id === probandId,
    isDeceased: p.row.is_deceased,
    hasBirthDate: Boolean(p.row.birth_date),
    hasDeathDate: Boolean(p.row.death_date),
    relationshipTo: p.row.relationship_to_proband,
    role: role(p),
  }));
  const proband = records.find((p) => p.id === probandId) ?? null;
  const parents = records.filter((p) => parentIds.has(p.id));
  const grandparents = records.filter((p) => grandparentIds.has(p.id) && !parentIds.has(p.id));
  const siblings = records.filter((p) => p.role === "sibling");
  const others = records.filter(
    (p) =>
      p.id !== probandId &&
      !parentIds.has(p.id) &&
      !grandparentIds.has(p.id) &&
      p.role !== "sibling",
  );

  const alerts: GenogramAlert[] = [];

  if (mappable.length === 0) {
    alerts.push({
      severity: "high",
      message: "Genossociograma ainda não iniciado para este cliente.",
    });
  } else {
    if (!proband) {
      alerts.push({
        severity: "warn",
        message: "Identifique o consulente para conferir as gerações do genossociograma.",
      });
    }
    if (proband && parents.length < 2) {
      alerts.push({
        severity: "warn",
        message: family.archivedPersons.length
          ? `Filiação do consulente: ${parents.length}/2 genitores no mapa ativo.`
          : `Filiação do consulente: ${parents.length}/2 genitores registrados.`,
      });
    }
    if (proband && grandparents.length < 4) {
      alerts.push({
        severity: "info",
        message: family.archivedPersons.length
          ? `Filiação dos pais: ${grandparents.length}/4 avós no mapa ativo.`
          : `Filiação dos pais: ${grandparents.length}/4 avós ligados ao consulente.`,
      });
    }
    const missingBirth = mappable.filter((p) => !p.birth_date).length;
    if (missingBirth > 0) {
      alerts.push({
        severity: missingBirth >= 3 ? "warn" : "info",
        message: `${missingBirth} parente(s) sem data de nascimento.`,
      });
    }
    const deceasedNoDate = mappable.filter((p) => p.is_deceased && !p.death_date).length;
    if (deceasedNoDate > 0) {
      alerts.push({
        severity: "warn",
        message: `${deceasedNoDate} falecido(s) sem data de óbito registrada.`,
      });
    }

    // life events without date
    let eventsNoDate = 0;
    mappable.forEach((p) => {
      const ev = p.life_events;
      if (Array.isArray(ev)) {
        ev.forEach((e) => {
          if (e && typeof e === "object" && !("date" in e && (e as Record<string, unknown>).date)) {
            eventsNoDate++;
          }
        });
      }
    });
    if (eventsNoDate > 0) {
      alerts.push({
        severity: "info",
        message: `${eventsNoDate} evento(s) importante(s) sem data — investigar coincidências.`,
      });
    }

    // repeated surnames
    const surnameCounts = new Map<string, number>();
    mappable.forEach((p) => {
      const s = lastSurname(p.full_name);
      if (s) surnameCounts.set(s, (surnameCounts.get(s) ?? 0) + 1);
    });
    surnameCounts.forEach((count, surname) => {
      if (count >= 3) {
        alerts.push({
          severity: "info",
          message: `Sobrenome "${surname[0].toUpperCase() + surname.slice(1)}" repete em ${count} pessoas.`,
        });
      }
    });
  }

  return {
    hasGenogram: mappable.length > 0,
    totalPersons: mappable.length,
    generations: { proband, parents, grandparents, siblings, others },
    alerts,
  };
}
