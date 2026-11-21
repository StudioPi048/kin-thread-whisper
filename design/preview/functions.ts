import { persons, supabase } from "./client";
import { agendaSession, sessionHistory, type AgendaSessionRow } from "../../src/lib/agenda-model";
import {
  appointmentDurationMin,
  DEFAULT_TZ,
  dateKeyInTz,
  shiftDateKey,
  timeInTz,
  validateReschedule,
} from "../../src/lib/scheduling";
import { clinicalStatusOf } from "../../src/lib/session-state";

type Client = { id: string; full_name: string; preferred_name: string | null; status: string };
type FixtureSession = AgendaSessionRow & { user_id: string };
async function calendarRecords() {
  const [{ data: sessions }, { data: clients }, { data: auth }] = await Promise.all([
    supabase.from("clinical_sessions").select(),
    supabase.from("clients").select(),
    supabase.auth.getUser(),
  ]);
  const roster = clients as Client[];
  const rows = (sessions as FixtureSession[])
    .map((entry) => ({
      ...entry,
      clients: roster.find((client) => client.id === entry.client_id),
    }))
    .filter((entry) => entry.clients?.status === "active" && entry.status !== "deleting")
    .sort((a, b) => Date.parse(a.session_date) - Date.parse(b.session_date));
  return { rows, roster, user: auth.user.id as string };
}

function pending(rows: FixtureSession[], now: Date) {
  return rows.filter(
    (row) => new Date(row.session_date) <= now && clinicalStatusOf(row, now) === "pending_record",
  ).length;
}

export async function getPendingRecordCount() {
  const { rows } = await calendarRecords();
  return pending(rows, new Date());
}

export async function getAgendaData({ data }: { data?: { date?: string; tz?: string } } = {}) {
  const { rows, roster } = await calendarRecords();
  const now = new Date();
  const tz = data?.tz ?? DEFAULT_TZ;
  const date = data?.date ?? dateKeyInTz(now, tz);
  const history = sessionHistory(rows);
  const sessions = rows.map((row) => agendaSession(row, tz, now, history.get(row.id)));
  const upcoming = new Set(
    sessions
      .filter((s) => s.clinicalStatus === "scheduled" && new Date(s.startISO) >= now)
      .map((s) => s.clientId),
  );
  return {
    today: sessions.filter((session) => session.dateKey === date),
    week: Array.from({ length: 7 }, (_, offset) => {
      const day = shiftDateKey(date, offset - 2);
      return {
        date: day,
        count: sessions.filter(
          (session) => session.dateKey === day && session.clinicalStatus !== "canceled",
        ).length,
      };
    }),
    orphanClients: roster
      .filter((client) => client.status === "active" && !upcoming.has(client.id))
      .map((client) => ({ id: client.id, name: client.preferred_name || client.full_name })),
    stats: { prontuariosPendentes: pending(rows, now) },
  };
}

export async function getAgendaWeek({ data }: { data: { weekStart: string; tz?: string } }) {
  const { rows } = await calendarRecords();
  const end = shiftDateKey(data.weekStart, 7);
  return rows
    .map((row) => agendaSession(row, data.tz ?? DEFAULT_TZ, new Date()))
    .filter((session) => session.dateKey >= data.weekStart && session.dateKey < end);
}

type AppointmentInput = {
  sessionId: string;
  date: string;
  time: string;
  durationMin: number;
  tz: string;
  occurrence?: number;
};
const rejected = (reason: string) => ({ ok: false as const, errors: [reason], conflicts: [] });

async function saveAppointment(
  input: AppointmentInput,
  scheduled?: { clientId: string; title?: string },
) {
  const { rows, roster, user } = await calendarRecords();
  const now = new Date();
  const previous = rows.find((row) => row.id === input.sessionId);
  const clientId = scheduled?.clientId ?? previous?.client_id;
  if (!clientId || !roster.some((client) => client.id === clientId && client.status === "active")) {
    return rejected("Selecione um dossiê ativo da sua conta.");
  }
  if (
    !scheduled &&
    (!previous || (previous.clinical_status ?? clinicalStatusOf(previous, now)) !== "scheduled")
  )
    return rejected("Este atendimento não está agendado.");
  const validation = validateReschedule({
    ...input,
    originalStartISO: previous?.session_date,
    existing: rows
      .filter((row) => ["scheduled", "in_progress"].includes(clinicalStatusOf(row, now)))
      .map((row) => ({
        id: row.id,
        startISO: row.session_date,
        durationMin: appointmentDurationMin(row) ?? 60,
      })),
  });
  if (!validation.ok)
    return {
      ok: false as const,
      errors: validation.errors,
      conflicts: validation.conflicts.map((overlap) => ({
        id: overlap.id,
        start: timeInTz(overlap.startISO, input.tz),
        patient: rows.find((row) => row.id === overlap.id)?.clients?.full_name ?? "Cliente",
      })),
    };
  if (new Date(validation.startISO) <= now) return rejected("Informe um horário futuro.");
  const update = {
    session_date: validation.startISO,
    planned_duration_minutes: input.durationMin,
    time_zone: input.tz,
    clinical_status: "scheduled",
  };
  const query = supabase.from("clinical_sessions");
  if (!scheduled) await query.update(update).eq("id", input.sessionId);
  else if (!previous)
    await query.insert({
      ...update,
      id: input.sessionId,
      client_id: clientId,
      user_id: user,
      status: "draft",
      title: scheduled.title?.trim() || "Atendimento",
    });
  else if (previous.session_date !== validation.startISO || previous.client_id !== clientId)
    return rejected("Este agendamento já existe.");
  return { ok: true as const, sessionId: input.sessionId, clientId, startISO: validation.startISO };
}

export const scheduleSession = ({
  data,
}: {
  data: AppointmentInput & { clientId: string; title?: string };
}) => saveAppointment(data, data);
export const rescheduleSession = ({ data }: { data: AppointmentInput }) => saveAppointment(data);

export async function cancelSession({ data }: { data: { sessionId: string } }) {
  const { rows } = await calendarRecords();
  const row = rows.find((s) => s.id === data.sessionId);
  if (!row || !["scheduled", "canceled"].includes(row.clinical_status ?? clinicalStatusOf(row)))
    return rejected("Este atendimento não está agendado.");
  await supabase.from("clinical_sessions").update({ clinical_status: "canceled" }).eq("id", row.id);
  return {
    ok: true as const,
    sessionId: row.id,
    clientId: row.client_id,
    startISO: row.session_date,
  };
}

export async function getClientGenogram() {
  const rows = persons.map((p) => ({
    id: p.id,
    fullName: String(p.full_name),
    preferredName: p.preferred_name,
    gender: p.gender,
    isProband: p.is_proband,
    isDeceased: p.is_deceased,
    hasBirthDate: true,
    hasDeathDate: false,
    relationshipTo: p.relationship_to_proband,
    role: p.is_proband ? "proband" : "other",
  }));
  return {
    hasGenogram: true,
    totalPersons: rows.length,
    generations: {
      proband: rows[6],
      parents: rows.slice(4, 6),
      grandparents: rows.slice(0, 4),
      siblings: [rows[7]],
      others: [],
    },
    alerts: [],
  };
}
export async function processSessionAudio() {
  throw new Error("Processamento desativado no preview local.");
}
