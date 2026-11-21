import type { QueryClient } from "@tanstack/react-query";

/**
 * Sessões: estado clínico (agenda → atendimento → registro → concluído)
 * separado do estado do áudio (gravando → enviando → processando → revisão → erro).
 */

export type ClinicalStatus =
  "scheduled" | "in_progress" | "pending_record" | "completed" | "canceled";
export type AudioState =
  | "none"
  | "recording"
  | "uploading"
  | "processing"
  | "review"
  | "reviewed"
  | "error"
  | "waiting_upload"
  | "waiting_processing"
  | "deleting"
  | "stale";

export const CLINICAL_LABEL: Record<ClinicalStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em atendimento",
  pending_record: "Registro pendente",
  completed: "Concluída",
  canceled: "Cancelada",
};

export const AUDIO_LABEL: Record<AudioState, string> = {
  none: "Sem áudio",
  recording: "Gravando",
  uploading: "Enviando",
  processing: "Processando",
  review: "Aguardando revisão",
  reviewed: "Revisado",
  error: "Erro no áudio",
  waiting_upload: "Envio pendente",
  waiting_processing: "Disponível para processamento",
  deleting: "Exclusão pendente",
  stale: "Síntese desatualizada",
};

export type SessionLike = {
  session_date: string;
  status: string;
  clinical_status?: string | null;
  manual_notes?: string | null;
  audio_path?: string | null;
  structured_note?: unknown;
  ai_reviewed_at?: string | null;
  summary_stale?: boolean;
};

const CLINICAL = new Set<ClinicalStatus>([
  "scheduled",
  "in_progress",
  "pending_record",
  "completed",
  "canceled",
]);

export function isAppointmentOverdue(s: SessionLike, now: Date) {
  return s.clinical_status === "scheduled" && Date.parse(s.session_date) <= now.getTime();
}

export function clinicalStatusOf(s: SessionLike, now = new Date()): ClinicalStatus {
  if (isAppointmentOverdue(s, now)) return "pending_record";
  if (s.clinical_status && CLINICAL.has(s.clinical_status as ClinicalStatus))
    return s.clinical_status as ClinicalStatus;
  if (new Date(s.session_date).getTime() > now.getTime()) return "scheduled";
  const hasRecord = !!s.manual_notes?.trim() || !!s.ai_reviewed_at;
  return hasRecord ? "completed" : "pending_record";
}

export function audioStateOf(s: SessionLike): AudioState {
  if (s.status === "deleting") return "deleting";
  if (!s.audio_path) return "none";
  if (s.status === "error") return "error";
  if (s.status === "awaiting_upload" || s.status === "discarding_upload") return "waiting_upload";
  if (s.status === "draft") return "waiting_processing";
  if (s.status === "transcribing" || s.status === "structuring") return "processing";
  if (s.summary_stale) return "stale";
  if (s.structured_note) return s.ai_reviewed_at ? "reviewed" : "review";
  return "processing";
}

/* ---------------- Rascunho de nota (em memória, nunca em localStorage) ---------------- */

export type NoteDraft = {
  text: string;
  saved: string | null;
  server: string | null;
  phase: "idle" | "saving" | "error";
  error: string | null;
};

export type NoteEvent =
  | { type: "edit"; text: string }
  | { type: "save_start" }
  | { type: "save_ok"; persisted: string | null }
  | { type: "save_fail"; message: string }
  | { type: "reset"; saved: string | null }
  | { type: "discard" };

export function noteDraftInit(saved: string | null | undefined): NoteDraft {
  return {
    text: saved ?? "",
    saved: saved ?? null,
    server: saved ?? null,
    phase: "idle",
    error: null,
  };
}

export function noteReducer(s: NoteDraft, e: NoteEvent): NoteDraft {
  switch (e.type) {
    case "edit":
      return { ...s, text: e.text };
    case "save_start":
      return { ...s, phase: "saving", error: null };
    case "save_ok":
      // Só marca como salvo o texto confirmado pelo banco; edições feitas
      // durante o envio continuam pendentes.
      return { ...s, saved: e.persisted, server: e.persisted, phase: "idle", error: null };
    case "save_fail":
      return { ...s, phase: "error", error: e.message };
    case "discard":
      // Escolha explícita no diálogo de saída: volta ao texto confirmado
      return noteDraftInit(s.server);
    case "reset":
      // Atualização vinda do servidor nunca sobrescreve edição local pendente.
      return isDirty(s) || s.phase === "saving"
        ? { ...s, server: e.saved }
        : noteDraftInit(e.saved);
  }
}

export const isDirty = (s: NoteDraft) => s.text !== (s.saved ?? "");

/**
 * Marca revisão do texto gerado. Só retorna true se o banco devolveu a linha
 * com `ai_reviewed_at` preenchido.
 */
export async function confirmReview(
  persist: () => Promise<{ ai_reviewed_at: string | null } | null>,
): Promise<{ reviewed: boolean; error?: string }> {
  try {
    const row = await persist();
    return row?.ai_reviewed_at
      ? { reviewed: true }
      : { reviewed: false, error: "Revisão não confirmada pelo servidor." };
  } catch (err) {
    return {
      reviewed: false,
      error: err instanceof Error ? err.message : "Falha ao salvar revisão.",
    };
  }
}

export async function invalidateSessionViews(qc: QueryClient, clientId: string) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] }),
    qc.invalidateQueries({ queryKey: ["client-session-count", clientId] }),
    qc.invalidateQueries({ queryKey: ["client-next-session", clientId] }),
    qc.invalidateQueries({ queryKey: ["agenda-data"] }),
    qc.invalidateQueries({ queryKey: ["agenda-week"] }),
    qc.invalidateQueries({ queryKey: ["agenda-pending-records"] }),
    qc.invalidateQueries({ queryKey: ["mesa-sessions-upcoming"] }),
    qc.invalidateQueries({ queryKey: ["mesa-pending-records"] }),
    qc.invalidateQueries({ queryKey: ["mesa-onboarding-counts"] }),
  ]);
}

export function canRetryAudioProcessing(
  status: string,
  processingStartedAt: string | null | undefined,
  updatedAt: string | undefined,
  now = Date.now(),
  summaryStale = false,
) {
  if (status === "draft" || status === "error" || (status === "ready" && summaryStale)) return true;
  if (status !== "transcribing" && status !== "structuring") return false;
  const startedAt = Date.parse(processingStartedAt ?? updatedAt ?? "");
  return Number.isFinite(startedAt) && now - startedAt >= 10 * 60 * 1000;
}
