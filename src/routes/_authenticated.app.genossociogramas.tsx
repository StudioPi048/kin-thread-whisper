import { GenogramThumbnail } from "@/components/genogram/genogram-thumbnail";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, GitBranch, Network, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentHeader } from "@/components/ui/document-header";
import { buildLogicalGraph, validateGraph } from "@/lib/geno/build";
import { getGenogramTopology, splitFamilyRecords } from "@/lib/clinical-intel";
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
  const topology = getGenogramTopology(splitFamilyRecords(raw, rels));
  const graph = buildLogicalGraph({
    ...topology,
    probandId: topology.persons.find((p) => p.is_proband)?.id,
  });
  return {
    ...topology,
    peopleCount: graph.persons.size,
    generations: new Set(Array.from(graph.persons.values(), (person) => person.generation)).size,
    pending: graph.pendingPersonIds.size,
    consistent: validateGraph(graph).ok,
  };
}

function MapRecord({ client, userId }: { client: CardClient; userId: string }) {
  const [requested, setRequested] = useState(false);
  const previewId = useId();
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
    <article className="archive-map-record">
      <div className="archive-map-record-row">
        <Network size={22} strokeWidth={1.55} aria-hidden />
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-ink">{label}</h2>
          {client.preferred_name && client.preferred_name !== client.full_name && (
            <p className="break-words text-sm text-ink-soft">{client.full_name}</p>
          )}
          {preview.data && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
              <GitBranch size={16} aria-hidden />
              {preview.data.peopleCount} {preview.data.peopleCount === 1 ? "pessoa" : "pessoas"}
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
        <div className="archive-map-actions">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            aria-expanded={requested}
            aria-controls={previewId}
            aria-label={`${requested ? "Fechar" : "Carregar"} prévia de ${label}`}
            onClick={() => setRequested(!requested)}
          >
            {requested ? "Fechar prévia" : "Ver prévia"}
          </Button>
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId: client.id }}
            search={{ tab: "genogram", ...(lastPerson ? { person: lastPerson } : {}) }}
            aria-label={`${lastPerson ? "Retomar familiar no mapa" : "Ver árvore"} de ${label}`}
            className="archive-text-action"
          >
            {lastPerson ? "Retomar familiar" : "Abrir árvore"} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <div id={previewId} hidden={!requested} className="archive-map-preview">
        {requested &&
          (preview.data ? (
            <GenogramThumbnail persons={preview.data.persons} rels={preview.data.rels} />
          ) : preview.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-destructive">
                Prévia indisponível.
              </p>
              <Button variant="outline" className="min-h-11" onClick={() => void preview.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <p role="status" className="text-sm text-ink-soft">
              Carregando prévia…
            </p>
          ))}
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
    <div className="archive-map-index-page">
      <DocumentHeader
        breadcrumb="Genossociogramas"
        title="Genossociogramas"
        subtitle="Abra as árvores ativas e retome a última pessoa que você consultou."
        illustration={<img src="/assets/genealiz/acervo/raizes.webp" alt="" decoding="async" />}
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
          <ul className="archive-register" aria-label="Árvores por cliente">
            {clients.map((client) => (
              <li key={client.id}>
                <MapRecord client={client} userId={user.id} />
              </li>
            ))}
          </ul>
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
