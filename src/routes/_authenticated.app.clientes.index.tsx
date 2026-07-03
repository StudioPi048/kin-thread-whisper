import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
      const hay = [c.full_name, c.preferred_name, c.email, (c.tags ?? []).join(" ")]
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

      {/* Header — bloco plum */}
      <div className="block-plum px-6 py-10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender-mid">
              Consultório
            </p>
            <h1 className="mt-2 font-serif text-5xl font-bold text-white">Clientes</h1>
            <p className="mt-2 text-[14px] text-white/55">
              Cada cliente tem um dossiê vivo. Você é a única pessoa com acesso.
            </p>
          </div>
          <Button size="lg" variant="hero" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      <div className="container-liz py-8">
        {/* Filtros */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
            <TabsList>
              <TabsTrigger value="active">Ativos</TabsTrigger>
              <TabsTrigger value="archived">Arquivados</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, e-mail ou tag..."
              className="pl-9 h-10 text-[14px]"
            />
          </div>
        </div>

        {/* Cards */}
        <div>
          {isLoading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <EmptyState hasQuery={query.length > 0} onCreate={() => setCreating(true)} tab={tab} />
          ) : (
            <motion.ul 
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
              }}
            >
              {filtered.map((c) => (
                <motion.li 
                  key={c.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                >
                  <ClientCard
                    client={c}
                    onEdit={() => setEditing(c)}
                    onArchive={() =>
                      setStatus.mutate({ id: c.id, status: c.status === "active" ? "archived" : "active" })
                    }
                    onDelete={() => setDeleting(c)}
                  />
                </motion.li>
              ))}
            </motion.ul>
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
  client, onEdit, onArchive, onDelete,
}: {
  client: ClientRow;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const age = calcAge(client.birth_date);
  const display = client.preferred_name || client.full_name;

  return (
    <article className="group relative flex h-full flex-col bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 accent-bar-lavender">
      <div className="flex items-start gap-3 p-5">
        {/* Avatar lavanda */}
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-lavender font-serif text-base font-bold text-white">
          {initialsFrom(client.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId: client.id }}
            className="block truncate font-serif text-xl font-bold text-primary hover:text-lavender transition-colors"
          >
            {display}
          </Link>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {age !== null ? `${age} anos · ` : ""}
            {formatBirthDate(client.birth_date)}
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
                <><Archive className="size-4" /> Arquivar</>
              ) : (
                <><ArchiveRestore className="size-4" /> Reativar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {client.presenting_complaint && (
        <p className="px-5 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
          {client.presenting_complaint}
        </p>
      )}

      {client.tags && client.tags.length > 0 && (
        <div className="px-5 pt-3 flex flex-wrap gap-1.5">
          {client.tags.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="rounded text-[11px] font-semibold">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border/60 px-5 py-3 text-[12px] text-muted-foreground">
        <span>
          {client.consent_given_at ? (
            <span className="font-semibold text-emerald-700">● Consentimento</span>
          ) : (
            <span className="text-amber-600">● Sem consentimento</span>
          )}
        </span>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: client.id }}
          className="font-bold uppercase tracking-[0.08em] text-lavender hover:text-plum transition-colors"
        >
          Abrir dossiê →
        </Link>
      </div>
    </article>
  );
}

function EmptyState({
  hasQuery, onCreate, tab,
}: {
  hasQuery: boolean;
  onCreate: () => void;
  tab: "active" | "archived";
}) {
  if (hasQuery) {
    return (
      <div className="border-l-[5px] border-l-muted bg-white p-16 text-center shadow-sm">
        <p className="font-serif text-2xl font-bold text-primary">Nada encontrado</p>
        <p className="mt-2 text-[15px] text-muted-foreground">Tente outro termo ou remova o filtro.</p>
      </div>
    );
  }
  return (
    <div className="border-l-[5px] border-l-lavender bg-white p-16 text-center shadow-sm">
      <p className="font-serif text-2xl font-bold text-primary">
        {tab === "active" ? "Comece pelo primeiro cliente" : "Nenhum dossiê arquivado"}
      </p>
      <p className="mt-2 text-[15px] text-muted-foreground">
        {tab === "active"
          ? "Todo caso começa por um nome. O resto — árvore, sessões, padrões — se constrói a partir daqui."
          : "Quando arquivar um dossiê, ele aparece aqui."}
      </p>
      {tab === "active" && (
        <Button onClick={onCreate} className="mt-6" size="lg" variant="lavender">
          <Plus className="size-4" />
          Cadastrar cliente
        </Button>
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
