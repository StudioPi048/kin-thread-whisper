import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { agendaSession, sessionHistory, type AgendaSessionDTO } from "@/lib/agenda-model";
import {
  DEFAULT_TZ,
  dateKeyInTz,
  isCivilDateKey,
  isValidTimeZone,
  shiftDateKey,
  startOfCivilDay,
  timeInTz,
  validateReschedule,
} from "@/lib/scheduling";

export type { AgendaSessionDTO } from "@/lib/agenda-model";

export type OrphanClientDTO = {
  id: string;
  name: string;
};

export type AgendaDataDTO = {
  today: AgendaSessionDTO[];
  week: { date: string; count: number }[];
  orphanClients: OrphanClientDTO[];
  stats: { prontuariosPendentes: number };
};

type Supabase = SupabaseClient<Database>;
const civilDate = z.string().refine(isCivilDateKey, "Informe uma data válida.");
const sessionColumns =
  "id, client_id, session_date, title, status, duration_seconds, planned_duration_minutes, clinical_status, manual_notes, audio_path, ai_reviewed_at, summary_stale, structured_note, clients!inner(id, full_name, preferred_name)" as const;

async function pendingCount(supabase: Supabase) {
  const { data, error } = await supabase.rpc("pending_clinical_record_count", {});
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export const getPendingRecordCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => pendingCount(context.supabase));

export const getAgendaData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date?: string; tz?: string } | undefined) =>
    z
      .object({ date: civilDate.optional(), tz: z.string().max(64).optional() })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AgendaDataDTO> => {
    const { supabase, userId } = context;
    const now = new Date();
    const tz = data?.tz && isValidTimeZone(data.tz) ? data.tz : DEFAULT_TZ;
    const day = data?.date ?? dateKeyInTz(now, tz);
    const edge = (offset: number) => startOfCivilDay(shiftDateKey(day, offset), tz).toISOString();
    const [dayRows, weekRows, activeClients, future, prontuariosPendentes] = await Promise.all([
      supabase
        .from("clinical_sessions")
        .select(sessionColumns)
        .eq("clients.status", "active")
        .neq("status", "deleting")
        .eq("user_id", userId)
        .gte("session_date", edge(0))
        .lt("session_date", edge(1))
        .order("session_date")
        .order("id"),
      supabase
        .from("clinical_sessions")
        .select("session_date, clinical_status, clients!inner(id)")
        .eq("clients.status", "active")
        .neq("status", "deleting")
        .eq("user_id", userId)
        .gte("session_date", edge(-2))
        .lt("session_date", edge(5)),
      supabase
        .from("clients")
        .select("id, full_name, preferred_name")
        .eq("professional_id", userId)
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("clinical_sessions")
        .select("client_id, clients!inner(id)")
        .eq("clients.status", "active")
        .neq("status", "deleting")
        .eq("user_id", userId)
        .gte("session_date", now.toISOString())
        .or("clinical_status.eq.scheduled,clinical_status.is.null"),
      pendingCount(supabase),
    ]);
    const error = dayRows.error ?? weekRows.error ?? activeClients.error ?? future.error;
    if (error) throw new Error(error.message);

    const rows = dayRows.data ?? [];
    const clientIds = [...new Set(rows.map((row) => row.client_id))];
    const historyRows = [];
    if (clientIds.length) {
      for (let from = 0; ; from += 500) {
        const { data: history, error: historyError } = await supabase
          .from("clinical_sessions")
          .select("id, client_id, session_date, clinical_status")
          .eq("user_id", userId)
          .in("client_id", clientIds)
          .lt("session_date", edge(1))
          .order("session_date")
          .order("id")
          .range(from, from + 499);
        if (historyError) throw new Error(historyError.message);
        historyRows.push(...(history ?? []));
        if (!history || history.length < 500) break;
      }
    }
    const history = sessionHistory(historyRows);
    const weekCounts = new Map<string, number>();
    for (const row of weekRows.data ?? []) {
      if (row.clinical_status === "canceled") continue;
      const date = dateKeyInTz(row.session_date, tz);
      weekCounts.set(date, (weekCounts.get(date) ?? 0) + 1);
    }
    const upcoming = new Set((future.data ?? []).map((row) => row.client_id));
    return {
      today: rows.map((row) => agendaSession(row, tz, now, history.get(row.id))),
      week: Array.from({ length: 7 }, (_, offset) => {
        const date = shiftDateKey(day, offset - 2);
        return { date, count: weekCounts.get(date) ?? 0 };
      }),
      orphanClients: (activeClients.data ?? [])
        .filter((client) => !upcoming.has(client.id))
        .map((client) => ({ id: client.id, name: client.preferred_name || client.full_name })),
      stats: { prontuariosPendentes },
    };
  });

export type WeekSessionDTO = Pick<
  AgendaSessionDTO,
  | "id"
  | "clientId"
  | "patient"
  | "dateKey"
  | "start"
  | "end"
  | "startISO"
  | "durationMin"
  | "clinicalStatus"
  | "overdue"
>;

export const getAgendaWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { weekStart: string; tz?: string }) =>
    z.object({ weekStart: civilDate, tz: z.string().max(64).optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<WeekSessionDTO[]> => {
    const tz = data.tz && isValidTimeZone(data.tz) ? data.tz : DEFAULT_TZ;
    const start = startOfCivilDay(data.weekStart, tz);
    const end = startOfCivilDay(shiftDateKey(data.weekStart, 7), tz);
    const { data: rows, error } = await context.supabase
      .from("clinical_sessions")
      .select(
        "id, client_id, session_date, title, status, clinical_status, duration_seconds, planned_duration_minutes, manual_notes, ai_reviewed_at, clients!inner(full_name, preferred_name)",
      )
      .eq("clients.status", "active")
      .neq("status", "deleting")
      .eq("user_id", context.userId)
      .gte("session_date", start.toISOString())
      .lt("session_date", end.toISOString())
      .order("session_date")
      .order("id");
    if (error) throw new Error(error.message);

    const now = new Date();
    return (rows ?? []).map((row) => {
      const {
        id,
        clientId,
        patient,
        dateKey,
        start,
        end,
        startISO,
        durationMin,
        clinicalStatus,
        overdue,
      } = agendaSession(row, tz, now);
      return {
        id,
        clientId,
        patient,
        dateKey,
        start,
        end,
        startISO,
        durationMin,
        clinicalStatus,
        overdue,
      };
    });
  });

export type RescheduleResponse =
  | { ok: true; sessionId: string; clientId: string; startISO: string }
  | { ok: false; errors: string[]; conflicts: { id: string; start: string; patient: string }[] };

const saveInput = z.object({
  sessionId: z.string().uuid(),
  date: civilDate,
  time: z.string(),
  durationMin: z.number().int(),
  occurrence: z.number().int().min(0).max(1).optional(),
  tz: z.string().max(64),
});
type SaveInput = z.infer<typeof saveInput>;

const responseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    sessionId: z.string(),
    clientId: z.string(),
    startISO: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    errors: z.array(z.string()),
    conflicts: z.array(z.object({ id: z.string(), startISO: z.string(), patient: z.string() })),
  }),
]);

async function commitAppointment(
  supabase: Supabase,
  args: Database["public"]["Functions"]["manage_clinical_appointment"]["Args"],
  tz: string,
): Promise<RescheduleResponse> {
  const { data, error } = await supabase.rpc("manage_clinical_appointment", args);
  if (error) {
    if (error.code === "22023" || error.code === "42501")
      return { ok: false, errors: [error.message], conflicts: [] };
    throw new Error("O servidor não confirmou o atendimento. Tente de novo.");
  }
  const response = responseSchema.parse(data);
  if (response.ok) return response;
  return {
    ok: false,
    errors: response.errors,
    conflicts: response.conflicts.map(({ id, startISO, patient }) => ({
      id,
      start: timeInTz(startISO, tz),
      patient,
    })),
  };
}

async function saveAppointment(
  supabase: Supabase,
  input: SaveInput,
  action: "schedule" | "reschedule",
  client?: { id: string; title?: string },
  originalStartISO?: string,
): Promise<RescheduleResponse> {
  const validation = validateReschedule({ ...input, existing: [], originalStartISO });
  if (!validation.ok) return { ok: false, errors: validation.errors, conflicts: [] };
  return commitAppointment(
    supabase,
    {
      _action: action,
      _session_id: input.sessionId,
      ...(client ? { _client_id: client.id, _title: client.title } : {}),
      _start: validation.startISO,
      _duration_minutes: input.durationMin,
      _time_zone: input.tz,
    },
    input.tz,
  );
}

export const scheduleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveInput & { clientId: string; title?: string }) =>
    saveInput
      .extend({ clientId: z.string().uuid(), title: z.string().trim().max(120).optional() })
      .parse(data),
  )
  .handler(({ data, context }) =>
    saveAppointment(context.supabase, data, "schedule", { id: data.clientId, title: data.title }),
  );

export const rescheduleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveInput) => saveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: current, error } = await context.supabase
      .from("clinical_sessions")
      .select("session_date")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!current)
      return { ok: false as const, errors: ["Atendimento indisponível."], conflicts: [] };
    return saveAppointment(context.supabase, data, "reschedule", undefined, current.session_date);
  });

export const cancelSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(data),
  )
  .handler(({ data, context }) =>
    commitAppointment(
      context.supabase,
      { _action: "cancel", _session_id: data.sessionId },
      DEFAULT_TZ,
    ),
  );
