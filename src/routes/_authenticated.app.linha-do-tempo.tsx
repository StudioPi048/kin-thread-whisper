import { useDeferredValue, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";
import { ArchiveEmptyState } from "@/components/ui/archive-empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 12;

export const Route = createFileRoute("/_authenticated/app/linha-do-tempo")({
  component: TimelinesPage,
});

function TimelinesPage() {
  const { user } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(0);
  const cases = useQuery({
    queryKey: ["timelines-list", user.id, tab, deferredSearch, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_timeline_cases", {
        _status: tab,
        _search: deferredSearch,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = cases.data?.slice(0, PAGE_SIZE) ?? [];

  return (
    <div className="archive-timeline-index-page">
      <DocumentHeader
        breadcrumb="Linha do tempo"
        title="Linha do tempo"
        subtitle="Abra a cronologia do caso para consultar acontecimentos e suas fontes."
        illustration={<img src="/assets/genealiz/acervo/relogio.webp" alt="" decoding="async" />}
      />
      <div className="container-liz space-y-5 py-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid w-full max-w-sm gap-1.5 text-sm font-medium">
            Buscar por cliente
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                className="min-h-11 pl-9 text-base"
                maxLength={120}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </label>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value as typeof tab);
              setPage(0);
            }}
          >
            <TabsList aria-label="Estado do caso">
              <TabsTrigger value="active" className="min-h-11">
                Ativos
              </TabsTrigger>
              <TabsTrigger value="archived" className="min-h-11">
                Arquivados
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {cases.isLoading ? (
          <p
            role="status"
            className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          >
            Carregando cronologias…
          </p>
        ) : cases.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm"
          >
            <p className="text-destructive">Não foi possível carregar as cronologias.</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void cases.refetch()}
            >
              Tentar de novo
            </Button>
          </div>
        ) : !rows.length ? (
          <ArchiveEmptyState
            image="/assets/renders/fio-heranca.jpg"
            withSeal={false}
            eyebrow="Linha do tempo"
            title={
              deferredSearch
                ? "Nenhum caso encontrado."
                : tab === "archived"
                  ? "Nenhum caso arquivado."
                  : "Nenhum caso ativo."
            }
            description={
              deferredSearch
                ? "Confira o nome ou limpe a busca."
                : "Os casos aparecem aqui quando são cadastrados."
            }
            action={
              deferredSearch ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setSearch("");
                    setPage(0);
                  }}
                >
                  Limpar busca
                </Button>
              ) : (
                <Button asChild className="min-h-11">
                  <Link to="/app/clientes">Abrir clientes</Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="archive-register" aria-label="Cronologias por cliente">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  to="/app/clientes/$clientId"
                  params={{ clientId: row.id }}
                  search={{ tab: "timeline" }}
                  className="archive-timeline-record"
                >
                  <Calendar className="size-5 shrink-0 text-forest" aria-hidden />
                  <h2 className="min-w-0 break-words text-base font-semibold text-foreground">
                    {row.preferred_name || row.full_name}
                  </h2>
                  <p className="text-sm text-ink-soft">
                    {row.has_events ? "Com acontecimentos" : "Aguardando registros"}
                  </p>
                  <ArrowRight className="size-4 shrink-0 text-bronze" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(page > 0 || (cases.data?.length ?? 0) > PAGE_SIZE) && (
          <nav
            className="flex flex-wrap items-center gap-3 text-sm"
            aria-label="Páginas de cronologias"
          >
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={page === 0 || cases.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <span aria-live="polite">Página {page + 1}</span>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={(cases.data?.length ?? 0) <= PAGE_SIZE || cases.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
