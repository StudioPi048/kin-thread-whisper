/**
 * Evidências → hipóteses provisórias.
 * Fonte única para Mesa, Dossiê e IA Clínica: SEMPRE derivado de detectPatterns()
 * sobre os dados reais do caso. Sem padrões detectados → nenhuma hipótese.
 * Nunca atribui causalidade nem confiança numérica.
 */
import { detectPatterns, type DetectedPattern, type PersonRow, type RelationshipRow } from "./patterns";

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
      "A queixa se intensifica em alguma época do ano?",
      "A família comenta essas datas ou elas são silenciadas?",
    ],
  },
  shared_cause_of_death: {
    title: "Repetição de causa de morte",
    description: "Mesma causa registrada para mais de um familiar.",
    questions: ["Como essas mortes foram contadas na família?", "Existe medo associado a essa causa?"],
  },
  shared_health_condition: {
    title: "Repetição de condição de saúde",
    description: "Mesma condição de saúde aparece em mais de um familiar.",
    questions: ["Quando o sintoma apareceu em cada familiar?", "Há fatores hereditários conhecidos?"],
  },
  shared_death_age: {
    title: "Repetição de idade ao falecer",
    description: "Familiares faleceram em idades próximas.",
    questions: ["O cliente está próximo dessa idade?", "Essa idade é mencionada como marco na família?"],
  },
  shared_occupation: {
    title: "Repetição profissional",
    description: "A mesma ocupação aparece em mais de um familiar.",
    questions: ["A escolha profissional foi livre?", "Quem na família esperava essa profissão?"],
  },
  relationship_ruptures: {
    title: "Rupturas repetidas de vínculo",
    description: "Há várias separações/rupturas registradas.",
    questions: ["Quem rompeu com quem e em que contexto?", "Há familiares excluídos das histórias?"],
  },
};

const LIMITS =
  "Hipótese provisória baseada apenas no que está registrado. Coincidência não indica causa; valide na relação clínica e complete dados faltantes.";

export function buildHypotheses(patterns: DetectedPattern[], persons: PersonRow[]): Hypothesis[] {
  const nameOf = new Map(persons.map((p) => [p.id, p.preferred_name || p.full_name]));
  const out: Hypothesis[] = [];
  for (const pt of patterns) {
    const t = TEMPLATES[pt.type];
    if (!t) continue;
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
