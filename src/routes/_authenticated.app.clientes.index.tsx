import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
      const { error } = await supabase.from("clients").update({ status: input.status }).eq("id", input.id);
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
    <div className="container-liz py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Consultório</p>
          <h1 className="mt-3 font-serif text-4xl text-primary md:text-5xl">Clientes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cada cliente tem um dossiê vivo. Você é a única pessoa com acesso.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Novo cliente
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
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
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={query.length > 0} onCreate={() => setCreating(true)} tab={tab} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <li key={c.id}>
                <ClientCard
                  client={c}
                  onEdit={() => setEditing(c)}
                  onArchive={() =>
                    setStatus.mutate({ id: c.id, status: c.status === "active" ? "archived" : "active" })
                  }
                  onDelete={() => setDeleting(c)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClientFormDialog
        open={creating}
        onOpenChange={setCreating}
        professionalId={user.id}
      />
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
    <article className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-lilac">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lilac-soft font-serif text-lg text-primary">
          {initialsFrom(client.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/app/clientes/$clientId"
            params={{ clientId: client.id }}
            className="block truncate font-serif text-xl text-primary hover:underline"
          >
            {display}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {age !== null ? `${age} anos · ` : ""}
            {formatBirthDate(client.birth_date)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 opacity-70 hover:opacity-100">
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

      {client.presenting_complaint && (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {client.presenting_complaint}
        </p>
      )}

      {client.tags && client.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {client.tags.slice(0, 5).map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>
          {client.consent_given_at ? (
            <span className="text-emerald-700">● Consentimento registrado</span>
          ) : (
            <span className="text-amber-700">● Sem consentimento</span>
          )}
        </span>
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: client.id }}
          className="text-primary underline-offset-4 hover:underline"
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
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
        <p className="font-serif text-2xl text-primary">Nada encontrado</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente outro termo ou remova o filtro.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
      <p className="font-serif text-2xl text-primary">
        {tab === "active" ? "Comece pelo primeiro cliente" : "Nenhum dossiê arquivado"}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {tab === "active"
          ? "Todo caso começa por um nome. O resto — árvore, sessões, padrões — se constrói a partir daqui."
          : "Quando arquivar um dossiê, ele aparece aqui."}
      </p>
      {tab === "active" && (
        <Button onClick={onCreate} className="mt-6" size="lg">
          <Plus className="size-4" /> Cadastrar cliente
        </Button>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-44 animate-pulse rounded-lg border border-border bg-card/60"
        />
      ))}
    </ul>
  );
}
