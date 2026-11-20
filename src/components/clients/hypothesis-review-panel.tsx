import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DetectedPattern, EvidenceFact } from "@/lib/patterns";
import {
  DECISION_LABEL,
  compareReviewEvidence,
  evidenceFingerprint,
  evidenceSnapshot,
  isStale,
  reviewsForPattern,
  type ReviewDecision,
  type ReviewRow,
} from "@/lib/hypothesis-review";

const reviewsKey = (clientId: string) => ["hypothesis-reviews", clientId] as const;

function useHypothesisReviews(clientId: string) {
  return useQuery({
    queryKey: reviewsKey(clientId),
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hypothesis_reviews")
        .select(
          "id, hypothesis_key, hypothesis_title, decision, note, version, evidence_fingerprint, evidence_snapshot, created_at",
        )
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
  const rows = reviewsForPattern(q.data ?? [], hypothesisKey, pattern);
  const latest = rows[0] ?? null;
  const stale = isStale(latest, fp);
  const diff = latest && stale ? compareReviewEvidence(latest, pattern) : null;
  const [draft, setDraft] = useState<{
    decision: ReviewDecision | "";
    note: string;
    fingerprint: string;
  }>({ decision: "", note: "", fingerprint: fp });
  const decision = draft.fingerprint === fp ? draft.decision : "";
  const needsDecision = Boolean(draft.decision && draft.fingerprint !== fp);
  const [showHistory, setShowHistory] = useState(false);

  const save = useMutation({
    mutationFn: async ({
      submitted,
      snapshot,
    }: {
      submitted: typeof draft;
      snapshot: ReturnType<typeof evidenceSnapshot>;
    }) => {
      if (!submitted.decision) throw new Error("Escolha uma decisão.");
      const { data, error } = await supabase
        .from("hypothesis_reviews")
        .insert({
          client_id: clientId,
          hypothesis_key: hypothesisKey,
          hypothesis_title: title,
          decision: submitted.decision,
          note: submitted.note.trim() || null,
          evidence_fingerprint: submitted.fingerprint,
          evidence_snapshot: [snapshot],
        })
        .select("id, version")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { submitted }) => {
      setDraft((current) =>
        current === submitted ? { ...current, decision: "", note: "" } : current,
      );
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
            <strong>Revisão salva (v{latest.version}):</strong>{" "}
            {DECISION_LABEL[latest.decision as ReviewDecision]} em{" "}
            {format(new Date(latest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            {stale && (
              <span className="ml-1 font-semibold text-clinical-warning">
                {latest.evidence_fingerprint.startsWith("v2-")
                  ? " · As evidências mudaram. Registre uma nova revisão."
                  : " · Revisão anterior ao detalhamento das evidências. Confira os dados e registre uma nova revisão."}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Ainda não revisada. Selecionar evidências não conta como revisão.
          </span>
        )}
      </div>

      {diff && (
        <details className="rounded-md border border-border p-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
            Ver o que mudou nas evidências
          </summary>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold">Registros da revisão anterior</h4>
              <EvidenceFacts facts={diff.previous} clientId={clientId} />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Registros atuais</h4>
              <EvidenceFacts facts={diff.current} clientId={clientId} />
            </div>
          </div>
        </details>
      )}
      <details className="rounded-md border border-border px-3 pb-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          Fontes e valores usados nesta hipótese
        </summary>
        <EvidenceFacts facts={pattern.facts} clientId={clientId} />
      </details>
      <fieldset className="space-y-2">
        <legend className="text-[15px] font-semibold">Registrar revisão</legend>
        {needsDecision && (
          <p role="status" className="text-[14px] text-clinical-warning">
            As evidências foram atualizadas. Confira os dados e escolha a decisão de novo.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DECISION_LABEL) as ReviewDecision[]).map((d) => (
            <label
              key={d}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-[15px]"
            >
              <input
                type="radio"
                name={name}
                value={d}
                checked={decision === d}
                onChange={() =>
                  setDraft((current) => ({ ...current, decision: d, fingerprint: fp }))
                }
                className="size-4"
              />
              {DECISION_LABEL[d]}
            </label>
          ))}
        </div>
        <label htmlFor={`${name}-note`} className="block text-[14px] text-muted-foreground">
          Justificativa (opcional)
        </label>
        <Textarea
          id={`${name}-note`}
          value={draft.note}
          onChange={(e) => setDraft((current) => ({ ...current, note: e.target.value }))}
          className="min-h-[72px] text-[15px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="min-h-11"
            disabled={!decision || save.isPending}
            onClick={() => save.mutate({ submitted: draft, snapshot: evidenceSnapshot(pattern) })}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {save.isError ? "Tentar salvar de novo" : "Salvar revisão"}
          </Button>
          {save.isError && (
            <span role="alert" className="text-[14px] text-destructive">
              Não salvo: {save.error instanceof Error ? save.error.message : "erro"}. Sua escolha
              continua aqui.
            </span>
          )}
          {rows.length > 0 && (
            <Button
              variant="ghost"
              className="min-h-11"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((v) => !v)}
            >
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

const fieldNames: Record<EvidenceFact["field"], string> = {
  birth_date: "Nascimento",
  death_date: "Falecimento",
  cause_of_death: "Causa registrada",
  health_conditions: "Condição de saúde registrada",
  occupation: "Profissão",
  qualifier: "Natureza do vínculo",
  start_date: "Início do vínculo",
  end_date: "Fim do vínculo",
};
const precisionNames = {
  day: "dia, mês e ano",
  month: "mês e ano",
  year: "só o ano",
  unknown: "precisão desconhecida",
};

function EvidenceFacts({ facts, clientId }: { facts: EvidenceFact[]; clientId: string }) {
  if (!facts.length)
    return <p className="mt-2 text-sm text-muted-foreground">Nenhum registro nesta coluna.</p>;
  return (
    <ul className="mt-1 divide-y divide-border">
      {facts.map((fact, index) => {
        const personId = fact.source === "genogram_persons" ? fact.recordId : fact.personIds?.[0];
        return (
          <li className="py-2 text-sm" key={`${fact.recordId}-${fact.field}-${index}`}>
            <p className="break-words">
              <strong>{fieldNames[fact.field] ?? fact.field}</strong> · {fact.value}
            </p>
            {fact.precision && (
              <p className="text-muted-foreground">{precisionNames[fact.precision]}</p>
            )}
            {personId && (
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId }}
                search={{ tab: "genogram", person: personId }}
                className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
              >
                {fact.source === "genogram_persons"
                  ? "Abrir ficha no mapa"
                  : "Abrir familiar vinculado"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Mantém acessíveis as revisões cuja hipótese já não aparece com os dados atuais. */
export function HypothesisReviewArchive({
  clientId,
  patterns,
}: {
  clientId: string;
  patterns: DetectedPattern[];
}) {
  const q = useHypothesisReviews(clientId);
  const rows = q.data ?? [];
  const currentReviewIds = new Set(
    patterns.flatMap((pattern) =>
      reviewsForPattern(rows, `h-${pattern.id}`, pattern).map(({ id }) => id),
    ),
  );
  const archived = rows
    .filter((row) => !currentReviewIds.has(row.id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (archived.length === 0) return null;
  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer font-semibold text-foreground">
        Revisões de hipóteses anteriores ({archived.length})
      </summary>
      <p className="my-2 text-[14px] text-muted-foreground">
        Estas hipóteses não aparecem com as evidências atuais do caso. As revisões permanecem no
        histórico.
      </p>
      <ol className="space-y-2 text-[14px]">
        {archived.map((row) => (
          <li key={row.id} className="rounded border border-border px-3 py-2">
            <strong>{row.hypothesis_title}</strong>
            <p>
              v{row.version} · {DECISION_LABEL[row.decision as ReviewDecision]} ·{" "}
              {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
            {row.note && <p className="mt-1 whitespace-pre-wrap">{row.note}</p>}
          </li>
        ))}
      </ol>
    </details>
  );
}
