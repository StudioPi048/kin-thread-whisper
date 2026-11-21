import { recognizedGeneration, type LogicalGraph } from "@/lib/geno/build";
import { civilDate } from "./civil-date";
import { INTAKE_ANSWER_SOURCE, INTAKE_ANSWER_STATUS } from "./intake";
import { personLifeEvents, type PersonRow, type RelationshipRow } from "@/lib/patterns";

export type TimelineKind = "birth" | "death" | "union" | "event";
export type TimelineBranch = "paternal" | "maternal" | "other";
/** Precisão que o próprio texto da data permite afirmar — nada além disso. */
export type DatePrecision = "day" | "month" | "year" | "month_day" | "range" | "unknown";

export type CaseTimelineItem = {
  key: string;
  personId: string;
  personName: string;
  personIds?: string[];
  relationshipId?: string;
  branch?: TimelineBranch;
  relationship: string | null;
  generation: number | null;
  kind: TimelineKind;
  label: string;
  rawDate: string | null;
  precision: DatePrecision;
  year: number | null;
  meta?: string;
  source: string;
  sourceTab?: "intake";
  sourceField?: string;
};

export function yearRange(raw: string | null | undefined) {
  const parts = raw?.trim().match(/^(\d{4})\s*[–—-]\s*(\d{4})$/);
  if (!parts) return null;
  const first = Number(parts[1]);
  const last = Number(parts[2]);
  return first > 0 && last >= first ? { first, last } : null;
}

export function precisionOf(raw: string | null | undefined): DatePrecision {
  if (yearRange(raw)) return "range";
  const dayMonth = raw?.trim().match(/^(\d{2})\/(\d{2})$/);
  if (dayMonth && civilDate(`2000-${dayMonth[2]}-${dayMonth[1]}`)) return "month_day";
  return civilDate(raw)?.precision ?? "unknown";
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatByPrecision(raw: string | null, p: DatePrecision): string {
  if (!raw || p === "unknown")
    return raw?.trim() ? `"${raw.trim()}" (data não estruturada)` : "Data desconhecida";
  if (p === "range") return `${raw} (intervalo)`;
  if (p === "month_day") return `${raw} (sem ano)`;
  const [y, m, d] = raw.trim().split("-");
  if (p === "year") return `${y} (só o ano)`;
  if (p === "month") return `${MONTHS[Number(m) - 1]} ${y} (sem dia)`;
  return `${d}/${m}/${y}`;
}

/** Compatibilidade para listas sem acesso ao grafo do caso. */
function generationFromLabel(p: PersonRow): number | null {
  if (p.is_proband) return 0;
  if (!p.relationship_to_proband?.trim()) return null;
  return recognizedGeneration(p.relationship_to_proband);
}

type TimelineDate = { raw: string | null; source: string; precision?: DatePrecision };

function vitalDate(p: PersonRow, kind: "birth" | "death"): TimelineDate | null {
  const birth = kind === "birth";
  const stored = birth ? p.birth_date : p.death_date;
  if (stored) {
    return {
      raw: stored,
      source: `Ficha do familiar: data de ${birth ? "nascimento" : "falecimento"}`,
    };
  }
  const recorded = birth ? p.birth_date_partial : p.death_date_partial;
  if (recorded?.trim()) {
    const value = recorded.trim();
    const monthYear = value.match(/^(\d{2})\/(\d{4})$/);
    const raw = monthYear ? `${monthYear[2]}-${monthYear[1]}` : value;
    return { raw, source: "Ficha do familiar · data aproximada" };
  }
  const partial = [
    ...(p.notes ?? "").matchAll(
      /^\[Importação\] (Nascimento|Falecimento) informado: "([^"\r\n]+)" \((só o ano|mês e ano, sem dia|dia e mês, sem ano); não gravado como data exata\)\r?$/gm,
    ),
  ].flatMap(([, label, raw, kind]) => {
    if (label !== (birth ? "Nascimento" : "Falecimento")) return [];
    if (kind === "só o ano" && precisionOf(raw) === "year") return [raw];
    if (kind === "mês e ano, sem dia") {
      const [month, year] = raw.split(/[/\\\-. \t]+/);
      const normalized = `${year}-${month.padStart(2, "0")}`;
      return precisionOf(normalized) === "month" ? [normalized] : [];
    }
    if (kind === "dia e mês, sem ano") {
      const [first, second] = raw.split(/[/\\\-. \t]+/).map(Number);
      const [day, month] = second > 12 ? [second, first] : [first, second];
      const formatted = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      return civilDate(`2000-${formatted.split("/").reverse().join("-")}`) ? [formatted] : [];
    }
    return [];
  });
  const unique = [...new Set(partial)].sort();
  if (unique.length > 1) {
    return {
      raw: unique.join(" · "),
      source: "Observações da importação: datas informadas divergentes",
      precision: "unknown",
    };
  }
  const raw = unique[0];
  if (raw) {
    return {
      raw,
      source: "Observações da importação: data parcial",
      precision: raw.includes("/") ? "month_day" : precisionOf(raw),
    };
  }
  return null;
}

export function buildCaseTimeline(
  persons: PersonRow[],
  graph?: Pick<LogicalGraph, "persons" | "probandId">,
  relationships: RelationshipRow[] = [],
): CaseTimelineItem[] {
  const out: CaseTimelineItem[] = [];
  for (const p of persons) {
    const mapped = graph?.persons.get(p.id);
    const base = {
      personId: p.id,
      personName: p.full_name.trim() || p.preferred_name?.trim() || "Pessoa sem nome",
      relationship:
        p.is_proband || graph?.probandId === p.id ? "Cliente" : p.relationship_to_proband,
      generation: graph ? (mapped?.generation ?? null) : generationFromLabel(p),
      branch: timelineBranch(mapped?.branchId),
    };
    const push = (
      kind: TimelineKind,
      label: string,
      { raw, source, precision = precisionOf(raw) }: TimelineDate,
      meta?: string,
      i = 0,
      eventId?: string,
      sourceTab?: "intake",
      sourceField?: string,
    ) => {
      out.push({
        ...base,
        key: eventId || `${p.id}-${kind}-${i}`,
        kind,
        label,
        rawDate: raw,
        precision,
        year:
          precision === "unknown" || precision === "month_day"
            ? null
            : (yearRange(raw)?.first ?? civilDate(raw)?.year ?? null),
        meta,
        source,
        ...(sourceTab ? { sourceTab, sourceField } : {}),
      });
    };
    const birth = vitalDate(p, "birth");
    if (birth) push("birth", "Nascimento", birth);
    const death = vitalDate(p, "death");
    if (death || p.is_deceased)
      push(
        "death",
        "Falecimento",
        death ?? { raw: null, source: "Ficha do familiar: marcado como falecido, sem data" },
        p.cause_of_death ? `causa registrada: ${p.cause_of_death}` : undefined,
      );
    personLifeEvents(p).forEach((ev, i) =>
      push(
        "event",
        ev.type || "Evento",
        {
          raw: ev.date.trim() || null,
          source:
            ev.source === "intake"
              ? [
                  "Anamnese",
                  ev.source_label,
                  INTAKE_ANSWER_STATUS[ev.source_status as keyof typeof INTAKE_ANSWER_STATUS],
                  INTAKE_ANSWER_SOURCE[ev.source_type as keyof typeof INTAKE_ANSWER_SOURCE],
                  ev.source_note,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Ficha do familiar: eventos de vida",
        },
        ev.description,
        i,
        ev.id,
        ev.source === "intake" ? "intake" : undefined,
        ev.source_field,
      ),
    );
  }
  const byId = new Map(persons.map((person) => [person.id, person]));
  for (const relationship of relationships) {
    if (relationship.relationship_type !== "union") continue;
    const from = byId.get(relationship.from_person_id);
    const to = byId.get(relationship.to_person_id);
    if (!from || !to) continue;
    const left = graph?.persons.get(from.id);
    const right = graph?.persons.get(to.id);
    const nameOf = (p: PersonRow) =>
      p.full_name.trim() || p.preferred_name?.trim() || "Pessoa sem nome";
    const base = {
      personId: from.id,
      personIds: [from.id, to.id],
      relationshipId: relationship.id,
      personName: `${nameOf(from)} e ${nameOf(to)}`,
      relationship: null,
      generation: left?.generation ?? right?.generation ?? null,
      branch: timelineBranch(left?.branchId === right?.branchId ? left?.branchId : undefined),
      kind: "union" as const,
      source: "Datas registradas no vínculo do genossociograma",
    };
    const separation =
      relationship.qualifier === "separation" || relationship.qualifier === "divorce";
    const events = [
      ["start", relationship.start_date, separation ? "Separação registrada" : "Início do vínculo"],
      ["end", relationship.end_date, "Fim do vínculo"],
    ] as const;
    for (const [when, rawDate, label] of events) {
      if (!rawDate) continue;
      out.push({
        ...base,
        key: `${relationship.id}-union-${when}`,
        label,
        rawDate,
        precision: precisionOf(rawDate),
        year: civilDate(rawDate)?.year ?? null,
      });
    }
  }
  return out.sort((a, b) => {
    if (a.rawDate && b.rawDate && a.year !== null && b.year !== null)
      return a.rawDate.localeCompare(b.rawDate);
    if (a.year === null && b.year !== null) return 1;
    if (b.year === null && a.year !== null) return -1;
    return a.personName.localeCompare(b.personName);
  });
}

function timelineBranch(branch: string | undefined): TimelineBranch {
  return branch === "paternal" || branch === "maternal" ? branch : "other";
}

export type TimelineFilter = {
  personId?: string;
  generation?: number | "none";
  kind?: TimelineKind;
  branch?: TimelineBranch;
  decade?: number;
};

export function filterTimeline(items: CaseTimelineItem[], f: TimelineFilter): CaseTimelineItem[] {
  return items.filter(
    (it) =>
      (!f.personId || it.personId === f.personId || it.personIds?.includes(f.personId)) &&
      (!f.branch || it.branch === f.branch) &&
      (f.decade === undefined ||
        (it.year !== null &&
          it.year <= f.decade + 9 &&
          (yearRange(it.rawDate)?.last ?? it.year) >= f.decade)) &&
      (f.generation === undefined ||
        (f.generation === "none" ? it.generation === null : it.generation === f.generation)) &&
      (!f.kind || it.kind === f.kind),
  );
}

export type TimelineGrouping = "none" | "decade" | "generation";

export function groupTimelineList(items: CaseTimelineItem[], grouping: TimelineGrouping) {
  if (grouping === "none") return [{ value: null, items }];
  const groups = new Map<number | null, CaseTimelineItem[]>();
  for (const item of items) {
    const value =
      grouping === "generation"
        ? item.generation
        : item.year === null
          ? null
          : Math.floor(item.year / 10) * 10;
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return [...groups]
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
    .map(([value, items]) => ({ value, items }));
}
