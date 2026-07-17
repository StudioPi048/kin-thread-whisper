import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
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
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentHeader } from "@/components/ui/document-header";
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
import { calcAge } from "@/lib/clients";
import { DossierCard, DossierCardSkeleton } from "@/components/ui/dossier-card";
import type { PatternItem } from "@/components/ui/dossier-card";
import type { Database } from "@/integrations/supabase/types";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

export const Route = createFileRoute("/_authenticated/app/clientes/")({
  component: ClientesIndex,
});

/* ─────────────────────────────────────────────────────────────
   Helpers — sem dados fictícios, sem random
   ───────────────────────────────────────────────────────────── */

/** Gera número de registro determinístico a partir do ID */
function toRegistrationNumber(id: string): string {
  const hash = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return String(hash % 999999).padStart(6, "0");
}

/** Normaliza capitalização preservando preposições */
const PREPS = new Set(["de", "da", "do", "dos", "das", "e", "em"]);
function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w, i) => (i > 0 && PREPS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Extrai padrões clínicos das tags do cliente (real — sem invenção) */
function patternsFromTags(tags: string[] | null): PatternItem[] {
  if (!tags || tags.length === 0) return [];
  const typeMap: Record<string, PatternItem["type"]> = {
    "síndrome de aniversário": "aniversario",
    aniversario: "aniversario",
    aniversário: "aniversario",
    "projeto sentido": "sentido",
    sentido: "sentido",
    lealdade: "lealdade",
    lealdades: "lealdade",
  };
  return tags.map((t) => ({
    label: t,
    type: typeMap[t.toLowerCase()] ?? "geral",
  }));
}

/* ─────────────────────────────────────────────────────────────
   PÁGINA PRINCIPAL
   ───────────────────────────────────────────────────────────── */

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
    <div className="min-h-screen bg-surface-archive">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <DocumentHeader
        breadcrumb="Clientes"
        title="Dossiês Clínicos"
        subtitle="Todos os pacientes em acompanhamento."
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 rounded-[10px] bg-gold px-5 font-sans text-[13px] font-bold tracking-[0.02em] text-forest shadow-[0_2px_10px_rgba(212,168,67,0.2),0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-px hover:bg-gold-soft hover:shadow-[0_4px_14px_rgba(212,168,67,0.3),0_2px_6px_rgba(0,0,0,0.1)]"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Novo cliente
          </Button>
        }
      />

      {/* ── TOOLBAR ─────────────────────────────────────────── */}
      <div className="border-b border-material-border bg-surface-document py-4">
        <div className="container-liz flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
              <TabsList>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="archived">Arquivados</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View mode */}
            <div
              role="group"
              aria-label="Modo de visualização"
              className="flex items-center rounded-lg border border-material-border bg-surface-archive p-[3px]"
            >
              <button
                onClick={() => setViewMode("cards")}
                title="Grade de Dossiês"
                aria-label="Grade de Dossiês"
                aria-pressed={viewMode === "cards"}
                className={`flex size-7 items-center justify-center rounded-[5px] transition-all duration-150 ${
                  viewMode === "cards"
                    ? "bg-surface-document text-forest shadow-[0_1px_3px_rgba(18,41,31,0.08)]"
                    : "text-warm-gray hover:text-ink"
                }`}
              >
                <LayoutGrid className="size-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="Lista Compacta"
                aria-label="Lista Compacta"
                aria-pressed={viewMode === "list"}
                className={`flex size-7 items-center justify-center rounded-[5px] transition-all duration-150 ${
                  viewMode === "list"
                    ? "bg-surface-document text-forest shadow-[0_1px_3px_rgba(18,41,31,0.08)]"
                    : "text-warm-gray hover:text-ink"
                }`}
              >
                <List className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Contagem */}
            {!isLoading && (
              <span className="text-xs text-warm-gray">
                {filtered.length} {filtered.length === 1 ? "dossiê" : "dossiês"}
              </span>
            )}
          </div>

          {/* Busca */}
          <div className="relative w-full sm:max-w-[320px]">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-warm-gray"
              strokeWidth={1.5}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, queixa, tag..."
              aria-label="Buscar dossiês"
              className="h-9 pl-9 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* ── GRID DE DOSSIÊS ─────────────────────────────────── */}
      <div className="container-liz pt-7 pb-12">
        {isLoading ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <DossierCardSkeleton />
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={query.length > 0} onCreate={() => setCreating(true)} tab={tab} />
        ) : viewMode === "cards" ? (
          <motion.ul
            className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 p-0"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
            }}
          >
            {filtered.map((c) => {
              const age = calcAge(c.birth_date);
              const patterns = patternsFromTags(c.tags);
              const consentStatus = c.consent_given_at ? "signed" : "pending";

              return (
                <motion.li
                  key={c.id}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 320, damping: 26 },
                    },
                  }}
                >
                  <DossierCard
                    id={c.id}
                    registrationNumber={toRegistrationNumber(c.id)}
                    patientName={normalizeName(c.full_name)}
                    preferredName={c.preferred_name ? normalizeName(c.preferred_name) : undefined}
                    subtitle={c.tags?.[0] ?? undefined}
                    age={age}
                    birthplace={c.birthplace ?? undefined}
                    presentingComplaint={c.presenting_complaint ?? undefined}
                    status={c.status as "active" | "archived"}
                    patterns={patterns}
                    aiInsight={null} /* Real: sem dados fictícios — IA real a implementar */
                    consentStatus={consentStatus}
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
              );
            })}
          </motion.ul>
        ) : (
          /* ── LISTA COMPACTA (alta densidade) ── */
          <div className="overflow-hidden rounded-[14px] border border-material-border bg-surface-document shadow-[0_1px_3px_rgba(18,41,31,0.04),0_6px_16px_rgba(18,41,31,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-material-border bg-surface-archive">
                    <Th className="pl-5">Cliente</Th>
                    <Th className="hidden md:table-cell">Contato</Th>
                    <Th className="hidden lg:table-cell">Queixa</Th>
                    <Th className="hidden sm:table-cell">Tags</Th>
                    <Th>Consentimento</Th>
                    <Th className="pr-5 text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const age = calcAge(c.birth_date);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-material-border/50 transition-colors duration-100 hover:bg-surface-archive/60"
                      >
                        <td className="py-3 pr-4 pl-5">
                          <Link
                            to="/app/clientes/$clientId"
                            params={{ clientId: c.id }}
                            className="block font-serif text-[15px] font-bold text-ink no-underline hover:text-forest-soft"
                          >
                            {normalizeName(c.preferred_name || c.full_name)}
                          </Link>
                          <span className="text-[11px] text-warm-gray">
                            {age !== null ? `${age} anos` : ""}
                            {c.birthplace ? ` · ${c.birthplace}` : ""}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-[11px] text-ink-soft md:table-cell">
                          {c.email || "—"}
                          <br />
                          {c.phone || "—"}
                        </td>
                        <td className="hidden max-w-[200px] px-4 py-3 lg:table-cell">
                          <span className="line-clamp-2 text-[13px] text-ink-soft">
                            {c.presenting_complaint || "—"}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.slice(0, 3).map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="px-1.5 py-0.5 text-[9px] font-bold"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex items-center gap-1 text-[11px] font-semibold ${
                              c.consent_given_at ? "text-forest-soft" : "text-material-terracotta"
                            }`}
                          >
                            {c.consent_given_at ? (
                              <>
                                <FileCheck className="size-3" aria-hidden /> Assinado
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="size-3" aria-hidden /> Pendente
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 pr-5 pl-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-8"
                                aria-label={`Ações para ${c.full_name}`}
                              >
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(c)}>
                                <Pencil className="size-[13px]" /> Editar
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
                                  <>
                                    <Archive className="size-[13px]" /> Arquivar
                                  </>
                                ) : (
                                  <>
                                    <ArchiveRestore className="size-[13px]" /> Reativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleting(c)}
                              >
                                <Trash2 className="size-[13px]" /> Excluir
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
          </div>
        )}
      </div>

      {/* ── DIALOGS ─────────────────────────────────────────── */}
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
            <AlertDialogTitle className="font-serif text-ink">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>{deleting?.full_name}</strong> e todos os dados clínicos
              associados. Não pode ser desfeita. Considere arquivar antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-clinical-critical text-white hover:bg-clinical-critical/90"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Th({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <th
      className={`px-4 py-3 text-left text-[9px] font-extrabold tracking-[0.14em] text-warm-gray uppercase ${className}`}
    >
      {children}
    </th>
  );
}

/* ─────────────────────────────────────────────────────────────
   EMPTY STATE
   ───────────────────────────────────────────────────────────── */
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
      <div className="rounded-xl border border-material-border border-l-[3px] border-l-material-bronze bg-surface-document px-6 py-16 text-center sm:px-12">
        <p className="m-0 font-serif text-2xl font-bold text-ink">Nada encontrado</p>
        <p className="mt-2 mb-0 text-sm leading-relaxed text-warm-gray">
          Tente outro termo ou remova o filtro.
        </p>
      </div>
    );
  }
  return (
    <div className="flex max-w-[560px] flex-col items-start gap-6 rounded-xl border border-material-border border-l-[3px] border-l-forest bg-surface-document px-6 py-16 sm:px-12">
      <p className="m-0 font-serif text-[1.75rem] leading-tight font-bold text-ink">
        {tab === "active" ? "A jornada começa aqui" : "Nenhum dossiê arquivado"}
      </p>
      <p className="m-0 max-w-[440px] text-[15px] leading-relaxed text-ink-soft">
        {tab === "active"
          ? "Todo caso começa por um nome. O genograma, as sessões e os padrões sistêmicos se constroem a partir do paciente-índice."
          : "Quando arquivar um dossiê, ele aparecerá aqui para consulta histórica."}
      </p>
      {tab === "active" && (
        <Button
          onClick={onCreate}
          className="gap-2 rounded-[10px] bg-forest px-5 py-3 text-sm font-bold tracking-[0.02em] text-white hover:bg-forest-mid"
        >
          <Plus className="size-[15px]" strokeWidth={2.5} />
          Cadastrar primeiro cliente
        </Button>
      )}
    </div>
  );
}
