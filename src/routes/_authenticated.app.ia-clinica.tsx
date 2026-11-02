import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { evidenceForCase } from "@/lib/evidence";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";

export const Route = createFileRoute("/_authenticated/app/ia-clinica")({
  head: () => ({
    meta: [
      { title: "Evidências e hipóteses — GENEALIZ" },
      { name: "description", content: "Hipóteses provisórias baseadas nas evidências registradas no caso." },
      { property: "og:title", content: "Evidências e hipóteses — GENEALIZ" },
      { property: "og:description", content: "Hipóteses provisórias com fontes, limites e perguntas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IaClinicaPage,
});

function IaClinicaPage() {
  const [clientId, setClientId] = useState<string>("");

  const clientsQ = useQuery({
    queryKey: ["ia-clinica-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mesma chave do painel do dossiê → invalidação consistente entre telas
  const caseQ = useQuery({
    queryKey: ["clinical-intel", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [personsRes, relsRes] = await Promise.all([
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
      ]);
      if (personsRes.error) throw personsRes.error;
      if (relsRes.error) throw relsRes.error;
      return {
        client: null,
        persons: (personsRes.data ?? []) as PersonRow[],
        relationships: (relsRes.data ?? []) as RelationshipRow[],
      };
    },
  });

  const ev = caseQ.data ? evidenceForCase(caseQ.data.persons, caseQ.data.relationships) : null;

  return (
    <div className="flex min-h-[calc(100dvh-72px)] flex-col">
      <DocumentHeader
        breadcrumb="Inteligência Clínica"
        title="Evidências e hipóteses"
        subtitle="Selecione um caso. As hipóteses vêm apenas do que está registrado no genossociograma."
      />
      <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="space-y-2">
          <label htmlFor="ia-case" className="text-[15px] font-semibold text-foreground">
            Caso
          </label>
          {clientsQ.isError ? (
            <div role="alert" className="flex items-center gap-3 text-[15px] text-destructive">
              Não foi possível carregar os casos.
              <Button variant="outline" size="sm" onClick={() => clientsQ.refetch()}>
                <RefreshCw className="size-4" /> Tentar de novo
              </Button>
            </div>
          ) : (
            <select
              id="ia-case"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{clientsQ.isLoading ? "Carregando…" : "Escolha um caso ativo"}</option>
              {(clientsQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.preferred_name || c.full_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {!clientId && (
          <p className="text-[15px] text-muted-foreground">
            Nenhum caso selecionado. Sem caso, não há evidências nem hipóteses.
          </p>
        )}
        {clientId && caseQ.isLoading && <p className="text-[15px] text-muted-foreground">Analisando…</p>}
        {clientId && caseQ.isError && (
          <div role="alert" className="flex items-center gap-3 text-[15px] text-destructive">
            Falha ao ler o caso.
            <Button variant="outline" size="sm" onClick={() => caseQ.refetch()}>
              <RefreshCw className="size-4" /> Tentar de novo
            </Button>
          </div>
        )}

        {ev && (
          <>
            <section aria-labelledby="ev-h" className="space-y-3">
              <h2 id="ev-h" className="text-lg font-semibold text-foreground">
                Evidências detectadas ({ev.patterns.length})
              </h2>
              {ev.patterns.length === 0 ? (
                <p className="text-[15px] text-muted-foreground">
                  Nenhuma repetição detectada com os dados atuais ({caseQ.data!.persons.length}{" "}
                  familiares). Sem evidência, nenhuma hipótese é sugerida.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ev.patterns.map((p) => (
                    <li key={p.id} className="rounded-lg border border-border bg-card p-3 text-[15px]">
                      <strong>{p.title}</strong> — {p.description}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {ev.hypotheses.length > 0 && (
              <section aria-labelledby="hy-h" className="space-y-3">
                <h2 id="hy-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Brain className="size-5" aria-hidden /> Hipóteses provisórias
                </h2>
                {ev.hypotheses.map((h) => (
                  <article key={h.id} className="space-y-2 rounded-lg border border-border bg-card p-4">
                    <h3 className="text-[16px] font-semibold">{h.title}</h3>
                    <p className="text-[15px]">{h.description}</p>
                    <p className="text-[15px]">
                      <strong>Fontes:</strong> {h.sources.join(", ")}
                    </p>
                    <p className="text-[14px] text-muted-foreground">
                      <strong>Limites:</strong> {h.limits}
                    </p>
                    <div className="text-[15px]">
                      <strong>Perguntas para a sessão:</strong>
                      <ul className="ml-5 list-disc">
                        {h.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </section>
            )}
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId }}
              className="inline-flex min-h-11 items-center text-[15px] font-medium text-primary underline underline-offset-4"
            >
              Abrir o caso
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
