import { useMemo, useState } from "react";
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
  MapPin,
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
import { calcAge, initialsFrom } from "@/lib/clients";
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
    "aniversario": "aniversario",
    "aniversário": "aniversario",
    "projeto sentido": "sentido",
    "sentido": "sentido",
    "lealdade": "lealdade",
    "lealdades": "lealdade",
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
      const { error } = await supabase.from("clients").delete().eq(id, id);
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
    <div style={{ background: "var(--surface-archive, #F4F1EB)", minHeight: "100vh" }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <DocumentHeader
        breadcrumb="Clientes"
        title="Dossiês Clínicos"
        subtitle="Todos os pacientes em acompanhamento."
        actions={
          <button
            onClick={() => setCreating(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "var(--gold, #D4A843)", color: "#12291F",
              border: "none", borderRadius: "10px",
              padding: "11px 20px",
              fontSize: "13px", fontWeight: 700,
              fontFamily: "var(--font-sans)",
              cursor: "pointer", letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 10px rgba(212,168,67,0.2), 0 1px 3px rgba(0,0,0,0.05)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--gold-soft, #E8C068)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(212,168,67,0.3), 0 2px 6px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--gold, #D4A843)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 10px rgba(212,168,67,0.2), 0 1px 3px rgba(0,0,0,0.05)";
            }}
          >
            <Plus style={{ width: "16px", height: "16px" }} strokeWidth={2.5} />
            Novo cliente
          </button>
        }
      />

      {/* ── TOOLBAR ─────────────────────────────────────────── */}
      <div style={{
        background: "var(--surface-document, #FAFAF7)",
        borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.5))",
        padding: "16px 0",
      }}>
        <div className="container-liz" style={{
          display: "flex", flexWrap: "wrap", alignItems: "center",
          justifyContent: "space-between", gap: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
              <TabsList>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="archived">Arquivados</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* View mode */}
            <div style={{
              display: "flex", alignItems: "center",
              border: "1px solid var(--material-border, rgba(180,170,155,0.5))",
              borderRadius: "8px", padding: "3px",
              background: "var(--surface-archive, #F4F1EB)",
            }}>
              <button
                onClick={() => setViewMode("cards")}
                title="Grade de Dossiês"
                style={{
                  width: "28px", height: "28px", borderRadius: "5px", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: viewMode === "cards" ? "var(--surface-document, #FAFAF7)" : "transparent",
                  color: viewMode === "cards" ? "var(--forest, #12291F)" : "var(--warm-gray, #6B6358)",
                  transition: "all 0.15s ease",
                  boxShadow: viewMode === "cards" ? "0 1px 3px rgba(18,41,31,0.08)" : "none",
                }}
              >
                <LayoutGrid style={{ width: "14px", height: "14px" }} strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="Lista Compacta"
                style={{
                  width: "28px", height: "28px", borderRadius: "5px", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: viewMode === "list" ? "var(--surface-document, #FAFAF7)" : "transparent",
                  color: viewMode === "list" ? "var(--forest, #12291F)" : "var(--warm-gray, #6B6358)",
                  transition: "all 0.15s ease",
                  boxShadow: viewMode === "list" ? "0 1px 3px rgba(18,41,31,0.08)" : "none",
                }}
              >
                <List style={{ width: "14px", height: "14px" }} strokeWidth={1.75} />
              </button>
            </div>

            {/* Contagem */}
            {!isLoading && (
              <span style={{
                fontSize: "12px", color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)",
              }}>
                {filtered.length} {filtered.length === 1 ? "dossiê" : "dossiês"}
              </span>
            )}
          </div>

          {/* Busca */}
          <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
            <Search style={{
              position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
              width: "14px", height: "14px", color: "var(--warm-gray, #6B6358)", pointerEvents: "none",
            }} strokeWidth={1.5} />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, queixa, tag..."
              style={{ paddingLeft: "36px", height: "36px", fontSize: "13px" }}
            />
          </div>
        </div>
      </div>

      {/* ── GRID DE DOSSIÊS ─────────────────────────────────── */}
      <div className="container-liz" style={{ paddingTop: "28px", paddingBottom: "48px" }}>
        {isLoading ? (
          <ul style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", listStyle: "none", margin: 0, padding: 0 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}><DossierCardSkeleton /></li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={query.length > 0} onCreate={() => setCreating(true)} tab={tab} />
        ) : viewMode === "cards" ? (
          <motion.ul
            style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", listStyle: "none", margin: 0, padding: 0 }}
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
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
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
                    aiInsight={null}  /* Real: sem dados fictícios — IA real a implementar */
                    consentStatus={consentStatus}
                    onEdit={() => setEditing(c)}
                    onArchive={() => setStatus.mutate({ id: c.id, status: c.status === "active" ? "archived" : "active" })}
                    onDelete={() => setDeleting(c)}
                  />
                </motion.li>
              );
            })}
          </motion.ul>
        ) : (
          /* ── LISTA COMPACTA (alta densidade) ── */
          <div style={{
            background: "var(--surface-document, #FAFAF7)",
            border: "1px solid var(--material-border, rgba(180,170,155,0.5))",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(18,41,31,0.04), 0 6px 16px rgba(18,41,31,0.06)",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{
                  borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.5))",
                  background: "var(--surface-archive, #F4F1EB)",
                }}>
                  {["Cliente", "Contato", "Queixa", "Tags", "Consentimento", "Ações"].map((h, i) => (
                    <th key={h} style={{
                      padding: i === 0 ? "12px 16px 12px 20px" : i === 5 ? "12px 20px 12px 16px" : "12px 16px",
                      textAlign: i === 5 ? "right" : "left",
                      fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em",
                      textTransform: "uppercase", color: "var(--warm-gray, #6B6358)",
                      fontFamily: "var(--font-sans)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const age = calcAge(c.birth_date);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(180,170,155,0.25)", transition: "background 0.12s ease" }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(244,241,235,0.6)"}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                    >
                      <td style={{ padding: "13px 16px 13px 20px" }}>
                        <Link
                          to="/app/clientes/$clientId"
                          params={{ clientId: c.id }}
                          style={{
                            fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "15px",
                            color: "var(--ink, #1A1714)", textDecoration: "none", display: "block",
                          }}
                        >
                          {normalizeName(c.preferred_name || c.full_name)}
                        </Link>
                        <span style={{ fontSize: "11px", color: "var(--warm-gray, #6B6358)", fontFamily: "var(--font-sans)" }}>
                          {age !== null ? `${age} anos` : ""}
                          {c.birthplace ? ` · ${c.birthplace}` : ""}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px", fontFamily: "monospace", fontSize: "11px", color: "var(--ink-soft, #4A4540)" }}>
                        {c.email || "—"}<br />{c.phone || "—"}
                      </td>
                      <td style={{ padding: "13px 16px", maxWidth: "200px" }}>
                        <span style={{
                          fontSize: "13px", color: "var(--ink-soft, #4A4540)",
                          fontFamily: "var(--font-sans)",
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {c.presenting_complaint || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {c.tags?.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px" }}>
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 600,
                          color: c.consent_given_at ? "var(--forest-soft, #26543E)" : "var(--terracotta, #A8654D)",
                          fontFamily: "var(--font-sans)",
                          display: "flex", alignItems: "center", gap: "4px",
                        }}>
                          {c.consent_given_at
                            ? <><FileCheck style={{ width: "12px", height: "12px" }} aria-hidden /> Assinado</>
                            : <><AlertTriangle style={{ width: "12px", height: "12px" }} aria-hidden /> Pendente</>
                          }
                        </span>
                      </td>
                      <td style={{ padding: "13px 20px 13px 16px", textAlign: "right" }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="size-8" aria-label={`Ações para ${c.full_name}`}>
                              <MoreHorizontal style={{ width: "14px", height: "14px" }} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(c)}>
                              <Pencil style={{ width: "13px", height: "13px" }} /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: c.status === "active" ? "archived" : "active" })}>
                              {c.status === "active"
                                ? <><Archive style={{ width: "13px", height: "13px" }} /> Arquivar</>
                                : <><ArchiveRestore style={{ width: "13px", height: "13px" }} /> Reativar</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(c)}>
                              <Trash2 style={{ width: "13px", height: "13px" }} /> Excluir
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
            <AlertDialogTitle style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>{deleting?.full_name}</strong> e todos os dados clínicos associados. Não pode ser desfeita. Considere arquivar antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              style={{ background: "var(--clinical-critical)", color: "#fff" }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
      <div style={{
        background: "var(--surface-document)", border: "1px solid var(--material-border)",
        borderLeft: "3px solid var(--material-bronze)", borderRadius: "12px",
        padding: "64px 48px", textAlign: "center",
      }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Nada encontrado
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--warm-gray)", margin: "8px 0 0", lineHeight: 1.6 }}>
          Tente outro termo ou remova o filtro.
        </p>
      </div>
    );
  }
  return (
    <div style={{
      background: "var(--surface-document)", border: "1px solid var(--material-border)",
      borderLeft: "3px solid var(--forest)", borderRadius: "12px",
      padding: "64px 48px",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "24px",
      maxWidth: "560px",
    }}>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.2 }}>
        {tab === "active" ? "A jornada começa aqui" : "Nenhum dossiê arquivado"}
      </p>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "15px", color: "var(--ink-soft)", margin: 0, lineHeight: 1.7, maxWidth: "440px" }}>
        {tab === "active"
          ? "Todo caso começa por um nome. O genograma, as sessões e os padrões sistêmicos se constroem a partir do paciente-índice."
          : "Quando arquivar um dossiê, ele aparecerá aqui para consulta histórica."
        }
      </p>
      {tab === "active" && (
        <button
          onClick={onCreate}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "var(--forest)", color: "#fff",
            border: "none", borderRadius: "10px",
            padding: "12px 22px", fontSize: "14px", fontWeight: 700,
            fontFamily: "var(--font-sans)", cursor: "pointer",
            letterSpacing: "0.02em", transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--forest-mid)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--forest)"; }}
        >
          <Plus style={{ width: "15px", height: "15px" }} strokeWidth={2.5} />
          Cadastrar primeiro cliente
        </button>
      )}
    </div>
  );
}
