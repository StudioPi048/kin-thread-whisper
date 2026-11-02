import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DetectedPattern } from "@/lib/patterns";
import {
  DECISION_LABEL,
  evidenceFingerprint,
  evidenceSnapshot,
  isStale,
  latestReview,
  type ReviewDecision,
  type ReviewRow,
} from "@/lib/hypothesis-review";

export const reviewsKey = (clientId: string) => ["hypothesis-reviews", clientId] as const;

export function useHypothesisReviews(clientId: string) {
  return useQuery({
    queryKey: reviewsKey(clientId),
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hypothesis_reviews")
        .select("id, hypothesis_key, decision, note, version, evidence_fingerprint, created_at")
        .eq("client_id", clientId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
  });
}

export function HypothesisReview({
  clientId,
  hypothesisKey,
  title,
  pattern,
}: {
  clientId: string;
  hypothesisKey: string;
  title: string;
  pattern: DetectedPattern;
}) {
  const qc = useQueryClient();
  const q = useHypothesisReviews(clientId);
  const fp = evidenceFingerprint(pattern);
  const rows = (q.data ?? []).filter((r) => r.hypothesis_key === hypothesisKey);
  const latest = latestReview(rows, hypothesisKey);
  const stale = isStale(latest, fp);
  const [decision, setDecision] = useState<ReviewDecision | "">("");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error("Escolha uma decisão.");
      const { data, error } = await supabase
        .from("hypothesis_reviews")
        .insert({
          client_id: clientId,
          hypothesis_key: hypothesisKey,
          hypothesis_title: title,
          decision,
          note: note.trim() || null,
          evidence_fingerprint: fp,
          evidence_snapshot: [evidenceSnapshot(pattern)],
        })
        .select("id, version")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setDecision("");
      setNote("");
      qc.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });

  const name = `rev-${hypothesisKey}`;
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="text-[15px]" role="status">
        {q.isLoading ? (
          "Carregando revisões…"
        ) : q.isError ? (
          <span className="text-destructive">
            Revisões indisponíveis.{" "}
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => q.refetch()}>
              <RefreshCw className="mr-1 size-4" /> Tentar de novo
            </Button>
          </span>
        ) : latest ? (
          <span>
            <strong>Revisão salva (v{latest.version}):</strong> {DECISION_LABEL[latest.decision as ReviewDecision]} em{" "}
            {format(new Date(latest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            {stale && (
              <span className="ml-1 font-semibold text-clinical-warning">
                — as evidências mudaram desde esta revisão; revise de novo.
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Ainda não revisada. Selecionar evidências não conta como revisão.</span>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold">Registrar revisão</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DECISION_LABEL) as ReviewDecision[]).map((d) => (
            <label key={d} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-[15px]">
              <input type="radio" name={name} value={d} checked={decision === d} onChange={() => setDecision(d)} className="size-4" />
              {DECISION_LABEL[d]}
            </label>
          ))}
        </div>
        <label htmlFor={`${name}-note`} className="block text-[14px] text-muted-foreground">
          Justificativa (opcional)
        </label>
        <Textarea id={`${name}-note`} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px] text-[15px]" />
        <div className="flex flex-wrap items-center gap-3">
          <Button className="min-h-11" disabled={!decision || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {save.isError ? "Tentar salvar de novo" : "Salvar revisão"}
          </Button>
          {save.isError && (
            <span role="alert" className="text-[14px] text-destructive">
              Não salvo: {save.error instanceof Error ? save.error.message : "erro"}. Sua escolha continua aqui.
            </span>
          )}
          {rows.length > 0 && (
            <Button variant="ghost" className="min-h-11" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
              <History className="mr-1.5 size-4" /> Histórico ({rows.length})
            </Button>
          )}
        </div>
      </fieldset>

      {showHistory && (
        <ol className="space-y-1 text-[14px]">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-border px-3 py-2">
              v{r.version} · {DECISION_LABEL[r.decision as ReviewDecision]} ·{" "}
              {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {r.evidence_fingerprint !== fp && " · evidência anterior"}
              {r.note && <p className="mt-1 whitespace-pre-wrap">{r.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
