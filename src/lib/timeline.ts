import { recognizedGeneration, type LogicalGraph } from "@/lib/geno/build";
import { civilDate } from "./civil-date";
import { personLifeEvents, type PersonRow } from "@/lib/patterns";

export type TimelineKind = "birth" | "death" | "event";
/** Precisão que o próprio texto da data permite afirmar — nada além disso. */
export type DatePrecision = "day" | "month" | "year" | "month_day" | "unknown";

export type CaseTimelineItem = {
  key: string;
  personId: string;
  personName: string;
  relationship: string | null;
  generation: number | null;
  kind: TimelineKind;
  label: string;
  rawDate: string | null;
  precision: DatePrecision;
  year: number | null;
  meta?: string;
  source: string;
};

export function precisionOf(raw: string | null | undefined): DatePrecision {
  const dayMonth = raw?.trim().match(/^(\d{2})\/(\d{2})$/);
  if (dayMonth && civilDate(`2000-${dayMonth[2]}-${dayMonth[1]}`)) return "month_day";
  return civilDate(raw)?.precision ?? "unknown";
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatByPrecision(raw: string | null, p: DatePrecision): string {
  if (!raw || p === "unknown")
    return raw?.trim() ? `"${raw.trim()}" (data não estruturada)` : "Data desconhecida";
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
    };
    const push = (
      kind: TimelineKind,
      label: string,
      { raw, source, precision = precisionOf(raw) }: TimelineDate,
      meta?: string,
      i = 0,
    ) => {
      out.push({
        ...base,
        key: `${p.id}-${kind}-${i}`,
        kind,
        label,
        rawDate: raw,
        precision,
        year:
          precision === "unknown" || precision === "month_day"
            ? null
            : (civilDate(raw)?.year ?? null),
        meta,
        source,
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
        { raw: ev.date.trim() || null, source: "Ficha do familiar: eventos de vida" },
        ev.description,
        i,
      ),
    );
  }
  return out.sort((a, b) => {
    if (a.rawDate && b.rawDate && a.year !== null && b.year !== null)
      return a.rawDate.localeCompare(b.rawDate);
    if (a.year === null && b.year !== null) return 1;
    if (b.year === null && a.year !== null) return -1;
    return a.personName.localeCompare(b.personName);
  });
}

export type TimelineFilter = {
  personId?: string;
  generation?: number | "none";
  kind?: TimelineKind;
};

export function filterTimeline(items: CaseTimelineItem[], f: TimelineFilter): CaseTimelineItem[] {
  return items.filter(
    (it) =>
      (!f.personId || it.personId === f.personId) &&
      (f.generation === undefined ||
        (f.generation === "none" ? it.generation === null : it.generation === f.generation)) &&
      (!f.kind || it.kind === f.kind),
  );
}
