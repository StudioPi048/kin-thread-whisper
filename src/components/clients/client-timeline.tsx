import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ListFilter, MapPin, RefreshCw } from "lucide-react";

import { clinicalIntelQuery, getMappablePersons } from "@/lib/clinical-intel";
import { buildLogicalGraph } from "@/lib/geno/build";
import { Button } from "@/components/ui/button";
import {
  buildCaseTimeline,
  filterTimeline,
  formatByPrecision,
  type CaseTimelineItem,
  type TimelineFilter,
  type TimelineKind,
} from "@/lib/timeline";
import { buildTimelineScale, groupTimelineMarkers } from "@/lib/timeline-scale";
import "./client-timeline.css";

interface Props {
  clientId: string;
}

const GEN_LABEL = (g: number) =>
  g === 0
    ? "Geração 0 · cliente e irmãos"
    : g === 1
      ? "Geração 1 · pais e tios"
      : g === 2
        ? "Geração 2 · avós"
        : `Geração ${g}`;
const KIND_LABEL: Record<TimelineKind, string> = {
  birth: "Nascimentos",
  death: "Falecimentos",
  event: "Eventos de vida",
};
const KINDS: TimelineKind[] = ["birth", "death", "event"];

export function ClientTimeline({ clientId }: Props) {
  const q = useQuery(clinicalIntelQuery(clientId));

  const [filter, setFilter] = useState<TimelineFilter>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const all = useMemo(() => {
    if (!q.data) return [];
    const rels = q.data.relationships;
    const persons = getMappablePersons(q.data.persons, rels);
    const probandId = persons.find((person) => person.is_proband)?.id;
    const graph = buildLogicalGraph({ persons, rels, probandId });
    const byId = new Map(persons.map((person) => [person.id, person]));
    const counts = new Map<string, number>();
    for (const person of persons) {
      const name = person.full_name.trim() || person.preferred_name?.trim() || "Pessoa sem nome";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return buildCaseTimeline(persons, graph).map((item) => {
      const person = byId.get(item.personId);
      if (!person || (counts.get(item.personName) ?? 0) < 2) return item;
      return {
        ...item,
        personName: [person.full_name || item.personName, person.relationship_to_proband]
          .filter(Boolean)
          .join(" · "),
      };
    });
  }, [q.data]);
  const items = useMemo(() => filterTimeline(all, filter), [all, filter]);
  const scale = useMemo(() => buildTimelineScale(items), [items]);
  const [dated, undated] = useMemo(() => {
    const plotted = new Set(scale?.events.map(({ item }) => item.key) ?? []);
    return [
      items.filter((item) => plotted.has(item.key)),
      items.filter((item) => !plotted.has(item.key)),
    ];
  }, [items, scale]);
  const selected = items.find((item) => item.key === selection) ?? dated[0] ?? undated[0];
  const people = useMemo(
    () =>
      [...new Map(all.map((i) => [i.personId, i.personName])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], "pt-BR"),
      ),
    [all],
  );
  const gens = useMemo(
    () =>
      [...new Set(all.map((i) => i.generation).filter((g): g is number => g !== null))].sort(
        (a, b) => a - b,
      ),
    [all],
  );
  const hasNoGen = all.some((i) => i.generation === null);

  if (q.isLoading)
    return (
      <div
        className="h-40 animate-pulse rounded-lg bg-muted/30"
        aria-label="Carregando linha do tempo"
      />
    );

  if (q.isError)
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-[15px]"
      >
        Não foi possível carregar a linha do tempo.
        <Button variant="outline" size="sm" className="ml-3 min-h-11" onClick={() => q.refetch()}>
          <RefreshCw className="mr-1.5 size-4" /> Tentar de novo
        </Button>
      </div>
    );

  if (all.length === 0)
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
        <CalendarClock className="mx-auto size-8 text-forest" aria-hidden />
        <p className="mt-3 text-lg font-semibold text-primary">
          Ainda não há registros na linha do tempo
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Abra a planilha para preencher datas ou a ficha de um familiar para registrar um evento.
        </p>
        <Button asChild variant="outline" className="mt-4 min-h-11">
          <Link to="/app/clientes/$clientId" params={{ clientId }} search={{ tab: "clan" }}>
            Abrir planilha do clã
          </Link>
        </Button>
      </div>
    );

  const selectClass =
    "h-11 min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground";
  const hasFilter = !!(filter.personId || filter.generation !== undefined || filter.kind);

  return (
    <div className="case-timeline">
      <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-controls="timeline-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <ListFilter size={16} aria-hidden /> {hasFilter ? "Filtros ativos" : "Filtros"}
        </Button>
        <p className="text-[14px] text-muted-foreground" role="status">
          {items.length} de {all.length} registros
        </p>
      </div>
      <div
        id="timeline-filters"
        className="case-timeline-filters"
        data-open={filtersOpen}
        role="group"
        aria-label="Filtros da linha do tempo"
      >
        <div>
          <label htmlFor="tl-person">Familiar</label>
          <select
            id="tl-person"
            className={selectClass}
            value={filter.personId ?? ""}
            onChange={(e) => setFilter({ ...filter, personId: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tl-gen">Geração</label>
          <select
            id="tl-gen"
            className={selectClass}
            value={filter.generation === undefined ? "" : String(filter.generation)}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({
                ...filter,
                generation: v === "" ? undefined : v === "none" ? "none" : Number(v),
              });
            }}
          >
            <option value="">Todas</option>
            {gens.map((g) => (
              <option key={g} value={g}>
                {GEN_LABEL(g)}
              </option>
            ))}
            {hasNoGen && <option value="none">Vínculo não informado</option>}
          </select>
        </div>
        <div>
          <label htmlFor="tl-kind">Tipo</label>
          <select
            id="tl-kind"
            className={selectClass}
            value={filter.kind ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                kind: (e.target.value || undefined) as TimelineKind | undefined,
              })
            }
          >
            <option value="">Todos</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
        {hasFilter && (
          <Button variant="ghost" className="min-h-11" onClick={() => setFilter({})}>
            Limpar filtros
          </Button>
        )}
        <p className="case-timeline-count hidden sm:block" role="status">
          {items.length} de {all.length} registros
        </p>
      </div>

      {!selected ? (
        <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhum registro com esses filtros.
        </p>
      ) : (
        <div className="case-timeline-layout">
          <section className="case-timeline-list" aria-labelledby="case-timeline-list-title">
            <h3 id="case-timeline-list-title">Cronologia</h3>
            {dated.length > 0 && (
              <TimelineList
                items={dated}
                selected={selected}
                clientId={clientId}
                onSelect={setSelection}
                label="Registros com data"
              />
            )}
            {undated.length > 0 && (
              <div className="case-timeline-undated">
                <h4>
                  Fora do gráfico por falta de data ou ano <span>{undated.length}</span>
                </h4>
                <TimelineList
                  items={undated}
                  selected={selected}
                  clientId={clientId}
                  onSelect={setSelection}
                  label="Registros sem data ou ano para o gráfico"
                />
              </div>
            )}
          </section>

          <TimelineOverview
            scale={scale}
            selected={selected}
            clientId={clientId}
            onSelect={setSelection}
          />
        </div>
      )}
    </div>
  );
}

function TimelineMark({ kind }: { kind: TimelineKind }) {
  return <span className="case-timeline-mark" data-kind={kind} aria-hidden="true" />;
}

function TimelineList({
  items,
  selected,
  clientId,
  onSelect,
  label,
}: {
  items: CaseTimelineItem[];
  selected: CaseTimelineItem;
  clientId: string;
  onSelect: (key: string) => void;
  label: string;
}) {
  return (
    <ol className="case-timeline-entries" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className="case-timeline-row"
            aria-pressed={selected.key === item.key}
            onClick={() => onSelect(item.key)}
          >
            <span className="case-timeline-row-date">
              {formatByPrecision(item.rawDate, item.precision)}
            </span>
            <span className="case-timeline-row-entry">
              <TimelineMark kind={item.kind} />
              <span>
                <strong>{item.personName}</strong>
                <span className="case-timeline-row-person">{item.label}</span>
              </span>
            </span>
          </button>
          {selected.key === item.key && (
            <div className="case-timeline-row-detail">
              <TimelineEventDetail item={item} clientId={clientId} inline />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

type Scale = ReturnType<typeof buildTimelineScale>;

function TimelineOverview({
  scale,
  selected,
  clientId,
  onSelect,
}: {
  scale: Scale;
  selected: CaseTimelineItem;
  clientId: string;
  onSelect: (key: string) => void;
}) {
  const active = scale?.events.find(({ item }) => item.key === selected.key);
  const partial = scale?.events.some(({ from, to }) => to !== from);
  const lanes = useMemo(
    () =>
      KINDS.flatMap((kind) => {
        const events = scale?.events.filter(({ item }) => item.kind === kind) ?? [];
        return events.length ? [{ kind, groups: groupTimelineMarkers(events) }] : [];
      }),
    [scale],
  );

  return (
    <section className="case-timeline-overview" aria-labelledby="case-timeline-overview-title">
      <header className="case-timeline-overview-header">
        <h3 id="case-timeline-overview-title">Panorama cronológico</h3>
        {scale && (
          <p className="case-timeline-range">
            {scale.fromYear === scale.toYear
              ? scale.fromYear
              : `${scale.fromYear} – ${scale.toYear}`}
          </p>
        )}
      </header>
      {scale ? (
        <figure className="case-timeline-figure">
          <div className="case-timeline-ruler" aria-hidden="true">
            {scale.ticks.map(({ label, at }) => (
              <span key={label} style={{ left: `${at}%` }}>
                {label}
              </span>
            ))}
          </div>
          <div className="case-timeline-plot">
            <div className="case-timeline-grid" aria-hidden="true">
              {scale.ticks.map(({ label, at }) => (
                <span key={label} style={{ left: `${at}%` }} />
              ))}
              {active && <span className="case-timeline-guide" style={{ left: `${active.at}%` }} />}
            </div>
            {lanes.map(({ kind, groups }) => (
              <div
                className="case-timeline-lane"
                key={kind}
                role="group"
                aria-label={KIND_LABEL[kind]}
              >
                <h4>
                  <TimelineMark kind={kind} />
                  {KIND_LABEL[kind]}
                </h4>
                <div className="case-timeline-track">
                  {groups.map((group) => {
                    const index = group.members.findIndex(({ item }) => item.key === selected.key);
                    const next = group.members[(index + 1) % group.members.length].item;
                    const title =
                      group.members.length === 1
                        ? `${next.label} de ${next.personName} · ${formatByPrecision(next.rawDate, next.precision)}`
                        : `${group.members.length} registros próximos. Selecionar ${next.label} de ${next.personName}`;
                    return (
                      <div key={group.members[0].item.key}>
                        {group.members
                          .filter(({ from, to }) => to > from)
                          .map(({ item, from, to }) => (
                            <span
                              key={item.key}
                              className="case-timeline-interval"
                              data-kind={kind}
                              style={{ left: `${from}%`, width: `${to - from}%` }}
                              aria-hidden="true"
                            />
                          ))}
                        <button
                          type="button"
                          className="case-timeline-pin"
                          aria-label={title}
                          title={title}
                          aria-pressed={index >= 0}
                          style={{ left: `${group.at}%` }}
                          onClick={() => onSelect(next.key)}
                        >
                          <TimelineMark kind={kind} />
                          {group.members.length > 1 && (
                            <span className="case-timeline-cluster" aria-hidden="true">
                              {group.members.length}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {partial && (
            <figcaption>As faixas indicam registros com mês ou ano, sem dia exato.</figcaption>
          )}
        </figure>
      ) : (
        <p className="case-timeline-graph-empty">Os registros sem data ou ano ficam na lista.</p>
      )}
      <div className="case-timeline-overview-detail">
        <TimelineEventDetail item={selected} clientId={clientId} />
      </div>
    </section>
  );
}

function TimelineEventDetail({
  item,
  clientId,
  inline = false,
}: {
  item: CaseTimelineItem;
  clientId: string;
  inline?: boolean;
}) {
  return (
    <div className="case-timeline-detail">
      {!inline && (
        <div className="case-timeline-detail-title" aria-live="polite">
          <div>
            <strong>
              {item.label} · {item.personName}
            </strong>
            <span>{formatByPrecision(item.rawDate, item.precision)}</span>
          </div>
          {item.relationship && <span>{item.relationship}</span>}
        </div>
      )}
      {item.meta && <p className="case-timeline-detail-meta">{item.meta}</p>}
      <footer>
        <p>{item.source}</p>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId }}
          search={{ tab: "genogram", person: item.personId }}
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest hover:underline"
        >
          <MapPin className="size-4" aria-hidden /> Ver no mapa
        </Link>
      </footer>
    </div>
  );
}
