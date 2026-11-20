import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { clinicalIntelQuery, getMappablePersons } from "@/lib/clinical-intel";
import { detectPatterns } from "@/lib/patterns";

export function CaseDashboard({ clientId }: { clientId: string }) {
  const intel = useQuery(clinicalIntelQuery(clientId));

  const persons = intel.data
    ? getMappablePersons(intel.data.persons, intel.data.relationships)
    : [];
  const female = persons.filter((person) =>
    ["feminino", "female"].includes(person.gender ?? ""),
  ).length;
  const male = persons.filter((person) =>
    ["masculino", "male"].includes(person.gender ?? ""),
  ).length;
  const composition = [
    { label: "Feminino", value: female, color: "bg-forest" },
    { label: "Masculino", value: male, color: "bg-forest-soft" },
    {
      label: "Outro ou não informado",
      value: persons.length - female - male,
      color: "bg-archive-old",
    },
  ];
  const stats = intel.data
    ? [
        { label: "Pessoas no mapa", value: persons.length },
        { label: "Vínculos", value: intel.data.relationships.length },
        {
          label: "Padrões detectados",
          value: detectPatterns(persons, intel.data.relationships).length,
        },
        {
          label: "Falecimentos",
          value: persons.filter(
            (person) => person.is_deceased || person.death_date || person.death_date_partial,
          ).length,
        },
        {
          label: "Pessoas com condições de saúde registradas",
          value: persons.filter((person) => person.health_conditions?.length).length,
        },
      ]
    : [];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[15px] font-semibold text-ink">Composição do mapa</h3>
      {intel.isError ? (
        <div className="mt-3 text-sm text-destructive">
          <p role="alert">Não foi possível atualizar a composição.</p>
          <Button
            variant="link"
            className="min-h-11 px-0"
            disabled={intel.isFetching}
            onClick={() => void intel.refetch()}
          >
            {intel.isFetching ? "Carregando…" : "Tentar novamente"}
          </Button>
        </div>
      ) : (
        !intel.data && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Carregando familiares e vínculos…
          </p>
        )
      )}
      {intel.data && (
        <>
          <dl className="mt-3 divide-y divide-border">
            {stats.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-3 py-2 text-sm">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="shrink-0 font-semibold tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {persons.length > 0 && (
            <div className="mt-3 border-t border-border pt-4">
              <h4 className="mb-2 text-sm font-semibold text-ink">Gênero registrado</h4>
              <div
                className="flex h-2 overflow-hidden rounded-full border border-border"
                aria-hidden
              >
                {composition
                  .filter(({ value }) => value > 0)
                  .map(({ label, value, color }) => (
                    <span
                      key={label}
                      className={color}
                      style={{ width: `${(value / persons.length) * 100}%` }}
                    />
                  ))}
              </div>
              <ul className="mt-2 space-y-1">
                {composition.map(({ label, value, color }) => (
                  <li key={label} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span
                      className={`size-2.5 shrink-0 rounded-full border border-border ${color}`}
                      aria-hidden
                    />
                    <span>{label}</span>
                    <span className="ml-auto font-semibold tabular-nums text-ink">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
