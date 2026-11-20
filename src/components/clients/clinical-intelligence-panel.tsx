import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import { evidenceForCase } from "@/lib/evidence";

export function ClinicalIntelligencePanel({ clientId }: { clientId: string }) {
  const query = useQuery(clinicalIntelQuery(clientId));
  const evidence = useMemo(
    () => (query.data ? evidenceForCase(query.data.persons, query.data.relationships) : undefined),
    [query.data],
  );
  const conflicts =
    query.data?.persons.filter(
      (person) => person.birth_date && person.death_date && person.birth_date > person.death_date,
    ) ?? [];
  const questions = [...new Set(evidence?.hypotheses.flatMap(({ questions }) => questions))].slice(
    0,
    3,
  );

  return (
    <details className="rounded-xl border border-border bg-card px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ring">
        Preparar a revisão do caso
      </summary>
      <div className="space-y-4 pb-4 text-[15px]">
        {query.isError ? (
          <>
            <p role="alert" className="text-destructive">
              Não foi possível conferir os registros familiares.
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? "Carregando…" : "Tentar novamente"}
            </Button>
          </>
        ) : !query.data ? (
          <p role="status" className="text-muted-foreground">
            Carregando registros…
          </p>
        ) : (
          <>
            {conflicts.length > 0 && (
              <section className="rounded-md border border-destructive/40 p-3">
                <h3 className="font-semibold text-destructive">Datas para conferir</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                  {conflicts.map((person) => (
                    <li key={person.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId }}
                        search={{ tab: "genogram", person: person.id }}
                        className="underline underline-offset-4"
                      >
                        {person.preferred_name || person.full_name || "Familiar sem nome"}
                      </Link>{" "}
                      tem falecimento anterior ao nascimento.
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {questions.length > 0 && (
              <section>
                <h3 className="font-semibold text-ink">Perguntas para a próxima sessão</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-soft">
                  {questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </section>
            )}
            <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
              <Link to="/app/ia-clinica" search={{ caseId: clientId }}>
                Revisar hipóteses e fontes
              </Link>
            </Button>
          </>
        )}
        <details className="border-t border-border">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ring">
            Legenda do genossociograma
          </summary>
          <ul className="grid gap-2 text-sm text-ink-soft sm:grid-cols-2 xl:grid-cols-1">
            <LegendItem label="Masculino">
              <rect x="5" y="5" width="14" height="14" />
            </LegendItem>
            <LegendItem label="Feminino">
              <circle cx="12" cy="12" r="7" />
            </LegendItem>
            <LegendItem label="Não binário ou não informado">
              <path d="M12 4 20 12 12 20 4 12Z" />
            </LegendItem>
            <LegendItem label="Perda gestacional">
              <path d="M12 5 20 19H4Z" />
            </LegendItem>
            <LegendItem label="Falecimento">
              <rect x="5" y="5" width="14" height="14" />
              <path d="M7 8h10" strokeWidth="2" />
            </LegendItem>
            <LegendItem label="Consultante">
              <rect x="5" y="5" width="14" height="14" />
              <rect x="2" y="2" width="20" height="20" stroke="var(--bronze)" />
            </LegendItem>
          </ul>
        </details>
      </div>
    </details>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="size-5 shrink-0 text-forest"
      >
        {children}
      </svg>
      {label}
    </li>
  );
}
