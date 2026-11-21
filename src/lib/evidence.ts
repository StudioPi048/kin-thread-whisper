/**
 * Evidências → hipóteses provisórias.
 * Fonte única para Mesa, Dossiê e revisão de evidências: derivado de detectPatterns()
 * sobre os dados reais do caso. Sem padrões detectados → nenhuma hipótese.
 * Nunca atribui causalidade nem confiança numérica.
 */
import { buildLogicalGraph, type LogicalGraph } from "./geno/build";
import { getGenogramTopology, type ClinicalIntelData } from "./clinical-intel";
import {
  detectPatterns,
  type DetectedPattern,
  type PersonRow,
  type RelationshipRow,
} from "./patterns";

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  /** Familiares que sustentam a hipótese (nomes) */
  sources: string[];
  patternId: string;
  limits: string;
  questions: string[];
}

const TEMPLATES: Partial<
  Record<DetectedPattern["type"], { title: string; description: string; questions: string[] }>
> = {
  anniversary_syndrome: {
    title: "Possível coincidência de datas (síndrome de aniversário)",
    description:
      "Datas de eventos se repetem entre gerações. Vale investigar se a queixa atual oscila perto dessas datas.",
    questions: [
      "Quais são as datas registradas de cada evento?",
      "A pessoa consultante percebe alguma relação com essas datas?",
    ],
  },
  shared_cause_of_death: {
    title: "Repetição de causa de morte",
    description: "Mesma causa registrada para mais de um familiar.",
    questions: ["O que se sabe sobre cada falecimento?", "Há registros a confirmar?"],
  },
  shared_health_condition: {
    title: "Repetição de condição de saúde",
    description: "Mesma condição de saúde aparece em mais de um familiar.",
    questions: [
      "Quando a condição foi registrada em cada familiar?",
      "Há avaliação médica disponível?",
    ],
  },
  shared_death_age: {
    title: "Repetição de idade ao falecer",
    description: "Familiares faleceram em idades próximas.",
    questions: [
      "As datas de nascimento e falecimento estão confirmadas?",
      "Como a pessoa consultante vê essa informação?",
    ],
  },
  shared_occupation: {
    title: "Repetição profissional",
    description: "A mesma ocupação aparece em mais de um familiar.",
    questions: [
      "Como cada familiar chegou a essa profissão?",
      "O que a pessoa consultante sabe sobre isso?",
    ],
  },
  relationship_ruptures: {
    title: "Rupturas repetidas de vínculo",
    description: "Há registros de ruptura ou conflito em mais de um vínculo emocional.",
    questions: ["Em que contexto cada ruptura aconteceu?", "Há datas a completar?"],
  },
};

const LIMITS =
  "Hipótese provisória baseada apenas no que está registrado. Coincidência não indica causa; valide na relação clínica e complete dados faltantes.";

export function buildHypotheses(patterns: DetectedPattern[], persons: PersonRow[]): Hypothesis[] {
  const nameOf = new Map(
    persons.map((p) => [p.id, p.full_name.trim() || p.preferred_name?.trim()]),
  );
  const out: Hypothesis[] = [];
  for (const pt of patterns) {
    const t = TEMPLATES[pt.type];
    if (!t || pt.facts.length === 0) continue;
    const sources = pt.personIds.map((id) => nameOf.get(id)).filter((x): x is string => !!x);
    if (sources.length === 0) continue;
    out.push({
      id: `h-${pt.id}`,
      title: t.title,
      description: `${t.description} Evidência: ${pt.description}`,
      sources,
      patternId: pt.id,
      limits: LIMITS,
      questions: t.questions,
    });
  }
  return out;
}

export function evidenceForCase(persons: PersonRow[], relationships: RelationshipRow[]) {
  const patterns = detectPatterns(persons, relationships);
  return { patterns, hypotheses: buildHypotheses(patterns, persons) };
}

type ArchivedFamily = Pick<ClinicalIntelData, "archivedPersons" | "archivedRelationships">;

function childrenWithArchivedParent(archive?: ArchivedFamily) {
  return new Set(
    (archive?.archivedRelationships ?? [])
      .filter(({ relationship_type }) => relationship_type === "parent")
      .map(({ to_person_id }) => to_person_id),
  );
}

function pendingParentage(graph: LogicalGraph, archivedParentIds: ReadonlySet<string>) {
  return [...graph.persons.values()]
    .filter(
      ({ id, row }) =>
        !archivedParentIds.has(id) &&
        !row.parentage_reviewed &&
        (graph.parentsByChild.get(id)?.length || graph.suggestedParentsByChild.get(id)?.length),
    )
    .map(({ id, row }) => ({
      id,
      name: row.preferred_name?.trim() || row.full_name.trim() || "Familiar sem nome",
    }));
}

export function parentageToReview(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  archive?: ArchivedFamily,
) {
  const probandId = persons.find((p) => p.is_proband)?.id;
  return probandId
    ? pendingParentage(
        buildLogicalGraph({
          ...getGenogramTopology({ persons, relationships, ...archive }),
          probandId,
        }),
        childrenWithArchivedParent(archive),
      )
    : [];
}

/** Campos faltantes e filiações a investigar no dossiê. */
export function informationGaps(
  persons: PersonRow[],
  relationships?: RelationshipRow[],
  now = new Date(),
  archive?: ArchivedFamily,
): string[] {
  const gaps: string[] = [];
  const name = (p: PersonRow) => p.preferred_name || p.full_name;
  const has = (k: string) =>
    persons.some((p) => (p.relationship_to_proband || "").toLowerCase().startsWith(k));
  if (persons.length === 0) return ["Nenhum familiar cadastrado no genossociograma."];
  if (relationships) {
    const probandId = persons.find((p) => p.is_proband)?.id;
    if (probandId) {
      const graph = buildLogicalGraph({
        ...getGenogramTopology({ persons, relationships, ...archive }),
        probandId,
      });
      const archivedParentIds = childrenWithArchivedParent(archive);
      gaps.push(
        ...pendingParentage(graph, archivedParentIds).map(
          (person) => `Confirme a fonte da filiação de ${person.name}.`,
        ),
      );
      const identified =
        graph.parentsByChild.get(probandId)?.filter((item) => item.kind !== "unknown") ?? [];
      if (identified.length < 2 && !archivedParentIds.has(probandId)) {
        gaps.push(
          identified.length === 1
            ? "Quem é o outro genitor do consultante? Confira a fonte da filiação."
            : "Quais genitores do consultante estão documentados ou foram relatados?",
        );
      }
    }
  } else {
    if (!has("pai")) gaps.push("Pai não cadastrado.");
    if (!has("mãe") && !has("mae")) gaps.push("Mãe não cadastrada.");
  }
  for (const p of persons) {
    if (p.is_deceased && !p.death_date && !p.death_date_partial)
      gaps.push(`Data de falecimento de ${name(p)} desconhecida.`);
    if (p.is_deceased && !p.cause_of_death)
      gaps.push(`Causa da morte de ${name(p)} não registrada.`);
    if (!p.birth_date && !p.birth_date_partial)
      gaps.push(`Data de nascimento de ${name(p)} desconhecida.`);
    else if (
      p.birth_date &&
      now.getFullYear() - new Date(p.birth_date).getFullYear() >= 18 &&
      !p.occupation
    )
      gaps.push(`Profissão de ${name(p)} não registrada.`);
  }
  return gaps;
}
