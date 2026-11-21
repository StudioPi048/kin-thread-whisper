import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ListFilter, MapPin, RefreshCw, ZoomIn } from "lucide-react";

import { clinicalIntelQuery, getGenogramTopology, getMappablePersons } from "@/lib/clinical-intel";
import { buildLogicalGraph } from "@/lib/geno/build";
import { Button } from "@/components/ui/button";
import {
  buildCaseTimeline,
  filterTimeline,
  formatByPrecision,
  groupTimelineList,
  yearRange,
  type TimelineBranch,
  type CaseTimelineItem,
  type TimelineFilter,
  type TimelineKind,
  type TimelineGrouping,
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
const WATCH_ART = "/assets/genealiz/acervo/relogio.webp";
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
  const [groupBy, setGroupBy] = useState<TimelineGrouping>("none");
  const [previousPeriods, setPreviousPeriods] = useState<Array<number | undefined>>([]);
  const [view, setView] = useState<"chart" | "list" | null>(null);
  const [selection, setSelection] = useState<string | null>(focusEvent ?? null);
  const all = useMemo(() => {
    if (!q.data) return [];
    const rels = q.data.relationships;
    const graph = buildLogicalGraph({
      ...getGenogramTopology(q.data),
      probandId: q.data.persons.find((person) => person.is_proband)?.id,
    });
    const persons = Array.from(graph.persons.values(), ({ row }) => row);
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
  const hasCalendarDate = undated.filter(({ precision }) => precision === "month_day");
  const withoutDate = undated.filter(({ precision }) => precision !== "month_day");
  const zoomYear = selected?.year ?? dated[0]?.year;
  const zoomDecade =
    zoomYear == null || !scale || scale.toYear - scale.fromYear < 10
      ? undefined
      : Math.floor(zoomYear / 10) * 10;
  function goToDecade(decade: number | undefined) {
    if (filter.decade === decade) return;
    setPreviousPeriods((previous) => [...previous, filter.decade]);
    setFilter((current) => ({ ...current, decade }));
  }
  function returnToPeriod() {
    setFilter((current) => ({ ...current, decade: previousPeriods.at(-1) }));
    setPreviousPeriods((previous) => previous.slice(0, -1));
  }
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
      <div className="case-timeline-empty">
        <img className="case-timeline-watch" src={WATCH_ART} alt="" width={500} height={387} />
        <div>
          <h2 className="text-lg font-semibold text-primary">
            Ainda não há registros na linha do tempo
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Abra a planilha para preencher datas ou a ficha de um familiar para registrar um evento.
          </p>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link to="/app/clientes/$clientId" params={{ clientId }} search={{ tab: "clan" }}>
              Abrir planilha do clã
            </Link>
          </Button>
        </div>
      </div>
    );

  const selectClass =
    "h-11 min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground";
  const activeView = view ?? (focusEvent ? "list" : scale ? "chart" : "list");
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
      <header className="case-timeline-heading">
        <div className="case-timeline-heading-title">
          <h2>Linha do tempo</h2>
          <p role="status">
            {items.length} de {all.length} {all.length === 1 ? "registro" : "registros"}
          </p>
        </div>
        <div className="case-timeline-actions">
          {selected && (
            <div
              className="case-timeline-view-switch"
              role="group"
              aria-label="Modo da linha do tempo"
            >
              <Button
                type="button"
                variant={activeView === "list" ? "secondary" : "ghost"}
                className="min-h-11"
                aria-pressed={activeView === "list"}
                onClick={() => setView("list")}
              >
                Lista
              </Button>
              <Button
                type="button"
                variant={activeView === "chart" ? "secondary" : "ghost"}
                className="min-h-11"
                aria-pressed={activeView === "chart"}
                onClick={() => setView("chart")}
              >
                Panorama
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant={filtersOpen ? "secondary" : "outline"}
            className="min-h-11"
            aria-controls="timeline-filters"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <ListFilter size={16} aria-hidden /> Filtros
            {activeFilters.length > 0 && ` (${activeFilters.length})`}
          </Button>
        </div>
      </header>
      <div
        id="timeline-filters"
        className="case-timeline-filters"
        hidden={!filtersOpen}
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
            onChange={(e) => goToDecade(e.target.value ? Number(e.target.value) : undefined)}
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
      {activeFilters.length > 0 && (
        <div className="case-timeline-applied-filters">
          <ul aria-label="Filtros ativos">
            {activeFilters.map((label, index) => (
              <li key={index}>{label}</li>
            ))}
          </ul>
          <Button
            variant="link"
            className="min-h-11 px-1"
            onClick={() => {
              setFilter({});
              setPreviousPeriods([]);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      )}

      {!selected ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>Nenhum registro com esses filtros.</p>
          {previousPeriods.length > 0 && (
            <Button variant="outline" className="min-h-11" onClick={returnToPeriod}>
              Voltar ao intervalo anterior
            </Button>
          )}
        </div>
      ) : (
        <div className="case-timeline-layout" data-view={activeView}>
          <section className="case-timeline-list" aria-labelledby="case-timeline-list-title">
            <div className="case-timeline-list-heading">
              <h2 id="case-timeline-list-title">Acontecimentos</h2>
              {dated.length > 1 && (
                <label className="grid min-w-0 gap-1 text-sm text-ink-soft">
                  Agrupar acontecimentos
                  <select
                    className={selectClass}
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as TimelineGrouping)}
                  >
                    <option value="none">Ordem cronológica</option>
                    <option value="decade">Por década</option>
                    <option value="generation">Por geração</option>
                  </select>
                </label>
              )}
            </div>
            {dated.length > 0 &&
              groupTimelineList(dated, groupBy).map(({ value, items }) => {
                const label =
                  groupBy === "none"
                    ? null
                    : value === null
                      ? "Geração não identificada"
                      : groupBy === "decade"
                        ? `${value}–${value + 9}`
                        : GEN_LABEL(value);
                return (
                  <div className="case-timeline-list-group" key={value ?? "none"}>
                    {label && <h3>{label}</h3>}
                    <TimelineList
                      items={items}
                      selected={selected}
                      clientId={clientId}
                      onSelect={setSelection}
                      label={label ?? "Registros com data"}
                    />
                  </div>
                );
              })}
            {hasCalendarDate.length > 0 && (
              <div className="case-timeline-undated">
                <h3>
                  Dia e mês, sem ano <span>{hasCalendarDate.length}</span>
                </h3>
                <TimelineList
                  items={hasCalendarDate}
                  selected={selected}
                  clientId={clientId}
                  onSelect={setSelection}
                  label="Registros com dia e mês, sem ano"
                />
              </div>
            )}
            {withoutDate.length > 0 && (
              <div className="case-timeline-undated">
                <h3>
                  Sem data para o gráfico <span>{withoutDate.length}</span>
                </h3>
                <TimelineList
                  items={withoutDate}
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
            zoomDecade={zoomDecade}
            onZoom={goToDecade}
            onReturnToPeriod={previousPeriods.length ? returnToPeriod : undefined}
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
            data-precision={item.precision}
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
  zoomDecade,
  onZoom,
  onReturnToPeriod,
}: {
  scale: Scale;
  compareBranches: boolean;
  onCompareBranches?: () => void;
  zoomDecade?: number;
  onZoom: (decade: number) => void;
  onReturnToPeriod?: () => void;
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
        <div className="case-timeline-overview-title">
          <div>
            <h2 id="case-timeline-overview-title">Panorama cronológico</h2>
            {scale && (
              <p className="case-timeline-range">
                {scale.fromYear === scale.toYear
                  ? scale.fromYear
                  : `${scale.fromYear} – ${scale.toYear}`}
              </p>
            )}
          </div>
        </div>
        {scale && onCompareBranches && (
          <Button
            type="button"
            variant="outline"
            className="case-timeline-compare min-h-11"
            aria-pressed={compareBranches}
            onClick={onCompareBranches}
          >
            Comparar ramos
          </Button>
        )}
        <img
          className="case-timeline-watch"
          src={WATCH_ART}
          alt=""
          width={500}
          height={387}
          decoding="async"
        />
      </header>
      {(onReturnToPeriod || zoomDecade !== undefined) && (
        <div className="case-timeline-range-tools" role="group" aria-label="Escala cronológica">
          {onReturnToPeriod && (
            <Button
              variant="outline"
              className="min-h-11 whitespace-normal text-left"
              onClick={onReturnToPeriod}
            >
              <ChevronLeft size={16} aria-hidden /> Voltar ao intervalo anterior
            </Button>
          )}
          {zoomDecade !== undefined && (
            <Button
              variant="outline"
              className="min-h-11 whitespace-normal text-left"
              onClick={() => onZoom(zoomDecade)}
            >
              <ZoomIn size={16} aria-hidden /> Aproximar década de {zoomDecade}
            </Button>
          )}
        </div>
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
                <h3>{title}</h3>
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
          search={
            item.relationshipId
              ? { tab: "genogram", relation: item.relationshipId }
              : { tab: "genogram", person: item.personId }
          }
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-forest hover:underline"
        >
          <MapPin className="size-4" aria-hidden />{" "}
          {item.relationshipId ? "Ver vínculo no mapa" : "Ver no mapa"}
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
