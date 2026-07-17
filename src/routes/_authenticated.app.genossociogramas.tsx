import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TreePine,
  Search,
  GitBranch,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DocumentHeader } from "@/components/ui/document-header";
import { buildLogicalGraph, validateGraph } from "@/lib/geno/build";
import { detectPatterns, type PersonRow, type RelationshipRow } from "@/lib/patterns";
import { ArchiveEmptyState } from "@/components/ui/archive-empty-state";

export const Route = createFileRoute("/_authenticated/app/genossociogramas")({
  component: GenogramsPage,
});

function GenogramsPage() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["genograms-list"],
    queryFn: async () => {
      const { data: clientRows } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .order("full_name");

      const clientIds = (clientRows ?? []).map((c) => c.id);
      if (clientIds.length === 0) return [];

      const [{ data: personRows }, { data: relRows }] = await Promise.all([
        supabase.from("genogram_persons").select("*").in("client_id", clientIds),
        supabase.from("genogram_relationships").select("*").in("client_id", clientIds),
      ]);

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
        const persons = personsByClient.get(c.id) ?? [];
        const rels = relsByClient.get(c.id) ?? [];
        const proband = persons.find((p) => p.is_proband);
        const graph = buildLogicalGraph({ persons, rels, probandId: proband?.id });
        const generations = new Set(Array.from(graph.persons.values()).map((p) => p.generation))
          .size;
        const patternsCount = detectPatterns(persons, rels).length;
        const consistent = validateGraph(graph).ok;

        return { ...c, personCount: persons.length, generations, patternsCount, consistent };
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

      <div className="container-liz py-8 space-y-6">
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
        ) : filtered.length === 0 ? (
          <ArchiveEmptyState
            image="/assets/renders/arvore-genealogica-bronze.jpg"
            withSeal={false}
            eyebrow="Arquivo de árvores"
            title={
              search
                ? "Nenhuma árvore com esse nome."
                : "Nenhuma árvore foi plantada neste arquivo ainda."
            }
            description={
              search
                ? "Confira a grafia ou limpe a busca para ver todas as árvores ativas."
                : "Cada genossociograma começa pelo paciente-índice e cresce geração a geração — os fios aparecem conforme a história é contada."
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border/50 bg-surface-document p-6 shadow-surface flex flex-col justify-between hover-lift accent-bar-forest"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-serif text-xl font-bold text-primary truncate">
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

                <div className="mt-6 pt-4 border-t border-border/40 flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                    {c.personCount === 0 ? null : c.consistent ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-clinical-positive" />
                        Consistente
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3.5 text-clinical-warning" />
                        Pendências
                      </>
                    )}
                  </span>

                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    search={{ tab: "genogram" }}
                    className="font-bold text-[12px] uppercase tracking-wider text-forest hover:text-forest flex items-center gap-1"
                  >
                    Ver Árvore <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
