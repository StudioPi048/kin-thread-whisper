import { Link } from "@tanstack/react-router";
import type { DetectedPattern, EvidenceFact, PersonRow } from "@/lib/patterns";
import { formatByPrecision } from "@/lib/timeline";

const fields: Record<EvidenceFact["field"], string> = {
  birth_date: "Nascimento",
  death_date: "Falecimento",
  cause_of_death: "Causa do falecimento",
  health_conditions: "Condição de saúde",
  occupation: "Ocupação",
  qualifier: "Natureza do vínculo",
  start_date: "Início do vínculo",
  end_date: "Fim do vínculo",
};

function factValue({ value, field, precision }: EvidenceFact) {
  if (precision) return formatByPrecision(value, precision);
  if (field === "qualifier") {
    if (value === "rupture") return "Ruptura";
    if (value === "conflict") return "Conflito";
  }
  return value;
}

export function EvidenceSources({
  clientId,
  pattern,
  persons,
}: {
  clientId: string;
  pattern: DetectedPattern;
  persons: PersonRow[];
}) {
  if (!pattern.facts.length) return null;
  const nameById = new Map(
    persons.map((person) => [person.id, person.full_name || person.preferred_name]),
  );
  const facts = [
    ...new Map(
      pattern.facts.map((fact) => [
        JSON.stringify([fact.source, fact.recordId, fact.field, fact.value]),
        fact,
      ]),
    ).entries(),
  ];

  return (
    <details className="border-t border-border">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-forest focus-visible:outline-2 focus-visible:outline-ring">
        Registros consultados ({facts.length})
      </summary>
      <ul className="space-y-3 pb-3 text-sm text-ink-soft">
        {facts.map(([key, fact]) => (
          <li key={key} className="grid gap-1">
            <span>
              <strong className="text-ink">{fields[fact.field]}</strong> · {factValue(fact)}
            </span>
            <span className="flex flex-wrap gap-x-3">
              {(fact.personIds ?? [fact.recordId]).map((id) => (
                <Link
                  key={id}
                  to="/app/clientes/$clientId"
                  params={{ clientId }}
                  search={{ tab: "genogram", person: id }}
                  className="inline-flex min-h-11 items-center text-forest underline underline-offset-4"
                >
                  {nameById.get(id) || "Familiar sem nome"}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
