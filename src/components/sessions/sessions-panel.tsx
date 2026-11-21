import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mic,
  Pause,
  Play,
  Square,
  Loader2,
  Trash2,
  AlertCircle,
  RefreshCw,
  AudioLines,
  Save,
  CheckCircle2,
  Plus,
  CalendarDays,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { processSessionAudio } from "@/lib/ai/session-processing.functions";
import { Button } from "@/components/ui/button";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import { informationGaps } from "@/lib/evidence";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/integrations/supabase/types";
import { TranscriptReview } from "./transcript-review";
import { AudioConsentPanel } from "./audio-consent-panel";
import {
  activeAudioConsent,
  audioConsentsKey,
  readAudioConsents,
  requireAudioConsent,
} from "@/lib/audio-consent";
import {
  AUDIO_LABEL,
  CLINICAL_LABEL,
  audioStateOf,
  clinicalStatusOf,
  canRetranscribeSession,
  canRetryAudioProcessing,
  confirmReview,
  invalidateSessionViews,
  isDirty,
  noteDraftInit,
  noteReducer,
  type ClinicalStatus,
} from "@/lib/session-state";

const ScheduleDialog = lazy(() =>
  import("@/components/agenda/agenda-views").then(({ ScheduleDialog }) => ({
    default: ScheduleDialog,
  })),
);

interface Props {
  clientId: string;
  clientName: string;
  focusedSessionId?: string;
  focusConsent?: boolean;
}

type Session = {
  id: string;
  session_date: string;
  title: string | null;
  duration_seconds: number | null;
  audio_path: string | null;
  transcript: string | null;
  transcript_segments?: Json;
  transcript_reviews?: Json;
  updated_at: string;
  recording_consent_id?: string | null;
  processing_consent_id?: string | null;
  processing_started_at?: string | null;
  status: string;
  error_message: string | null;
  structured_note: Record<string, unknown> | null;
  summary_stale?: boolean;
  clinical_status: string | null;
  manual_notes: string | null;
  ai_reviewed_at: string | null;
};

type CapturedAudio = {
  sessionId: string;
  existingSession: boolean;
  recordingGrantId: string;
  recordedSessionId?: string;
  blob: Blob;
  seconds: number;
  fileId: string;
  path?: string;
};

async function confirmAudioUpload(sessionId: string, path: string) {
  const { data, error } = await supabase.rpc("confirm_session_audio_upload", {
    _session_id: sessionId,
    _path: path,
  });
  if (error) throw new Error("Não foi possível verificar o envio. Tente confirmar novamente.");
  if (data === "confirmed") return;
  if (data === "canceled") {
    throw new Error("A sessão foi cancelada. Confira o destino antes de guardar a gravação.");
  }
  if (data === "missing") {
    throw new Error("O arquivo ainda não está no dossiê. Tente novamente ou remova a reserva.");
  }
  if (data === "consent") {
    throw new Error(
      "A autorização usada para gravar deixou de estar vigente. Remova o envio pendente.",
    );
  }
  throw new Error("O estado do envio mudou. Atualize a sessão.");
}

async function clearPendingUpload(sessionId: string, path: string) {
  const { data, error } = await supabase
    .from("clinical_sessions")
    .update({ status: "discarding_upload" })
    .eq("id", sessionId)
    .eq("audio_path", path)
    .in("status", ["awaiting_upload", "discarding_upload"])
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("O estado do envio mudou. Atualize a sessão.");
  const { error: removal } = await supabase.storage.from("session-audio").remove([path]);
  if (removal) throw new Error("O arquivo pendente não pôde ser removido. Tente novamente.");
  const { error: update } = await supabase
    .from("clinical_sessions")
    .update({
      audio_path: null,
      duration_seconds: null,
      recording_consent_id: null,
      status: "ready",
    })
    .eq("id", sessionId)
    .eq("audio_path", path)
    .eq("status", "discarding_upload");
  if (update) throw new Error("Não foi possível confirmar o descarte. Tente novamente.");
}

async function releaseUnconfirmedAudio({ sessionId, path }: CapturedAudio) {
  if (!path) return;
  const { data, error } = await supabase
    .from("clinical_sessions")
    .select("status, audio_path")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o áudio pendente.");
  if (data?.audio_path !== path) return;
  if (data.status !== "awaiting_upload" && data.status !== "discarding_upload") {
    return "confirmed";
  }
  await clearPendingUpload(sessionId, path);
}

function CapturedAudioPlayer({ blob }: { blob: Blob }) {
  const [url, setURL] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const preview = URL.createObjectURL(blob);
    setURL(preview);
    return () => URL.revokeObjectURL(preview);
  }, [blob]);
  if (!url) return null;
  return (
    <div className="space-y-1">
      <audio
        className="max-w-full"
        aria-label="Ouvir trecho capturado"
        controls
        preload="metadata"
        src={url}
        onError={() => setError(true)}
      />
      {error && (
        <p role="status" className="text-sm text-muted-foreground">
          O navegador não conseguiu reproduzir este trecho.
        </p>
      )}
    </div>
  );
}

function SavedAudioPlayer({ sessionId, audioPath }: { sessionId: string; audioPath: string }) {
  const player = useQuery({
    queryKey: ["session-audio-playback", sessionId, audioPath],
    enabled: false,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("session-audio")
        .createSignedUrl(audioPath, 180);
      if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o áudio.");
      return data.signedUrl;
    },
  });
  return (
    <section className="space-y-2" aria-label="Áudio guardado">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={player.isFetching}
        onClick={() => void player.refetch()}
      >
        <Play className="size-4" aria-hidden />{" "}
        {player.data ? "Atualizar player" : "Ouvir áudio guardado"}
      </Button>
      {player.data && (
        <audio
          className="max-w-full"
          controls
          preload="none"
          aria-label="Reproduzir áudio guardado"
          src={player.data}
        />
      )}
      {player.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível abrir o áudio.
        </p>
      )}
    </section>
  );
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionsPanel({ clientId, clientName, focusedSessionId, focusConsent }: Props) {
  const qc = useQueryClient();
  const processFn = useServerFn(processSessionAudio);

  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["clinical_sessions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_sessions")
        .select("*")
        .eq("client_id", clientId)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Session[];
    },
  });

  const preparing = sessions.find(
    (session) => session.id === focusedSessionId && clinicalStatusOf(session) === "scheduled",
  );
  const priorNote =
    preparing &&
    sessions.find(
      (session) =>
        Date.parse(session.session_date) < Date.parse(preparing.session_date) &&
        session.manual_notes?.trim(),
    );
  const preparation = useQuery({ ...clinicalIntelQuery(clientId), enabled: Boolean(preparing) });
  const openQuestions = useMemo(() => {
    if (!preparing || !preparation.data) return [];
    return informationGaps(preparation.data.persons, preparation.data.relationships).slice(0, 3);
  }, [preparing, preparation.data]);

  // Poll while any session is processing
  useEffect(() => {
    const processing = sessions.some(
      (s) => s.status === "transcribing" || s.status === "structuring",
    );
    if (!processing) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
    }, 3000);
    return () => clearInterval(t);
  }, [sessions, clientId, qc]);

  const consentQuery = useQuery({
    queryKey: audioConsentsKey(clientId),
    queryFn: () => readAudioConsents(supabase, clientId),
    retry: false,
    refetchInterval: 5000,
  });
  const events = consentQuery.data ?? [];
  const [pendingAudio, setPendingAudio] = useState<CapturedAudio | null>(null);
  const pendingAudioRef = useRef<CapturedAudio | null>(null);
  const updatePending = (audio: CapturedAudio | null) => {
    pendingAudioRef.current = audio;
    setPendingAudio(audio);
  };

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [manualFocusId, setManualFocusId] = useState<string>();
  const [recordingSelection, setRecordingSelection] = useState<{
    focus: string | undefined;
    id: string;
  }>();
  const recordingTarget =
    recordingSelection && recordingSelection.focus === focusedSessionId
      ? recordingSelection.id
      : (focusedSessionId ?? "");
  const targets = sessions.filter(
    (session) =>
      !session.audio_path &&
      session.status !== "deleting" &&
      clinicalStatusOf(session) !== "canceled",
  );
  const linkedSession = sessions.find(
    (session) =>
      session.id === focusedSessionId &&
      clinicalStatusOf(session) !== "canceled" &&
      session.status !== "deleting",
  );
  const targetId = targets.some((session) => session.id === recordingTarget) ? recordingTarget : "";
  const targetUnavailable = !!recordingTarget && !targetId;
  const grantFor = (scope: "recording" | "external_processing", sessionId?: string) =>
    !consentQuery.isError ? activeAudioConsent(events, scope, sessionId) : undefined;
  const recordingGrant = targetUnavailable
    ? undefined
    : grantFor("recording", targetId || undefined);
  const pendingSession = sessions.find((session) => session.id === pendingAudio?.sessionId);
  const pendingDestinationUnavailable =
    !!pendingAudio?.existingSession &&
    (!pendingSession ||
      pendingSession.status === "deleting" ||
      pendingSession.clinical_status === "canceled");
  const canUploadPending =
    pendingAudio &&
    !pendingDestinationUnavailable &&
    grantFor("recording", pendingAudio.recordedSessionId)?.id === pendingAudio.recordingGrantId &&
    grantFor("recording", pendingAudio.existingSession ? pendingAudio.sessionId : undefined)?.id ===
      pendingAudio.recordingGrantId;
  const canRecover =
    pendingAudio &&
    pendingDestinationUnavailable &&
    grantFor("recording", pendingAudio.recordedSessionId)?.id === pendingAudio.recordingGrantId;
  const recoveryTargets =
    pendingAudio && canRecover
      ? targets.filter(
          (target) => grantFor("recording", target.id)?.id === pendingAudio.recordingGrantId,
        )
      : [];
  const canRecoverAsNew =
    pendingAudio && canRecover && grantFor("recording")?.id === pendingAudio.recordingGrantId;
  const recordingStatus = starting
    ? "Confirmando a autorização e o acesso ao microfone."
    : recording
      ? paused
        ? "Gravação pausada."
        : "Gravação em andamento."
      : consentQuery.isPending
        ? "Consultando autorização para gravar."
        : consentQuery.isError
          ? "Autorização indisponível. Confira o registro de autorizações."
          : recordingGrant
            ? "Gravação autorizada para esta seleção."
            : targetUnavailable
              ? "Selecione uma sessão disponível para receber a gravação."
              : "Esta seleção precisa de autorização para gravar.";
  const [processingTarget, setProcessingTarget] = useState<{
    sessionId: string;
    retranscribe?: boolean;
  }>();
  const processingGrant = processingTarget
    ? grantFor("external_processing", processingTarget.sessionId)
    : undefined;
  const processingTranscript =
    !processingTarget?.retranscribe &&
    sessions.find((session) => session.id === processingTarget?.sessionId)?.transcript;
  const mountedRef = useRef(false);
  const startLock = useRef(false);
  const audioLock = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeGrantRef = useRef<{ id: string; sessionId?: string } | null>(null);
  const timerRef = useRef<number | null>(null);
  const recorderEndTimerRef = useRef<number | null>(null);

  const refreshSessions = () => invalidateSessionViews(qc, clientId);

  const clearRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    activeGrantRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onpause = null;
      recorder.onresume = null;
      recorder.onerror = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderEndTimerRef.current !== null) {
      window.clearTimeout(recorderEndTimerRef.current);
      recorderEndTimerRef.current = null;
    }
    if (mountedRef.current) {
      setRecording(false);
      setPaused(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecorder();
    };
  }, [clearRecorder]);

  useEffect(() => {
    const grant = activeGrantRef.current;
    const recorder = mediaRecorderRef.current;
    if (!recorder || !grant) return;
    if (consentQuery.isError) {
      if (recorder.state !== "inactive") {
        recorder.stop();
        setOperationError(
          "A consulta de autorização falhou. O trecho capturado fica nesta tela até você confirmar a autorização ou descartar o áudio.",
        );
      }
      return;
    }
    if (
      grant.id !== activeAudioConsent(consentQuery.data ?? [], "recording", grant.sessionId)?.id
    ) {
      clearRecorder();
      setOperationError("A autorização para gravar mudou. A gravação foi interrompida.");
    }
  }, [consentQuery.data, consentQuery.isError, clearRecorder]);

  const scrollTarget = manualFocusId ?? focusedSessionId;
  const visibleTarget = sessions.find((session) => session.id === scrollTarget)?.id;
  const focusNotes = useCallback((sessionId: string) => {
    const notes = document.getElementById(`notes-${sessionId}`);
    notes?.scrollIntoView({ block: "nearest" });
    notes?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!visibleTarget) return;
    if (manualFocusId) {
      focusNotes(visibleTarget);
      return;
    }
    if (focusConsent || preparing?.id === visibleTarget) return;
    const target = document.getElementById(`session-${visibleTarget}`);
    target?.scrollIntoView({ block: "nearest" });
    target?.focus({ preventScroll: true });
  }, [visibleTarget, manualFocusId, focusConsent, preparing?.id, focusNotes]);

  const [requestedConsentScope, setRequestedConsentScope] = useState<{ sessionId?: string }>();
  const focusAudioConsent = useCallback((sessionId?: string) => {
    setRequestedConsentScope({ sessionId });
    const section = document.getElementById("audio-consents");
    section?.scrollIntoView({ block: "start" });
    section?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (focusConsent) focusAudioConsent(focusedSessionId);
  }, [focusConsent, focusedSessionId, focusAudioConsent]);

  const startRecording = async () => {
    if (startLock.current || mediaRecorderRef.current || pendingAudioRef.current || !recordingGrant)
      return;
    startLock.current = true;
    setStarting(true);
    setOperationError("");
    let stream: MediaStream | undefined;
    try {
      await requireAudioConsent(
        supabase,
        clientId,
        "recording",
        recordingGrant.id,
        targetId || undefined,
      );
      if (!mountedRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("O microfone não está disponível neste navegador.");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await requireAudioConsent(
        supabase,
        clientId,
        "recording",
        recordingGrant.id,
        targetId || undefined,
      );
      if (!mountedRef.current) return;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const startedAt = performance.now();
      let pausedAt: number | undefined;
      let timePaused = 0;
      const recordedSeconds = () =>
        Math.floor(((pausedAt ?? performance.now()) - startedAt - timePaused) / 1000);
      const parts: Blob[] = [];
      recorder.onpause = () => {
        pausedAt = performance.now();
        setElapsed(recordedSeconds());
        setPaused(true);
      };
      recorder.onresume = () => {
        if (pausedAt !== undefined) timePaused += performance.now() - pausedAt;
        pausedAt = undefined;
        setPaused(false);
      };
      recorder.ondataavailable = ({ data }) => {
        if (data.size) parts.push(data);
      };
      let microphoneFailed = false;
      const finishCapture = () => {
        if (!mountedRef.current || mediaRecorderRef.current !== recorder) return;
        const seconds = recordedSeconds();
        clearRecorder();
        const blob = new Blob(parts, { type: recorder.mimeType || parts[0]?.type });
        if (!blob.size) {
          setOperationError("A gravação ficou vazia. Inicie outra gravação.");
          return;
        }
        updatePending({
          blob,
          seconds,
          sessionId: targetId || crypto.randomUUID(),
          existingSession: !!targetId,
          recordingGrantId: recordingGrant.id,
          recordedSessionId: targetId || undefined,
          fileId: crypto.randomUUID(),
        });
        if (microphoneFailed) {
          setOperationError(
            "O microfone foi interrompido. Confira o trecho recuperado antes de guardar.",
          );
        }
      };
      recorder.onerror = () => {
        microphoneFailed = true;
        if (recorder.state !== "inactive") recorder.stop();
        // Alguns gravadores emitem os dados finais e o evento de parada depois do erro.
        recorderEndTimerRef.current = window.setTimeout(finishCapture, 500);
      };
      recorder.onstop = finishCapture;
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      stream = undefined;
      activeGrantRef.current = { id: recordingGrant.id, sessionId: targetId || undefined };
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setElapsed(recordedSeconds()), 1000);
    } catch (error) {
      if (mountedRef.current) {
        setOperationError(
          error instanceof Error && error.name !== "NotAllowedError"
            ? error.message
            : "Permita o acesso ao microfone para iniciar a gravação.",
        );
        void consentQuery.refetch();
      }
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      startLock.current = false;
      if (mountedRef.current) setStarting(false);
    }
  };

  // Reserve one attachment in the session before touching Storage. Retries use the same key.
  const uploadAudio = async (audio: CapturedAudio) => {
    if (audioLock.current) throw new Error("O áudio já está sendo enviado.");
    audioLock.current = true;
    setUploading(true);
    setOperationError("");
    try {
      const destination = audio.existingSession ? audio.sessionId : undefined;
      if (destination !== audio.recordedSessionId) {
        await requireAudioConsent(
          supabase,
          clientId,
          "recording",
          audio.recordingGrantId,
          audio.recordedSessionId,
        );
      }
      await requireAudioConsent(
        supabase,
        clientId,
        "recording",
        audio.recordingGrantId,
        destination,
      );
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (userError || !uid) throw new Error("Entre novamente para guardar o áudio.");
      const extension = audio.blob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${uid}/${clientId}/${audio.sessionId}/${audio.fileId}.${extension}`;
      audio.path = path;

      const { data: existing, error: readError } = await supabase
        .from("clinical_sessions")
        .select("id, audio_path, status, clinical_status")
        .eq("id", audio.sessionId)
        .eq("client_id", clientId)
        .eq("user_id", uid)
        .maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a sessão.");
      if (
        existing?.clinical_status === "canceled" &&
        (!existing.audio_path ||
          existing.status === "awaiting_upload" ||
          existing.status === "discarding_upload")
      ) {
        throw new Error("A sessão foi cancelada. Confira outro destino para o trecho capturado.");
      }
      if (existing?.audio_path && existing.audio_path !== path)
        throw new Error("A sessão já tem outro áudio.");
      if (existing?.status === "discarding_upload")
        throw new Error("A remoção do arquivo pendente está em andamento.");
      if (existing?.status === "deleting") throw new Error("A sessão está em exclusão.");
      const attachment = {
        audio_path: path,
        duration_seconds: audio.seconds,
        status: "awaiting_upload",
        recording_consent_id: audio.recordingGrantId,
      };
      if (!existing) {
        if (audio.existingSession) throw new Error("A sessão selecionada está indisponível.");
        const { error } = await supabase.from("clinical_sessions").insert({
          ...attachment,
          id: audio.sessionId,
          client_id: clientId,
          user_id: uid,
          title: "Relato da sessão",
          clinical_status: "pending_record",
        });
        if (error) throw new Error("Não foi possível reservar o envio na sessão.");
      } else if (!existing.audio_path) {
        const { data, error } = await supabase
          .from("clinical_sessions")
          .update(attachment)
          .eq("id", audio.sessionId)
          .is("audio_path", null)
          .select("id")
          .maybeSingle();
        if (error?.code === "22023") throw new Error(error.message);
        if (error || !data) throw new Error("O áudio da sessão mudou. Confira antes de reenviar.");
      }
      if (existing?.status === "awaiting_upload" || existing?.audio_path !== path) {
        const bucket = supabase.storage.from("session-audio");
        const priorUpload = existing?.audio_path === path && (await bucket.info(path)).data;
        if (!priorUpload) {
          const { error } = await bucket.upload(path, audio.blob, {
            contentType: audio.blob.type,
            upsert: false,
          });
          // The object may have been written while the response was lost.
          if (error && !(await bucket.info(path)).data)
            throw new Error("Falha no envio. Tente novamente.");
        }
      }
      await confirmAudioUpload(audio.sessionId, path);

      updatePending(null);
      void refreshSessions();
      toast.success("Áudio guardado no dossiê.");
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : "Não foi possível guardar o áudio.",
      );
      void refreshSessions();
      throw error;
    } finally {
      audioLock.current = false;
      setUploading(false);
    }
  };

  const discardAudio = async () => {
    if (audioLock.current) throw new Error("Aguarde o envio terminar.");
    clearRecorder();
    const audio = pendingAudioRef.current;
    if (audio?.path) {
      audioLock.current = true;
      setUploading(true);
      try {
        await releaseUnconfirmedAudio(audio);
        void refreshSessions();
      } finally {
        setUploading(false);
        audioLock.current = false;
      }
    }
    updatePending(null);
    setOperationError("");
  };

  const movePendingAudio = async (destination: string) => {
    const audio = pendingAudioRef.current;
    if (!audio || audioLock.current) return;
    const newSession = destination === "new";
    const destinationId = newSession ? undefined : destination;
    audioLock.current = true;
    setUploading(true);
    try {
      await requireAudioConsent(
        supabase,
        clientId,
        "recording",
        audio.recordingGrantId,
        audio.recordedSessionId,
      );
      await requireAudioConsent(
        supabase,
        clientId,
        "recording",
        audio.recordingGrantId,
        destinationId,
      );
      if ((await releaseUnconfirmedAudio(audio)) === "confirmed") {
        throw new Error("O áudio já foi guardado. Confira a sessão de origem.");
      }
      updatePending({
        ...audio,
        sessionId: destinationId ?? crypto.randomUUID(),
        existingSession: !newSession,
        path: undefined,
      });
      setRecordingSelection({ focus: focusedSessionId, id: destinationId ?? "" });
      setOperationError("");
    } finally {
      audioLock.current = false;
      setUploading(false);
      void refreshSessions();
    }
  };

  useUnsaved(`audio:${clientId}`, {
    label: recording || starting ? "Gravação em andamento" : "Áudio da sessão não enviado",
    isDirty: () =>
      startLock.current ||
      !!mediaRecorderRef.current ||
      audioLock.current ||
      !!pendingAudioRef.current,
    save: async () => {
      if (startLock.current || mediaRecorderRef.current)
        throw new Error("Finalize a gravação antes de guardar o áudio.");
      if (pendingAudioRef.current) await uploadAudio(pendingAudioRef.current);
    },
    discard: discardAudio,
  });

  const reprocess = useMutation({
    mutationFn: (data: { sessionId: string; retranscribe?: boolean }) => processFn({ data }),
    onSettled: () => void refreshSessions(),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao processar áudio"),
  });

  const createManual = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const { data, error } = await supabase
        .from("clinical_sessions")
        .insert({
          client_id: clientId,
          user_id: uid,
          title: `Sessão de ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
          status: "ready",
          clinical_status: "pending_record",
        })
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Não foi possível criar a sessão.");
      return data.id;
    },
    onSuccess: async (id) => {
      setManualFocusId(id);
      await refreshSessions();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar registro"),
  });

  const clearOrphanUpload = useMutation({
    mutationFn: ({ id, audio_path }: Session) => {
      if (!audio_path) throw new Error("A sessão não tem envio pendente.");
      return clearPendingUpload(id, audio_path);
    },
    onSettled: () => void refreshSessions(),
    onError: (error) => toast.error(error.message),
  });

  const resumeOrphanUpload = useMutation({
    mutationFn: ({ id, audio_path }: Session) => {
      if (!audio_path) throw new Error("A sessão não tem envio pendente.");
      return confirmAudioUpload(id, audio_path);
    },
    onSettled: () => void refreshSessions(),
    onSuccess: () => toast.success("Áudio guardado no dossiê."),
    onError: (error) => toast.error(error.message),
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data: path, error: beginError } = await supabase.rpc("begin_session_deletion", {
        _session_id: sessionId,
      });
      if (beginError)
        throw new Error(
          "O início da exclusão não foi confirmado. Confira a sessão e tente novamente.",
        );
      if (path) {
        // A falha pode ser apenas na resposta do Storage. O banco confere se o objeto ainda existe.
        await supabase.storage
          .from("session-audio")
          .remove([path])
          .catch(() => undefined);
      }
      const { data: removed, error: finishError } = await supabase.rpc("finish_session_deletion", {
        _session_id: sessionId,
      });
      if (finishError)
        throw new Error("A etapa final não foi confirmada. Retome a exclusão na sessão.");
      if (!removed)
        throw new Error("O áudio continua pendente de remoção. Retome a exclusão na sessão.");
    },
    onSettled: () => void refreshSessions(),
    onSuccess: () => toast.success("Sessão removida"),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="dossier-sessions">
      {preparing && (
        <section className="dossier-session-preparation" aria-label="Preparação do atendimento">
          <header>
            <h2 className="dossier-work-heading">Preparar atendimento</h2>
            <p className="text-sm text-muted-foreground">
              {format(new Date(preparing.session_date), "dd/MM/yyyy HH:mm")}
            </p>
          </header>
          {openQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Pontos em aberto no caso</h4>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {openQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}
          {preparation.isError && (
            <p className="text-sm" role="alert">
              Não foi possível carregar os pontos da família.{" "}
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => preparation.refetch()}
              >
                Tentar de novo
              </Button>
            </p>
          )}
          {priorNote && (
            <details className="rounded-md border border-border px-3 pb-2">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
                Notas da última sessão registrada
              </summary>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm">
                {priorNote.manual_notes}
              </p>
            </details>
          )}
          <div className="flex flex-wrap gap-x-4">
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId }}
              search={{ tab: "intake" }}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              Abrir anamnese
            </Link>
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId }}
              search={{ tab: "patterns" }}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              Conferir evidências
            </Link>
          </div>
        </section>
      )}
      <section className="dossier-session-record">
        <header className="dossier-session-record-head">
          <h2 className="dossier-work-heading">Registro de sessão</h2>
          <div className="flex flex-wrap items-center gap-2">
            {linkedSession && (
              <Button
                variant="forest"
                className="min-h-11"
                onClick={() => {
                  if (clinicalStatusOf(linkedSession) !== "completed") {
                    focusNotes(linkedSession.id);
                    return;
                  }
                  const record = document.getElementById(`session-${linkedSession.id}`);
                  record?.scrollIntoView({ block: "nearest" });
                  record?.focus({ preventScroll: true });
                }}
              >
                {clinicalStatusOf(linkedSession) === "completed"
                  ? "Abrir registro da sessão"
                  : "Registrar sessão sem áudio"}
              </Button>
            )}
            <Button
              variant={linkedSession ? "outline" : "forest"}
              className="min-h-11"
              onClick={() => createManual.mutate()}
              disabled={createManual.isPending || (!!focusedSessionId && (isLoading || isError))}
            >
              <Plus className="mr-2 size-4" /> Nova sessão sem áudio
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setScheduling(true)}>
              <CalendarDays size={16} aria-hidden />
              Agendar sessão
            </Button>
          </div>
        </header>
        <section className="dossier-session-capture" aria-label="Gravação de áudio">
          <h3 className="mb-2 text-base font-semibold text-primary">Gravação de áudio</h3>
          <p className="mb-3 max-w-prose text-sm text-muted-foreground">
            Guarde o áudio no dossiê. O envio para transcrição é uma etapa posterior, com
            autorização própria.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="dossier-session-select block min-w-0 text-sm font-medium">
              Sessão para o áudio
              <select
                className="mt-1 block min-h-11 w-full min-w-0 rounded-sm border border-input bg-background p-2"
                value={recordingTarget}
                onChange={(event) =>
                  setRecordingSelection({ focus: focusedSessionId, id: event.target.value })
                }
                disabled={starting || recording || uploading || !!pendingAudio}
              >
                {targetUnavailable && (
                  <option value={recordingTarget}>
                    {isLoading
                      ? "Carregando sessão selecionada…"
                      : "Sessão indisponível para gravação"}
                  </option>
                )}
                <option value="">Nova sessão</option>
                {targets.map((session) => (
                  <option key={session.id} value={session.id}>
                    {format(new Date(session.session_date), "dd/MM/yyyy HH:mm")} ·{" "}
                    {session.title ?? "Sessão"}
                  </option>
                ))}
              </select>
            </label>
            {recording ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="min-h-11"
                  variant="outline"
                  onClick={() => {
                    const recorder = mediaRecorderRef.current;
                    if (recorder?.state === "paused") recorder.resume();
                    else if (recorder?.state === "recording") recorder.pause();
                  }}
                >
                  {paused ? (
                    <Play className="size-4" aria-hidden />
                  ) : (
                    <Pause className="size-4" aria-hidden />
                  )}
                  {paused ? "Retomar" : "Pausar"}
                </Button>
                <Button
                  className="min-h-11"
                  variant="destructive"
                  onClick={() => {
                    const recorder = mediaRecorderRef.current;
                    if (recorder && recorder.state !== "inactive") recorder.stop();
                  }}
                >
                  <Square className="size-4" aria-hidden /> Finalizar gravação
                </Button>
                <span className="text-sm tabular-nums">{formatDuration(elapsed)}</span>
              </div>
            ) : (
              <Button
                className="min-h-11"
                onClick={() => void startRecording()}
                disabled={!recordingGrant || starting || uploading || !!pendingAudio}
                aria-describedby={!pendingAudio ? "audio-capture-status" : undefined}
              >
                <Mic className="size-4" aria-hidden />
                {starting ? "Preparando gravação…" : "Iniciar gravação"}
              </Button>
            )}
          </div>
          {!pendingAudio && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3">
              <p id="audio-capture-status" role="status" className="text-sm text-muted-foreground">
                {recordingStatus}
              </p>
              {!recordingGrant && !consentQuery.isPending && (
                <Button
                  variant="link"
                  className="min-h-11 px-0"
                  onClick={() => focusAudioConsent(recordingTarget || undefined)}
                >
                  Ver autorizações de áudio
                </Button>
              )}
            </div>
          )}
        </section>
        {operationError && (
          <p role="alert" className="text-sm text-destructive">
            {operationError}
          </p>
        )}
        {pendingAudio && (
          <div className="space-y-3 border-t border-border pt-3">
            <p role="status" className="text-sm text-muted-foreground">
              {uploading
                ? "Enviando o áudio para o dossiê…"
                : `Áudio por guardar · ${formatDuration(pendingAudio.seconds)}`}
              {!uploading &&
                !canUploadPending &&
                !pendingDestinationUnavailable &&
                " · É necessária a autorização usada na gravação."}
            </p>
            {!pendingDestinationUnavailable && (
              <p className="text-sm">
                Destino ·{" "}
                <strong>
                  {pendingAudio.existingSession
                    ? pendingSession?.title || "Sessão existente"
                    : "Nova sessão"}
                </strong>
              </p>
            )}
            <CapturedAudioPlayer blob={pendingAudio.blob} />
            {pendingDestinationUnavailable && (
              <>
                <p className="text-sm text-muted-foreground">
                  A sessão de origem está indisponível. O trecho fica nesta tela.
                  {recoveryTargets.length || canRecoverAsNew
                    ? " Escolha outro destino coberto pela mesma autorização."
                    : " A autorização da gravação ainda não permite guardá-la em outro destino."}
                </p>
                {(recoveryTargets.length > 0 || canRecoverAsNew) && (
                  <label className="grid max-w-md gap-1.5 text-sm">
                    Novo destino da gravação
                    <select
                      className="min-h-11 min-w-0 rounded-sm border border-input bg-background p-2"
                      value=""
                      disabled={uploading}
                      onChange={(event) => {
                        const destination = event.target.value;
                        if (destination)
                          void movePendingAudio(destination).catch((error) =>
                            setOperationError(error.message),
                          );
                      }}
                    >
                      <option value="">Selecione uma sessão</option>
                      {canRecoverAsNew && <option value="new">Nova sessão</option>}
                      {recoveryTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {format(new Date(target.session_date), "dd/MM/yyyy HH:mm")} ·{" "}
                          {target.title ?? "Sessão"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={uploading || !canUploadPending}
                onClick={() => void uploadAudio(pendingAudio).catch(() => {})}
              >
                {uploading ? "Enviando áudio…" : "Guardar áudio no dossiê"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={uploading}
                onClick={() =>
                  void discardAudio().catch((error) => setOperationError(error.message))
                }
              >
                Descartar gravação
              </Button>
            </div>
          </div>
        )}
      </section>

      {scheduling && (
        <Suspense
          fallback={
            <p role="status" className="text-sm">
              Carregando agenda…
            </p>
          }
        >
          <ScheduleDialog
            clientId={clientId}
            clientName={clientName}
            onClose={() => setScheduling(false)}
          />
        </Suspense>
      )}

      <AudioConsentPanel
        clientId={clientId}
        events={events}
        loading={consentQuery.isPending}
        unavailable={consentQuery.isError}
        refresh={() => consentQuery.refetch()}
        initialSessionId={focusedSessionId}
        requestedScope={requestedConsentScope}
        sessions={sessions.map((session) => ({
          id: session.id,
          label: `${format(new Date(session.session_date), "dd/MM/yyyy HH:mm")} · ${session.title || "Sessão"}`,
        }))}
      />

      <AlertDialog
        open={!!processingTarget}
        onOpenChange={(open) => !open && setProcessingTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {processingTarget?.retranscribe
                ? "Transcrever novamente o áudio desta sessão?"
                : processingTranscript
                  ? "Enviar a transcrição para atualizar a síntese?"
                  : "Enviar o áudio para processamento externo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {processingTarget?.retranscribe
                ? "O áudio original será enviado à IA via Lovable. A transcrição e a síntese atuais permanecem disponíveis até a nova versão ser salva."
                : processingTranscript
                  ? "O serviço de IA via Lovable recebe o texto da transcrição, com os trechos corrigidos e sem os descartados."
                  : "Os serviços de IA via Lovable recebem o áudio e a transcrição para gerar texto provisório."}{" "}
              Suas notas manuais ficam no dossiê.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar envio</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={!processingGrant || reprocess.isPending}
              onClick={() => processingTarget && reprocess.mutate(processingTarget)}
            >
              Confirmar envio para IA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="dossier-session-history" aria-labelledby="session-history-title">
        <header>
          <h2 id="session-history-title" className="dossier-work-heading">
            Histórico de sessões
          </h2>
          {!isLoading && !isError && (
            <span>
              {sessions.length} {sessions.length === 1 ? "sessão" : "sessões"}
            </span>
          )}
        </header>

        {isLoading && (
          <div
            className="h-32 animate-pulse rounded-lg bg-muted/30"
            aria-label="Carregando sessões"
          />
        )}

        {isError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-[15px]"
          >
            Não foi possível carregar as sessões.
            <Button variant="outline" size="sm" className="ml-3 min-h-11" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 size-4" /> Tentar de novo
            </Button>
          </div>
        )}

        {!isLoading && !isError && sessions.length === 0 && (
          <p className="dossier-session-empty">Nenhuma sessão registrada.</p>
        )}

        <div className="dossier-session-ledger">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              clientId={clientId}
              onReprocess={(retranscribe) => setProcessingTarget({ sessionId: s.id, retranscribe })}
              onDelete={() => {
                if (
                  s.status === "deleting" ||
                  window.confirm(
                    "Excluir esta sessão, suas notas e o áudio? Isso não pode ser desfeito.",
                  )
                ) {
                  deleteSession.mutate(s.id);
                }
              }}
              deleting={deleteSession.isPending}
              onDiscardUpload={() => clearOrphanUpload.mutate(s)}
              onResumeUpload={() => resumeOrphanUpload.mutate(s)}
              uploadBusy={clearOrphanUpload.isPending || resumeOrphanUpload.isPending}
              showDiscardUpload={pendingAudio?.sessionId !== s.id}
              processingAuthorized={!!grantFor("external_processing", s.id)}
              processingBusy={reprocess.isPending}
              onOpenConsent={() => focusAudioConsent(s.id)}
              recordingAuthorization={events.find(({ id }) => id === s.recording_consent_id)}
              processingAuthorization={events.find(({ id }) => id === s.processing_consent_id)}
              reprocessing={reprocess.isPending && reprocess.variables?.sessionId === s.id}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SessionCard({
  session,
  clientId,
  onReprocess,
  onDelete,
  onDiscardUpload,
  onResumeUpload,
  uploadBusy,
  deleting,
  showDiscardUpload,
  processingAuthorized,
  processingBusy,
  onOpenConsent,
  reprocessing,
  recordingAuthorization,
  processingAuthorization,
}: {
  session: Session;
  clientId: string;
  onReprocess: (retranscribe?: boolean) => void;
  onDelete: () => void;
  onDiscardUpload: () => void;
  onResumeUpload: () => void;
  uploadBusy: boolean;
  deleting: boolean;
  showDiscardUpload: boolean;
  processingAuthorized: boolean;
  processingBusy: boolean;
  onOpenConsent: () => void;
  reprocessing: boolean;
  recordingAuthorization?: ReturnType<typeof activeAudioConsent>;
  processingAuthorization?: ReturnType<typeof activeAudioConsent>;
}) {
  const qc = useQueryClient();

  const note = session.structured_note as Record<string, unknown> | null;
  const clinical = clinicalStatusOf(session);
  const audio = audioStateOf(session);

  // Notas manuais: rascunho em memória; o servidor nunca sobrescreve edição pendente.
  const [draft, dispatch] = useReducer(noteReducer, session.manual_notes, noteDraftInit);
  useEffect(() => dispatch({ type: "reset", saved: session.manual_notes }), [session.manual_notes]);
  const dirty = isDirty(draft);
  const [editingFinalNote, setEditingFinalNote] = useState(false);
  const showNoteEditor = clinical !== "completed" || editingFinalNote || dirty;

  const refresh = () => invalidateSessionViews(qc, clientId);

  const activeNoteSave = useRef<Promise<void> | null>(null);
  const persistNotes = () => {
    if (activeNoteSave.current) return activeNoteSave.current;
    const request = (async () => {
      dispatch({ type: "save_start" });
      const query = supabase
        .from("clinical_sessions")
        .update({ manual_notes: draft.text })
        .eq("id", session.id);
      const matching =
        draft.saved === null
          ? query.is("manual_notes", null)
          : query.eq("manual_notes", draft.saved);
      const { data, error } = await matching.select("manual_notes").maybeSingle();
      if (error || !data) {
        const message =
          error?.message ??
          "A nota mudou em outra sessão. Compare com a versão salva antes de continuar.";
        dispatch({ type: "save_fail", message });
        void refresh();
        throw new Error(message);
      }
      dispatch({ type: "save_ok", persisted: data.manual_notes });
      void refresh();
    })().finally(() => {
      activeNoteSave.current = null;
    });
    activeNoteSave.current = request;
    return request;
  };
  const saveNotes = () => persistNotes().catch(() => {});
  useUnsaved(`note:${session.id}`, {
    label: "Notas da sessão",
    isDirty: () => isDirty(draft) || activeNoteSave.current !== null,
    save: persistNotes,
    discard: async () => {
      const active = activeNoteSave.current;
      if (active) {
        const sent = await active.then(
          () => true,
          () => false,
        );
        if (sent) toast.info("O envio em andamento das notas foi confirmado.");
      }
      dispatch({ type: "discard" });
    },
  });

  const [reviewState, setReviewState] = useState<{ pending: boolean; error?: string }>({
    pending: false,
  });
  const review = async () => {
    setReviewState({ pending: true });
    const r = await confirmReview(async () => {
      const { data, error } = await supabase
        .from("clinical_sessions")
        .update({ ai_reviewed_at: new Date().toISOString() })
        .eq("id", session.id)
        .eq("updated_at", session.updated_at)
        .eq("summary_stale", false)
        .eq("status", "ready")
        .select("ai_reviewed_at")
        .maybeSingle();
      if (error) throw error;
      return data;
    });
    setReviewState({ pending: false, error: r.error });
    if (r.reviewed) refresh();
  };

  const setClinical = useMutation({
    mutationFn: async (value: ClinicalStatus) => {
      const { error } = await supabase
        .from("clinical_sessions")
        .update({ clinical_status: value })
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao mudar estado"),
  });

  const rows = useMemo(() => {
    if (!note) return [];
    return [
      ["Resumo", note.resumo],
      ["Queixa", note.queixa_principal],
      ["Fatos relatados", note.fatos_relatados],
      ["Hipóteses sistêmicas", note.hipoteses_sistemicas],
      ["Padrões observados", note.padroes_observados],
      ["Figuras do clã mencionadas", note.figuras_do_cla_mencionadas],
      ["Eventos significativos", note.eventos_significativos],
      ["Encaminhamentos", note.encaminhamentos],
      ["Próxima sessão", note.proxima_sessao],
    ].filter(([, v]) => v && (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0));
  }, [note]);

  const isProcessing = audio === "processing";
  const audioLabel =
    session.status === "transcribing" && isProcessing
      ? "Transcrevendo áudio"
      : session.status === "structuring" && isProcessing
        ? "Preparando texto para revisão"
        : AUDIO_LABEL[audio];
  const canRetry = canRetryAudioProcessing(
    session.status,
    session.processing_started_at,
    session.updated_at,
    Date.now(),
    session.summary_stale,
  );
  const canRetranscribe = canRetranscribeSession(session);
  const isError = audio === "error";
  const notesId = `notes-${session.id}`;
  const clinicalId = `clinical-${session.id}`;

  if (session.status === "deleting") {
    return (
      <article
        id={`session-${session.id}`}
        tabIndex={-1}
        className="dossier-session-entry scroll-mt-24"
      >
        <div className="space-y-2 p-4 sm:p-6">
          <h3 className="text-base font-semibold text-primary">{session.title ?? "Sessão"}</h3>
          <p role="status" className="text-sm text-muted-foreground">
            Exclusão pendente. O registro permanece nesta lista até a confirmação da remoção do
            áudio e da sessão.
          </p>
          <Button className="min-h-11" variant="outline" onClick={onDelete} disabled={deleting}>
            {deleting ? "Excluindo…" : "Retomar exclusão"}
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article
      id={`session-${session.id}`}
      tabIndex={-1}
      aria-labelledby={`session-title-${session.id}`}
      className="dossier-session-entry scroll-mt-24"
    >
      <div className="dossier-session-entry-head">
        <div>
          <p className="text-[14px] font-semibold text-muted-foreground mb-1">
            {format(new Date(session.session_date), "dd 'de' MMMM 'de' yyyy, HH:mm", {
              locale: ptBR,
            })}
          </p>
          <h3 id={`session-title-${session.id}`} className="text-lg font-semibold text-primary">
            {session.title ?? "Sessão"}
          </h3>
          {session.audio_path && (
            <p className="text-[14px] text-muted-foreground mt-1 flex items-center gap-2">
              <Mic className="size-3.5" aria-hidden />
              {formatDuration(session.duration_seconds)} de áudio
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor={clinicalId} className="text-[13px] text-muted-foreground">
              Estado clínico
            </label>
            <select
              id={clinicalId}
              className="h-11 rounded-md border border-input bg-background px-2 text-[14px]"
              value={clinical}
              disabled={setClinical.isPending || clinical === "canceled"}
              onChange={(e) => setClinical.mutate(e.target.value as ClinicalStatus)}
            >
              {(Object.keys(CLINICAL_LABEL) as ClinicalStatus[])
                .filter(
                  (status) =>
                    status === clinical || (status !== "scheduled" && status !== "canceled"),
                )
                .map((status) => (
                  <option key={status} value={status}>
                    {CLINICAL_LABEL[status]}
                  </option>
                ))}
            </select>
          </div>
          <Badge variant="outline" className="text-[13px] font-semibold" role="status">
            {isProcessing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            {audioLabel}
          </Badge>
          <div className="flex items-center gap-1 border-l border-border/60 pl-3">
            {canRetry && session.audio_path && (
              <Button
                variant="outline"
                onClick={() => onReprocess()}
                disabled={!processingAuthorized || processingBusy}
                aria-describedby={
                  !processingAuthorized ? `processing-consent-${session.id}` : undefined
                }
                className="min-h-11"
              >
                <AudioLines className="mr-2 size-4" aria-hidden />
                {reprocessing
                  ? "Processando…"
                  : session.summary_stale || session.transcript
                    ? "Gerar síntese da transcrição"
                    : isProcessing
                      ? "Retomar processamento"
                      : "Processar áudio com IA"}
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={deleting}
              aria-label="Excluir sessão"
              className="min-h-11 min-w-11"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {(canRetry || canRetranscribe) && session.audio_path && !processingAuthorized && (
          <div className="flex flex-wrap items-center gap-x-3">
            <p id={`processing-consent-${session.id}`} className="text-sm text-muted-foreground">
              O processamento exige autorização para envio à IA.
            </p>
            <Button variant="link" className="min-h-11 px-0" onClick={onOpenConsent}>
              Ver autorizações de áudio
            </Button>
          </div>
        )}
        {(recordingAuthorization || processingAuthorization) && (
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium text-primary">
              Autorizações usadas nesta sessão
            </summary>
            <dl className="space-y-2 text-muted-foreground">
              {[
                { label: "Gravação", grant: recordingAuthorization },
                { label: "Processamento", grant: processingAuthorization },
              ].map(
                ({ label, grant }) =>
                  grant && (
                    <div key={label}>
                      <dt className="font-semibold text-foreground">{label}</dt>
                      <dd>
                        {format(new Date(grant.created_at), "dd/MM/yyyy HH:mm")}
                        {grant.term_version && ` · termo ${grant.term_version}`}
                        {grant.session_id ? " · esta sessão" : " · caso inteiro"}
                      </dd>
                      {grant.document_reference && (
                        <dd className="break-words">{grant.document_reference}</dd>
                      )}
                    </div>
                  ),
              )}
            </dl>
          </details>
        )}
        {audio === "waiting_upload" && showDiscardUpload && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-background p-3 text-sm">
            <p className="text-muted-foreground">
              Etapa de armazenamento pendente. Confira se o arquivo já chegou ou libere a sessão
              para outra gravação.
            </p>
            {session.status === "awaiting_upload" && (
              <Button className="min-h-11" onClick={onResumeUpload} disabled={uploadBusy}>
                Confirmar áudio já enviado
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              onClick={onDiscardUpload}
              disabled={uploadBusy}
            >
              Remover envio pendente
            </Button>
          </div>
        )}
        {isProcessing && canRetry && (
          <p
            role="status"
            className="rounded-md border border-border p-3 text-sm text-clinical-warning"
          >
            O processamento está sem conclusão há mais de dez minutos. Você pode retomá-lo.
          </p>
        )}
        {isError && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-[14px] text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>
              {session.error_message ?? "Falha ao processar o áudio."} Suas notas abaixo não são
              afetadas.
            </span>
          </div>
        )}

        {/* Notas da profissional — independentes do áudio */}
        {showNoteEditor ? (
          <div className="space-y-2">
            <label htmlFor={notesId} className="text-[15px] font-semibold text-primary">
              Notas manuais
            </label>
            <p id={`${notesId}-help`} className="text-sm text-muted-foreground">
              Salve suas anotações para registrá-las no dossiê.
            </p>
            <Textarea
              id={notesId}
              aria-describedby={`${notesId}-help ${notesId}-status`}
              value={draft.text}
              onChange={(e) => dispatch({ type: "edit", text: e.target.value })}
              className="min-h-[140px] text-[16px] leading-relaxed"
            />
            {dirty && draft.saved !== draft.server && (
              <details className="space-y-2 rounded-md border border-border p-3">
                <summary className="cursor-pointer font-semibold">
                  Ver versão salva em outra aba
                </summary>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {draft.server || "A outra versão está sem notas."}
                </p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => dispatch({ type: "discard" })}
                >
                  Usar versão salva
                </Button>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-3 text-[14px]">
              <Button
                onClick={saveNotes}
                disabled={!dirty || draft.phase === "saving"}
                className="min-h-11"
              >
                {draft.phase === "saving" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {draft.phase === "error" ? "Tentar salvar de novo" : "Salvar notas"}
              </Button>
              <span
                id={`${notesId}-status`}
                role="status"
                className={draft.phase === "error" ? "text-destructive" : "text-muted-foreground"}
              >
                {draft.phase === "error"
                  ? (draft.error ?? "Falha ao salvar as notas. O texto continua aqui.")
                  : draft.phase === "saving"
                    ? "Salvando notas…"
                    : dirty
                      ? "Notas com alterações pendentes"
                      : draft.saved
                        ? "Notas salvas no dossiê"
                        : "Sem notas salvas"}
              </span>
            </div>
          </div>
        ) : (
          <section className="space-y-2" aria-label="Notas da sessão concluída">
            <p className="text-[15px] font-semibold text-primary">Notas manuais</p>
            <p className="whitespace-pre-wrap break-words text-[15px]">
              {session.manual_notes?.trim() || "Sem notas manuais registradas."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setEditingFinalNote(true);
                requestAnimationFrame(() => document.getElementById(notesId)?.focus());
              }}
            >
              Editar notas
            </Button>
          </section>
        )}

        {rows.length > 0 && (
          <section
            aria-label="Texto gerado a partir do áudio"
            className="space-y-4 border-t border-border/40 pt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-primary">
                Texto gerado pela IA{" "}
                {session.summary_stale
                  ? "· desatualizado"
                  : session.ai_reviewed_at
                    ? "· revisado"
                    : "· provisório, requer revisão"}
              </p>
              {session.summary_stale ? (
                <p role="status" className="text-sm text-clinical-warning">
                  A transcrição mudou. Gere uma nova síntese e revise o resultado.
                </p>
              ) : session.ai_reviewed_at ? (
                <span className="flex items-center gap-1.5 text-[14px] text-clinical-positive">
                  <CheckCircle2 className="size-4" /> Revisado em{" "}
                  {format(new Date(session.ai_reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={review}
                  disabled={reviewState.pending || session.status !== "ready"}
                >
                  {reviewState.pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Li e revisei este texto
                </Button>
              )}
            </div>
            {reviewState.error && (
              <p role="alert" className="text-[14px] text-destructive">
                {reviewState.error}
              </p>
            )}
            <div
              className={`grid gap-4 md:grid-cols-2 ${session.ai_reviewed_at ? "" : "opacity-90"}`}
            >
              {rows.map(([label, value]) => (
                <div
                  key={label as string}
                  className="bg-background border border-border/40 p-4 rounded-sm"
                >
                  <p className="text-[14px] font-semibold text-bronze mb-2">{label as string}</p>
                  {Array.isArray(value) ? (
                    <ul className="list-disc list-inside space-y-1.5 text-[15px] leading-relaxed text-foreground">
                      {(value as unknown[]).map((v, i) => (
                        <li key={i}>{String(v)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                      {String(value)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {session.audio_path && !session.transcript && audio !== "waiting_upload" && (
          <SavedAudioPlayer sessionId={session.id} audioPath={session.audio_path} />
        )}
        {session.transcript && (
          <TranscriptReview
            sessionId={session.id}
            clientId={clientId}
            transcript={session.transcript}
            segments={session.transcript_segments}
            reviews={session.transcript_reviews}
            audioPath={session.audio_path}
            updatedAt={session.updated_at}
            processing={session.status !== "ready" && session.status !== "error"}
            completed={clinical === "completed"}
            onRetranscribe={canRetranscribe ? () => onReprocess(true) : undefined}
            retranscribeDisabled={!processingAuthorized || processingBusy}
            refresh={refresh}
          />
        )}
      </div>
    </article>
  );
}
