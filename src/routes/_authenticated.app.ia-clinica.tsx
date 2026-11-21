import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { evidenceForCase, parentageToReview, type Hypothesis } from "@/lib/evidence";
import type { DetectedPattern } from "@/lib/patterns";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import { readVisits } from "@/lib/recent-activity";
import { EvidenceSources } from "@/components/clients/evidence-sources";
import {
  HypothesisReview,
  HypothesisReviewArchive,
} from "@/components/clients/hypothesis-review-panel";

export const Route = createFileRoute("/_authenticated/app/ia-clinica")({
  validateSearch: (search: Record<string, unknown>): { caseId?: string } =>
    typeof search.caseId === "string" &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(search.caseId)
      ? { caseId: search.caseId }
      : {},
  head: () => ({
    meta: [
      { title: "Evidências e hipóteses — GENEALIZ" },
      {
        name: "description",
        content: "Hipóteses provisórias baseadas nas evidências registradas no caso.",
      },
      { property: "og:title", content: "Evidências e hipóteses — GENEALIZ" },
      {
        property: "og:description",
        content: "Hipóteses provisórias com fontes, limites e perguntas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IaClinicaPage,
});

type ReviewEntry = { hypothesis: Hypothesis; pattern: DetectedPattern };

function IaClinicaPage() {
  const { caseId } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const [recentId, setRecentId] = useState("");
  useEffect(() => {
    setRecentId(readVisits(user.id)[0]?.clientId ?? "");
  }, [user.id]);

  const clientsQ = useQuery({
    queryKey: ["clients", "evidence", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, status")
        .eq("professional_id", user.id)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const clients = clientsQ.data ?? [];
  const clientId = clients.find((client) => client.id === caseId)?.id ?? "";
  const recentCase = clients.find((client) => client.id === recentId);
  // Mesma queryFn/formato do dossiê (lib/clinical-intel) → cache compatível
  const caseQ = useQuery(clinicalIntelQuery(clientId));
  const [panel, setPanel] = useState({
    clientId: "",
    selected: new Set<string>(),
    opened: new Map<string, ReviewEntry>(),
    showHyp: false,
  });
  const selected = panel.clientId === clientId ? panel.selected : new Set<string>();
  const opened = panel.clientId === clientId ? panel.opened : new Map<string, ReviewEntry>();
  const showHyp = panel.clientId === clientId && panel.showHyp;
  const evidenceData = caseQ.data;
  const ev = useMemo(
    () => (evidenceData ? evidenceForCase(evidenceData.persons, evidenceData.relationships) : null),
    [evidenceData],
  );
  const missingParentage = useMemo(
    () => (evidenceData ? parentageToReview(evidenceData.persons, evidenceData.relationships) : []),
    [evidenceData],
  );
  const patterns = new Map(ev?.patterns.map((pattern) => [pattern.id, pattern]));
  const current = new Map<string, ReviewEntry>();
  for (const hypothesis of ev?.hypotheses ?? []) {
    const pattern = patterns.get(hypothesis.patternId);
    if (pattern) current.set(hypothesis.id, { hypothesis, pattern });
  }

  const changeCase = (id: string) => {
    void navigate({ search: id ? { caseId: id } : {} });
  };
  const updateSelection = (next: Set<string>, show: boolean) => {
    const entries = new Map(opened);
    if (show) {
      for (const [id, entry] of current) {
        if (next.has(entry.hypothesis.patternId)) entries.set(id, entry);
      }
    }
    setPanel({ clientId, selected: next, opened: entries, showHyp: show });
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSelection(next, showHyp);
  };

  const visibleHypotheses =
    showHyp && [...opened.values()].some(({ hypothesis }) => selected.has(hypothesis.patternId));
  const hypothesisHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (showHyp) hypothesisHeadingRef.current?.focus();
  }, [showHyp]);

  return (
    <div className="archive-evidence-page flex min-h-[calc(100dvh-72px)] flex-col">
      <DocumentHeader
        breadcrumb={<Link to="/app">Mesa de trabalho</Link>}
        title="Evidências e hipóteses"
        subtitle="Selecione um caso. As hipóteses vêm apenas do que está registrado no genossociograma."
        illustration={<img src="/assets/genealiz/acervo/chaves.webp" alt="" decoding="async" />}
      />
      <div className="container-liz archive-evidence-layout">
        <section aria-label="Selecionar caso" className="archive-evidence-controls space-y-2">
          {clientsQ.isError ? (
            <div className="flex flex-wrap items-center gap-3 text-[15px] text-destructive">
              <span role="alert">Não foi possível carregar os casos.</span>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={clientsQ.isFetching}
                onClick={() => void clientsQ.refetch()}
              >
                <RefreshCw className="size-4" aria-hidden />
                {clientsQ.isFetching ? "Carregando…" : "Tentar novamente"}
              </Button>
            </div>
          ) : !clientsQ.data ? (
            <p role="status" className="text-[15px] text-muted-foreground">
              Carregando casos…
            </p>
          ) : clients.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Nenhum dossiê cadastrado.</p>
          ) : (
            <>
              <label htmlFor="ia-case" className="block text-[15px] font-semibold text-foreground">
                Caso
              </label>
              <select
                id="ia-case"
                value={clientId}
                onChange={(e) => changeCase(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Escolha um dossiê</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.preferred_name}
                    {c.status === "archived" ? " (arquivado)" : ""}
                  </option>
                ))}
              </select>
            </>
          )}
          {!clientId && recentCase && (
            <Button
              variant="outline"
              className="h-auto min-h-11 whitespace-normal text-left"
              onClick={() => changeCase(recentCase.id)}
            >
              Usar caso atual · {recentCase.full_name || recentCase.preferred_name}
            </Button>
          )}
        </section>

        <div className="archive-evidence-sheet space-y-6">
          {!clientId && !caseId && clients.length > 0 && (
            <p className="text-ink-soft">
              Escolha um dossiê para consultar as evidências registradas.
            </p>
          )}
          {caseId && !clientId && clientsQ.isSuccess && (
            <p className="text-[15px] text-muted-foreground">
              O caso solicitado está indisponível. Selecione outro dossiê para continuar.
            </p>
          )}
          {clientId && caseQ.isPending && (
            <p role="status" className="text-[15px] text-muted-foreground">
              Carregando registros familiares…
            </p>
          )}
          {clientId && caseQ.isError && (
            <div className="flex flex-wrap items-center gap-3 text-[15px] text-destructive">
              <span role="alert">Não foi possível carregar as evidências do caso.</span>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={caseQ.isFetching}
                onClick={() => void caseQ.refetch()}
              >
                <RefreshCw className="size-4" aria-hidden />
                {caseQ.isFetching ? "Carregando…" : "Tentar novamente"}
              </Button>
            </div>
          )}

          {ev && evidenceData && (
            <>
              {missingParentage.length > 0 && (
                <details className="rounded-md border border-border px-3">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
                    Filiações com fonte a confirmar ({missingParentage.length})
                  </summary>
                  <ul className="divide-y divide-border pb-2 text-sm">
                    {missingParentage.map(({ id, name }) => (
                      <li key={id}>
                        <Link
                          to="/app/clientes/$clientId"
                          params={{ clientId }}
                          search={{ tab: "genogram", person: id, review: "parentage" }}
                          className="inline-flex min-h-11 items-center text-forest underline underline-offset-4"
                        >
                          Revisar filiação de {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <section aria-labelledby="ev-h" className="space-y-3">
                <h2 id="ev-h" className="text-lg font-semibold text-foreground">
                  Evidências detectadas ({ev.patterns.length})
                </h2>
                {ev.patterns.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">
                    A leitura do genossociograma não encontrou repetições nos registros atuais.
                  </p>
                ) : (
                  <ul className="archive-register">
                    {ev.patterns.map((pattern) => (
                      <li key={pattern.id} className="space-y-2 px-4 pt-3 text-[15px]">
                        <label className="flex min-h-11 cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 size-5 accent-[var(--color-primary)]"
                            checked={selected.has(pattern.id)}
                            onChange={() => toggle(pattern.id)}
                          />
                          <span>
                            <strong className="block">{pattern.title}</strong>
                            {pattern.description}
                          </span>
                        </label>
                        <EvidenceSources
                          clientId={clientId}
                          pattern={pattern}
                          persons={evidenceData.persons}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {ev.patterns.length > 0 && (
                <Button
                  className="min-h-11"
                  disabled={selected.size === 0}
                  onClick={() => {
                    updateSelection(selected, true);
                    if (showHyp) hypothesisHeadingRef.current?.focus();
                  }}
                >
                  Ver hipóteses{" "}
                  {selected.size > 0 && (
                    <span>
                      · {selected.size}{" "}
                      {selected.size === 1 ? "evidência selecionada" : "evidências selecionadas"}
                    </span>
                  )}
                </Button>
              )}
              {opened.size > 0 && (
                <section aria-labelledby="hy-h" className="space-y-3" hidden={!visibleHypotheses}>
                  <h2
                    id="hy-h"
                    ref={hypothesisHeadingRef}
                    tabIndex={-1}
                    className="text-lg font-semibold text-foreground"
                  >
                    Hipóteses provisórias
                  </h2>
                  {[...opened.entries()].map(([id, original]) => {
                    const latest = current.get(id);
                    const { hypothesis: h, pattern } = latest ?? original;
                    return (
                      <article
                        key={`${clientId}:${id}`}
                        hidden={!selected.has(h.patternId)}
                        className="space-y-2 border-b border-border bg-card p-4"
                      >
                        <h3 className="text-[16px] font-semibold">{h.title}</h3>
                        <p className="text-[15px]">{h.description}</p>
                        <p className="text-[15px]">
                          <strong>Familiares mencionados</strong> · {h.sources.join(", ")}
                        </p>
                        <p className="text-[14px] text-muted-foreground">
                          <strong>Limites</strong> · {h.limits}
                        </p>
                        <div className="text-[15px]">
                          <strong>Perguntas para a sessão</strong>
                          <ul className="ml-5 list-disc">
                            {h.questions.map((q) => (
                              <li key={q}>{q}</li>
                            ))}
                          </ul>
                        </div>
                        <HypothesisReview
                          clientId={clientId}
                          hypothesisKey={id}
                          title={h.title}
                          pattern={pattern}
                          available={Boolean(latest)}
                        />
                      </article>
                    );
                  })}
                </section>
              )}
              <HypothesisReviewArchive clientId={clientId} patterns={ev.patterns} />
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId }}
                search={{ tab: "patterns" }}
                className="inline-flex min-h-11 items-center text-[15px] font-medium text-primary underline underline-offset-4"
              >
                Voltar às evidências do dossiê
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
