import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_TZ,
  dateKeyInTz,
  isValidTimeZone,
  plannedDurationMin,
  timeInTz,
  validateReschedule,
  zonedLocalToUtc,
} from "@/lib/scheduling";
import {
  audioStateOf,
  clinicalStatusOf,
  type AudioState,
  type ClinicalStatus,
} from "@/lib/session-state";

export type AgendaSessionDTO = {
  id: string;
  clientId: string;
  patient: string;
  initials: string;
  start: string; // HH:mm
  end: string; // HH:mm
  startISO: string;
  type: "Primeira Consulta" | "Retorno" | "Anamnese Sistêmica";
  sessionNumber: number;
  isFirst: boolean;
  daysSinceFirst: number | null;
  lastEvolution: string | null;
  status: "completed" | "processing" | "scheduled" | "failed";
  durationMin: number;
  clinicalStatus: ClinicalStatus;
  audioState: AudioState;
};

export type OrphanClientDTO = {
  id: string;
  name: string;
  daysSinceLast: number | null;
};

export type AgendaDataDTO = {
  today: AgendaSessionDTO[];
  week: { date: string; count: number }[]; // last 2 + today + next 4
  orphanClients: OrphanClientDTO[];
  stats: {
    total: number;
    primeira: number;
    retornos: number;
    prontuariosPendentes: number;
  };
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export const getAgendaData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date?: string; tz?: string } | undefined) =>
    z
      .object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        tz: z.string().max(64).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AgendaDataDTO> => {
    const { supabase, userId } = context;
    const now = new Date();
    const tz = data?.tz && isValidTimeZone(data.tz) ? data.tz : DEFAULT_TZ;
    const dayKey = data?.date ?? dateKeyInTz(now, tz);
    const todayStart = zonedLocalToUtc(dayKey, "00:00", tz) ?? new Date(`${dayKey}T00:00:00Z`);
    const todayEnd = new Date(todayStart.getTime() + 26 * 60 * 60_000); // margem p/ horário de verão; filtrado abaixo
    const weekBack = new Date(todayStart.getTime() - 2 * 24 * 60 * 60_000);
    const weekAhead = new Date(todayStart.getTime() + 5 * 24 * 60 * 60_000);

    // Today's sessions with client info
    const { data: todayRows, error: todayErr } = await supabase
      .from("clinical_sessions")
      .select(
        "id, client_id, session_date, title, status, duration_seconds, planned_duration_minutes, clinical_status, manual_notes, audio_path, ai_reviewed_at, structured_note, clients(id, full_name, preferred_name)",
      )
      .eq("user_id", userId)
      .gte("session_date", todayStart.toISOString())
      .lt("session_date", todayEnd.toISOString())
      .order("session_date", { ascending: true });

    if (todayErr) throw new Error(todayErr.message);
    const dayRows = (todayRows ?? []).filter((r) => dateKeyInTz(r.session_date, tz) === dayKey);

    // Week counts (aggregate client-side; small dataset)
    const { data: weekRows } = await supabase
      .from("clinical_sessions")
      .select("session_date")
      .eq("user_id", userId)
      .gte("session_date", weekBack.toISOString())
      .lt("session_date", weekAhead.toISOString());

    // Get session counts per client (for "Primeira/Retorno" and session #)
    const clientIds = Array.from(
      new Set(dayRows.map((r) => r.client_id).filter(Boolean) as string[]),
    );

    const historyByClient = new Map<string, { count: number; firstDate: Date | null }>();
    if (clientIds.length) {
      const { data: hist } = await supabase
        .from("clinical_sessions")
        .select("client_id, session_date")
        .eq("user_id", userId)
        .in("client_id", clientIds)
        .order("session_date", { ascending: true });
      (hist ?? []).forEach((h) => {
        const prev = historyByClient.get(h.client_id!) ?? { count: 0, firstDate: null };
        prev.count += 1;
        if (!prev.firstDate) prev.firstDate = new Date(h.session_date);
        historyByClient.set(h.client_id!, prev);
      });
    }

    const today: AgendaSessionDTO[] = dayRows.map((r, idx) => {
      const client = r.clients as {
        id: string;
        full_name: string;
        preferred_name: string | null;
      } | null;
      const patient = client?.preferred_name || client?.full_name || "Cliente";
      const start = new Date(r.session_date);
      const durMin = plannedDurationMin(r);
      const end = addMinutes(start, durMin);
      const hist = client?.id ? historyByClient.get(client.id) : undefined;
      const sessionNumber = hist?.count ?? 1;
      const isFirst = sessionNumber === 1;
      const daysSinceFirst =
        hist?.firstDate && !isFirst
          ? Math.max(0, Math.floor((now.getTime() - hist.firstDate.getTime()) / 86_400_000))
          : null;
      void idx;

      const type: AgendaSessionDTO["type"] = isFirst
        ? "Primeira Consulta"
        : r.title?.toLowerCase().includes("anamnese")
          ? "Anamnese Sistêmica"
          : "Retorno";

      const lastEvolution = extractSummary(r.structured_note);

      return {
        id: r.id,
        clientId: client?.id ?? "",
        patient,
        initials: initialsOf(patient),
        start: timeInTz(start, tz),
        end: timeInTz(end, tz),
        startISO: start.toISOString(),
        type,
        sessionNumber,
        isFirst,
        daysSinceFirst,
        lastEvolution,
        status: (r.status as AgendaSessionDTO["status"]) ?? "scheduled",
        durationMin: durMin,
        clinicalStatus: clinicalStatusOf(r, now),
        audioState: audioStateOf(r),
      };
    });

    // Week counts
    const weekMap = new Map<string, number>();
    (weekRows ?? []).forEach((r) => {
      const key = dateKeyInTz(r.session_date, tz);
      weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
    });
    const week: AgendaDataDTO["week"] = [];
    for (let offset = -2; offset <= 4; offset++) {
      const d = new Date(todayStart.getTime() + offset * 86_400_000 + 12 * 3_600_000);
      const key = dateKeyInTz(d, tz);
      week.push({ date: key, count: weekMap.get(key) ?? 0 });
    }

    // Orphan clients: active clients without a session in the last 30 days
    const thirtyAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, full_name, preferred_name, status")
      .eq("professional_id", userId)
      .eq("status", "active");

    const { data: recentSessions } = await supabase
      .from("clinical_sessions")
      .select("client_id, session_date")
      .eq("user_id", userId)
      .gte("session_date", thirtyAgo);

    const lastByClient = new Map<string, Date>();
    (recentSessions ?? []).forEach((r) => {
      if (!r.client_id) return;
      const d = new Date(r.session_date);
      const prev = lastByClient.get(r.client_id);
      if (!prev || d > prev) lastByClient.set(r.client_id, d);
    });

    const orphanClients: OrphanClientDTO[] = (allClients ?? [])
      .filter((c) => !lastByClient.has(c.id))
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        name: c.preferred_name || c.full_name,
        daysSinceLast: null,
      }));

    // Pending prontuários: sessions with status != completed
    const { count: pendingCount } = await supabase
      .from("clinical_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("status", "completed");

    const stats = {
      total: today.length,
      primeira: today.filter((s) => s.isFirst).length,
      retornos: today.filter((s) => !s.isFirst).length,
      prontuariosPendentes: pendingCount ?? 0,
    };

    return { today, week, orphanClients, stats };
  });

// tiny helper — pulls a plausible one-liner from structured_note
function extractSummary(note: unknown): string | null {
  if (!note || typeof note !== "object") return null;
  const n = note as Record<string, unknown>;
  const s = n.resumo ?? n.summary;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

/* ------------------------------ Semana ------------------------------ */

export type WeekSessionDTO = {
  id: string;
  clientId: string;
  patient: string;
  dateKey: string;
  start: string;
  end: string;
  startISO: string;
  durationMin: number;
  clinicalStatus: ClinicalStatus;
};

export const getAgendaWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { weekStart: string; tz?: string }) =>
    z
      .object({
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tz: z.string().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<WeekSessionDTO[]> => {
    const tz = data.tz && isValidTimeZone(data.tz) ? data.tz : DEFAULT_TZ;
    const start =
      zonedLocalToUtc(data.weekStart, "00:00", tz) ?? new Date(`${data.weekStart}T00:00:00Z`);
    const end = new Date(start.getTime() + 7 * 86_400_000 + 2 * 3_600_000);
    const { data: rows, error } = await context.supabase
      .from("clinical_sessions")
      .select(
        "id, client_id, session_date, status, duration_seconds, planned_duration_minutes, clinical_status, manual_notes, ai_reviewed_at, clients(full_name, preferred_name)",
      )
      .eq("user_id", context.userId)
      .gte("session_date", start.toISOString())
      .lt("session_date", end.toISOString())
      .order("session_date");
    if (error) throw new Error(error.message);
    const now = new Date();
    return (rows ?? []).map((r) => {
      const c = r.clients as { full_name: string; preferred_name: string | null } | null;
      const dur = plannedDurationMin(r);
      const s = new Date(r.session_date);
      return {
        id: r.id,
        clientId: r.client_id,
        patient: c?.preferred_name || c?.full_name || "Cliente",
        dateKey: dateKeyInTz(s, tz),
        start: timeInTz(s, tz),
        end: timeInTz(addMinutes(s, dur), tz),
        startISO: s.toISOString(),
        durationMin: dur,
        clinicalStatus: clinicalStatusOf(r, now),
      };
    });
  });

/* --------------------------- Reagendamento --------------------------- */

export type RescheduleResponse =
  | { ok: true; startISO: string }
  | { ok: false; errors: string[]; conflicts: { id: string; start: string; patient: string }[] };

export const rescheduleSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { sessionId: string; date: string; time: string; durationMin: number; tz: string }) =>
      z
        .object({
          sessionId: z.string().uuid(),
          date: z.string(),
          time: z.string(),
          durationMin: z.number().int(),
          tz: z.string().max(64),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<RescheduleResponse> => {
    const { supabase, userId } = context;
    const target = zonedLocalToUtc(data.date, data.time, data.tz);
    // Janela ampla: qualquer sessão que possa encostar no novo horário.
    const center = target ?? new Date();
    const { data: near, error } = await supabase
      .from("clinical_sessions")
      .select(
        "id, session_date, duration_seconds, planned_duration_minutes, clients(full_name, preferred_name)",
      )
      .eq("user_id", userId)
      .gte("session_date", new Date(center.getTime() - 9 * 3_600_000).toISOString())
      .lt("session_date", new Date(center.getTime() + 9 * 3_600_000).toISOString());
    if (error) throw new Error(error.message);
    const existing = (near ?? []).map((r) => ({
      id: r.id,
      startISO: new Date(r.session_date).toISOString(),
      durationMin: plannedDurationMin(r),
    }));
    const res = validateReschedule({ ...data, existing });
    if (!res.ok) {
      return {
        ok: false,
        errors: res.errors,
        conflicts: res.conflicts.map((c) => {
          const row = near?.find((r) => r.id === c.id);
          const cl = row?.clients as { full_name: string; preferred_name: string | null } | null;
          return {
            id: c.id,
            start: timeInTz(c.startISO, data.tz),
            patient: cl?.preferred_name || cl?.full_name || "Cliente",
          };
        }),
      };
    }
    const { data: upd, error: upErr } = await supabase
      .from("clinical_sessions")
      .update({
        session_date: res.startISO,
        planned_duration_minutes: data.durationMin,
        time_zone: data.tz,
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (!upd)
      return { ok: false, errors: ["Sessão não encontrada ou sem permissão."], conflicts: [] };
    return { ok: true, startISO: res.startISO };
  });
