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
    <div>
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Clientes
        </p>
      </div>

      {/* Header — bloco mahogany */}
      <div className="block-mahogany px-6 py-10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-gold">
              Consultório
            </p>
            <h1 className="mt-2 font-serif text-5xl font-bold text-white">Clientes</h1>
            <p className="mt-2 text-[14px] text-white/55">
              Cada cliente tem um dossiê vivo contendo genograma, linha do tempo e anamnese.
            </p>
          </div>
          <Button size="lg" variant="hero" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <div className="container-liz py-8 space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4 justify-between border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
              <TabsList>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="archived">Arquivados</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View Mode Switcher */}
            <div className="flex items-center border border-border rounded-lg p-1 bg-white">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === "cards" ? "bg-mahogany/5 text-mahogany" : "text-muted-foreground hover:text-primary"}`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md cursor-pointer ${viewMode === "list" ? "bg-mahogany/5 text-mahogany" : "text-muted-foreground hover:text-primary"}`}
                title="Visualização em Lista"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, queixa, trauma, tag..."
              className="pl-9 h-10 text-[14px]"
            />
          </div>
        </div>

        {/* Clientes Content */}
        <div>
          {isLoading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={query.length > 0} onCreate={() => setCreating(true)} tab={tab} />
          ) : viewMode === "cards" ? (
            <motion.ul
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
              }}
            >
              {filtered.map((c) => (
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
                  <ClientCard
                    client={c}
                    onEdit={() => setEditing(c)}
                    onArchive={() =>
                      setStatus.mutate({
                        id: c.id,
                        status: c.status === "active" ? "archived" : "active",
                      })
                    }
                    onDelete={() => setDeleting(c)}
                  />
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            // Lista compacta de alta densidade
            <div className="bg-white border border-border/50 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-muted-foreground uppercase tracking-[0.1em] font-bold text-[10px]">
                    <th className="p-4 pl-6">Cliente</th>
                    <th className="p-4">Contato</th>
                    <th className="p-4">Queixa / Trauma</th>
                    <th className="p-4">Tags</th>
                    <th className="p-4">Genograma</th>
                    <th className="p-4 pr-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((c) => {
                    const age = calcAge(c.birth_date);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6">
                          <Link
                            to="/app/clientes/$clientId"
                            params={{ clientId: c.id }}
                            className="font-serif font-bold text-[15px] text-primary hover:text-mahogany transition-colors block"
                          >
                            {c.preferred_name || c.full_name}
                          </Link>
                          <span className="text-[12px] text-muted-foreground">
                            {age !== null ? `${age} anos · ` : ""}
                            {c.birthplace || "Sem cidade"}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-[12px] text-primary/80">
                          {c.email || "—"}
                          <br />
                          {c.phone || "—"}
                        </td>
                        <td className="p-4 max-w-xs truncate font-serif text-foreground/80">
                          {c.presenting_complaint || "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.slice(0, 3).map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="rounded-full bg-mahogany/5 text-mahogany border border-mahogany/10 px-2 py-0.5 font-bold text-[11px]">
                            74% Completo
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(c)}>
                                <Pencil className="size-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setStatus.mutate({
                                    id: c.id,
                                    status: c.status === "active" ? "archived" : "active",
                                  })
                                }
                              >
                                {c.status === "active" ? (
                                  <Archive className="size-4" />
                                ) : (
                                  <ArchiveRestore className="size-4" />
                                )}
                                {c.status === "active" ? "Arquivar" : "Reativar"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleting(c)}
                              >
                                <Trash2 className="size-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ClientFormDialog open={creating} onOpenChange={setCreating} professionalId={user.id} />
      <ClientFormDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        professionalId={user.id}
        editing={editing}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-primary">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>{deleting?.full_name}</strong> e todos os dados clínicos
              associados. Não pode ser desfeita. Considere arquivar antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientCard({
  client,
  onEdit,
  onArchive,
  onDelete,
}: {
  client: ClientRow;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const age = calcAge(client.birth_date);
  const display = client.preferred_name || client.full_name;

  return (
    <article className="group relative flex h-full flex-col glass-card rounded-[1rem] hover-lift accent-bar-forest">
      <div className="flex items-start gap-4 p-5 pb-4">
        {/* Avatar lavanda */}
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-forest font-serif text-lg font-bold text-white shadow-sm">
          {initialsFrom(client.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId: client.id }}
            preload="intent"
            className="block truncate font-serif text-xl font-bold text-primary hover:text-forest transition-colors leading-tight"
          >
            {display}
          </Link>
          <p className="mt-1 truncate text-[12px] text-muted-foreground flex items-center gap-1.5">
            {age !== null ? <span>{age} anos</span> : null}
            {client.birthplace && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="size-3" /> {client.birthplace}
                </span>
              </>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-8 opacity-60 hover:opacity-100">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              {client.status === "active" ? (
                <>
                  <Archive className="size-4" /> Arquivar
                </>
              ) : (
                <>
                  <ArchiveRestore className="size-4" /> Reativar
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Trauma / Queixa */}
      <div className="px-5 pb-4 flex-1">
        <p className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground font-serif">
          {client.presenting_complaint || "Sem queixa registrada."}
        </p>
      </div>

      {/* IA Alertas rápidos e progresso */}
      <div className="px-5 pb-4 space-y-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-bold flex items-center gap-1">
            <Layers className="size-3.5 text-forest" />
            Genossociograma
          </span>
          <span className="text-mahogany font-bold">74% Completo</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px] font-bold py-0.5 rounded-md"
          >
            🟢 Sessão amanhã
          </Badge>
          <Badge
            variant="outline"
            className="text-mahogany border-mahogany/20 bg-mahogany/[0.03] text-[10px] font-bold py-0.5 rounded-md"
          >
            🟣 IA detectou padrão
          </Badge>
        </div>
      </div>

      {/* Footer do Card */}
      <div className="mt-auto flex items-center justify-between border-t border-border/60 px-5 py-3 text-[12px] text-muted-foreground bg-slate-50/[0.3] rounded-b-[1rem]">
        <span>
          {client.consent_given_at ? (
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <FileCheck className="size-3.5" /> Consentimento
            </span>
          ) : (
            <span className="text-amber-600">● Sem consentimento</span>
          )}
        </span>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: client.id }}
          preload="intent"
          className="font-bold uppercase tracking-[0.08em] text-mahogany hover:text-forest transition-colors"
        >
          Abrir dossiê →
        </Link>
      </div>
    </article>
  );
}

function EmptyState({
  hasQuery,
  onCreate,
  tab,
}: {
  hasQuery: boolean;
  onCreate: () => void;
  tab: "active" | "archived";
}) {
  if (hasQuery) {
    return (
      <div className="border-l-[5px] border-l-muted glass-card rounded-r-[1rem] p-16 text-center shadow-sm">
        <p className="font-serif text-2xl font-bold text-primary">Nada encontrado</p>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Tente outro termo ou remova o filtro.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col md:flex-row items-center border-l-[5px] border-l-forest glass-card rounded-r-[1rem] shadow-sm overflow-hidden">
      <div className="flex-1 p-10 md:p-16 text-center md:text-left">
        <p className="font-serif text-3xl font-bold text-primary">
          {tab === "active" ? "A jornada começa aqui" : "Nenhum dossiê arquivado"}
        </p>
        <p className="mt-4 text-[15px] max-w-md text-muted-foreground leading-relaxed">
          {tab === "active"
            ? "Todo caso começa por um nome. O resto — a árvore genealógica, as sessões e a detecção de padrões sistêmicos — se constrói a partir do paciente-índice."
            : "Quando arquivar um dossiê, ele aparecerá aqui para consulta."}
        </p>
        {tab === "active" && (
          <Button onClick={onCreate} className="mt-8" size="lg" variant="forest">
            <Plus className="size-4" />
            Cadastrar primeiro cliente
          </Button>
        )}
      </div>
      {tab === "active" && (
        <div className="hidden md:block flex-1 bg-forest-soft/30 w-full h-full min-h-[300px] relative">
          <img
            src="/empty_clients.png"
            alt="Ilustração editorial de um consultório"
            className="absolute inset-0 w-full h-full object-cover mix-blend-multiply"
          />
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="skeleton h-44" />
      ))}
    </ul>
  );
}
