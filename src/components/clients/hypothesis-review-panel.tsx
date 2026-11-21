import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import type { DetectedPattern, EvidenceFact } from "@/lib/patterns";
import {
  DECISION_LABEL,
  compareReviewEvidence,
  evidenceFingerprint,
  isStale,
  reviewsForPattern,
  type ReviewDecision,
  type ReviewRow,
} from "@/lib/hypothesis-review";
import {
  hypothesisReviewsQuery,
  observeReview,
  reviewsKey,
  submitHypothesisReview,
  type ObservedReview,
} from "@/lib/hypothesis-review-save";

type ReviewDraft = { decision: ReviewDecision | ""; note: string; fingerprint: string };

export function HypothesisReview({
  clientId,
  hypothesisKey,
  title,
  pattern,
  available,
}: {
  clientId: string;
  hypothesisKey: string;
  title: string;
  pattern: DetectedPattern;
  available: boolean;
}) {
  const qc = useQueryClient();
  const q = useQuery(hypothesisReviewsQuery(clientId));
  const fp = evidenceFingerprint(pattern);
  const rows = reviewsForPattern(q.data ?? [], hypothesisKey, pattern);
  const latest = rows[0] ?? null;
  const stale = isStale(latest, fp);
  const diff = latest && stale ? compareReviewEvidence(latest, pattern) : null;
  const [draft, setDraftState] = useState<ReviewDraft>({ decision: "", note: "", fingerprint: fp });
  const draftRef = useRef(draft);
  const setDraft = (update: (current: ReviewDraft) => ReviewDraft) => {
    draftRef.current = update(draftRef.current);
    setDraftState(draftRef.current);
  };
  const decision = draft.fingerprint === fp ? draft.decision : "";
  const needsDecision = Boolean(draft.decision && draft.fingerprint !== fp);
  const [showHistory, setShowHistory] = useState(false);
  const pendingSave = useRef<Promise<void> | null>(null);
  const observed = useRef<ObservedReview | null>(null);
  const [reviewConflict, setReviewConflict] = useState<{
    latest: ReviewRow | null;
    observed: ObservedReview;
  } | null>(null);
  useEffect(() => {
    if (!observed.current && q.data) {
      observed.current = observeReview(q.data, hypothesisKey, pattern).observed;
    }
  }, [q.data, hypothesisKey, pattern]);

  const save = useMutation({
    mutationFn: async ({
      submitted,
      confirmed,
    }: {
      submitted: ReviewDraft;
      confirmed: ObservedReview;
    }) => {
      if (!submitted.decision) throw new Error("Escolha uma decisão.");
      return submitHypothesisReview(qc, {
        clientId,
        key: hypothesisKey,
        title,
        pattern,
        decision: submitted.decision,
        note: submitted.note,
        fingerprint: submitted.fingerprint,
        observed: confirmed,
      });
    },
    onSuccess: (result, { submitted }) => {
      if (result.kind === "conflict") {
        setReviewConflict(result);
        return;
      }
      observed.current = { id: result.latest.id, canonicalId: result.latest.id };
      setReviewConflict(null);
      setDraft((current) =>
        current === submitted ? { ...current, decision: "", note: "" } : current,
      );
      qc.setQueryData<ReviewRow[]>(reviewsKey(clientId), (previous) => [
        ...(previous ?? []).filter((row) => row.id !== result.latest.id),
        result.latest,
      ]);
      void qc.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });

  const isDirty = () => Boolean(draftRef.current.decision || draftRef.current.note);
  const submit = (): Promise<void> => {
    if (pendingSave.current) return pendingSave.current;
    const submitted = draftRef.current;
    if (!available || !submitted.decision || submitted.fingerprint !== fp) {
      return Promise.reject(new Error("Confira as evidências atuais e escolha uma decisão."));
    }
    if (reviewConflict)
      return Promise.reject(new Error("Confira a revisão registrada em outra aba antes de sair."));
    const confirmed = observed.current;
    if (!confirmed || q.isError)
      return Promise.reject(new Error("Carregue o histórico antes de confirmar uma revisão."));
    pendingSave.current = save
      .mutateAsync({ submitted, confirmed })
      .then((result) => {
        if (result.kind === "conflict")
          throw new Error("Confira a revisão registrada em outra aba antes de sair.");
      })
      .finally(() => {
        pendingSave.current = null;
      });
    return pendingSave.current;
  };
  const discard = async () => {
    await pendingSave.current?.catch(() => undefined);
    setDraft(() => ({ decision: "", note: "", fingerprint: fp }));
    if (q.data) observed.current = observeReview(q.data, hypothesisKey, pattern).observed;
    setReviewConflict(null);
    save.reset();
  };
  useUnsaved(`review:${clientId}:${hypothesisKey}`, {
    label: `Revisão · ${title}`,
    isDirty,
    save: submit,
    discard,
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
        {!available ? (
          <p role="status" className="text-[14px] text-clinical-warning">
            A hipótese deixou de aparecer com as evidências atuais. Você pode consultar ou descartar
            este rascunho.
          </p>
        ) : (
          needsDecision && (
            <p role="status" className="text-[14px] text-clinical-warning">
              As evidências foram atualizadas. Confira os dados e escolha a decisão de novo.
            </p>
          )
        )}
        {reviewConflict && (
          <div className="space-y-2 rounded-md border border-clinical-warning/50 p-3 text-sm">
            <p role="status" className="font-semibold">
              Uma revisão foi registrada desde que você abriu o formulário. Seu rascunho continua
              aqui.
            </p>
            {reviewConflict.latest && (
              <>
                <p>
                  Revisão v{reviewConflict.latest.version} ·{" "}
                  {DECISION_LABEL[reviewConflict.latest.decision as ReviewDecision]} ·{" "}
                  {format(new Date(reviewConflict.latest.created_at), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </p>
                {reviewConflict.latest.note && (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {reviewConflict.latest.note}
                  </p>
                )}
              </>
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                observed.current = reviewConflict.observed;
                setReviewConflict(null);
              }}
            >
              Conferi a revisão mais recente
            </Button>
          </div>
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
                disabled={!available}
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
          readOnly={!available}
          className="min-h-[72px] text-[15px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="min-h-11"
            disabled={
              !available ||
              !decision ||
              save.isPending ||
              q.isLoading ||
              q.isError ||
              !!reviewConflict
            }
            onClick={() => void submit().catch(() => undefined)}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {save.isError ? "Tentar salvar de novo" : "Salvar revisão"}
          </Button>
          {(draft.note || draft.decision) && (
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={save.isPending}
              onClick={discard}
            >
              Descartar rascunho
            </Button>
          )}
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
        return (
          <li className="py-2 text-sm" key={`${fact.recordId}-${fact.field}-${index}`}>
            <p className="break-words">
              <strong>{fieldNames[fact.field] ?? fact.field}</strong> · {fact.value}
            </p>
            {fact.precision && (
              <p className="text-muted-foreground">{precisionNames[fact.precision]}</p>
            )}
            {fact.recordId && (
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId }}
                search={
                  fact.source === "genogram_relationships"
                    ? { tab: "genogram", relation: fact.recordId }
                    : { tab: "genogram", person: fact.recordId }
                }
                className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
              >
                {fact.source === "genogram_persons"
                  ? "Abrir ficha no mapa"
                  : "Abrir vínculo no mapa"}
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
  const q = useQuery(hypothesisReviewsQuery(clientId));
  const rows = q.data ?? [];
  const currentReviewIds = new Set(
    patterns.flatMap((pattern) =>
      reviewsForPattern(rows, `h-${pattern.id}`, pattern).map(({ id }) => id),
    ),
  );
  const archived = rows
    .filter((row) => !currentReviewIds.has(row.id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!q.isError && archived.length === 0) return null;
  return (
    <>
      {q.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          Não foi possível carregar o histórico completo de revisões.
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {archived.length > 0 && (
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
      )}
    </>
  );
}
