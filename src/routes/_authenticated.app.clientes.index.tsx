import { invalidateSessionViews } from "@/lib/session-state";
import { deleteClientDossier, pendingDossierDeletionsKey } from "@/lib/delete-client-dossier";
import { useEffect, useRef, useState } from "react";
import { readClientListPreferences, writePref } from "@/lib/recent-activity";
import { readWorkspaceClientPage } from "@/lib/workspace-client-search";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  ArrowRight,
  FolderOpen,
  X,
  Pencil,
  Plus,
  Search,
  Trash2,
  LayoutGrid,
  List,
  Archive,
  ArchiveRestore,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ReactivationConflictDialog } from "@/components/agenda/agenda-views";
import { readReactivationConflicts, type ReactivationConflict } from "@/lib/agenda-model";
import { calcAge } from "@/lib/clients";
import type { Database } from "@/integrations/supabase/types";
import "@/components/archive/work-desk.css";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientSummary = Pick<
  ClientRow,
  | "id"
  | "full_name"
  | "preferred_name"
  | "birth_date"
  | "birthplace"
  | "email"
  | "phone"
  | "presenting_complaint"
  | "consent_given_at"
  | "tags"
  | "status"
>;

export const Route = createFileRoute("/_authenticated/app/clientes/")({
  head: () => ({ meta: [{ title: "Dossiês clínicos — GENEALIZ" }] }),
  component: ClientesIndex,
});

function ClientesIndex() {
  const { user } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  // Visualização e aba são preferências. A busca fica somente nesta tela.
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 24;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);
  const searchInput = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [prefsLoadedFor, setPrefsLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    const preferences = readClientListPreferences(user.id);
    setTab(preferences.tab);
    setQuery("");
    setViewMode(preferences.viewMode);
    setPrefsLoadedFor(user.id);
  }, [user.id]);
  useEffect(() => {
    if (prefsLoadedFor === user.id) writePref(user.id, "clients-filters", { tab, viewMode });
  }, [prefsLoadedFor, user.id, tab, viewMode]);
  const [creating, setCreating] = useState(false);
  const newCase = useLocation({ select: ({ hash }) => hash === "novo-cliente" });
  useEffect(() => {
    if (newCase) setCreating(true);
  }, [newCase]);
  const [editing, setEditing] = useState<ClientSummary | null>(null);
  const [deleting, setDeleting] = useState<ClientSummary | null>(null);
  const editQuery = useQuery({
    queryKey: ["client-edit", user.id, editing?.id],
    enabled: !!editing,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (!editing) throw new Error("Escolha um dossiê para editar.");
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", editing.id)
        .eq("professional_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("O dossiê está indisponível.");
      return data;
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["clients", user.id, tab, search, page],
    queryFn: () =>
      readWorkspaceClientPage(supabase, {
        status: tab,
        search,
        offset: page * pageSize,
        limit: pageSize,
        details: true,
      }),
  });
  const filtered = data?.clients ?? [];
  const total = data?.total ?? 0;
  useEffect(() => {
    if (data && page > 0 && page * pageSize >= data.total) {
      setPage(Math.floor(Math.max(0, data.total - 1) / pageSize));
    }
  }, [data, page]);

  const [reactivation, setReactivation] = useState<{
    id: string;
    name: string;
    conflicts: ReactivationConflict[];
  } | null>(null);
  const setStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "archived"; name: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update({ status: input.status })
        .eq("id", input.id)
        .eq("professional_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não foi possível alterar o status do dossiê.");
    },
    onSuccess: (_d, v) => {
      setReactivation(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["all-clients-search"] });
      qc.invalidateQueries({ queryKey: ["genograms-list"] });
      void invalidateSessionViews(qc, v.id);
      void qc.invalidateQueries({ queryKey: ["client", v.id] });
      void qc.invalidateQueries({ queryKey: ["mesa-clients"] });
      void qc.invalidateQueries({ queryKey: ["timelines-list"] });
      toast.success(
        v.status === "archived"
          ? "Dossiê arquivado. Os atendimentos ficam no dossiê e saem da Agenda."
          : "Dossiê reativado. Os atendimentos voltam à Agenda.",
      );
    },
    onError: (error, { id, name }) => {
      const conflicts = readReactivationConflicts(error);
      if (conflicts) setReactivation({ id, name, conflicts });
      else
        toast.error(
          error instanceof Error ? error.message : "Não foi possível alterar o status do dossiê.",
        );
    },
  });

  const remove = useMutation({
    mutationFn: deleteClientDossier,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["all-clients-search"] });
      qc.invalidateQueries({ queryKey: ["genograms-list"] });
      qc.invalidateQueries({ queryKey: ["timelines-list"] });
      qc.invalidateQueries({ queryKey: pendingDossierDeletionsKey(user.id) });
      if (result === "media_pending") {
        toast.warning("Dossiê removido. Retome a limpeza de arquivos em Configurações.", {
          action: {
            label: "Abrir configurações",
            onClick: () =>
              void navigate({
                to: "/app/configuracoes",
                hash: "exclusoes",
              }),
          },
        });
      } else {
        toast.success("Dossiê e arquivos removidos.");
      }
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function toggleArchive(client: ClientSummary) {
    setStatus.mutate({
      id: client.id,
      name: client.preferred_name || client.full_name,
      status: client.status === "active" ? "archived" : "active",
    });
  }

  function clearSearch() {
    setQuery("");
    searchInput.current?.focus();
  }

  const hasQuery = query.trim().length > 0;

  return (
    <div className="container-liz work-clients">
      <header className="work-desk-heading work-client-heading">
        <h1>Dossiês clínicos</h1>
        <Button type="button" variant="forest" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> Novo cliente
        </Button>
      </header>

      <div className="work-clients-controls">
        <div role="group" aria-label="Status dos dossiês" className="work-client-filters">
          <button
            type="button"
            aria-pressed={tab === "active"}
            onClick={() => {
              setTab("active");
              setPage(0);
            }}
          >
            Em acompanhamento
          </button>
          <button
            type="button"
            aria-pressed={tab === "archived"}
            onClick={() => {
              setTab("archived");
              setPage(0);
            }}
          >
            Arquivados
          </button>
        </div>
        <div className="work-client-find">
          <div className="work-client-search">
            <Search size={18} aria-hidden />
            <Input
              ref={searchInput}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, queixa ou tag"
              aria-label="Buscar dossiês"
            />
            {query && (
              <button type="button" aria-label="Limpar busca" onClick={clearSearch}>
                <X size={17} aria-hidden />
              </button>
            )}
          </div>
          <div role="group" aria-label="Modo de visualização" className="work-client-views">
            <button
              type="button"
              title="Lista compacta"
              aria-label="Lista compacta"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <List size={18} aria-hidden />
            </button>
            <button
              type="button"
              title="Grade de dossiês"
              aria-label="Grade de dossiês"
              aria-pressed={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid size={17} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {isLoading || query.trim() !== search ? (
        <div className="work-client-loading" role="status">
          <p>Carregando dossiês…</p>
          <div className="work-skeleton" aria-hidden />
          <div className="work-skeleton" aria-hidden />
          <div className="work-skeleton" aria-hidden />
        </div>
      ) : isError ? (
        <div role="alert" className="work-desk-error work-client-page-status">
          Não foi possível carregar os clientes.
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <p role="status" className="work-client-count">
            {total} {total === 1 ? "dossiê" : "dossiês"}
            {filtered.length > 0 &&
              total > pageSize &&
              ` · ${page * pageSize + 1}–${page * pageSize + filtered.length}`}
          </p>
          {filtered.length === 0 ? (
            <EmptyState
              hasQuery={hasQuery}
              onClear={clearSearch}
              onCreate={() => setCreating(true)}
              tab={tab}
            />
          ) : viewMode === "cards" ? (
            <ul className="work-client-grid" aria-label="Dossiês em grade">
              {filtered.map((client) => (
                <li key={client.id} className="work-client-file">
                  <div className="work-client-file-head">
                    <ClientName client={client} />
                    <ClientActions
                      client={client}
                      onEdit={() => setEditing(client)}
                      onArchive={() => toggleArchive(client)}
                      onDelete={() => setDeleting(client)}
                    />
                  </div>
                  {client.presenting_complaint && (
                    <p className="work-client-summary">{client.presenting_complaint}</p>
                  )}
                  {client.tags?.length ? <ClientTags tags={client.tags} /> : null}
                  <footer>
                    <ClientConsent given={!!client.consent_given_at} />
                  </footer>
                </li>
              ))}
            </ul>
          ) : (
            <table className="work-client-ledger">
              <caption className="sr-only">
                {tab === "active" ? "Dossiês em acompanhamento" : "Dossiês arquivados"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="work-client-contact">
                    Contato
                  </th>
                  <th scope="col" className="work-client-concern">
                    Queixa
                  </th>
                  <th scope="col" className="work-client-tags-column">
                    Tags
                  </th>
                  <th scope="col" className="work-client-consent-column">
                    Consentimento
                  </th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <th scope="row">
                      <ClientName client={client} />
                    </th>
                    <td className="work-client-contact">
                      {client.email && <span>{client.email}</span>}
                      {client.phone && <span>{client.phone}</span>}
                      {!client.email && !client.phone && <span>—</span>}
                    </td>
                    <td className="work-client-concern">
                      <span>{client.presenting_complaint || "—"}</span>
                    </td>
                    <td className="work-client-tags-column">
                      <ClientTags tags={client.tags} />
                    </td>
                    <td className="work-client-consent-column">
                      <ClientConsent given={!!client.consent_given_at} />
                    </td>
                    <td className="work-client-action">
                      <ClientActions
                        client={client}
                        onEdit={() => setEditing(client)}
                        onArchive={() => toggleArchive(client)}
                        onDelete={() => setDeleting(client)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {!isError && !isLoading && query.trim() === search && (page > 0 || data?.hasMore) && (
        <nav className="my-4 flex gap-2" aria-label="Páginas de dossiês">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={!data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}

      <ClientFormDialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open && newCase) void navigate({ hash: "", replace: true });
        }}
        professionalId={user.id}
        onCreated={(clientId) =>
          void navigate({
            to: "/app/clientes/$clientId",
            params: { clientId },
            search: { tab: "overview" },
          })
        }
      />
      {reactivation && (
        <ReactivationConflictDialog
          key={reactivation.id}
          clientId={reactivation.id}
          clientName={reactivation.name}
          conflicts={reactivation.conflicts}
          checking={setStatus.isPending}
          onRetry={() =>
            setStatus.mutate({ id: reactivation.id, name: reactivation.name, status: "active" })
          }
          onClose={() => setReactivation(null)}
        />
      )}
      {editing && editQuery.data && (
        <ClientFormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          professionalId={user.id}
          editing={editQuery.data}
        />
      )}
      {editing && !editQuery.data && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogTitle>Editar dossiê</DialogTitle>
            {editQuery.isError ? (
              <div role="alert" className="space-y-3 text-sm">
                <p>Não foi possível carregar o dossiê.</p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void editQuery.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <p role="status" className="text-sm">
                Carregando dossiê…
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-ink">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você vai excluir permanentemente o dossiê de <strong>{deleting?.full_name}</strong>,
              incluindo mapa, planilha, notas, sessões, áudios e foto do perfil. Se a limpeza de
              áudios ou fotos for interrompida, termine em Configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
              className="bg-clinical-critical text-white hover:bg-clinical-critical/90"
            >
              {remove.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientName({ client }: { client: ClientSummary }) {
  const age = calcAge(client.birth_date);
  const [first = "", ...surnames] = client.full_name.trim().split(/\s+/);
  const initials =
    `${Array.from(first)[0] ?? ""}${Array.from(surnames.at(-1) ?? "")[0] ?? ""}`.toLocaleUpperCase(
      "pt-BR",
    );
  const metadata = [
    client.preferred_name && client.preferred_name !== client.full_name ? client.full_name : null,
    age !== null ? `${age} anos` : null,
    client.birthplace,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to="/app/clientes/$clientId"
      params={{ clientId: client.id }}
      className="work-client-name"
    >
      <span className="work-client-initials" aria-hidden="true">
        {initials}
      </span>
      <span>
        <strong>{client.preferred_name || client.full_name}</strong>
        {metadata && <small>{metadata}</small>}
      </span>
      <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function ClientTags({ tags }: { tags: string[] | null }) {
  return tags?.length ? (
    <ul className="work-client-tags">
      {tags.slice(0, 3).map((tag, index) => (
        <li key={`${tag}-${index}`}>{tag}</li>
      ))}
    </ul>
  ) : (
    <span>—</span>
  );
}

function ClientConsent({ given }: { given: boolean }) {
  return (
    <span className="work-client-consent" data-pending={given ? undefined : true}>
      {given ? <FileCheck size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
      {given ? "Registrado" : "Pendente"}
    </span>
  );
}

function ClientActions({
  client,
  onEdit,
  onArchive,
  onDelete,
}: {
  client: ClientSummary;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações para ${client.full_name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchive}>
          {client.status === "active" ? (
            <>
              <Archive aria-hidden /> Arquivar
            </>
          ) : (
            <>
              <ArchiveRestore aria-hidden /> Reativar
            </>
          )}
        </DropdownMenuItem>
        {client.status === "archived" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 aria-hidden /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({
  hasQuery,
  onClear,
  onCreate,
  tab,
}: {
  hasQuery: boolean;
  onClear: () => void;
  onCreate: () => void;
  tab: "active" | "archived";
}) {
  return (
    <section className="work-client-empty" aria-labelledby="work-client-empty-title">
      {!hasQuery && tab === "active" && (
        <img
          src="/assets/genealiz/acervo/raizes.webp"
          alt=""
          className="work-client-empty-art"
          width={500}
          height={500}
          decoding="async"
        />
      )}
      {hasQuery ? <Search size={26} aria-hidden /> : <FolderOpen size={28} aria-hidden />}
      <h2 id="work-client-empty-title">
        {hasQuery
          ? "Nenhum dossiê encontrado"
          : tab === "active"
            ? "Nenhum cliente cadastrado"
            : "Nenhum dossiê arquivado"}
      </h2>
      <p>
        {hasQuery
          ? "Tente outro nome, queixa ou tag."
          : tab === "active"
            ? "Cadastre o primeiro cliente para começar o dossiê."
            : "Os dossiês ficam disponíveis aqui após o arquivamento."}
      </p>
      {hasQuery ? (
        <Button variant="outline" onClick={onClear}>
          Limpar busca
        </Button>
      ) : tab === "active" ? (
        <Button variant="forest" onClick={onCreate}>
          <Plus aria-hidden /> Cadastrar primeiro cliente
        </Button>
      ) : null}
    </section>
  );
}
