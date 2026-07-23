import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const fmtHM = (d: Date) =>
  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export const getAgendaData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { date?: string } | undefined) =>
    z.object({ date: z.string().optional() }).optional().parse(data),
  )
  .handler(async ({ data, context }): Promise<AgendaDataDTO> => {
    const { supabase, userId } = context;
    const now = new Date();
    const viewedDate = data?.date ? new Date(data.date) : now;
    const todayStart = new Date(
      viewedDate.getFullYear(),
      viewedDate.getMonth(),
      viewedDate.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000);
    const weekBack = new Date(todayStart.getTime() - 2 * 24 * 60 * 60_000);
    const weekAhead = new Date(todayStart.getTime() + 5 * 24 * 60 * 60_000);

    // Today's sessions with client info
    const { data: todayRows, error: todayErr } = await supabase
      .from("clinical_sessions")
      .select(
        "id, client_id, session_date, title, status, duration_seconds, structured_note, clients(id, full_name, preferred_name)",
      )
      .eq("user_id", userId)
      .gte("session_date", todayStart.toISOString())
      .lt("session_date", todayEnd.toISOString())
      .order("session_date", { ascending: true });

    if (todayErr) throw new Error(todayErr.message);

    // Week counts (aggregate client-side; small dataset)
    const { data: weekRows } = await supabase
      .from("clinical_sessions")
      .select("session_date")
      .eq("user_id", userId)
      .gte("session_date", weekBack.toISOString())
      .lt("session_date", weekAhead.toISOString());

    // Get session counts per client (for "Primeira/Retorno" and session #)
    const clientIds = Array.from(
      new Set((todayRows ?? []).map((r) => r.client_id).filter(Boolean) as string[]),
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

    const today: AgendaSessionDTO[] = (todayRows ?? []).map((r, idx) => {
      const client = r.clients as {
        id: string;
        full_name: string;
        preferred_name: string | null;
      } | null;
      const patient = client?.preferred_name || client?.full_name || "Cliente";
      const start = new Date(r.session_date);
      const durMin = Math.max(30, Math.round((r.duration_seconds ?? 3600) / 60));
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
        start: fmtHM(start),
        end: fmtHM(end),
        startISO: start.toISOString(),
        type,
        sessionNumber,
        isFirst,
        daysSinceFirst,
        lastEvolution,
        status: (r.status as AgendaSessionDTO["status"]) ?? "scheduled",
      };
    });

    // Week counts
    const weekMap = new Map<string, number>();
    (weekRows ?? []).forEach((r) => {
      const d = new Date(r.session_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
    });
    const week: AgendaDataDTO["week"] = [];
    for (let offset = -2; offset <= 4; offset++) {
      const d = new Date(todayStart.getTime() + offset * 86_400_000);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      week.push({ date: d.toISOString(), count: weekMap.get(key) ?? 0 });
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
