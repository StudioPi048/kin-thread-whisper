import { useMemo, useRef, useState } from "react";
import { FileText, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  readTranscriptReviews,
  transcriptDecisionLabels,
  transcriptPassages,
  type TranscriptDecision,
} from "@/lib/transcript";

const time = (position: number) => {
  const seconds = Math.floor(position);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

type ReviewDraft = {
  index: number;
  decision: TranscriptDecision;
  correction: string;
  audioSecond: number | null;
  updatedAt: string;
};

export function TranscriptReview({
  sessionId,
  clientId,
  transcript,
  segments,
  reviews,
  audioPath,
  updatedAt,
  processing,
  refresh,
}: {
  sessionId: string;
  clientId: string;
  transcript: string;
  segments?: Json;
  reviews?: Json;
  audioPath: string | null;
  updatedAt: string;
  processing: boolean;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const player = useRef<HTMLAudioElement>(null);
  const lock = useRef(false);
  const passages = useMemo(() => transcriptPassages(transcript, segments), [transcript, segments]);
  const decisions = useMemo(() => readTranscriptReviews(reviews), [reviews]);
  const playback = useQuery({
    queryKey: ["session-audio-playback", sessionId, audioPath],
    enabled: false,
    retry: false,
    gcTime: 0,
    queryFn: async () => {
      if (!audioPath) throw new Error("Áudio indisponível.");
      const { data, error } = await supabase.storage
        .from("session-audio")
        .createSignedUrl(audioPath, 180);
      if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o áudio.");
      return data.signedUrl;
    },
  });

  const save = async () => {
    if (
      !draft ||
      lock.current ||
      processing ||
      (draft.decision === "corrected" && !draft.correction.trim())
    ) {
      throw new Error("Confira a correção antes de salvar.");
    }
    if (draft.updatedAt !== updatedAt) {
      const reason =
        "A sessão foi atualizada. Reabra a revisão do trecho para conferir a versão atual.";
      setMessage(reason);
      throw new Error(reason);
    }
    lock.current = true;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("clinical_sessions")
        .update({
          transcript_reviews: {
            ...decisions,
            [draft.index]: {
              decision: draft.decision,
              correction: draft.decision === "corrected" ? draft.correction.trim() : "",
              audio_second: draft.audioSecond,
              reviewed_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", sessionId)
        .eq("client_id", clientId)
        .eq("updated_at", draft.updatedAt)
        .eq("status", "ready")
        .select("id")
        .maybeSingle();
      if (error || !data) {
        throw new Error("A revisão não foi salva. Confira a conexão e o estado da sessão.");
      }
      setDraft(undefined);
      await refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar a revisão.");
      throw reason;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  useUnsaved(`transcript:${sessionId}`, {
    label: "Revisão da transcrição",
    isDirty: () => Boolean(draft) || lock.current,
    save,
    discard: () => {
      setDraft(undefined);
      setMessage("");
    },
  });

  return (
    <section className="space-y-3 border-t border-border pt-4" aria-label="Transcrição da sessão">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FileText className="size-4" aria-hidden />
        {open ? "Ocultar transcrição" : "Revisar transcrição"}
      </Button>
      {open && (
        <div className="space-y-4">
          {audioPath && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={playback.isFetching}
                onClick={() => void playback.refetch()}
              >
                <Play className="size-4" aria-hidden />{" "}
                {playback.data ? "Atualizar player" : "Abrir áudio"}
              </Button>
              {playback.data && (
                <audio
                  ref={player}
                  controls
                  preload="none"
                  src={playback.data}
                  className="max-w-full"
                />
              )}
              {playback.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível abrir o áudio.
                </p>
              )}
            </div>
          )}
          <ol className="divide-y divide-border rounded-md border border-border">
            {passages.map((part) => {
              const existing = decisions[part.index];
              const selected = draft?.index === part.index;
              const position = existing?.audio_second ?? part.start;
              return (
                <li className="space-y-3 p-4" key={part.index}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <strong>Trecho {part.index + 1}</strong>
                    {existing && (
                      <span className="text-muted-foreground">
                        {transcriptDecisionLabels[existing.decision]}
                      </span>
                    )}
                    {position !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        disabled={!playback.data}
                        onClick={() => {
                          if (player.current) player.current.currentTime = position;
                        }}
                      >
                        {time(position)}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {part.text}
                  </p>
                  {existing?.correction && (
                    <p className="break-words text-sm">
                      <strong>Correção</strong> · {existing.correction}
                    </p>
                  )}
                  {selected ? (
                    <div className="space-y-3 rounded-md bg-muted p-3">
                      <label className="grid gap-1.5 text-sm font-medium">
                        Decisão
                        <select
                          className="min-h-11 w-full max-w-xs rounded-md border border-input bg-card px-3 text-base"
                          value={draft.decision}
                          disabled={saving}
                          onChange={(e) =>
                            setDraft({ ...draft, decision: e.target.value as TranscriptDecision })
                          }
                        >
                          {Object.entries(transcriptDecisionLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {draft.decision === "corrected" && (
                        <label className="grid gap-1.5 text-sm font-medium">
                          Texto corrigido
                          <Textarea
                            value={draft.correction}
                            disabled={saving}
                            onChange={(e) => setDraft({ ...draft, correction: e.target.value })}
                          />
                        </label>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={
                            saving ||
                            processing ||
                            (draft.decision === "corrected" && !draft.correction.trim())
                          }
                          onClick={() => void save().catch(() => {})}
                        >
                          {saving ? "Salvando…" : "Salvar revisão"}
                        </Button>
                        {playback.data && (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={saving}
                            onClick={() => {
                              const audio = player.current;
                              if (audio) setDraft({ ...draft, audioSecond: audio.currentTime });
                            }}
                          >
                            {draft.audioSecond === null
                              ? "Marcar ponto do áudio"
                              : `Atualizar marca em ${time(draft.audioSecond)}`}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="min-h-11"
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setDraft(undefined);
                            setMessage("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                      {message && (
                        <p role="alert" className="text-sm text-destructive">
                          {message}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={processing || !!draft}
                      onClick={() =>
                        setDraft({
                          index: part.index,
                          decision: existing?.decision ?? "confirmed",
                          correction: existing?.correction || part.text,
                          audioSecond: position,
                          updatedAt,
                        })
                      }
                    >
                      {existing ? "Rever trecho" : "Revisar trecho"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
