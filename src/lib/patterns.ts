/**
 * Motor de padrões v1 — Psicogenealogia.
 *
 * Detectores puros (client-side). Recebem a lista de pessoas do
 * genossociograma e retornam padrões repetitivos: doença, causa de morte,
 * idade de morte, profissão, rupturas e síndrome de aniversário.
 */
import type { Database } from "@/integrations/supabase/types";

export type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
export type RelationshipRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

export type LifeEvent = {
  date: string; // YYYY-MM-DD
  description: string;
  type?: string;
  [key: string]: string | undefined;
};

export type PatternSeverity = "info" | "attention" | "critical";

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
  details?: Record<string, unknown>;
}

export interface TimelineItem {
  date: string;
  year: number;
  personId: string;
  personName: string;
  kind: "birth" | "death" | "event";
  label: string;
  meta?: string;
}

/* ---------- helpers ---------- */

function yearOf(d?: string | null): number | null {
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ageAt(birth: string, ref: string): number | null {
  const b = new Date(birth);
  const r = new Date(ref);
  if (Number.isNaN(b.getTime()) || Number.isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) age--;
  return age;
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
      typeof (e as { date?: unknown }).date === "string" &&
      typeof (e as { description?: unknown }).description === "string"
    ) {
      out.push(e as LifeEvent);
    }
  }
  return out;
}

/* ---------- Timeline ---------- */

export function buildTimeline(persons: PersonRow[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const p of persons) {
    const name = personLabel(p);
    if (p.birth_date) {
      items.push({
        date: p.birth_date,
        year: yearOf(p.birth_date) ?? 0,
        personId: p.id,
        personName: name,
        kind: "birth",
        label: "Nascimento",
      });
    }
    if (p.death_date) {
      const age = p.birth_date && p.death_date ? ageAt(p.birth_date, p.death_date) : null;
      items.push({
        date: p.death_date,
        year: yearOf(p.death_date) ?? 0,
        personId: p.id,
        personName: name,
        kind: "death",
        label: "Falecimento",
        meta: [
          age !== null ? `${age} anos` : null,
          p.cause_of_death ? `causa: ${p.cause_of_death}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    for (const ev of personLifeEvents(p)) {
      items.push({
        date: ev.date,
        year: yearOf(ev.date) ?? 0,
        personId: p.id,
        personName: name,
        kind: "event",
        label: ev.type || "Evento",
        meta: ev.description,
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Detectores ---------- */

export function detectPatterns(
  persons: PersonRow[],
  relationships: RelationshipRow[],
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // 1) Mesma idade de falecimento (± 2 anos)
  const deathAges = persons
    .map((p) =>
      p.birth_date && p.death_date ? { p, age: ageAt(p.birth_date, p.death_date) } : null,
    )
    .filter((x): x is { p: PersonRow; age: number } => !!x && x.age !== null);

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
        )} e ${Math.max(...ages)} anos. Investigar síndrome de aniversário e lealdades invisíveis.`,
        severity: "attention",
        personIds: cluster.map((c) => c.p.id),
        details: { ages },
      });
    }
  }

  // 2) Mesma causa de morte
  patterns.push(
    ...groupBy(
      persons.filter((p) => p.cause_of_death),
      (p) => normalize(p.cause_of_death!),
    ).flatMap(([key, group]) =>
      group.length >= 2
        ? [
            {
              id: `cause_${key}`,
              type: "shared_cause_of_death" as const,
              title: `Causa de morte repetida: ${group[0].cause_of_death}`,
              description: `${group.length} membros faleceram com a mesma causa. Padrão somático transgeracional a explorar.`,
              severity: "critical" as PatternSeverity,
              personIds: group.map((p) => p.id),
            },
          ]
        : [],
    ),
  );

  // 3) Condição de saúde compartilhada
  const conditionMap = new Map<string, { label: string; ids: Set<string> }>();
  for (const p of persons) {
    for (const c of p.health_conditions ?? []) {
      const key = normalize(c);
      if (!key) continue;
      const entry = conditionMap.get(key) ?? { label: c, ids: new Set() };
      entry.ids.add(p.id);
      conditionMap.set(key, entry);
    }
  }
  for (const [key, entry] of conditionMap) {
    if (entry.ids.size >= 2) {
      patterns.push({
        id: `health_${key}`,
        type: "shared_health_condition",
        title: `Condição de saúde recorrente: ${entry.label}`,
        description: `${entry.ids.size} membros compartilham "${entry.label}". Considerar herança sistêmica além da genética.`,
        severity: "attention",
        personIds: [...entry.ids],
      });
    }
  }

  // 4) Mesma profissão
  patterns.push(
    ...groupBy(
      persons.filter((p) => p.occupation),
      (p) => normalize(p.occupation!),
    ).flatMap(([key, group]) =>
      group.length >= 2
        ? [
            {
              id: `occ_${key}`,
              type: "shared_occupation" as const,
              title: `Profissão repetida: ${group[0].occupation}`,
              description: `${group.length} pessoas exercem/exerceram ${group[0].occupation}. Missão ou lealdade familiar possível.`,
              severity: "info" as PatternSeverity,
              personIds: group.map((p) => p.id),
            },
          ]
        : [],
    ),
  );

  // 5) Rupturas emocionais concentradas
  const ruptures = relationships.filter(
    (r) =>
      r.relationship_type === "emotional" && ["rupture", "conflict"].includes(r.qualifier ?? ""),
  );
  if (ruptures.length >= 2) {
    const involved = new Set<string>();
    ruptures.forEach((r) => {
      involved.add(r.from_person_id);
      involved.add(r.to_person_id);
    });
    patterns.push({
      id: "ruptures_cluster",
      type: "relationship_ruptures",
      title: `${ruptures.length} rupturas emocionais no sistema`,
      description:
        "Concentração de rupturas / conflitos ativos. Mapear exclusões sistêmicas e restaurações necessárias.",
      severity: "critical",
      personIds: [...involved],
    });
  }

  // 6) Síndrome de aniversário — evento em pessoa X que coincide (mesmo dia/mês)
  // com nascimento ou morte de outra pessoa do sistema.
  const anniversaryHits: {
    a: PersonRow;
    b: PersonRow;
    aKind: string;
    bKind: string;
    date: string;
  }[] = [];
  const stamps: {
    person: PersonRow;
    date: string;
    md: string;
    kind: "birth" | "death";
  }[] = [];
  for (const p of persons) {
    if (p.birth_date)
      stamps.push({
        person: p,
        date: p.birth_date,
        md: p.birth_date.slice(5, 10),
        kind: "birth",
      });
    if (p.death_date)
      stamps.push({
        person: p,
        date: p.death_date,
        md: p.death_date.slice(5, 10),
        kind: "death",
      });
  }
  for (let i = 0; i < stamps.length; i++) {
    for (let j = i + 1; j < stamps.length; j++) {
      const a = stamps[i];
      const b = stamps[j];
      if (a.person.id === b.person.id) continue;
      if (!a.md || a.md !== b.md) continue;
      if (a.date === b.date) continue;
      anniversaryHits.push({
        a: a.person,
        b: b.person,
        aKind: a.kind,
        bKind: b.kind,
        date: a.md,
      });
    }
  }
  for (const hit of anniversaryHits) {
    patterns.push({
      id: `anniv_${hit.a.id}_${hit.b.id}_${hit.date}`,
      type: "anniversary_syndrome",
      title: `Data ${formatMd(hit.date)} se repete no sistema`,
      description: `${labelKind(hit.aKind)} de ${personLabel(hit.a)} coincide com ${labelKind(
        hit.bKind,
      )} de ${personLabel(hit.b)}. Possível síndrome de aniversário.`,
      severity: "attention",
      personIds: [hit.a.id, hit.b.id],
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

function labelKind(k: string): string {
  return k === "birth" ? "nascimento" : k === "death" ? "morte" : "evento";
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
    label: "Crítico",
  },
};
