import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AUDIO_LABEL,
  CLINICAL_LABEL,
  audioStateOf,
  clinicalStatusOf,
  confirmReview,
  isDirty,
  noteDraftInit,
  noteReducer,
  type ClinicalStatus,
} from "@/lib/session-state";

interface Props {
  clientId: string;
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

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  transcribing: "Transcrevendo…",
  structuring: "Estruturando prontuário…",
  ready: "Pronto",
  error: "Erro",
};

function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionsPanel({ clientId }: Props) {
  const qc = useQueryClient();
  const processFn = useServerFn(processSessionAudio);

  const { data: sessions = [], isLoading, isError, refetch } = useQuery({
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

  // ---- Proteção de saída: notas não salvas ----
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; mime: string; seconds: number } | null>(null);
  useEffect(() => {
    if (dirtyIds.size === 0 && !pendingAudio) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyIds, pendingAudio]);

  // ---- Recorder state ----
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(
    () => () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => void handleStop(mime);
      mr.start(1000);
      mediaRecorderRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
    } catch (e) {
      toast.error("Não foi possível acessar o microfone");
      console.error(e);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.stop();
    mr.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
  };

  const handleStop = async (mime: string) => {
    const blob = new Blob(chunksRef.current, { type: mime });
    const durationSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
    if (blob.size < 1024) {
      toast.error("Gravação muito curta");
      return;
    }
    await uploadAudio(blob, mime, durationSeconds);
  };

  // O áudio fica em memória até o envio ser confirmado; falha permite reenviar.
  const uploadAudio = async (blob: Blob, mime: string, durationSeconds: number) => {
    setPendingAudio({ blob, mime, seconds: durationSeconds });
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const sessionId = crypto.randomUUID();
      const path = `${uid}/${clientId}/${sessionId}.webm`;

      const upload = await supabase.storage
        .from("session-audio")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upload.error) throw upload.error;

      const insert = await supabase
        .from("clinical_sessions")
        .insert({
          id: sessionId,
          client_id: clientId,
          user_id: uid,
          audio_path: path,
          duration_seconds: durationSeconds,
          title: `Sessão de ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
          status: "draft",
          clinical_status: "pending_record",
        })
        .select()
        .single();
      if (insert.error) throw insert.error;

      setPendingAudio(null);
      qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
      toast.success("Áudio salvo. Processando texto provisório…");

      // Fire off processing (non-blocking)
      processFn({ data: { sessionId } }).catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Falha ao processar áudio");
        qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
      });
    } catch (e) {
      toast.error(
        `${e instanceof Error ? e.message : "Falha no envio"}. O áudio continua nesta página — use "Reenviar áudio".`,
      );
    } finally {
      setUploading(false);
    }
  };

  const reprocess = useMutation({
    mutationFn: async (sessionId: string) => {
      await processFn({ data: { sessionId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reprocessar"),
  });

  const createManual = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const { error } = await supabase.from("clinical_sessions").insert({
        client_id: clientId,
        user_id: uid,
        title: `Sessão de ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`,
        status: "ready",
        clinical_status: "pending_record",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar registro"),
  });

  const deleteSession = useMutation({
    mutationFn: async (s: Session) => {
      if (!window.confirm("Excluir esta sessão, suas notas e o áudio? Isso não pode ser desfeito.")) return;
      if (s.audio_path) {
        await supabase.storage.from("session-audio").remove([s.audio_path]);
      }
      const { error } = await supabase.from("clinical_sessions").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
      toast.success("Sessão removida");
    },
  });

  return (
    <div className="space-y-8">
      {/* Recorder Panel - Editorial Style */}
      <section className="rounded-sm border-2 border-forest bg-forest text-white shadow-lg relative overflow-hidden">
        {/* Constelação familiar — textura de fundo do painel floresta */}
        <img
          src="/assets/renders/constelacao-floresta.jpg"
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-45 mix-blend-screen"
        />
        <div className="p-8 md:p-10 relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-serif text-3xl font-bold">Gravar Relato da Sessão</h3>
            <p className="text-sm text-white/90 mt-2 max-w-xl leading-relaxed">
              Grave suas observações logo após o término da sessão. A inteligência transcreverá e
              extrairá automaticamente fatos, hipóteses sistêmicas e figuras mencionadas para o
              prontuário.
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            {recording ? (
              <div className="flex items-center gap-4 bg-white/10 px-6 py-4 rounded-md border border-white/20">
                <span className="inline-flex items-center gap-2 text-2xl font-mono font-bold text-forest-mid">
                  <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                  {formatDuration(elapsed)}
                </span>
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  className="bg-destructive border-transparent text-white hover:bg-destructive/90 transition-colors h-12 px-6"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </div>
            ) : (
              <Button
                onClick={startRecording}
                disabled={uploading}
                variant="hero"
                className="h-14 px-8 text-[14px]"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5 mr-3" />
                )}
                {uploading ? "Enviando áudio…" : "Iniciar gravação"}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* History */}
      {pendingAudio && !uploading && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-[15px]">
          <AlertCircle className="size-5 text-destructive" />
          <span className="flex-1">O áudio não foi enviado e continua guardado nesta página. Não feche a aba.</span>
          <Button
            className="min-h-11"
            onClick={() => void uploadAudio(pendingAudio.blob, pendingAudio.mime, pendingAudio.seconds)}
          >
            <RefreshCw className="mr-2 size-4" /> Reenviar áudio
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setPendingAudio(null)}>
            Descartar
          </Button>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <h3 className="font-serif text-2xl font-bold text-primary">Histórico de Sessões</h3>
          <Button variant="outline" className="min-h-11" onClick={() => createManual.mutate()} disabled={createManual.isPending}>
            <Plus className="mr-2 size-4" /> Registrar sessão sem áudio
          </Button>
        </div>

        {isLoading && <div className="h-32 animate-pulse rounded-lg bg-muted/30" aria-label="Carregando sessões" />}

        {isError && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-[15px]">
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
              Nenhuma sessão gravada
            </p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Os registros de voz são transformados em anotações estruturadas automaticamente.
              Experimente iniciar uma gravação.
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
                onDirtyChange={setDirty}
                onReprocess={() => reprocess.mutate(s.id)}
                onDelete={() => deleteSession.mutate(s)}
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
  onDirtyChange,
  onReprocess,
  onDelete,
  reprocessing,
}: {
  session: Session;
  clientId: string;
  onDirtyChange: (id: string, dirty: boolean) => void;
  onReprocess: () => void;
  onDelete: () => void;
  reprocessing: boolean;
}) {
  const qc = useQueryClient();
  const [showTranscript, setShowTranscript] = useState(false);
  const note = session.structured_note as Record<string, unknown> | null;
  const clinical = clinicalStatusOf(session);
  const audio = audioStateOf(session);

  // Notas manuais: rascunho em memória; o servidor nunca sobrescreve edição pendente.
  const [draft, dispatch] = useReducer(noteReducer, session.manual_notes, noteDraftInit);
  useEffect(() => dispatch({ type: "reset", saved: session.manual_notes ?? "" }), [session.manual_notes]);
  const dirty = isDirty(draft);
  useEffect(() => onDirtyChange(session.id, dirty), [dirty, session.id, onDirtyChange]);
  useEffect(() => () => onDirtyChange(session.id, false), [session.id, onDirtyChange]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });

  const saveNotes = async () => {
    const text = draft.text;
    dispatch({ type: "save_start" });
    const { data, error } = await supabase
      .from("clinical_sessions")
      .update({ manual_notes: text })
      .eq("id", session.id)
      .select("manual_notes")
      .maybeSingle();
    if (error || !data) {
      dispatch({ type: "save_fail", message: error?.message ?? "Sem permissão para salvar." });
      return;
    }
    dispatch({ type: "save_ok", persisted: data.manual_notes ?? "" });
    refresh();
  };

  const [reviewState, setReviewState] = useState<{ pending: boolean; error?: string }>({ pending: false });
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
      const { error } = await supabase.from("clinical_sessions").update({ clinical_status: value }).eq("id", session.id);
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
    <article className="rounded-sm border border-border bg-surface-document shadow-sm overflow-hidden accent-bar-forest">
      <div className="border-b border-border/40 bg-background/50 px-6 py-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-muted-foreground mb-1">
            {format(new Date(session.session_date), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
          </p>
          <h4 className="font-serif text-2xl font-bold text-primary">{session.title ?? "Sessão"}</h4>
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
              disabled={setClinical.isPending}
              onChange={(e) => setClinical.mutate(e.target.value as ClinicalStatus)}
            >
              {(Object.keys(CLINICAL_LABEL) as ClinicalStatus[]).map((k) => (
                <option key={k} value={k}>{CLINICAL_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <Badge variant="outline" className="text-[13px] font-semibold" aria-label={`Áudio: ${AUDIO_LABEL[audio]}`}>
            {isProcessing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            Áudio: {AUDIO_LABEL[audio]}
          </Badge>
          <div className="flex items-center gap-1 border-l border-border/60 pl-3">
            {(isError || session.status === "draft") && session.audio_path && (
              <Button size="icon" variant="ghost" onClick={onReprocess} disabled={reprocessing} aria-label="Reprocessar áudio" className="min-h-11 min-w-11">
                <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Excluir sessão" className="min-h-11 min-w-11">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isError && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-[14px] text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>
              {session.error_message ?? "Falha ao processar o áudio."} Suas notas abaixo não são afetadas.
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
            <Button onClick={saveNotes} disabled={!dirty || draft.phase === "saving"} className="min-h-11">
              {draft.phase === "saving" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {draft.phase === "error" ? "Tentar salvar de novo" : "Salvar notas"}
            </Button>
            <span role="status" className={draft.phase === "error" ? "text-destructive" : "text-muted-foreground"}>
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
          <section aria-label="Texto gerado a partir do áudio" className="space-y-4 border-t border-border/40 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] font-semibold text-primary">
                Texto gerado pela IA {session.ai_reviewed_at ? "· revisado" : "· provisório, requer revisão"}
              </p>
              {session.ai_reviewed_at ? (
                <span className="flex items-center gap-1.5 text-[14px] text-clinical-positive">
                  <CheckCircle2 className="size-4" /> Revisado em{" "}
                  {format(new Date(session.ai_reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              ) : (
                <Button variant="outline" className="min-h-11" onClick={review} disabled={reviewState.pending}>
                  {reviewState.pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Li e revisei este texto
                </Button>
              )}
            </div>
            {reviewState.error && <p role="alert" className="text-[14px] text-destructive">{reviewState.error}</p>}
            <div className={`grid gap-4 md:grid-cols-2 ${session.ai_reviewed_at ? "" : "opacity-90"}`}>
              {rows.map(([label, value]) => (
                <div key={label as string} className="bg-background border border-border/40 p-4 rounded-sm">
                  <p className="text-[14px] font-semibold text-bronze mb-2">{label as string}</p>
                  {Array.isArray(value) ? (
                    <ul className="list-disc list-inside space-y-1.5 text-[15px] leading-relaxed text-foreground">
                      {(value as unknown[]).map((v, i) => (
                        <li key={i}>{String(v)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{String(value)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {session.transcript && (
          <div className="border-t border-border/40 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setShowTranscript((v) => !v)} className="min-h-11 text-[15px]">
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
