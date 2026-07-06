import { createFileRoute, Link } from "@tanstack/react-router";
import { History, Search, Calendar, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/linha-do-tempo")({
  component: TimelinesPage,
});

function TimelinesPage() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["timelines-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
  });

  const filtered = clients.filter(c => 
    (c.preferred_name || c.full_name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Linhas do Tempo
        </p>
      </div>

      {/* Header */}
      <div className="block-plum px-6 py-10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender-mid">
              Estudos de Caso
            </p>
            <h1 className="mt-2 font-serif text-5xl font-bold text-white">Linhas do Tempo</h1>
            <p className="mt-2 text-[14px] text-white/55">
              Visualize acontecimentos marcantes, traumas e fatos históricos de forma cronológica por caso.
            </p>
          </div>
        </div>
      </div>

      <div className="container-liz py-8 space-y-6">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              className="pl-9 h-10 text-[14px]"
            />
          </div>
        </div>

        {/* Timelines list */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-48" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
            <History className="size-10 text-lavender/50 mx-auto" />
            <p className="font-serif text-lg font-bold text-primary mt-2">Nenhuma linha do tempo encontrada</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(c => (
              <div 
                key={c.id}
                className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm flex flex-col justify-between hover-lift accent-bar-lavender"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-serif text-xl font-bold text-primary truncate">
                      {c.preferred_name || c.full_name}
                    </h3>
                    <Badge variant="outline" className="text-lavender border-lavender bg-lavender/5 text-[10px] font-bold">
                      60% completa
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-gold shrink-0" />
                      <span>12 marcos históricos registrados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-plum shrink-0" />
                      <span>2 traumas principais mapeados</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/40 flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                    <AlertCircle className="size-3.5 text-amber-600" />
                    Pendente revisão
                  </span>
                  
                  <Link 
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    className="font-bold text-[12px] uppercase tracking-wider text-plum hover:text-lavender flex items-center gap-1"
                  >
                    Ver Linha do Tempo <ArrowRight className="size-3.5" />
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
