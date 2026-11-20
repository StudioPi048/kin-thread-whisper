import { appointmentDurationMin, dateKeyInTz, timeInTz } from "./scheduling";
import { audioStateOf, clinicalStatusOf, type SessionLike } from "./session-state";

export type AgendaSessionRow = SessionLike & {
  id: string;
  client_id: string;
  title: string | null;
  duration_seconds?: number | null;
  planned_duration_minutes?: number | null;
  clients?: { id?: string; full_name: string; preferred_name: string | null } | null;
};

type HistoryRow = Pick<AgendaSessionRow, "id" | "client_id" | "clinical_status" | "session_date">;

export function sessionHistory(rows: HistoryRow[]) {
  const perClient = new Map<string, { firstSession: string; count: number }>();
  const ordered = [...rows].sort(
    (a, b) => Date.parse(a.session_date) - Date.parse(b.session_date) || a.id.localeCompare(b.id),
  );
  const sessions = new Map<string, { number: number; firstSession: string }>();
  for (const row of ordered) {
    if (row.clinical_status === "canceled") continue;
    const previous = perClient.get(row.client_id);
    const firstSession = previous?.firstSession ?? row.session_date;
    const count = (previous?.count ?? 0) + 1;
    perClient.set(row.client_id, { firstSession, count });
    sessions.set(row.id, { number: count, firstSession });
  }
  return sessions;
}

function clinicRecordPreview(row: AgendaSessionRow): string | null {
  const note = row.manual_notes?.trim();
  if (note) return note.length > 220 ? `${note.slice(0, 220)}…` : note;
  if (!row.ai_reviewed_at || !row.structured_note || typeof row.structured_note !== "object")
    return null;
  const structuredNote = row.structured_note as { resumo?: unknown; summary?: unknown };
  const summary = structuredNote.resumo ?? structuredNote.summary;
  if (typeof summary !== "string" || !summary.trim()) return null;
  return summary.length > 220 ? `${summary.slice(0, 220)}…` : summary;
}

export function agendaSession(
  row: AgendaSessionRow,
  tz: string,
  now: Date,
  history?: { number: number; firstSession: string },
) {
  const patient = row.clients?.preferred_name || row.clients?.full_name || "Cliente";
  const clinicalStatus = clinicalStatusOf(row, now);
  const durationMin = appointmentDurationMin(row);
  const start = new Date(row.session_date);
  const dateKey = dateKeyInTz(start, tz);
  const number = clinicalStatus === "canceled" ? null : (history?.number ?? 1);
  const isFirst = number === 1;
  const type = isFirst
    ? ("Primeira Consulta" as const)
    : row.title?.toLowerCase().includes("anamnese")
      ? ("Anamnese Sistêmica" as const)
      : ("Retorno" as const);
  return {
    id: row.id,
    clientId: row.client_id,
    patient,
    initials: patient
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(""),
    dateKey,
    start: timeInTz(start, tz),
    end:
      durationMin === null ? null : timeInTz(new Date(start.getTime() + durationMin * 60_000), tz),
    startISO: start.toISOString(),
    type,
    sessionNumber: number,
    isFirst,
    daysSinceFirst:
      history && number && number > 1
        ? (Date.parse(dateKey) - Date.parse(dateKeyInTz(history.firstSession, tz))) / 86_400_000
        : null,
    lastEvolution: clinicRecordPreview(row),
    durationMin,
    clinicalStatus,
    audioState: audioStateOf(row),
  };
}

export type AgendaSessionDTO = ReturnType<typeof agendaSession>;
