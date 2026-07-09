import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TreePine,
  Search,
  GitBranch,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  FolderClosed,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/genossociogramas")({
  component: GenogramsPage,
});

function Tape({ rotate = "0deg", w = "64px", top = "-10px", left = "50%" }: { rotate?: string; w?: string; top?: string; left?: string; }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: `translateX(-50%) rotate(${rotate})`,
        width: w,
        height: "22px",
        background: "rgba(210,190,155,0.75)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        zIndex: 20,
      }}
    />
  );
}

function GenogramsPage() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["genograms-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
  });

  const filtered = clients.filter((c) =>
    (c.preferred_name || c.full_name).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#1B211A] pb-24 font-serif text-white selection:bg-gold-soft relative overflow-x-hidden">
      
      {/* ═══════════════════════════════════════════════════
          FUNDO E TEXTURAS
      ════════════════════════════════════════════════════ */}
      <div className="absolute right-0 top-0 w-[50%] h-[600px] opacity-[0.08] pointer-events-none">
        <img src="/assets/photos/section2_botanicals.jpg" alt="" className="w-full h-full object-cover mix-blend-screen" />
      </div>

      {/* ═══════════════════════════════════════════════════
          CABEÇALHO DA PRANCHETA
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-12 relative z-10 border-b border-white/10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-sans text-[14px] font-bold tracking-[0.2em] text-[#D4AF37] uppercase mb-4 flex items-center gap-2">
              <TreePine className="size-5" /> Prancheta de Árvores
            </p>
            <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
              Genossociogramas
            </h1>
            <p className="mt-4 text-[19px] text-white/60 font-serif italic max-w-2xl leading-relaxed">
              Explore e gerencie as ramificações e padrões ativos dos seus clientes.
            </p>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          CONTROLES
      ════════════════════════════════════════════════════ */}
      <div className="container-liz py-10 relative z-10">
        <div className="flex flex-wrap items-center gap-6 justify-between bg-[#151A15] p-6 border border-white/10 shadow-xl mb-12">
          
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente na prancheta..."
              className="w-full bg-[#1B211A] border border-white/20 text-white placeholder:text-white/30 pl-11 pr-4 py-3 font-sans text-[14px] focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            LISTAGEM
        ════════════════════════════════════════════════════ */}
        <div>
          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 opacity-50 animate-pulse">
               <div className="h-[240px] bg-[#151A15] border border-white/10"></div>
               <div className="h-[240px] bg-[#151A15] border border-white/10"></div>
               <div className="h-[240px] bg-[#151A15] border border-white/10"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#151A15] border border-white/10 p-16 text-center shadow-xl">
              <FolderClosed className="size-12 text-white/20 mx-auto mb-6" strokeWidth={1} />
              <h3 className="font-serif text-[28px] font-bold text-white mb-3">Nenhuma árvore encontrada.</h3>
              <p className="font-serif text-[18px] text-white/50 italic mb-8">
                Abra um dossiê para iniciar o mapeamento transgeracional.
              </p>
            </div>
          ) : (
            <motion.ul
              className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
              }}
            >
              {filtered.map((c, i) => (
                <motion.li
                  key={c.id}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 300, damping: 24 },
                    },
                  }}
                >
                  {/* Cartão Estilo Prancheta/Papel Vegetal */}
                  <div className={`relative bg-[#F5F0E8] p-8 shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-[#E6DDD0] text-[#3B2F2F] group transition-transform duration-300 hover:rotate-0 hover:z-10 ${i % 2 === 0 ? 'rotate-[1deg]' : 'rotate-[-1deg]'}`}>
                    
                    <Tape rotate={i % 2 === 0 ? '2deg' : '-2deg'} w="50px" top="-10px" left="50%" />
                    
                    <div className="flex justify-between items-start gap-4 mb-6 border-b border-[#E6DDD0] pb-4">
                      <h3 className="font-serif font-bold text-[24px] text-[#2B2018] leading-tight truncate">
                        {c.preferred_name || c.full_name}
                      </h3>
                      <span className="shrink-0 bg-[#3B2F2F] text-[#F5F0E8] px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-widest">
                        74% Map
                      </span>
                    </div>

                    <div className="space-y-3 font-serif italic text-[#5A4A3A] text-[16px] mb-8">
                      <div className="flex items-center gap-3">
                        <GitBranch className="size-4 text-[#8B7355] shrink-0" />
                        <span>3 gerações traçadas na prancheta</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Sparkles className="size-4 text-[#D4AF37] shrink-0" />
                        <span>4 padrões sistêmicos vigentes</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-dashed border-[#E6DDD0] flex justify-between items-center">
                      <span className="text-[11px] text-[#8B7355] font-sans font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        Consistente
                      </span>

                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: c.id }}
                        search={{ tab: "genograma" }}
                        className="font-sans font-bold text-[11px] uppercase tracking-widest text-[#2B2018] hover:text-[#D4AF37] flex items-center gap-1 transition-colors"
                      >
                        Abrir Mapa <ArrowRight className="size-3.5" />
                      </Link>
                    </div>

                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </div>
  );
}
