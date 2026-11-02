import { recognizedGeneration } from "@/lib/geno/build";
import { personLifeEvents, type PersonRow } from "@/lib/patterns";

export type TimelineKind = "birth" | "death" | "event";
/** Precisão que o próprio texto da data permite afirmar — nada além disso. */
export type DatePrecision = "day" | "month" | "year" | "unknown";

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
  if (!raw) return "unknown";
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return "day";
  if (/^\d{4}-\d{2}$/.test(t)) return "month";
  if (/^\d{4}$/.test(t)) return "year";
  return "unknown";
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatByPrecision(raw: string | null, p: DatePrecision): string {
  if (!raw || p === "unknown") return raw?.trim() ? `"${raw.trim()}" (data não estruturada)` : "Data desconhecida";
  const [y, m, d] = raw.split("-");
  if (p === "year") return `${y} (só o ano)`;
  if (p === "month") return `${MONTHS[Number(m) - 1]} ${y} (sem dia)`;
  return `${d}/${m}/${y}`;
}

/** Geração 0 = cliente e irmãos (topo); 1 = pais; 2 = avós… null = vínculo não informado. */
export function generationOfPerson(p: PersonRow): number | null {
  if (p.is_proband) return 0;
  if (!p.relationship_to_proband?.trim()) return null;
  return recognizedGeneration(p.relationship_to_proband);
}

export function buildCaseTimeline(persons: PersonRow[]): CaseTimelineItem[] {
  const out: CaseTimelineItem[] = [];
  for (const p of persons) {
    const base = {
      personId: p.id,
      personName: p.preferred_name || p.full_name,
      relationship: p.is_proband ? "Cliente" : p.relationship_to_proband,
      generation: generationOfPerson(p),
    };
    const push = (kind: TimelineKind, label: string, raw: string | null, source: string, meta?: string, i = 0) => {
      const precision = precisionOf(raw);
      out.push({
        ...base,
        key: `${p.id}-${kind}-${i}`,
        kind,
        label,
        rawDate: raw,
        precision,
        year: precision === "unknown" ? null : Number(raw!.slice(0, 4)),
        meta,
        source,
      });
    };
    if (p.birth_date) push("birth", "Nascimento", p.birth_date, "Ficha do familiar: data de nascimento");
    if (p.death_date || p.is_deceased)
      push(
        "death",
        "Falecimento",
        p.death_date,
        p.death_date ? "Ficha do familiar: data de falecimento" : "Ficha do familiar: marcado como falecido, sem data",
        p.cause_of_death ? `causa registrada: ${p.cause_of_death}` : undefined,
      );
    personLifeEvents(p).forEach((ev, i) =>
      push("event", ev.type || "Evento", ev.date || null, "Ficha do familiar: eventos de vida", ev.description, i),
    );
  }
  return out.sort((a, b) => {
    if (a.rawDate && b.rawDate && a.precision !== "unknown" && b.precision !== "unknown")
      return a.rawDate.localeCompare(b.rawDate);
    if (a.precision === "unknown" && b.precision !== "unknown") return 1;
    if (b.precision === "unknown" && a.precision !== "unknown") return -1;
    return a.personName.localeCompare(b.personName);
  });
}

export type TimelineFilter = { personId?: string; generation?: number | "none"; kind?: TimelineKind };

export function filterTimeline(items: CaseTimelineItem[], f: TimelineFilter): CaseTimelineItem[] {
  return items.filter(
    (it) =>
      (!f.personId || it.personId === f.personId) &&
      (f.generation === undefined ||
        (f.generation === "none" ? it.generation === null : it.generation === f.generation)) &&
      (!f.kind || it.kind === f.kind),
  );
}
