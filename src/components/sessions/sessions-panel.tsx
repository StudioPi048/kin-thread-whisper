import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { processSessionAudio } from "@/lib/ai/session-processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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

  const { data: sessions = [], isLoading } = useQuery({
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
        })
        .select()
        .single();
      if (insert.error) throw insert.error;

      qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
      toast.success("Áudio salvo. Processando prontuário…");

      // Fire off processing (non-blocking)
      processFn({ data: { sessionId } }).catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Falha ao processar áudio");
        qc.invalidateQueries({ queryKey: ["clinical_sessions", clientId] });
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
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

  const deleteSession = useMutation({
    mutationFn: async (s: Session) => {
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
      <section className="rounded-sm border-2 border-mahogany bg-mahogany text-white shadow-lg relative overflow-hidden">
        <span className="section-number absolute -right-4 -bottom-10 opacity-[0.05] text-white">
          🎙️
        </span>
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
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="font-serif text-2xl font-bold text-primary">Histórico de Sessões</h3>
        </div>

        {isLoading && <div className="h-32 animate-pulse rounded-lg bg-muted/30" />}

        {!isLoading && sessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-sm border border-dashed border-border bg-forest-soft/40 p-16 text-center"
          >
            <AudioLines className="mx-auto size-10 text-forest opacity-60" />
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
  onReprocess,
  onDelete,
  reprocessing,
}: {
  session: Session;
  onReprocess: () => void;
  onDelete: () => void;
  reprocessing: boolean;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const note = session.structured_note as Record<string, unknown> | null;

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

  const isProcessing = session.status === "transcribing" || session.status === "structuring";
  const isError = session.status === "error";

  const statusBadge = isError
    ? "bg-destructive text-white"
    : isProcessing
      ? "bg-forest text-white"
      : "bg-emerald-600 text-white";

  return (
    <article className="rounded-sm border border-border bg-white shadow-sm overflow-hidden accent-bar-mahogany transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="border-b border-border/40 bg-background/50 px-6 py-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
            {format(new Date(session.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h4 className="font-serif text-2xl font-bold text-primary">
            {session.title ?? "Sessão"}
          </h4>
          <p className="text-[16px] text-muted-foreground/70 font-mono mt-1 flex items-center gap-2">
            <Mic className="size-3" />
            {formatDuration(session.duration_seconds)} de áudio registrado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            className={`${statusBadge} border-0 uppercase tracking-widest text-[9px] px-2 py-1`}
          >
            {isProcessing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
            {STATUS_LABEL[session.status] ?? session.status}
          </Badge>

          <div className="flex items-center gap-1 border-l border-border/60 pl-3 ml-1">
            {(session.status === "error" || session.status === "draft") && session.audio_path && (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onReprocess}
                disabled={reprocessing}
                title="Reprocessar áudio"
              >
                <RefreshCw
                  className={`h-4 w-4 text-muted-foreground hover:text-mahogany ${reprocessing ? "animate-spin" : ""}`}
                />
              </Button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={onDelete} title="Excluir sessão">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {isError && session.error_message && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-[14px] font-medium text-destructive mb-6">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>{session.error_message}</span>
          </div>
        )}

        {rows.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {rows.map(([label, value]) => (
              <div
                key={label as string}
                className="bg-background border border-border/40 p-4 rounded-sm"
              >
                <p className="text-[14px] font-bold text-gold uppercase tracking-[0.15em] mb-2">
                  {label as string}
                </p>
                {Array.isArray(value) ? (
                  <ul className="list-disc list-inside space-y-1.5 font-serif text-[15px] leading-relaxed text-foreground/85">
                    {(value as unknown[]).map((v, i) => (
                      <li key={i}>{String(v)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground/85">
                    {String(value)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          !isProcessing &&
          !isError && (
            <p className="text-[14px] text-muted-foreground italic">
              Nenhuma anotação estruturada extraída para esta sessão.
            </p>
          )
        )}

        {session.transcript && (
          <div className="mt-8 border-t border-border/40 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscript((v) => !v)}
              className="text-[16px] text-muted-foreground hover:text-primary"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showTranscript ? "Ocultar" : "Ver"} transcrição bruta gerada pela IA
            </Button>
            {showTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden mt-3"
              >
                <Textarea
                  readOnly
                  aria-label="Transcrição da sessão"
                  value={session.transcript}
                  className="font-mono text-[16px] min-h-[160px] bg-background border-border/50 resize-none text-muted-foreground/80 p-4 leading-relaxed"
                />
              </motion.div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
