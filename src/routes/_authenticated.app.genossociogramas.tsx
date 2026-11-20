import { GenogramThumbnail } from "@/components/genogram/genogram-thumbnail";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TreePine,
  Search,
  GitBranch,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DocumentHeader } from "@/components/ui/document-header";
import { buildLogicalGraph, validateGraph } from "@/lib/geno/build";
import { detectPatterns, type PersonRow, type RelationshipRow } from "@/lib/patterns";
import { getMappablePersons } from "@/lib/clinical-intel";
import { readPref } from "@/lib/recent-activity";
import { ArchiveEmptyState } from "@/components/ui/archive-empty-state";

export const Route = createFileRoute("/_authenticated/app/genossociogramas")({
  component: GenogramsPage,
});

function GenogramsPage() {
  const { user } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const {
    data: clients = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["genograms-list", user.id],
    queryFn: async () => {
      const { data: clientRows, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name")
        .eq("status", "active")
        .order("full_name");

      if (clientsError) throw clientsError;
      const clientIds = (clientRows ?? []).map((c) => c.id);
      if (clientIds.length === 0) return [];

      const [people, links, layouts] = await Promise.all([
        supabase.from("genogram_persons").select("*").in("client_id", clientIds),
        supabase.from("genogram_relationships").select("*").in("client_id", clientIds),
        supabase
          .from("genogram_layouts")
          .select("client_id, updated_at")
          .in("client_id", clientIds),
      ]);
      const error = people.error ?? links.error ?? layouts.error;
      if (error) throw error;
      const personRows = people.data ?? [];
      const relRows = links.data ?? [];
      const lastUpdated = new Map<string, string>();
      for (const row of [...personRows, ...relRows, ...(layouts.data ?? [])]) {
        const timestamp = row.updated_at;
        if (timestamp && timestamp > (lastUpdated.get(row.client_id) ?? "")) {
          lastUpdated.set(row.client_id, timestamp);
        }
      }

      const personsByClient = new Map<string, PersonRow[]>();
      for (const p of personRows ?? []) {
        if (!personsByClient.has(p.client_id)) personsByClient.set(p.client_id, []);
        personsByClient.get(p.client_id)!.push(p);
      }
      const relsByClient = new Map<string, RelationshipRow[]>();
      for (const r of relRows ?? []) {
        if (!relsByClient.has(r.client_id)) relsByClient.set(r.client_id, []);
        relsByClient.get(r.client_id)!.push(r);
      }

      return (clientRows ?? []).map((c) => {
        const rels = relsByClient.get(c.id) ?? [];
        const persons = getMappablePersons(personsByClient.get(c.id) ?? [], rels);
        const proband = persons.find((p) => p.is_proband);
        const graph = buildLogicalGraph({ persons, rels, probandId: proband?.id });
        const generations = new Set(Array.from(graph.persons.values()).map((p) => p.generation))
          .size;
        const patternsCount = detectPatterns(persons, rels).length;
        const consistent = validateGraph(graph).ok;

        return {
          ...c,
          persons,
          rels,
          personCount: persons.length,
          generations,
          patternsCount,
          consistent,
          pending: graph.pendingPersonIds.size,
          updatedAt: lastUpdated.get(c.id),
        };
      });
    },
  });

  const filtered = clients.filter((c) =>
    (c.preferred_name || c.full_name).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <DocumentHeader
        breadcrumb="Genossociogramas"
        title="Genossociogramas"
        subtitle="Explore e gerencie as árvores genealógicas ativas dos seus clientes."
      />

      <div className="container-liz py-2 space-y-6">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              aria-label="Buscar por cliente"
              className="pl-9 h-10 text-[14px]"
            />
          </div>
        </div>

        {/* Genograms list */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-48" />
            ))}
          </div>
        ) : isError ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border border-border p-4 text-sm"
            role="alert"
          >
            Não foi possível carregar os genossociogramas.
            <Button variant="outline" className="min-h-11" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <ArchiveEmptyState
            image="/assets/renders/arvore-genealogica-bronze.jpg"
            withSeal={false}
            eyebrow="Arquivo de árvores"
            title={search ? "Nenhuma árvore com esse nome." : "Nenhum genossociograma disponível."}
            description={
              search
                ? "Confira a grafia ou limpe a busca para ver todas as árvores ativas."
                : "Escolha um dossiê para registrar os primeiros familiares e seus vínculos."
            }
            action={
              !search && (
                <Link to="/app/clientes">
                  <Button className="gap-2 bg-forest font-bold text-white hover:bg-forest-mid">
                    <TreePine className="size-4" />
                    Escolher um cliente para começar
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="gv-map-gallery">
            {filtered.map((c) => {
              const remembered = mounted
                ? readPref<{ personId?: string }>(user.id, `map-focus:${c.id}`, {}).personId
                : undefined;
              const lastPerson = remembered
                ? c.persons.find((person) => person.id === remembered)
                : undefined;
              return (
                <div key={c.id} className="gv-map-card">
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    search={{ tab: "genogram" }}
                    className="gv-map-card-preview"
                    aria-label={`Abrir genossociograma de ${c.preferred_name || c.full_name}`}
                  >
                    <GenogramThumbnail persons={c.persons} rels={c.rels} />
                    <span>
                      Explorar árvore <ArrowRight size={15} />
                    </span>
                  </Link>
                  <div className="space-y-3 gv-map-card-body">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-serif text-xl font-bold text-primary">
                        {c.preferred_name || c.full_name}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-forest border-forest bg-forest/5 text-[10px] font-bold shrink-0"
                      >
                        {c.personCount === 0
                          ? "Não iniciado"
                          : `${c.personCount} ${c.personCount === 1 ? "pessoa" : "pessoas"}`}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-[13px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <GitBranch className="size-4 text-forest shrink-0" />
                        <span>
                          {c.generations === 0
                            ? "Nenhuma geração mapeada"
                            : `${c.generations} ${c.generations === 1 ? "geração mapeada" : "gerações mapeadas"}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-gold shrink-0" />
                        <span>
                          {c.patternsCount === 0
                            ? "Nenhum padrão identificado"
                            : `${c.patternsCount} ${c.patternsCount === 1 ? "padrão transgeracional ativo" : "padrões transgeracionais ativos"}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {c.updatedAt && (
                    <p className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">
                      <Clock3 className="size-4" aria-hidden />
                      Editado em{" "}
                      {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
                        new Date(c.updatedAt),
                      )}
                    </p>
                  )}
                  <div className="gv-map-card-footer flex flex-wrap justify-between items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                      {c.personCount === 0 ? null : c.consistent && !c.pending ? (
                        <>
                          <CheckCircle2 className="size-3.5 text-clinical-positive" />
                          Consistente
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="size-3.5 text-clinical-warning" />
                          {c.pending ? `${c.pending} para revisar` : "Pendências"}
                        </>
                      )}
                    </span>

                    <Link
                      to="/app/clientes/$clientId"
                      params={{ clientId: c.id }}
                      search={{ tab: "genogram", ...(lastPerson ? { person: lastPerson.id } : {}) }}
                      title={
                        lastPerson
                          ? lastPerson.preferred_name || lastPerson.full_name || undefined
                          : undefined
                      }
                      className="min-h-11 font-bold text-[13px] text-forest hover:text-forest flex items-center gap-1"
                    >
                      {lastPerson ? "Retomar familiar" : "Ver árvore"}{" "}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
