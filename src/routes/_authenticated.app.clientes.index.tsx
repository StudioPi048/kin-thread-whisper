import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  LayoutGrid,
  List,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  FileCheck,
  FolderClosed,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { calcAge, formatBirthDate, initialsFrom } from "@/lib/clients";
import type { Database } from "@/integrations/supabase/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export const Route = createFileRoute("/_authenticated/app/clientes/")({
  component: ClientesIndex,
});

/* ─── ATOMS ──────────────────────────────────────────────── */

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

function ClientesIndex() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [
        c.full_name,
        c.preferred_name,
        c.email,
        c.birthplace,
        c.phone,
        c.presenting_complaint,
        c.clinical_notes,
        (c.tags ?? []).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query]);

  const setStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase
        .from("clients")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(v.status === "archived" ? "Dossiê arquivado." : "Dossiê reativado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dossiê removido permanentemente.");
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="min-h-screen bg-[#1B211A] pb-24 font-serif text-white selection:bg-gold-soft relative overflow-x-hidden">
      
      {/* ═══════════════════════════════════════════════════
          FUNDO E TEXTURAS
      ════════════════════════════════════════════════════ */}
      <div className="absolute left-0 top-0 w-[60%] h-[700px] opacity-10 pointer-events-none rotate-180">
        <img src="/assets/photos/section2_botanicals.jpg" alt="" className="w-full h-full object-cover mix-blend-screen" />
      </div>

      {/* ═══════════════════════════════════════════════════
          CABEÇALHO DO ACERVO
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-12 relative z-10 border-b border-white/10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-sans text-[16px] font-bold tracking-[0.2em] text-[#D4AF37] uppercase mb-4 flex items-center gap-2">
              <FolderClosed className="size-5" /> Gaveta de Dossiês Físicos
            </p>
            <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
              Acervo de Clientes
            </h1>
            <p className="mt-4 text-[19px] text-white/60 font-serif italic max-w-2xl leading-relaxed">
              Cada cliente é um dossiê vivo contendo genograma, linha do tempo e fragmentos de história.
            </p>
          </div>
          <button 
            className="bg-[#D4AF37] text-[#1B211A] font-sans text-[16px] font-bold uppercase tracking-widest px-8 py-4 hover:bg-[#E8C65A] transition-colors shadow-lg cursor-pointer"
            onClick={() => setCreating(true)}
          >
            + Criar Novo Dossiê
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          CONTROLES DA GAVETA
      ════════════════════════════════════════════════════ */}
      <div className="container-liz py-10 relative z-10">
        <div className="flex flex-wrap items-center gap-6 justify-between bg-[#151A15] p-6 border border-white/10 shadow-xl mb-12">
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-[#1B211A] p-1 border border-white/10 rounded-none">
              <button
                onClick={() => setTab("active")}
                className={`font-sans text-[16px] font-bold uppercase tracking-widest px-6 py-3 transition-colors ${tab === "active" ? "bg-white/10 text-[#D4AF37]" : "text-white/40 hover:text-white"}`}
              >
                Dossiês Ativos
              </button>
              <button
                onClick={() => setTab("archived")}
                className={`font-sans text-[16px] font-bold uppercase tracking-widest px-6 py-3 transition-colors ${tab === "archived" ? "bg-white/10 text-[#D4AF37]" : "text-white/40 hover:text-white"}`}
              >
                Caixa Morta
              </button>
            </div>

            <div className="flex items-center border border-white/10 p-1 bg-[#1B211A]">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === "cards" ? "bg-white/10 text-[#D4AF37]" : "text-white/40 hover:text-white"}`}
                title="Visualização em Grade (Dossiês)"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 transition-colors cursor-pointer ${viewMode === "list" ? "bg-white/10 text-[#D4AF37]" : "text-white/40 hover:text-white"}`}
                title="Visualização em Lista (Fichas)"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no acervo..."
              className="w-full bg-[#1B211A] border border-white/20 text-white placeholder:text-white/30 pl-11 pr-4 py-3 font-sans text-[16px] focus:outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            LISTAGEM DE DOSSIÊS
        ════════════════════════════════════════════════════ */}
        <div>
          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 opacity-50 animate-pulse">
               <div className="h-[280px] bg-[#151A15] border border-white/10"></div>
               <div className="h-[280px] bg-[#151A15] border border-white/10"></div>
               <div className="h-[280px] bg-[#151A15] border border-white/10"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-[#151A15] border border-white/10 p-16 text-center shadow-xl">
              <FolderClosed className="size-12 text-white/20 mx-auto mb-6" strokeWidth={1} />
              <h3 className="font-serif text-[28px] font-bold text-white mb-3">Nenhum dossiê encontrado.</h3>
              <p className="font-serif text-[18px] text-white/50 italic mb-8">
                A busca no acervo não retornou resultados para este filtro.
              </p>
              <button 
                onClick={() => setCreating(true)}
                className="bg-transparent border border-[#D4AF37] text-[#D4AF37] font-sans text-[16px] font-bold uppercase tracking-widest px-6 py-3 hover:bg-[#D4AF37]/10 transition-colors"
              >
                Abrir Novo Dossiê
              </button>
            </div>
          ) : viewMode === "cards" ? (
            <motion.ul
              className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3"
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
                  {/* Cartão de Pasta Parda / Ficha de Investigação */}
                  <div className={`relative bg-[#151A15] p-8 shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-white/10 text-white group transition-transform duration-300 hover:rotate-0 hover:z-10 ${i % 2 === 0 ? 'rotate-[-1deg]' : 'rotate-[1deg]'}`}>
                    
                    <Tape rotate={i % 2 === 0 ? '-2deg' : '2deg'} w="55px" top="-10px" left="50%" />
                    
                    <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-[#1B211A] text-[#D4AF37] flex items-center justify-center font-serif text-[18px] font-bold">
                          {initialsFrom(c.preferred_name || c.full_name)}
                        </div>
                        <div>
                          <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-white">Ref. {c.id.slice(0, 5)}</p>
                          <p className="font-sans text-[16px] text-white">
                            {calcAge(c.birth_date) ? `${calcAge(c.birth_date)} anos` : "Idade ñ informada"}
                          </p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-[#E6DDD0]/50 transition-colors cursor-pointer text-white">
                            <MoreHorizontal className="size-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-[#151A15] border-white/10 text-white font-sans rounded-none p-1">
                          <DropdownMenuItem onClick={() => setEditing(c)} className="cursor-pointer focus:bg-[#E6DDD0]/50 text-[16px] py-2">
                            <Pencil className="mr-2 size-4" /> Editar Capa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatus.mutate({
                                id: c.id,
                                status: c.status === "active" ? "archived" : "active",
                              })
                            }
                            className="cursor-pointer focus:bg-[#E6DDD0]/50 text-[16px] py-2"
                          >
                            {c.status === "active" ? (
                              <><Archive className="mr-2 size-4" /> Arquivar Dossiê</>
                            ) : (
                              <><ArchiveRestore className="mr-2 size-4" /> Reativar Dossiê</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#E6DDD0]" />
                          <DropdownMenuItem
                            onClick={() => setDeleting(c)}
                            className="cursor-pointer text-red-700 focus:bg-red-50 focus:text-red-800 text-[16px] py-2"
                          >
                            <Trash2 className="mr-2 size-4" /> Destruir Dossiê
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mb-8">
                      <h3 className="font-serif font-bold text-[26px] text-white leading-tight mb-2 line-clamp-2">
                        {c.preferred_name || c.full_name}
                      </h3>
                      <p className="font-serif italic text-white text-[17px] line-clamp-2">
                        {c.presenting_complaint || "Sem queixa inicial registrada."}
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-dashed border-white/10">
                       <div className="flex items-center justify-between">
                         <span className="font-sans text-[16px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                           <Layers className="size-4" /> Genograma
                         </span>
                         <span className="font-serif text-[18px] font-bold text-white">
                            Pendente
                         </span>
                       </div>

                       <Link to="/app/clientes/$clientId" params={{ clientId: c.id }}>
                         <button className="w-full bg-[#1B211A] text-white font-sans text-[16px] font-bold uppercase tracking-widest py-4 mt-2 hover:bg-[#2B312A] transition-colors cursor-pointer">
                           Abrir Dossiê Completo →
                         </button>
                       </Link>
                    </div>

                  </div>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            // Lista compacta estilo registro
            <div className="bg-[#151A15] border border-white/10 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse font-sans text-[16px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-[#D4AF37] uppercase tracking-[0.15em] font-bold text-[16px]">
                    <th className="p-5 pl-8">Dossiê / Nome</th>
                    <th className="p-5">Localidade</th>
                    <th className="p-5">Motivo da Investigação</th>
                    <th className="p-5 pr-8 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-5 pl-8">
                        <Link to="/app/clientes/$clientId" params={{ clientId: c.id }} className="group-hover:text-[#D4AF37] transition-colors">
                          <p className="font-serif font-bold text-[20px] text-white">{c.preferred_name || c.full_name}</p>
                          <p className="text-[16px] text-white/40 mt-1 uppercase tracking-widest">{c.id.slice(0,8)}</p>
                        </Link>
                      </td>
                      <td className="p-5 text-white/60">
                         {c.birthplace || "—"}
                      </td>
                      <td className="p-5">
                        <p className="font-serif italic text-white/80 text-[16px] line-clamp-1">
                          {c.presenting_complaint || "—"}
                        </p>
                      </td>
                      <td className="p-5 pr-8 text-right">
                        <div className="flex justify-end gap-3 opacity-50 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setEditing(c)} className="p-2 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer" title="Editar Capa">
                             <Pencil className="size-4" />
                           </button>
                           <button onClick={() => setDeleting(c)} className="p-2 hover:bg-red-500/20 text-white/60 hover:text-red-400 cursor-pointer" title="Destruir">
                             <Trash2 className="size-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ClientFormDialog
        open={creating}
        onOpenChange={setCreating}
        professionalId={user.id}
      />

      {editing && (
        <ClientFormDialog
          editing={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          professionalId={user.id}
        />
      )}

      {deleting && (
        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent className="bg-[#151A15] border-white/10 rounded-none p-8 font-sans">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-3xl font-bold text-[#8B3A3A]">Destruir Dossiê Físico?</AlertDialogTitle>
              <AlertDialogDescription className="text-[16px] text-white font-serif leading-relaxed italic mt-4">
                Esta ação reduzirá o dossiê de <strong className="not-italic text-white">{deleting.full_name}</strong> a cinzas. 
                Isso inclui anamnese, genograma e linha do tempo. É um ato irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8">
              <AlertDialogCancel className="rounded-none border-white/10 text-white hover:bg-[#E6DDD0]/50 font-bold uppercase tracking-widest text-[16px] px-6">
                Guardar de volta
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate(deleting.id)}
                className="rounded-none bg-[#8B3A3A] hover:bg-[#6A2B2B] text-white font-bold uppercase tracking-widest text-[16px] px-6"
              >
                Destruir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
