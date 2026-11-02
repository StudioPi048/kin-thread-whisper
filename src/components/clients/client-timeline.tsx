import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Baby, CalendarClock, Cross, MapPin, RefreshCw, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  buildCaseTimeline,
  filterTimeline,
  formatByPrecision,
  type CaseTimelineItem,
  type TimelineFilter,
  type TimelineKind,
} from "@/lib/timeline";

interface Props {
  clientId: string;
}

const GEN_LABEL = (g: number) =>
  g === 0 ? "Geração 0 · cliente e irmãos" : g === 1 ? "Geração 1 · pais e tios" : g === 2 ? "Geração 2 · avós" : `Geração ${g}`;
const KIND_LABEL: Record<TimelineKind, string> = { birth: "Nascimentos", death: "Falecimentos", event: "Eventos de vida" };

export function ClientTimeline({ clientId }: Props) {
  const q = useQuery({
    queryKey: ["genogram", clientId, "timeline"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genogram_persons").select("*").eq("client_id", clientId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [filter, setFilter] = useState<TimelineFilter>({});
  const all = useMemo(() => buildCaseTimeline(q.data ?? []), [q.data]);
  const items = useMemo(() => filterTimeline(all, filter), [all, filter]);
  const people = useMemo(
    () => [...new Map(all.map((i) => [i.personId, i.personName])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [all],
  );
  const gens = useMemo(
    () => [...new Set(all.map((i) => i.generation).filter((g): g is number => g !== null))].sort((a, b) => a - b),
    [all],
  );
  const hasNoGen = all.some((i) => i.generation === null);

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-lg bg-muted/30" aria-label="Carregando linha do tempo" />;

  if (q.isError)
    return (
      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-[15px]">
        Não foi possível carregar a linha do tempo.
        <Button variant="outline" size="sm" className="ml-3 min-h-11" onClick={() => q.refetch()}>
          <RefreshCw className="mr-1.5 size-4" /> Tentar de novo
        </Button>
      </div>
    );

  if (all.length === 0)
    return (
      <div className="rounded-sm border border-dashed border-border bg-forest-soft/40 p-12 text-center">
        <CalendarClock className="mx-auto size-10 text-forest opacity-60" aria-hidden />
        <p className="mt-4 font-serif text-2xl font-bold text-primary">Ainda não há datas registradas</p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Nascimentos, falecimentos e eventos de vida aparecem aqui quando forem preenchidos na ficha de cada familiar.
        </p>
        <Button asChild variant="outline" className="mt-4 min-h-11">
          <Link to="/app/clientes/$clientId" params={{ clientId }} search={{ tab: "clan" }}>
            Abrir planilha do clã
          </Link>
        </Button>
      </div>
    );

  const dated = items.filter((i) => i.precision !== "unknown");
  const undated = items.filter((i) => i.precision === "unknown");
  const sel = "h-11 rounded-md border border-input bg-background px-2 text-[14px]";

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros da linha do tempo">
        <div className="flex flex-col gap-1">
          <label htmlFor="tl-person" className="text-[13px] font-semibold text-muted-foreground">Familiar</label>
          <select id="tl-person" className={sel} value={filter.personId ?? ""} onChange={(e) => setFilter({ ...filter, personId: e.target.value || undefined })}>
            <option value="">Todos</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tl-gen" className="text-[13px] font-semibold text-muted-foreground">Geração</label>
          <select
            id="tl-gen"
            className={sel}
            value={filter.generation === undefined ? "" : String(filter.generation)}
            onChange={(e) => {
              const v = e.target.value;
              setFilter({ ...filter, generation: v === "" ? undefined : v === "none" ? "none" : Number(v) });
            }}
          >
            <option value="">Todas</option>
            {gens.map((g) => <option key={g} value={g}>{GEN_LABEL(g)}</option>)}
            {hasNoGen && <option value="none">Vínculo não informado</option>}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tl-kind" className="text-[13px] font-semibold text-muted-foreground">Tipo</label>
          <select id="tl-kind" className={sel} value={filter.kind ?? ""} onChange={(e) => setFilter({ ...filter, kind: (e.target.value || undefined) as TimelineKind | undefined })}>
            <option value="">Todos</option>
            {(Object.keys(KIND_LABEL) as TimelineKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </div>
        {(filter.personId || filter.generation !== undefined || filter.kind) && (
          <Button variant="ghost" className="min-h-11" onClick={() => setFilter({})}>Limpar filtros</Button>
        )}
        <p className="ml-auto text-[14px] text-muted-foreground" role="status">{items.length} de {all.length} registros</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-background p-6 text-[15px] text-muted-foreground">
          Nenhum registro com esses filtros.
        </p>
      ) : (
        <>
          {dated.length > 0 && (
            <ol className="space-y-3 border-l-2 border-forest/30 pl-5" aria-label="Registros com data">
              {dated.map((it) => <TimelineCard key={it.key} item={it} clientId={clientId} />)}
            </ol>
          )}
          {undated.length > 0 && (
            <section aria-labelledby="tl-undated" className="space-y-3">
              <h3 id="tl-undated" className="text-[15px] font-semibold text-primary">
                Sem data utilizável ({undated.length}) — não posicionados na cronologia
              </h3>
              <ol className="space-y-3">
                {undated.map((it) => <TimelineCard key={it.key} item={it} clientId={clientId} />)}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TimelineCard({ item, clientId }: { item: CaseTimelineItem; clientId: string }) {
  const Icon = item.kind === "birth" ? Baby : item.kind === "death" ? Cross : Sparkles;
  return (
    <li className="rounded-md border border-border bg-surface-document px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Icon className="size-4 text-forest" aria-hidden />
        <span className="font-mono text-[15px] font-bold tabular-nums text-primary">{formatByPrecision(item.rawDate, item.precision)}</span>
        <span className="text-[15px] font-semibold">{item.label}</span>
        <span className="text-[15px]">· {item.personName}</span>
        {item.relationship && <span className="text-[14px] text-muted-foreground">({item.relationship})</span>}
      </div>
      {item.meta && <p className="mt-1 text-[15px] leading-relaxed">{item.meta}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span>Fonte: {item.source}</span>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId }}
          search={{ tab: "genogram", person: item.personId }}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-forest hover:underline"
        >
          <MapPin className="size-3.5" aria-hidden /> Ver no mapa
        </Link>
      </div>
    </li>
  );
}
