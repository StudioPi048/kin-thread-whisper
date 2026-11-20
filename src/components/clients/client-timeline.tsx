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
  yearRange,
  type TimelineBranch,
  type CaseTimelineItem,
  type TimelineFilter,
  type TimelineKind,
} from "@/lib/timeline";
import { buildTimelineScale, groupTimelineMarkers } from "@/lib/timeline-scale";
import "./client-timeline.css";

interface Props {
  clientId: string;
  focusEvent?: string;
}

const GEN_LABEL = (g: number) =>
  g === 0
    ? "Geração 0 · consultante e irmãos"
    : g === 1
      ? "Geração 1 · pais e tios"
      : g === 2
        ? "Geração 2 · avós"
        : `Geração ${g}`;
const KIND_LABEL: Record<TimelineKind, string> = {
  birth: "Nascimentos",
  death: "Falecimentos",
  event: "Eventos de vida",
  union: "Uniões e separações",
};
const KINDS: TimelineKind[] = ["birth", "death", "union", "event"];
const BRANCH_LABEL: Record<TimelineBranch, string> = {
  paternal: "Paterno",
  maternal: "Materno",
  other: "Outros ou compartilhados",
};

export function ClientTimeline({ clientId, focusEvent }: Props) {
  const q = useQuery(clinicalIntelQuery(clientId));

  const [filter, setFilter] = useState<TimelineFilter>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareBranches, setCompareBranches] = useState(false);
  const [view, setView] = useState<"chart" | "list" | null>(null);
  const [selection, setSelection] = useState<string | null>(focusEvent ?? null);
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
    return buildCaseTimeline(persons, graph, rels).map((item) => {
      if (item.personIds) return item;
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
  const scale = useMemo(() => buildTimelineScale(items, filter.decade), [items, filter.decade]);
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
      [
        ...new Map(
          getMappablePersons(q.data?.persons ?? [], q.data?.relationships ?? [])
            .filter((person) =>
              all.some((item) => (item.personIds ?? [item.personId]).includes(person.id)),
            )
            .map((person) => [
              person.id,
              [
                person.full_name.trim() || person.preferred_name?.trim() || "Pessoa sem nome",
                person.relationship_to_proband,
              ]
                .filter(Boolean)
                .join(" · "),
            ]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [all, q.data],
  );
  const gens = useMemo(
    () =>
      [...new Set(all.map((i) => i.generation).filter((g): g is number => g !== null))].sort(
        (a, b) => a - b,
      ),
    [all],
  );
  const decades = useMemo(
    () =>
      [
        ...new Set(
          all.flatMap((item) => {
            if (item.year === null) return [];
            const first = Math.floor(item.year / 10) * 10;
            const last = Math.floor((yearRange(item.rawDate)?.last ?? item.year) / 10) * 10;
            return Array.from(
              { length: (last - first) / 10 + 1 },
              (_, index) => first + index * 10,
            );
          }),
        ),
      ].sort((a, b) => a - b),
    [all],
  );
  const hasNoGen = all.some((i) => i.generation === null);

  if (!q.data && !q.isError)
    return (
      <div
        className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"
        role="status"
      >
        Carregando linha do tempo…
      </div>
    );

  if (q.isError && (!q.data || all.length === 0))
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-[15px]">
        <p role="alert">Não foi possível carregar a linha do tempo.</p>
        <Button
          variant="outline"
          className="mt-3 min-h-11"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden />
          {q.isFetching ? "Carregando…" : "Tentar novamente"}
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
  const activeView = view ?? (scale ? "chart" : "list");
  const activeFilters = [
    filter.personId &&
      (people.find(([id]) => id === filter.personId)?.[1] ?? "Familiar indisponível"),
    filter.generation === "none"
      ? "Vínculo não informado"
      : filter.generation !== undefined && GEN_LABEL(filter.generation),
    filter.kind && KIND_LABEL[filter.kind],
    filter.branch && BRANCH_LABEL[filter.branch],
    filter.decade !== undefined && `${filter.decade}–${filter.decade + 9}`,
  ].filter(Boolean);

  return (
    <div className="case-timeline">
      {q.isError && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-destructive">
          <p role="alert">Não foi possível atualizar a linha do tempo.</p>
          <Button
            variant="link"
            className="min-h-11"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            {q.isFetching ? "Carregando…" : "Tentar novamente"}
          </Button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2 sm:hidden">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-controls="timeline-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <ListFilter size={16} aria-hidden /> Filtros{" "}
          {activeFilters.length > 0 && `(${activeFilters.length})`}
        </Button>
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
        <div>
          <label htmlFor="tl-branch">Ramo</label>
          <select
            id="tl-branch"
            className={selectClass}
            value={filter.branch ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                branch: (e.target.value || undefined) as TimelineBranch | undefined,
              })
            }
          >
            <option value="">Todos</option>
            {Object.entries(BRANCH_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tl-decade">Década</label>
          <select
            id="tl-decade"
            className={selectClass}
            value={filter.decade ?? ""}
            onChange={(e) =>
              setFilter({ ...filter, decade: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">Todas</option>
            {decades.map((decade) => (
              <option key={decade} value={decade}>
                {decade}–{decade + 9}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 text-sm text-muted-foreground">
        <p role="status">
          {items.length} de {all.length} registros
        </p>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2">
            <ul aria-label="Filtros ativos" className="flex flex-wrap gap-1.5">
              {activeFilters.map((filter, i) => (
                <li key={i} className="rounded-md bg-archive-old px-2 py-1">
                  {filter}
                </li>
              ))}
            </ul>
            <Button variant="link" className="min-h-11 px-1" onClick={() => setFilter({})}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {!selected ? (
        <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhum registro com esses filtros.
        </p>
      ) : (
        <div className="case-timeline-layout" data-view={activeView}>
          <div
            className="case-timeline-view-switch"
            role="group"
            aria-label="Modo da linha do tempo"
          >
            <Button
              type="button"
              variant={activeView === "list" ? "secondary" : "outline"}
              className="min-h-11"
              aria-pressed={activeView === "list"}
              onClick={() => setView("list")}
            >
              Lista
            </Button>
            <Button
              type="button"
              variant={activeView === "chart" ? "secondary" : "outline"}
              className="min-h-11"
              aria-pressed={activeView === "chart"}
              onClick={() => setView("chart")}
            >
              Gráfico
            </Button>
          </div>
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
            compareBranches={compareBranches && !filter.branch}
            onCompareBranches={
              filter.branch ? undefined : () => setCompareBranches((active) => !active)
            }
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
                <strong>{item.label}</strong>
                <span className="case-timeline-row-person">{item.personName}</span>
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
  compareBranches,
  onCompareBranches,
}: {
  scale: Scale;
  compareBranches: boolean;
  onCompareBranches?: () => void;
  selected: CaseTimelineItem;
  clientId: string;
  onSelect: (key: string) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const active = scale?.events.find(({ item }) => item.key === selected.key);
  const partial = scale?.events.some(({ from, to }) => to !== from);
  const lanes = useMemo(() => {
    const events = scale?.events ?? [];
    if (!compareBranches) {
      return KINDS.flatMap((kind) => {
        const list = events.filter(({ item }) => item.kind === kind);
        return list.length
          ? [{ id: kind, title: KIND_LABEL[kind], groups: groupTimelineMarkers(list) }]
          : [];
      });
    }
    const branches = [
      ["paternal", "Ramo paterno"],
      ["maternal", "Ramo materno"],
      ["other", "Outros ou compartilhados"],
    ] as const;
    return branches.flatMap(([branch, title]) => {
      const list = events.filter(({ item }) => (item.branch ?? "other") === branch);
      return list.length ? [{ id: branch, title, groups: groupTimelineMarkers(list) }] : [];
    });
  }, [scale, compareBranches]);

  const cluster = lanes
    .flatMap((lane) => lane.groups)
    .find((group) => group.members[0].item.key === openGroup && group.members.length > 1);

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
      {scale && onCompareBranches && (
        <Button
          type="button"
          variant="outline"
          className="ml-4 min-h-11"
          aria-pressed={compareBranches}
          onClick={onCompareBranches}
        >
          Comparar ramos
        </Button>
      )}
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
            {lanes.map(({ id, title, groups }) => (
              <div className="case-timeline-lane" key={id} role="group" aria-label={title}>
                <h4>{title}</h4>
                <div className="case-timeline-track">
                  {groups.map((group) => {
                    const index = group.members.findIndex(({ item }) => item.key === selected.key);
                    const item = group.members[0].item;
                    const single = group.members.length === 1;
                    const title = single
                      ? `${item.label} de ${item.personName} · ${formatByPrecision(item.rawDate, item.precision)}`
                      : `Ver ${group.members.length} registros próximos de ${formatByPrecision(item.rawDate, item.precision)}`;
                    return (
                      <div key={group.members[0].item.key}>
                        {group.members
                          .filter(({ from, to }) => to > from)
                          .map(({ item, from, to }) => (
                            <span
                              key={item.key}
                              className="case-timeline-interval"
                              data-kind={item.kind}
                              style={{ left: `${from}%`, width: `${to - from}%` }}
                              aria-hidden="true"
                            />
                          ))}
                        <button
                          type="button"
                          className="case-timeline-pin"
                          aria-label={title}
                          title={title}
                          aria-pressed={single ? index >= 0 : undefined}
                          aria-expanded={
                            single ? undefined : cluster?.members[0].item.key === item.key
                          }
                          aria-controls={single || !cluster ? undefined : "timeline-nearby-events"}
                          style={{ left: `${group.at}%` }}
                          onClick={() => {
                            if (single) {
                              setOpenGroup(null);
                              onSelect(item.key);
                            } else {
                              setOpenGroup(openGroup === item.key ? null : item.key);
                            }
                          }}
                        >
                          <TimelineMark kind={item.kind} />
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
          {partial && <figcaption>As faixas indicam datas aproximadas ou intervalos.</figcaption>}
        </figure>
      ) : (
        <p className="case-timeline-graph-empty">Os registros sem data ou ano ficam na lista.</p>
      )}
      {cluster && (
        <section
          id="timeline-nearby-events"
          className="mt-4 rounded-md border border-border p-3"
          aria-label="Registros próximos na cronologia"
        >
          <h4 className="text-sm font-semibold text-primary">Registros próximos</h4>
          <ul className="mt-1 divide-y divide-border">
            {cluster.members.map(({ item }) => (
              <li key={item.key}>
                <button
                  type="button"
                  aria-pressed={selected.key === item.key}
                  className="min-h-11 w-full px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => onSelect(item.key)}
                >
                  <strong>
                    {item.label} · {item.personName}
                  </strong>
                  <span className="block text-muted-foreground">
                    {formatByPrecision(item.rawDate, item.precision)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
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
          <MapPin className="size-4" aria-hidden />{" "}
          {item.kind === "union" ? "Ver vínculo no mapa" : "Ver no mapa"}
        </Link>
        {item.sourceTab && (
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId }}
            search={{ tab: item.sourceTab, question: item.sourceField }}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest hover:underline"
          >
            Abrir anamnese
          </Link>
        )}
        {item.kind !== "union" && (
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId }}
            search={{ tab: "clan", person: item.personId }}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest hover:underline"
          >
            Ver ficha na planilha
          </Link>
        )}
      </footer>
    </div>
  );
}
