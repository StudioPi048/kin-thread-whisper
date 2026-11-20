import { GenogramThumbnail } from "@/components/genogram/genogram-thumbnail";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GitBranch, Network, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentHeader } from "@/components/ui/document-header";
import { buildLogicalGraph, validateGraph } from "@/lib/geno/build";
import { getMappablePersons } from "@/lib/clinical-intel";
import { readClientNamePage } from "@/lib/client-index";
import { readPref } from "@/lib/recent-activity";
import { ArchiveEmptyState } from "@/components/ui/archive-empty-state";

export const Route = createFileRoute("/_authenticated/app/genossociogramas")({
  component: GenogramsPage,
});

const pageSize = 12;

type CardClient = Awaited<ReturnType<typeof readClientNamePage>>["clients"][number];

async function readPreview(clientId: string) {
  const readAll = async <T,>(
    getPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) => {
    const rows: T[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await getPage(from, from + 499);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
  };
  const [raw, rels] = await Promise.all([
    readAll((from, to) =>
      supabase
        .from("genogram_persons")
        .select("*")
        .eq("client_id", clientId)
        .order("id")
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("genogram_relationships")
        .select("*")
        .eq("client_id", clientId)
        .order("id")
        .range(from, to),
    ),
  ]);
  const persons = getMappablePersons(raw, rels);
  const graph = buildLogicalGraph({
    persons,
    rels,
    probandId: persons.find((p) => p.is_proband)?.id,
  });
  return {
    persons,
    rels,
    generations: new Set(Array.from(graph.persons.values(), (person) => person.generation)).size,
    pending: graph.pendingPersonIds.size,
    consistent: validateGraph(graph).ok,
  };
}

function MapCard({ client, userId }: { client: CardClient; userId: string }) {
  const [requested, setRequested] = useState(false);
  const [lastPerson, setLastPerson] = useState<string>();
  useEffect(() => {
    setLastPerson(readPref<{ personId?: string }>(userId, `map-focus:${client.id}`, {}).personId);
  }, [userId, client.id]);
  const preview = useQuery({
    queryKey: ["genogram-gallery-preview", client.id, userId],
    queryFn: () => readPreview(client.id),
    enabled: requested,
  });
  const label = client.preferred_name || client.full_name;
  return (
    <article className="gv-map-card">
      <div className="gv-map-card-preview grid place-items-center">
        {preview.data ? (
          <GenogramThumbnail persons={preview.data.persons} rels={preview.data.rels} />
        ) : (
          <div className="flex flex-col items-center gap-3 p-4 text-center text-forest">
            <Network size={28} strokeWidth={1.3} aria-hidden />
            {preview.isFetching ? (
              <p role="status" className="text-sm">
                Carregando prévia…
              </p>
            ) : preview.isError ? (
              <>
                <p role="alert" className="text-sm text-destructive">
                  Prévia indisponível.
                </p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void preview.refetch()}
                >
                  Tentar novamente
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setRequested(true)}
                aria-label={`Carregar prévia de ${label}`}
              >
                Carregar prévia
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="gv-map-card-body space-y-2">
        <h2 className="break-words font-sans text-lg font-semibold text-ink">{label}</h2>
        {client.preferred_name && client.preferred_name !== client.full_name && (
          <p className="text-sm text-ink-soft">{client.full_name}</p>
        )}
        {preview.data && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <GitBranch size={16} aria-hidden />
            {preview.data.persons.length} {preview.data.persons.length === 1 ? "pessoa" : "pessoas"}
            {" · "}
            {preview.data.generations} {preview.data.generations === 1 ? "geração" : "gerações"}
            {preview.data.pending > 0
              ? ` · ${preview.data.pending} para revisar`
              : !preview.data.consistent
                ? " · Há vínculos a conferir"
                : ""}
          </p>
        )}
      </div>
      <div className="gv-map-card-footer">
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: client.id }}
          search={{ tab: "genogram", ...(lastPerson ? { person: lastPerson } : {}) }}
          aria-label={`${lastPerson ? "Retomar familiar no mapa" : "Ver árvore"} de ${label}`}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest"
        >
          {lastPerson ? "Retomar familiar" : "Ver árvore"} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function GenogramsPage() {
  const { user } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (activeSearch === search.trim()) return;
      setActiveSearch(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [search, activeSearch]);

  const gallery = useQuery({
    queryKey: ["genograms-list", user.id, activeSearch, page],
    queryFn: () => readClientNamePage(user.id, activeSearch, page * pageSize, pageSize),
    placeholderData: keepPreviousData,
    gcTime: 0,
  });
  const waiting = activeSearch !== search.trim() || gallery.isPending || gallery.isPlaceholderData;
  const clients = gallery.data?.clients ?? [];

  return (
    <div>
      <DocumentHeader
        breadcrumb="Genossociogramas"
        title="Genossociogramas"
        subtitle="Abra as árvores ativas e retome a última pessoa que você consultou."
      />
      <div className="container-liz space-y-6 py-2">
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={96}
            placeholder="Buscar por cliente…"
            aria-label="Buscar árvore por cliente"
            className="min-h-11 pl-9"
          />
        </div>
        {waiting ? (
          <p role="status" className="text-sm text-ink-soft">
            Carregando árvores…
          </p>
        ) : gallery.isError ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-4 text-sm"
            role="alert"
          >
            Não foi possível carregar os genossociogramas.
            <Button variant="outline" className="min-h-11" onClick={() => void gallery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : clients.length === 0 ? (
          <ArchiveEmptyState
            eyebrow="Arquivo de árvores"
            title={search ? "Nenhuma árvore com esse nome" : "Nenhuma árvore nesta página"}
            description={
              search
                ? "Confira a grafia ou limpe a busca."
                : "Abra um dossiê para registrar a primeira pessoa."
            }
            action={
              search ? (
                <Button variant="outline" className="min-h-11" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              ) : page === 0 ? (
                <Button asChild className="min-h-11">
                  <Link to="/app/clientes">Abrir Clientes</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="gv-map-gallery">
            {clients.map((client) => (
              <MapCard key={client.id} client={client} userId={user.id} />
            ))}
          </div>
        )}
        {!waiting && !gallery.isError && (page > 0 || gallery.data?.hasMore) && (
          <nav
            className="flex flex-wrap items-center gap-3"
            aria-label="Páginas de genossociogramas"
          >
            <Button
              variant="outline"
              className="min-h-11"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={16} aria-hidden /> Anterior
            </Button>
            <span className="text-sm text-ink-soft" aria-live="polite">
              Página {page + 1}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!gallery.data?.hasMore}
              onClick={() => setPage(page + 1)}
            >
              Próxima <ArrowRight size={16} aria-hidden />
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
