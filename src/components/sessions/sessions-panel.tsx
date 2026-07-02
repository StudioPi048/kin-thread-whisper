import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mic, Square, Loader2, Trash2, FileText, AlertCircle, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { processSessionAudio } from "@/lib/ai/session-processing.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    const processing = sessions.some((s) => s.status === "transcribing" || s.status === "structuring");
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

  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
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
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h3 className="font-serif text-lg text-primary">Gravar sessão</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Grave a fala ao final do atendimento. A plataforma transcreve e devolve um prontuário estruturado (fatos × hipóteses).
            </p>
          </div>
          {recording ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                {formatDuration(elapsed)}
              </span>
              <Button onClick={stopRecording} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Parar
              </Button>
            </div>
          ) : (
            <Button onClick={startRecording} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
              {uploading ? "Enviando…" : "Iniciar gravação"}
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="font-serif text-lg text-primary">Histórico de sessões</h3>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && sessions.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma sessão gravada ainda.
          </Card>
        )}
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onReprocess={() => reprocess.mutate(s.id)}
            onDelete={() => deleteSession.mutate(s)}
            reprocessing={reprocess.isPending && reprocess.variables === s.id}
          />
        ))}
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
      ["Queixa principal", note.queixa_principal],
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
  const statusVariant =
    session.status === "ready" ? "default" : session.status === "error" ? "destructive" : "secondary";

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{session.title ?? "Sessão"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(session.session_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            {" · "}
            {formatDuration(session.duration_seconds)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant as never}>
            {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {STATUS_LABEL[session.status] ?? session.status}
          </Badge>
          {(session.status === "error" || session.status === "draft") && session.audio_path && (
            <Button size="sm" variant="ghost" onClick={onReprocess} disabled={reprocessing}>
              <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {session.status === "error" && session.error_message && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{session.error_message}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xs font-medium text-primary uppercase tracking-wide">{label as string}</p>
              {Array.isArray(value) ? (
                <ul className="mt-1 list-disc list-inside text-sm space-y-1">
                  {(value as unknown[]).map((v, i) => (
                    <li key={i}>{String(v)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm whitespace-pre-wrap">{String(value)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {session.transcript && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowTranscript((v) => !v)}>
            <FileText className="h-4 w-4 mr-2" />
            {showTranscript ? "Ocultar" : "Ver"} transcrição bruta
          </Button>
          {showTranscript && (
            <Textarea
              readOnly
              value={session.transcript}
              className="mt-2 font-mono text-xs min-h-[160px]"
            />
          )}
        </div>
      )}
    </Card>
  );
}
