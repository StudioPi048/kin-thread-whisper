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
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mic,
  Square,
  Loader2,
  Trash2,
  FileText,
  AlertCircle,
  RefreshCw,
  AudioLines,
  Save,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { processSessionAudio } from "@/lib/ai/session-processing.functions";
import { Button } from "@/components/ui/button";
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
}

type Session = {
  id: string;
  session_date: string;
  title: string | null;
  duration_seconds: number | null;
  audio_path: string | null;
  transcript: string | null;
  status: string;
  error_message: string | null;
  structured_note: Record<string, unknown> | null;
  clinical_status: string | null;
  manual_notes: string | null;
  ai_reviewed_at: string | null;
};

type CapturedAudio = {
  sessionId: string;
  existingSession: boolean;
  recordingGrantId: string;
  blob: Blob;
  seconds: number;
  fileId: string;
  path?: string;
};

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

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionsPanel({ clientId, clientName, focusedSessionId }: Props) {
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
  const recordingGrant = !consentQuery.isError && activeAudioConsent(events, "recording");
  const processingGrant =
    !consentQuery.isError && activeAudioConsent(events, "external_processing");
  const [pendingAudio, setPendingAudio] = useState<CapturedAudio | null>(null);
  const pendingAudioRef = useRef<CapturedAudio | null>(null);
  const updatePending = (audio: CapturedAudio | null) => {
    pendingAudioRef.current = audio;
    setPendingAudio(audio);
  };

  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [manualFocusId, setManualFocusId] = useState<string>();
  const [recordingTarget, setRecordingTarget] = useState(focusedSessionId ?? "");
  const targets = sessions.filter(
    (session) => !session.audio_path && clinicalStatusOf(session) !== "canceled",
  );
  const targetId = targets.some((session) => session.id === recordingTarget) ? recordingTarget : "";
  const [processingTarget, setProcessingTarget] = useState<string>();
  const mountedRef = useRef(false);
  const startLock = useRef(false);
  const audioLock = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeGrantRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const refreshSessions = () => invalidateSessionViews(qc, clientId);

  const clearRecorder = useCallback((discard: boolean) => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    activeGrantRef.current = null;
    if (recorder) {
      if (discard) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mountedRef.current) setRecording(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecorder(true);
    };
  }, [clearRecorder]);

  useEffect(() => {
    if (
      mediaRecorderRef.current &&
      activeGrantRef.current !== (recordingGrant ? recordingGrant.id : null)
    ) {
      clearRecorder(true);
      setOperationError("Gravação interrompida. Confirme a autorização antes de gravar novamente.");
    }
  }, [recordingGrant, clearRecorder]);

  useEffect(() => {
    const target = manualFocusId ?? focusedSessionId;
    if (!target || !sessions.some(({ id }) => id === target)) return;
    document.getElementById(`session-${target}`)?.scrollIntoView({ block: "nearest" });
  }, [focusedSessionId, manualFocusId, sessions.length]);

  const startRecording = async () => {
    if (startLock.current || mediaRecorderRef.current || pendingAudioRef.current || !recordingGrant)
      return;
    startLock.current = true;
    setStarting(true);
    setOperationError("");
    let stream: MediaStream | undefined;
    try {
      await requireAudioConsent(supabase, clientId, "recording", recordingGrant.id);
      if (!mountedRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("O microfone não está disponível neste navegador.");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await requireAudioConsent(supabase, clientId, "recording", recordingGrant.id);
      if (!mountedRef.current) return;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const startedAt = Date.now();
      const parts: Blob[] = [];
      recorder.ondataavailable = ({ data }) => {
        if (data.size) parts.push(data);
      };
      recorder.onerror = () => {
        clearRecorder(true);
        setOperationError("O microfone foi interrompido. Inicie outra gravação.");
      };
      recorder.onstop = () => {
        if (!mountedRef.current) return;
        clearRecorder(false);
        const blob = new Blob(parts, { type: recorder.mimeType || parts[0]?.type });
        if (!blob.size) {
          setOperationError("A gravação ficou vazia. Inicie outra gravação.");
          return;
        }
        updatePending({
          blob,
          seconds: Math.floor((Date.now() - startedAt) / 1000),
          sessionId: targetId || crypto.randomUUID(),
          existingSession: !!targetId,
          recordingGrantId: recordingGrant.id,
          fileId: crypto.randomUUID(),
        });
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      stream = undefined;
      activeGrantRef.current = recordingGrant.id;
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(
        () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
        1000,
      );
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
      await requireAudioConsent(supabase, clientId, "recording", audio.recordingGrantId);
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (userError || !uid) throw new Error("Entre novamente para guardar o áudio.");
      const extension = audio.blob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${uid}/${clientId}/${audio.sessionId}/${audio.fileId}.${extension}`;
      audio.path = path;

      const { data: existing, error: readError } = await supabase
        .from("clinical_sessions")
        .select("id, audio_path, status")
        .eq("id", audio.sessionId)
        .eq("client_id", clientId)
        .eq("user_id", uid)
        .maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a sessão.");
      if (existing?.audio_path && existing.audio_path !== path)
        throw new Error("A sessão já tem outro áudio.");
      if (existing?.status === "discarding_upload")
        throw new Error("A remoção do arquivo pendente está em andamento.");
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
        if (error || !data) throw new Error("O áudio da sessão mudou. Confira antes de reenviar.");
      }
      if (existing?.status === "awaiting_upload" || existing?.audio_path !== path) {
        const bucket = supabase.storage.from("session-audio");
        const { error } = await bucket.upload(path, audio.blob, {
          contentType: audio.blob.type,
          upsert: false,
        });
        // A prior attempt may have written the object while the response was lost.
        if (error) {
          const info = await bucket.info(path);
          if (info.error || !info.data) throw new Error("Falha no envio. Tente novamente.");
        }
        const { data, error: finishError } = await supabase
          .from("clinical_sessions")
          .update({ status: "draft", error_message: null })
          .eq("id", audio.sessionId)
          .eq("audio_path", path)
          .eq("status", "awaiting_upload")
          .select("id")
          .maybeSingle();
        if (finishError || !data)
          throw new Error("O áudio foi enviado, mas falta confirmar na sessão.");
      }

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
    clearRecorder(true);
    const audio = pendingAudioRef.current;
    if (audio?.path) {
      audioLock.current = true;
      setUploading(true);
      try {
        const { data: row, error: readError } = await supabase
          .from("clinical_sessions")
          .select("status, audio_path")
          .eq("id", audio.sessionId)
          .maybeSingle();
        if (readError) throw new Error("Não foi possível verificar o áudio pendente.");
        if (
          row?.audio_path === audio.path &&
          (row.status === "awaiting_upload" || row.status === "discarding_upload")
        ) {
          await clearPendingUpload(audio.sessionId, audio.path);
          void refreshSessions();
        }
      } finally {
        setUploading(false);
        audioLock.current = false;
      }
    }
    updatePending(null);
    setOperationError("");
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
    mutationFn: (sessionId: string) => processFn({ data: { sessionId } }),
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

  const deleteSession = useMutation({
    mutationFn: async (session: Session) => {
      if (session.audio_path) {
        const { error } = await supabase.storage.from("session-audio").remove([session.audio_path]);
        if (error)
          throw new Error("Não foi possível remover o áudio. A sessão continua no dossiê.");
      }
      const { data, error } = await supabase
        .from("clinical_sessions")
        .delete()
        .eq("id", session.id)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error(
          session.audio_path
            ? "O áudio foi removido. A sessão continua no dossiê e pode ser excluída novamente."
            : "Não foi possível remover a sessão.",
        );
      }
    },
    onSuccess: () => {
      void refreshSessions();
      toast.success("Sessão removida");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-sm border border-border bg-surface-document p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl font-bold text-primary">Registro de sessão</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Faça anotações ou grave um relato com autorização.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => createManual.mutate()}
              disabled={createManual.isPending}
            >
              <Plus className="mr-2 size-4" /> Registrar sessão sem áudio
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setScheduling(true)}>
              Agendar sessão
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-0 text-sm font-medium">
            Sessão para o áudio
            <select
              className="mt-1 block min-h-11 max-w-full rounded-sm border border-input bg-background p-2"
              value={targetId}
              onChange={(event) => setRecordingTarget(event.target.value)}
              disabled={starting || recording || uploading || !!pendingAudio}
            >
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
            <Button
              className="min-h-11"
              variant="destructive"
              onClick={() => {
                const recorder = mediaRecorderRef.current;
                if (recorder?.state === "recording") recorder.stop();
              }}
            >
              <Square className="mr-2 size-4" /> Parar gravação · {formatDuration(elapsed)}
            </Button>
          ) : (
            <Button
              className="min-h-11"
              onClick={() => void startRecording()}
              disabled={!recordingGrant || starting || uploading || !!pendingAudio}
            >
              <Mic className="mr-2 size-4" />
              {starting ? "Confirmando autorização…" : "Iniciar gravação"}
            </Button>
          )}
        </div>
        {operationError && (
          <p role="alert" className="text-sm text-destructive">
            {operationError}
          </p>
        )}
        {pendingAudio && (
          <div className="space-y-3 border-t border-border pt-3">
            <p role="status" className="text-sm text-muted-foreground">
              Gravação pronta · {formatDuration(pendingAudio.seconds)}. Guarde o áudio antes de sair
              da página.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-11"
                disabled={
                  uploading ||
                  !recordingGrant ||
                  recordingGrant.id !== pendingAudio.recordingGrantId
                }
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
      />

      <AlertDialog
        open={!!processingTarget}
        onOpenChange={(open) => !open && setProcessingTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar o áudio para processamento externo?</AlertDialogTitle>
            <AlertDialogDescription>
              Os serviços de IA via Lovable recebem o áudio e a transcrição para gerar texto
              provisório. Suas notas manuais ficam no dossiê.
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

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <h3 className="font-serif text-2xl font-bold text-primary">Histórico de Sessões</h3>
        </div>

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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-sm border border-dashed border-border bg-forest-soft/40 p-16 text-center"
          >
            <img
              src="/assets/renders/tinteiro-pena.jpg"
              alt=""
              aria-hidden
              loading="lazy"
              className="mx-auto w-[170px] mix-blend-darken [mask-image:radial-gradient(120%_120%_at_50%_45%,black_58%,transparent_90%)]"
            />
            <p className="mt-4 font-serif text-2xl font-bold text-primary">
              Nenhuma sessão registrada
            </p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Use o registro manual ou guarde um relato de áudio autorizado.
            </p>
          </motion.div>
        )}

        <motion.div
          className="grid gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
        >
          {sessions.map((s) => (
            <motion.div
              key={s.id}
              variants={{
                hidden: { opacity: 0, y: 15 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 300, damping: 24 },
                },
              }}
            >
              <SessionCard
                session={s}
                clientId={clientId}
                onReprocess={() => setProcessingTarget(s.id)}
                onDelete={() => {
                  if (
                    window.confirm(
                      "Excluir esta sessão, suas notas e o áudio? Isso não pode ser desfeito.",
                    )
                  ) {
                    deleteSession.mutate(s);
                  }
                }}
                onDiscardUpload={() => clearOrphanUpload.mutate(s)}
                discardingUpload={clearOrphanUpload.isPending}
                showDiscardUpload={pendingAudio?.sessionId !== s.id}
                canProcess={!!processingGrant && !reprocess.isPending}
                reprocessing={reprocess.isPending && reprocess.variables === s.id}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  clientId,
  onReprocess,
  onDelete,
  onDiscardUpload,
  discardingUpload,
  showDiscardUpload,
  canProcess,
  reprocessing,
}: {
  session: Session;
  clientId: string;
  onReprocess: () => void;
  onDelete: () => void;
  onDiscardUpload: () => void;
  discardingUpload: boolean;
  showDiscardUpload: boolean;
  canProcess: boolean;
  reprocessing: boolean;
}) {
  const qc = useQueryClient();
  const [showTranscript, setShowTranscript] = useState(false);
  const note = session.structured_note as Record<string, unknown> | null;
  const clinical = clinicalStatusOf(session);
  const audio = audioStateOf(session);

  // Notas manuais: rascunho em memória; o servidor nunca sobrescreve edição pendente.
  const [draft, dispatch] = useReducer(noteReducer, session.manual_notes, noteDraftInit);
  useEffect(
    () => dispatch({ type: "reset", saved: session.manual_notes ?? "" }),
    [session.manual_notes],
  );
  const dirty = isDirty(draft);

  const refresh = () => invalidateSessionViews(qc, clientId);

  /** Lança erro se o banco não confirmou (o texto continua na tela). */
  const persistNotes = async () => {
    const text = draft.text;
    dispatch({ type: "save_start" });
    const { data, error } = await supabase
      .from("clinical_sessions")
      .update({ manual_notes: text })
      .eq("id", session.id)
      .select("manual_notes")
      .maybeSingle();
    if (error || !data) {
      const message = error?.message ?? "Sem permissão para salvar.";
      dispatch({ type: "save_fail", message });
      throw new Error(message);
    }
    dispatch({ type: "save_ok", persisted: data.manual_notes ?? "" });
    refresh();
  };
  const saveNotes = () => persistNotes().catch(() => {});
  useUnsaved(`note:${session.id}`, {
    label: "Notas da sessão",
    isDirty: () => isDirty(draft) || draft.phase === "saving",
    save: persistNotes,
    discard: () => dispatch({ type: "discard" }),
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
  const isError = audio === "error";
  const notesId = `notes-${session.id}`;
  const clinicalId = `clinical-${session.id}`;

  return (
    <article
      id={`session-${session.id}`}
      className="scroll-mt-24 rounded-sm border border-border bg-surface-document shadow-sm overflow-hidden accent-bar-forest"
    >
      <div className="border-b border-border/40 bg-background/50 px-6 py-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-muted-foreground mb-1">
            {format(new Date(session.session_date), "dd 'de' MMMM 'de' yyyy, HH:mm", {
              locale: ptBR,
            })}
          </p>
          <h4 className="font-serif text-2xl font-bold text-primary">
            {session.title ?? "Sessão"}
          </h4>
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
          <Badge
            variant="outline"
            className="text-[13px] font-semibold"
            aria-label={`Áudio: ${AUDIO_LABEL[audio]}`}
          >
            {isProcessing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            Áudio: {AUDIO_LABEL[audio]}
          </Badge>
          <div className="flex items-center gap-1 border-l border-border/60 pl-3">
            {(isError || session.status === "draft") && session.audio_path && (
              <Button
                variant="outline"
                onClick={onReprocess}
                disabled={!canProcess || reprocessing}
                className="min-h-11"
              >
                <AudioLines className="mr-2 size-4" aria-hidden />
                Processar áudio com IA
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label="Excluir sessão"
              className="min-h-11 min-w-11"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {audio === "waiting_upload" && showDiscardUpload && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-background p-3 text-sm">
            <p className="text-muted-foreground">
              Envio de áudio incompleto. Você pode liberar a sessão para uma nova gravação.
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={onDiscardUpload}
              disabled={discardingUpload}
            >
              {discardingUpload ? "Removendo…" : "Remover envio pendente"}
            </Button>
          </div>
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
        <div className="space-y-2">
          <label htmlFor={notesId} className="text-[15px] font-semibold text-primary">
            Notas da sessão
          </label>
          <Textarea
            id={notesId}
            value={draft.text}
            onChange={(e) => dispatch({ type: "edit", text: e.target.value })}
            placeholder="Registro da profissional. Fica separado do texto gerado pelo áudio."
            className="min-h-[140px] text-[16px] leading-relaxed"
          />
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
              role="status"
              className={draft.phase === "error" ? "text-destructive" : "text-muted-foreground"}
            >
              {draft.phase === "error"
                ? `Não salvo: ${draft.error}. O texto continua aqui.`
                : draft.phase === "saving"
                  ? "Salvando…"
                  : dirty
                    ? "Alterações não salvas"
                    : draft.saved
                      ? "Salvo"
                      : ""}
            </span>
          </div>
        </div>

        {rows.length > 0 && (
          <section
            aria-label="Texto gerado a partir do áudio"
            className="space-y-4 border-t border-border/40 pt-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-primary">
                Texto gerado pela IA{" "}
                {session.ai_reviewed_at ? "· revisado" : "· provisório, requer revisão"}
              </p>
              {session.ai_reviewed_at ? (
                <span className="flex items-center gap-1.5 text-[14px] text-clinical-positive">
                  <CheckCircle2 className="size-4" /> Revisado em{" "}
                  {format(new Date(session.ai_reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              ) : (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={review}
                  disabled={reviewState.pending || isProcessing}
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

        {session.transcript && (
          <div className="border-t border-border/40 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscript((v) => !v)}
              className="min-h-11 text-[15px]"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showTranscript ? "Ocultar" : "Ver"} transcrição automática
            </Button>
            {showTranscript && (
              <Textarea
                readOnly
                aria-label="Transcrição da sessão"
                value={session.transcript}
                className="mt-3 font-mono text-[15px] min-h-[160px] bg-background resize-none text-muted-foreground"
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
