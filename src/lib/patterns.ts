/**
 * Comparação de registros do genossociograma.
 *
 * Detectores puros (client-side). Recebem a lista de pessoas do
 * genossociograma e retornam padrões repetitivos: doença, causa de morte,
 * idade de morte, profissão, rupturas e síndrome de aniversário.
 */
import type { Database } from "@/integrations/supabase/types";
import { civilAge, civilDate } from "./civil-date";

export type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
export type RelationshipRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

export type LifeEvent = {
  date: string; // ISO completo, parcial ou vazio
  description: string;
  type?: string;
  [key: string]: string | undefined;
};

export type PatternSeverity = "info" | "attention" | "critical";

export type EvidenceFact = {
  source: "genogram_persons" | "genogram_relationships";
  recordId: string;
  field:
    | "birth_date"
    | "death_date"
    | "cause_of_death"
    | "health_conditions"
    | "occupation"
    | "qualifier"
    | "start_date"
    | "end_date";
  value: string;
  precision?: "day" | "month" | "year" | "unknown";
  personIds?: string[];
};

export interface DetectedPattern {
  id: string;
  type:
    | "shared_death_age"
    | "shared_cause_of_death"
    | "shared_health_condition"
    | "shared_occupation"
    | "relationship_ruptures"
    | "anniversary_syndrome";
  title: string;
  description: string;
  severity: PatternSeverity;
  personIds: string[];
  facts: EvidenceFact[];
  legacyIds?: string[];
  details?: Record<string, unknown>;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function personFact(personId: string, field: EvidenceFact["field"], value: string): EvidenceFact {
  return { source: "genogram_persons", recordId: personId, field, value: value.trim() };
}

function dateFact(fact: EvidenceFact): EvidenceFact {
  return { ...fact, precision: civilDate(fact.value)?.precision ?? "unknown" };
}

function personLabel(p: PersonRow): string {
  return p.preferred_name || p.full_name;
}

export function personLifeEvents(p: PersonRow): LifeEvent[] {
  const raw = p.life_events as unknown;
  if (!Array.isArray(raw)) return [];
  const out: LifeEvent[] = [];
  for (const e of raw) {
    if (
      e &&
      typeof e === "object" &&
      typeof (e as { description?: unknown }).description === "string"
    ) {
      const event = e as LifeEvent;
      out.push({
        ...event,
        date: typeof event.date === "string" ? event.date : "",
        type: typeof event.type === "string" ? event.type : undefined,
      });
    }
  }
  return out;
}

/* ---------- Detectores ---------- */

export function detectPatterns(
  persons: PersonRow[],
  relationships: RelationshipRow[],
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const orderedPersons = [...persons].sort((a, b) => a.id.localeCompare(b.id, "en"));

  // 1) Mesma idade de falecimento (± 2 anos)
  const deathAges = orderedPersons
    .flatMap((p) => {
      if (!p.birth_date || !p.death_date) return [];
      const age = civilAge(p.birth_date, p.death_date);
      if (age === null) return [];
      return [
        {
          p,
          age,
          facts: [
            dateFact(personFact(p.id, "birth_date", p.birth_date)),
            dateFact(personFact(p.id, "death_date", p.death_date)),
          ],
        },
      ];
    })
    .sort((a, b) => a.age - b.age);

  const usedIds = new Set<string>();
  for (const seed of deathAges) {
    if (usedIds.has(seed.p.id)) continue;
    const cluster = deathAges.filter((x) => Math.abs(x.age - seed.age) <= 2);
    if (cluster.length >= 2) {
      cluster.forEach((c) => usedIds.add(c.p.id));
      const ages = cluster.map((c) => c.age);
      patterns.push({
        id: `death_age_${seed.age}`,
        type: "shared_death_age",
        title: `Falecimento por volta dos ${seed.age} anos`,
        description: `${cluster.length} pessoas do sistema faleceram entre ${Math.min(
          ...ages,
        )} e ${Math.max(...ages)} anos, segundo as datas registradas.`,
        severity: "attention",
        personIds: cluster.map((c) => c.p.id),
        facts: cluster.flatMap((c) => c.facts),
        legacyIds: [
          ...new Set(ages.filter((age) => age !== seed.age).map((age) => `death_age_${age}`)),
        ],
        details: { ages },
      });
    }
  }

  // 2) Mesma causa de morte
  patterns.push(
    ...groupBy(
      orderedPersons.filter(
        (p) =>
          p.cause_of_death?.trim() &&
          (p.is_deceased || p.death_date || p.death_date_partial?.trim()),
      ),
      (p) => normalize(p.cause_of_death!),
    ).flatMap(([key, group]) =>
      group.length >= 2
        ? [
            {
              id: `cause_${key}`,
              type: "shared_cause_of_death" as const,
              title: `Causa de morte repetida: ${group[0].cause_of_death}`,
              description: `${group.length} pessoas têm a mesma causa de falecimento registrada.`,
              severity: "critical" as PatternSeverity,
              personIds: group.map((p) => p.id),
              facts: group.flatMap((p) => [
                personFact(p.id, "cause_of_death", p.cause_of_death!),
                ...(p.death_date ? [dateFact(personFact(p.id, "death_date", p.death_date))] : []),
              ]),
            },
          ]
        : [],
    ),
  );

  // 3) Condição de saúde compartilhada
  const conditionMap = new Map<
    string,
    { label: string; ids: Set<string>; facts: EvidenceFact[] }
  >();
  for (const p of orderedPersons) {
    for (const c of p.health_conditions ?? []) {
      const key = normalize(c);
      if (!key) continue;
      const entry = conditionMap.get(key) ?? { label: c.trim(), ids: new Set(), facts: [] };
      entry.ids.add(p.id);
      entry.facts.push(personFact(p.id, "health_conditions", c));
      conditionMap.set(key, entry);
    }
  }
  for (const [key, entry] of conditionMap) {
    if (entry.ids.size >= 2) {
      patterns.push({
        id: `health_${key}`,
        type: "shared_health_condition",
        title: `Condição de saúde recorrente: ${entry.label}`,
        description: `${entry.ids.size} pessoas têm a condição “${entry.label}” registrada.`,
        severity: "attention",
        personIds: [...entry.ids],
        facts: entry.facts,
      });
    }
  }

  // 4) Mesma profissão
  patterns.push(
    ...groupBy(
      orderedPersons.filter((p) => p.occupation?.trim()),
      (p) => normalize(p.occupation!),
    ).flatMap(([key, group]) =>
      group.length >= 2
        ? [
            {
              id: `occ_${key}`,
              type: "shared_occupation" as const,
              title: `Profissão repetida: ${group[0].occupation}`,
              description: `${group.length} pessoas têm a mesma ocupação registrada.`,
              severity: "info" as PatternSeverity,
              personIds: group.map((p) => p.id),
              facts: group.map((p) => personFact(p.id, "occupation", p.occupation!)),
            },
          ]
        : [],
    ),
  );

  // 5) Rupturas emocionais concentradas
  const ruptures = relationships
    .filter(
      (r) =>
        r.relationship_type === "emotional" && ["rupture", "conflict"].includes(r.qualifier ?? ""),
    )
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
  if (ruptures.length >= 2) {
    const involved = new Set<string>();
    ruptures.forEach((r) => {
      involved.add(r.from_person_id);
      involved.add(r.to_person_id);
    });
    patterns.push({
      id: "ruptures_cluster",
      type: "relationship_ruptures",
      title: `${ruptures.length} vínculos com ruptura ou conflito`,
      description: "Os vínculos emocionais abaixo têm registro de ruptura ou conflito.",
      severity: "critical",
      personIds: [...involved],
      facts: ruptures.flatMap((r) => {
        const linkFact = {
          source: "genogram_relationships",
          recordId: r.id,
          personIds: [r.from_person_id, r.to_person_id],
        } satisfies Pick<EvidenceFact, "source" | "recordId" | "personIds">;
        return [
          { ...linkFact, field: "qualifier", value: r.qualifier! },
          ...(r.start_date
            ? [dateFact({ ...linkFact, field: "start_date", value: r.start_date })]
            : []),
          ...(r.end_date ? [dateFact({ ...linkFact, field: "end_date", value: r.end_date })] : []),
        ];
      }),
    });
  }

  // 6) Coincidências entre datas civis de nascimento/falecimento com dia e mês registrados.
  const stamps = orderedPersons.flatMap((person) =>
    (["birth_date", "death_date"] as const).flatMap((field) => {
      const date = civilDate(person[field]);
      if (date?.precision !== "day") return [];
      return [
        {
          person,
          date: date.value,
          dayMonth: date.value.slice(5),
          field,
          fact: dateFact(personFact(person.id, field, date.value)),
        },
      ];
    }),
  );
  const anniversaryHits = new Map<
    string,
    {
      aId: string;
      bId: string;
      dayMonth: string;
      facts: EvidenceFact[];
      comparisons: string[];
    }
  >();
  for (const [, dates] of groupBy(stamps, (stamp) => stamp.dayMonth)) {
    for (const [i, a] of dates.entries()) {
      for (const b of dates.slice(i + 1)) {
        if (a.person.id === b.person.id || a.date === b.date) continue;
        const id = `anniv_${a.person.id}_${b.person.id}_${a.dayMonth}`;
        const group = anniversaryHits.get(id) ?? {
          aId: a.person.id,
          bId: b.person.id,
          dayMonth: a.dayMonth,
          facts: [],
          comparisons: [],
        };
        group.facts.push(a.fact, b.fact);
        group.comparisons.push(
          `${labelKind(a.field)} de ${personLabel(a.person)} (${formatStamp(a.date)}) coincide com ${labelKind(b.field)} de ${personLabel(b.person)} (${formatStamp(b.date)}).`,
        );
        anniversaryHits.set(id, group);
      }
    }
  }
  for (const [id, hit] of anniversaryHits) {
    patterns.push({
      id,
      type: "anniversary_syndrome",
      title: `Data ${formatMd(hit.dayMonth)} se repete no sistema`,
      description: hit.comparisons.join(" "),
      severity: "attention",
      personIds: [hit.aId, hit.bId],
      facts: [...new Set(hit.facts)],
      legacyIds: [`anniv_${hit.bId}_${hit.aId}_${hit.dayMonth}`],
    });
  }
  return patterns;
}

function groupBy<T, K extends string>(arr: T[], keyFn: (t: T) => K): [K, T[]][] {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return [...map.entries()];
}

function labelKind(k: "birth_date" | "death_date"): string {
  return k === "birth_date" ? "nascimento" : "falecimento";
}

function formatStamp(date: string): string {
  return date.split("-").reverse().join("/");
}

function formatMd(md: string): string {
  const [m, d] = md.split("-");
  return `${d}/${m}`;
}

export const severityStyles: Record<
  PatternSeverity,
  { badge: string; ring: string; label: string }
> = {
  info: {
    badge: "bg-lilac-soft text-primary",
    ring: "border-lilac/40",
    label: "Observação",
  },
  attention: {
    badge: "bg-gold/20 text-amber-900",
    ring: "border-amber-400/50",
    label: "Atenção",
  },
  critical: {
    badge: "bg-destructive/15 text-destructive",
    ring: "border-destructive/40",
    label: "Revisão prioritária",
  },
};
