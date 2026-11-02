/**
 * Agenda: conversão de fuso e validação de reagendamento.
 * Funções puras — usadas no navegador (prévia) e no servidor (validação final).
 */

export const DEFAULT_TZ = "America/Sao_Paulo";
export const MIN_DURATION = 10;
export const MAX_DURATION = 480;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number };

function partsInTz(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const get = (t: string) => Number(f.formatToParts(date).find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** "YYYY-MM-DD" do instante no fuso dado. */
export function dateKeyInTz(iso: string | Date, tz: string): string {
  const p = partsInTz(new Date(iso), tz);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** "HH:mm" do instante no fuso dado. */
export function timeInTz(iso: string | Date, tz: string): string {
  const p = partsInTz(new Date(iso), tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

/**
 * Converte data+hora locais de um fuso em instante UTC.
 * Retorna null se o horário não existe naquele fuso (salto de horário de verão).
 */
export function zonedLocalToUtc(date: string, time: string, tz: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = partsInTz(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += wanted - asUtc;
  }
  const back = partsInTz(new Date(guess), tz);
  if (back.y !== y || back.mo !== mo || back.d !== d || back.h !== h || back.mi !== mi) return null;
  return new Date(guess);
}

export type ScheduledItem = { id: string; startISO: string; durationMin: number };

export type RescheduleInput = {
  sessionId: string;
  date: string;
  time: string;
  durationMin: number;
  tz: string;
  existing: ScheduledItem[];
};

export type RescheduleResult =
  | { ok: true; startISO: string; endISO: string }
  | { ok: false; errors: string[]; conflicts: ScheduledItem[] };

export function validateReschedule(input: RescheduleInput): RescheduleResult {
  const errors: string[] = [];
  if (!isValidTimeZone(input.tz)) errors.push("Fuso horário desconhecido.");
  if (!Number.isInteger(input.durationMin) || input.durationMin < MIN_DURATION || input.durationMin > MAX_DURATION)
    errors.push(`Duração deve ser entre ${MIN_DURATION} e ${MAX_DURATION} minutos.`);
  const start = errors.length ? null : zonedLocalToUtc(input.date, input.time, input.tz);
  if (!errors.length && !start)
    errors.push("Data ou horário inválido (ou inexistente neste fuso por mudança de horário).");
  if (errors.length || !start) return { ok: false, errors, conflicts: [] };

  const s = start.getTime();
  const e = s + input.durationMin * 60_000;
  const conflicts = input.existing.filter((x) => {
    if (x.id === input.sessionId) return false;
    const xs = new Date(x.startISO).getTime();
    const xe = xs + x.durationMin * 60_000;
    return s < xe && xs < e; // intervalos semiabertos: encostar não conflita
  });
  if (conflicts.length)
    return { ok: false, errors: ["Sobrepõe outro atendimento."], conflicts };
  return { ok: true, startISO: start.toISOString(), endISO: new Date(e).toISOString() };
}

export function plannedDurationMin(row: {
  planned_duration_minutes?: number | null;
  duration_seconds?: number | null;
}): number {
  if (row.planned_duration_minutes) return row.planned_duration_minutes;
  if (row.duration_seconds) return Math.max(MIN_DURATION, Math.round(row.duration_seconds / 60));
  return 60;
}
