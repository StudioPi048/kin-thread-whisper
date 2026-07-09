import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  LayoutGrid,
  List,
  MapPin,
  Calendar,
  Layers,
  FolderClosed,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { calcAge, initialsFrom } from "@/lib/clients";
import type { Database } from "@/integrations/supabase/types";

// Design System do Arquivo Vivo
import { SectionTitle } from "@/components/archive/section-title";
import { ArchiveCard, ArchiveCardContent } from "@/components/archive/archive-card";
import { StatusBadge } from "@/components/archive/status-badge";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export const Route = createFileRoute("/_authenticated/app/clientes/")({
  component: ClientesIndex,
});

/* ─── ATOMS ──────────────────────────────────────────────── */
function Tape({ rotate = "0deg", w = "64px", top = "-10px", left = "50%" }: { rotate?: string; w?: string; top?: string; left?: string; }) {
  return (
    <div
      className="absolute z-20 shadow-sm"
      style={{
        top,
        left,
        transform: `translateX(-50%) rotate(${rotate})`,
        width: w,
        height: "22px",
        background: "rgba(210,190,155,0.75)",
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
    <div className="min-h-screen text-foreground pb-24">
      
      {/* ═══════════════════════════════════════════════════
          CABEÇALHO DO ACERVO
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-12 border-b border-border/50">
        <SectionTitle
          eyebrow="Gaveta de Dossiês Físicos"
          title="Acervo de Clientes"
          subtitle="Cada cliente é um dossiê vivo contendo genograma, linha do tempo e fragmentos de história transgeracional."
          action={
            <button 
              className="bg-primary text-primary-foreground font-sans text-[16px] font-bold uppercase tracking-widest px-8 py-4 hover:opacity-90 transition-opacity shadow-lg flex items-center gap-2 cursor-pointer rounded"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-5" /> Criar Novo Dossiê
            </button>
          }
        />
      </header>

      {/* ═══════════════════════════════════════════════════
          CONTROLES DA GAVETA
      ════════════════════════════════════════════════════ */}
      <div className="py-10">
        <div className="flex flex-wrap items-center gap-6 justify-between bg-card p-6 border border-border shadow-sm rounded-lg mb-12">
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-muted p-1 rounded">
              <button
                onClick={() => setTab("active")}
                className={`font-sans text-[16px] font-bold uppercase tracking-widest px-6 py-3 rounded transition-colors ${tab === "active" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Dossiês Ativos
              </button>
              <button
                onClick={() => setTab("archived")}
                className={`font-sans text-[16px] font-bold uppercase tracking-widest px-6 py-3 rounded transition-colors ${tab === "archived" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Caixa Morta
              </button>
            </div>

            <div className="flex items-center border border-border p-1 bg-muted rounded">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2.5 rounded transition-colors cursor-pointer ${viewMode === "cards" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Visualização em Grade (Dossiês)" aria-label="Visualização em Grade (Dossiês)"
              >
                <LayoutGrid className="size-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2.5 rounded transition-colors cursor-pointer ${viewMode === "list" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Visualização em Lista (Fichas)" aria-label="Visualização em Lista (Fichas)"
              >
                <List className="size-5" />
              </button>
            </div>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar no acervo..."
              className="w-full bg-background border border-border text-foreground placeholder:text-muted-foreground pl-12 pr-4 py-3 font-sans text-[16px] rounded focus:outline-none focus:ring-2 focus:ring-gold transition-all"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            LISTAGEM DE DOSSIÊS
        ════════════════════════════════════════════════════ */}
        <div>
          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 opacity-50 animate-pulse">
               <ArchiveCard className="h-[340px]" />
               <ArchiveCard className="h-[340px]" />
               <ArchiveCard className="h-[340px]" />
            </div>
          ) : filtered.length === 0 ? (
            <ArchiveCard variant="solid" elevation="none" className="p-16 text-center border-dashed">
              <FolderClosed className="size-16 text-muted-foreground mx-auto mb-6" strokeWidth={1} />
              <h3 className="font-serif text-[28px] font-bold text-primary mb-3">Nenhum dossiê encontrado no acervo.</h3>
              <p className="font-serif text-[18px] text-muted-foreground italic mb-8">
                Tente ajustar seus termos de busca ou filtros.
              </p>
              <button 
                onClick={() => setCreating(true)}
                className="bg-transparent border border-gold text-gold font-sans text-[16px] font-bold uppercase tracking-widest px-8 py-3 rounded hover:bg-gold/10 transition-colors cursor-pointer"
              >
                Abrir Novo Dossiê
              </button>
            </ArchiveCard>
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
                  <ArchiveCard 
                    variant="paper" 
                    elevation="md" 
                    className={`h-full flex flex-col hover-lift group ${i % 2 === 0 ? 'rotate-[-1deg] hover:rotate-0' : 'rotate-[1deg] hover:rotate-0'}`}
                  >
                    <Tape rotate={i % 2 === 0 ? '-2deg' : '2deg'} w="55px" top="-10px" left="50%" />
                    
                    <ArchiveCardContent className="flex flex-col h-full p-8">
                      {/* Header do Card (Foto + Ações) */}
                      <div className="flex justify-between items-start mb-6 border-b border-border/50 pb-5">
                        <div className="flex items-center gap-4">
                          <div className="size-14 rounded-full bg-forest text-white flex items-center justify-center font-serif text-2xl font-bold shadow-sm border-2 border-background">
                            {initialsFrom(c.preferred_name || c.full_name)}
                          </div>
                          <div>
                            <p className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">Ref. {c.id.slice(0, 5)}</p>
                            <p className="font-sans text-[16px] text-foreground font-medium">
                              {calcAge(c.birth_date) ? `${calcAge(c.birth_date)} anos` : "Idade ñ informada"}
                            </p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="size-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 font-sans">
                            <DropdownMenuItem onClick={() => setEditing(c)} className="cursor-pointer text-[16px] py-3">
                              <Pencil className="mr-3 size-4" /> Editar Capa do Dossiê
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setStatus.mutate({
                                  id: c.id,
                                  status: c.status === "active" ? "archived" : "active",
                                })
                              }
                              className="cursor-pointer text-[16px] py-3"
                            >
                              {c.status === "active" ? (
                                <><Archive className="mr-3 size-4" /> Mover para Caixa Morta</>
                              ) : (
                                <><ArchiveRestore className="mr-3 size-4" /> Reativar Dossiê</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleting(c)}
                              className="cursor-pointer text-clinical-critical focus:bg-clinical-critical/10 text-[16px] py-3"
                            >
                              <Trash2 className="mr-3 size-4" /> Destruir Dossiê
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Corpo do Card */}
                      <div className="flex-1 mb-6">
                        <h3 className="font-serif font-bold text-3xl text-primary leading-tight mb-3 line-clamp-2">
                          {c.preferred_name || c.full_name}
                        </h3>
                        <p className="font-serif italic text-muted-foreground text-lg line-clamp-2">
                          "{c.presenting_complaint || "Aguardando acolhimento."}"
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mt-4">
                           {c.tags && c.tags.slice(0,3).map(tag => (
                             <StatusBadge key={tag} status="neutral" variant="soft">{tag}</StatusBadge>
                           ))}
                        </div>
                      </div>

                      {/* Footer do Card */}
                      <div className="space-y-4 pt-5 border-t border-dashed border-border/60 mt-auto">
                         <div className="flex items-center justify-between">
                           <span className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Layers className="size-4" /> Árvore
                           </span>
                           <StatusBadge status="warning" variant="outline">
                              Pendente
                           </StatusBadge>
                         </div>
                         <div className="flex items-center justify-between">
                           <span className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <Calendar className="size-4" /> Sessão
                           </span>
                           <span className="font-serif text-lg font-bold text-primary">
                              Há 2 dias
                           </span>
                         </div>

                         <Link to="/app/clientes/$clientId" params={{ clientId: c.id }} className="block pt-2">
                           <button className="w-full bg-primary text-primary-foreground font-sans text-[16px] font-bold uppercase tracking-widest py-4 rounded hover:opacity-90 transition-opacity cursor-pointer">
                             Abrir Dossiê Completo →
                           </button>
                         </Link>
                      </div>

                    </ArchiveCardContent>
                  </ArchiveCard>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            // Lista compacta estilo registro
            <ArchiveCard variant="solid" elevation="sm" className="overflow-hidden rounded-xl">
              <table className="w-full text-left border-collapse font-sans text-[16px]">
                <thead>
                  <tr className="border-b border-border bg-muted text-primary uppercase tracking-widest font-bold text-sm">
                    <th className="p-5 pl-8">Dossiê / Nome</th>
                    <th className="p-5">Localidade</th>
                    <th className="p-5">Motivo da Investigação</th>
                    <th className="p-5 pr-8 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50 transition-colors group">
                      <td className="p-5 pl-8">
                        <Link to="/app/clientes/$clientId" params={{ clientId: c.id }} className="group-hover:text-gold transition-colors">
                          <p className="font-serif font-bold text-2xl text-primary">{c.preferred_name || c.full_name}</p>
                          <p className="text-[14px] text-muted-foreground mt-1 uppercase tracking-widest">Ref. {c.id.slice(0,8)}</p>
                        </Link>
                      </td>
                      <td className="p-5 text-muted-foreground">
                         {c.birthplace || "—"}
                      </td>
                      <td className="p-5">
                        <p className="font-serif italic text-foreground text-lg line-clamp-1">
                          {c.presenting_complaint || "—"}
                        </p>
                      </td>
                      <td className="p-5 pr-8 text-right">
                        <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setEditing(c)} className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-primary cursor-pointer" title="Editar Capa" aria-label="Editar Capa">
                             <Pencil className="size-5" />
                           </button>
                           <button onClick={() => setDeleting(c)} className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-clinical-critical/10 text-muted-foreground hover:text-clinical-critical cursor-pointer" title="Destruir" aria-label="Destruir">
                             <Trash2 className="size-5" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ArchiveCard>
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
          <AlertDialogContent className="font-sans">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif text-3xl font-bold text-clinical-critical">Destruir Dossiê Físico?</AlertDialogTitle>
              <AlertDialogDescription className="text-lg text-foreground font-serif leading-relaxed italic mt-4">
                Esta ação reduzirá o dossiê de <strong className="not-italic text-foreground">{deleting.full_name}</strong> a cinzas. 
                Isso inclui anamnese, genograma e linha do tempo. É um ato irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-4">
              <AlertDialogCancel className="border-border text-foreground hover:bg-muted font-bold uppercase tracking-widest text-[16px] px-6 h-12">
                Guardar de volta
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => remove.mutate(deleting.id)}
                className="bg-clinical-critical hover:bg-clinical-critical/90 text-white font-bold uppercase tracking-widest text-[16px] px-6 h-12"
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
