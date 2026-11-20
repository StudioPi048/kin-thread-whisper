import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import { Button } from "@/components/ui/button";
import { detectPatterns, severityStyles } from "@/lib/patterns";
import { EvidenceSources } from "./evidence-sources";

export function PatternsPanel({ clientId }: { clientId: string }) {
  const query = useQuery(clinicalIntelQuery(clientId));
  const patterns = useMemo(
    () => (query.data ? detectPatterns(query.data.persons, query.data.relationships) : []),
    [query.data],
  );

  return (
    <section className="dossier-evidence" aria-labelledby="case-evidence-title">
      <header className="dossier-evidence-head">
        <div className="max-w-xl">
          <h2 id="case-evidence-title" className="dossier-work-heading">
            Evidências no mapa
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            A leitura automática compara os registros do genossociograma. Confira as fontes antes de
            formular uma hipótese.
          </p>
        </div>
        {query.data && patterns.length > 0 && (
          <Button asChild variant="forest" className="min-h-11">
            <Link to="/app/ia-clinica" search={{ caseId: clientId }}>
              Revisar hipóteses deste caso
            </Link>
          </Button>
        )}
      </header>

      {query.isError ? (
        <div className="dossier-evidence-entry">
          <p role="alert" className="text-[15px] text-destructive">
            Não foi possível atualizar as evidências.
          </p>
          <Button
            variant="link"
            className="min-h-11 px-0"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Carregando…" : "Tentar novamente"}
          </Button>
        </div>
      ) : !query.data ? (
        <p role="status" className="dossier-evidence-entry text-[15px] text-ink-soft">
          Carregando evidências…
        </p>
      ) : patterns.length === 0 ? (
        <div className="dossier-evidence-entry">
          <p className="font-semibold text-ink">Nenhuma repetição nos registros atuais</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            Complete datas, ocupações e outras informações conhecidas na planilha do clã.
          </p>
          <Button asChild variant="link" className="min-h-11 px-0">
            <Link to="/app/clientes/$clientId" params={{ clientId }} search={{ tab: "clan" }}>
              Abrir planilha
            </Link>
          </Button>
        </div>
      ) : null}

      {query.data && patterns.length > 0 && (
        <ul className="dossier-evidence-list">
          {patterns.map((pattern) => (
            <li key={pattern.id} className="dossier-evidence-entry">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[16px] font-semibold text-ink">{pattern.title}</h3>
                <span
                  className={`text-sm font-medium ${pattern.severity === "info" ? "text-ink-soft" : "text-clinical-warning"}`}
                >
                  {severityStyles[pattern.severity].label}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed text-ink-soft">{pattern.description}</p>
              <EvidenceSources
                clientId={clientId}
                pattern={pattern}
                persons={query.data!.persons}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
