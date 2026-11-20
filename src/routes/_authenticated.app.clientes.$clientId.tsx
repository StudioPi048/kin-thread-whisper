import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazy, Suspense } from "react";

const ClientTimeline = lazy(() =>
  import("@/components/clients/client-timeline").then((m) => ({ default: m.ClientTimeline })),
);
const CaseDashboard = lazy(() =>
  import("@/components/clients/case-dashboard").then((m) => ({ default: m.CaseDashboard })),
);
const PatternsPanel = lazy(() =>
  import("@/components/clients/patterns-panel").then((m) => ({ default: m.PatternsPanel })),
);
const GenogramCanvas = lazy(() =>
  import("@/components/genogram/genogram-canvas").then((m) => ({ default: m.GenogramCanvas })),
);
const ClanSpreadsheet = lazy(() =>
  import("@/components/genogram/clan-spreadsheet").then((m) => ({ default: m.ClanSpreadsheet })),
);
const IntakeForm = lazy(() =>
  import("@/components/intake/intake-form").then((m) => ({ default: m.IntakeForm })),
);
const SessionsPanel = lazy(() =>
  import("@/components/sessions/sessions-panel").then((m) => ({ default: m.SessionsPanel })),
);
const DossierReportDialog = lazy(() =>
  import("@/components/clients/dossier-report-dialog").then((m) => ({
    default: m.DossierReportDialog,
  })),
);

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Ellipsis,
  Download,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  TreePine,
  Activity,
  History,
  FileText,
  Camera,
  MapPin,
  RefreshCw,
  Table2,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { LibraryCasePanel } from "@/components/library/library-case-panel";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteClientDossier, pendingDossierDeletionsKey } from "@/lib/delete-client-dossier";
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClinicalIntelligencePanel } from "@/components/clients/clinical-intelligence-panel";
import { DocumentHeader } from "@/components/ui/document-header";

import { recordVisit, writePref } from "@/lib/recent-activity";
import { clinicalIntelQuery, getMappablePersons } from "@/lib/clinical-intel";
import { detectPatterns } from "@/lib/patterns";
import { informationGaps } from "@/lib/evidence";
import { calcAge, formatBirthDate, genderOptions, initialsFrom } from "@/lib/clients";
import { JOURNEY_STAGES, deriveStage, stageIndex } from "@/lib/clinical-catalog";

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground"
          role="status"
        >
          <span
            className="size-5 animate-spin rounded-full border-2 border-forest border-r-transparent"
            aria-hidden
          />
          Carregando seção…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const DOSSIER_TABS = [
  "overview",
  "genogram",
  "timeline",
  "patterns",
  "intake",
  "sessions",
  "clan",
] as const;
type DossierTab = (typeof DOSSIER_TABS)[number];

export const Route = createFileRoute("/_authenticated/app/clientes/$clientId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab?: DossierTab;
    from?: "agenda";
    agendaDate?: string;
    person?: string;
    session?: string;
    review?: "parentage";
    focus?: "audio-consent";
    event?: string;
    question?: string;
  } => {
    const tab = search.tab as string | undefined;
    return {
      ...(search.review === "parentage" ? { review: "parentage" as const } : {}),
      ...(search.focus === "audio-consent" ? { focus: "audio-consent" as const } : {}),
      ...(typeof search.question === "string" && /^[a-z_]{1,100}$/.test(search.question)
        ? { question: search.question }
        : {}),
      ...(typeof search.event === "string" && /^[a-z0-9-]{1,80}$/i.test(search.event)
        ? { event: search.event }
        : {}),
      ...(typeof search.agendaDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.agendaDate)
        ? { agendaDate: search.agendaDate }
        : {}),
      ...(typeof search.person === "string" && /^[0-9a-f-]{36}$/i.test(search.person)
        ? { person: search.person }
        : {}),
      ...(typeof search.session === "string" && /^[0-9a-f-]{36}$/i.test(search.session)
        ? { session: search.session }
        : {}),
      ...(DOSSIER_TABS.includes(tab as DossierTab) ? { tab: tab as DossierTab } : {}),
      ...(search.from === "agenda" ? { from: "agenda" as const } : {}),
    };
  },
  component: ClientDossierPage,
  notFoundComponent: ClientNotFound,
});

function ClientDossierPage() {
  const { clientId } = Route.useParams();
  const {
    tab: tabFromUrl,
    from,
    agendaDate,
    person: focusPerson,
    session: focusedSessionId,
    review,
    focus,
    event: focusEvent,
    question: focusQuestion,
  } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [avatar, setAvatar] = useState<{ path: string; url: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const recoveringClientRef = useRef<string | null>(null);
  const [mapFocus, setMapFocus] = useState<{ clientId: string; personId: string }>();
  const rememberMapFocus = useCallback(
    (personId: string) => {
      setMapFocus({ clientId, personId });
      writePref(user.id, `map-focus:${clientId}`, { personId });
    },
    [clientId, user.id],
  );
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const activeTab = tabFromUrl ?? "genogram";

  // A aba só muda depois que a navegação passa pelo guard de alterações
  // não salvas (useBlocker); se a usuária escolher "Ficar", nada desmonta.
  const goToTab = (next: DossierTab) => {
    if (next === activeTab) return;
    const selectedPerson = mapFocus?.clientId === clientId ? mapFocus.personId : focusPerson;
    void navigate({
      from: Route.fullPath,
      search: (prev) => ({
        ...prev,
        tab: next,
        person: next === "clan" || next === "genogram" ? selectedPerson : undefined,
        review: undefined,
        focus: undefined,
        event: undefined,
        question: undefined,
        session: next === "sessions" ? prev.session : undefined,
      }),
      replace: true,
    });
  };
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${clientId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("client-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from("clients")
        .update({ avatar_url: path })
        .eq("id", clientId);
      if (updateError) throw updateError;
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Foto atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const client = clientQ.data;
  const hasClient = Boolean(client);

  useEffect(() => {
    if (hasClient) recordVisit(user.id, clientId, activeTab);
  }, [user.id, clientId, activeTab, hasClient]);
  useEffect(() => {
    if (recoveringClientRef.current !== clientId || !hasClient) return;
    recoveringClientRef.current = null;
    titleRef.current?.focus();
  }, [clientId, hasClient]);
  useEffect(() => {
    const lane = tabScrollRef.current;
    const active = lane?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!lane || !active) return;
    const viewport = lane.getBoundingClientRect();
    const target = active.getBoundingClientRect();
    if (target.left < viewport.left) lane.scrollLeft += target.left - viewport.left;
    if (target.right > viewport.right) lane.scrollLeft += target.right - viewport.right;
  }, [activeTab, clientId, hasClient]);

  const intelQ = useQuery({
    ...clinicalIntelQuery(clientId),
    enabled: hasClient && activeTab === "overview",
  });
  const patterns = useMemo(
    () => (intelQ.data ? detectPatterns(intelQ.data.persons, intelQ.data.relationships) : []),
    [intelQ.data],
  );
  const gaps = useMemo(
    () => (intelQ.data ? informationGaps(intelQ.data.persons, intelQ.data.relationships) : []),
    [intelQ.data],
  );

  const sessionCountQ = useQuery({
    queryKey: ["client-session-count", clientId],
    enabled: hasClient,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clinical_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      if (error) throw error;
      if (count === null) throw new Error("Contagem de sessões indisponível.");
      return count;
    },
  });

  // Sinais leves pra jornada clínica e o card de "próxima sessão" — não
  // duplicam os dados completos que cada aba (Sessões/Genograma) já busca.
  const nextSessionQ = useQuery({
    queryKey: ["client-next-session", clientId],
    enabled: hasClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_sessions")
        .select("id, session_date")
        .eq("client_id", clientId)
        .or("clinical_status.eq.scheduled,clinical_status.is.null")
        .gt("session_date", new Date().toISOString())
        .order("session_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      if (!client) return;
      const next = client.status === "active" ? "archived" : "active";
      const { data, error } = await supabase
        .from("clients")
        .update({ status: next })
        .eq("id", client.id)
        .eq("professional_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não foi possível alterar o status do dossiê.");
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["all-clients-search"] });
      qc.invalidateQueries({ queryKey: ["genograms-list"] });
      qc.invalidateQueries({ queryKey: ["timelines-list"] });
      toast.success(next === "archived" ? "Dossiê arquivado." : "Dossiê reativado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const exportCase = useMutation({
    mutationFn: async () => {
      const [{ exportDossierData }, { readExportPage, downloadJson }] = await Promise.all([
        import("@/lib/data-export"),
        import("@/lib/download-export"),
      ]);
      const data = await exportDossierData(readExportPage, user.id, clientId);
      downloadJson(data, `genealiz-dossie-${clientId}.json`);
    },
    onSuccess: () => toast.success("Arquivo JSON do dossiê gerado."),
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteClientDossier(clientId),
    onSuccess: (result) => {
      setDeleting(false);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["all-clients-search"] });
      qc.invalidateQueries({ queryKey: ["genograms-list"] });
      qc.invalidateQueries({ queryKey: ["timelines-list"] });
      qc.invalidateQueries({ queryKey: pendingDossierDeletionsKey(user.id) });
      if (result === "media_pending") {
        toast.warning("Dossiê removido. Termine a limpeza de arquivos em Configurações.");
        navigate({ to: "/app/configuracoes", hash: "exclusoes" });
      } else {
        toast.success("Dossiê e arquivos removidos.");
        navigate({ to: "/app/clientes" });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  // Resolve stored avatar path to a signed URL (bucket is private).
  useEffect(() => {
    let cancelled = false;
    const path = client?.avatar_url;
    if (!path) return;
    supabase.storage
      .from("client-avatars")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setAvatar({ path, url: data.signedUrl });
      });
    return () => {
      cancelled = true;
    };
  }, [client?.avatar_url]);

  if (!client && clientQ.isError && !clientQ.isFetching) {
    return (
      <div className="container-liz space-y-4 py-12">
        <h1 className="font-serif text-4xl font-semibold text-ink">Falha ao abrir o dossiê</h1>
        <p role="alert" className="text-[15px] text-muted-foreground">
          Não foi possível consultar o dossiê agora. Confira a conexão e tente novamente.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            onClick={() => {
              recoveringClientRef.current = clientId;
              void clientQ.refetch();
            }}
          >
            Tentar novamente
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            {from === "agenda" ? (
              <Link to="/app/agenda" search={agendaDate ? { date: agendaDate } : {}}>
                Voltar à agenda
              </Link>
            ) : (
              <Link to="/app/clientes">Voltar à lista de clientes</Link>
            )}
          </Button>
        </div>
      </div>
    );
  }
  if (!client && !clientQ.isSuccess) {
    return (
      <div className="container-liz py-12" role="status">
        <p className="mb-4 text-sm text-muted-foreground">Carregando dossiê…</p>
        <div className="h-40 animate-pulse rounded-lg bg-muted/70" aria-hidden />
      </div>
    );
  }
  if (client === null) return <ClientNotFound />;
  if (!client) return null;

  const display = client.preferred_name || client.full_name;
  const age = calcAge(client.birth_date);
  const genderLabel = genderOptions.find((g) => g.value === client.gender)?.label ?? "—";
  const initials = initialsFrom(client.full_name);

  const sessionCount = sessionCountQ.data;
  const nextSession = nextSessionQ.data;
  const family = intelQ.data
    ? getMappablePersons(intelQ.data.persons, intelQ.data.relationships)
    : undefined;
  const sessionQueries = [sessionCountQ, nextSessionQ];
  const sessionError = sessionQueries.some((query) => query.isError && !query.isFetching);
  const sessionLoading = sessionQueries.some(
    (query) => query.isPending || (query.isError && query.isFetching),
  );
  const journeyQueries = [sessionCountQ, intelQ];
  const journeyErrors = journeyQueries.filter((query) => query.isError && !query.isFetching);
  const currentStageIdx =
    sessionCount !== undefined && family
      ? stageIndex(deriveStage(sessionCount, family.length > 0, patterns.length))
      : null;
  const avatarUrl = avatar?.path === client.avatar_url ? avatar?.url : undefined;
  const journeyStages =
    currentStageIdx === null
      ? null
      : JOURNEY_STAGES.map((s, i) => ({
          ...s,
          status:
            i < currentStageIdx
              ? ("done" as const)
              : i === currentStageIdx
                ? ("current" as const)
                : ("future" as const),
        }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-12 atlas-dossier"
      data-active-tab={activeTab}
    >
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleAvatarUpload}
      />
      <DocumentHeader
        breadcrumb={
          <>
            {from === "agenda" ? (
              <Link
                to="/app/agenda"
                search={agendaDate ? { date: agendaDate } : {}}
                className="hover:text-gold transition-colors"
              >
                Agenda
              </Link>
            ) : (
              <Link to="/app/clientes" className="hover:text-gold transition-colors">
                Clientes
              </Link>
            )}
            <span className="mx-1.5 opacity-40">/</span>
            {display}
          </>
        }
        title={
          <div className="flex min-w-0 items-center gap-3">
            <motion.div
              aria-hidden
              layoutId={`avatar-${client.id}`}
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-archive-old text-base font-semibold text-ink"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </motion.div>
            <span ref={titleRef} tabIndex={-1} className="min-w-0 wrap-anywhere tracking-tight">
              {display}
            </span>
          </div>
        }
        subtitle={
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[14px] font-normal not-italic tracking-normal text-ink-soft">
            {age !== null && <span>{age} anos</span>}
            {client.birthplace && <span>{client.birthplace}</span>}
            {sessionCount !== undefined && (
              <span>
                {sessionCount} {sessionCount === 1 ? "sessão" : "sessões"}
              </span>
            )}
            {nextSession ? (
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId }}
                search={(previous) => ({ ...previous, tab: "sessions", session: nextSession.id })}
                className="inline-flex min-h-11 items-center font-medium text-forest underline-offset-4 hover:underline"
              >
                Próxima sessão ·{" "}
                {new Date(nextSession.session_date).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Link>
            ) : (
              nextSession === null && <span>Sem sessão agendada</span>
            )}
            {sessionLoading && <span role="status">Carregando sessões…</span>}
            {sessionError && (
              <ReadFailure
                retry={() =>
                  sessionQueries
                    .filter((query) => query.isError)
                    .forEach((query) => void query.refetch())
                }
              >
                Consulta de sessões incompleta.
              </ReadFailure>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LibraryCasePanel
              reference={
                activeTab === "genogram"
                  ? "manual-genossociograma"
                  : activeTab === "timeline" || activeTab === "patterns"
                    ? "manual-cronologia"
                    : activeTab === "intake" || activeTab === "clan"
                      ? "manual-investigacao"
                      : undefined
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-h-11" aria-label="Mais ações do dossiê">
                  <Ellipsis className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Mais ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="min-h-11" onSelect={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> Editar dossiê
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={uploadingAvatar}
                  onSelect={() => avatarInputRef.current?.click()}
                >
                  <Camera className="size-4" aria-hidden />
                  {uploadingAvatar ? "Enviando foto…" : "Alterar foto do consultante"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={exportCase.isPending}
                  onSelect={() => exportCase.mutate()}
                >
                  <Download className="size-4" aria-hidden />
                  {exportCase.isPending ? "Exportando…" : "Exportar dossiê em JSON"}
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-11" onSelect={() => setReportOpen(true)}>
                  <Download className="size-4" aria-hidden /> Preparar relatório PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={toggleArchive.isPending}
                  onSelect={() => toggleArchive.mutate()}
                >
                  {client.status === "active" ? (
                    <Archive aria-hidden />
                  ) : (
                    <ArchiveRestore aria-hidden />
                  )}
                  {client.status === "active" ? "Arquivar dossiê" : "Reativar dossiê"}
                </DropdownMenuItem>
                {client.status === "archived" && (
                  <DropdownMenuItem
                    className="min-h-11 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onSelect={() => setDeleting(true)}
                  >
                    <Trash2 className="size-4" aria-hidden /> Excluir dossiê
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {clientQ.isError && (
        <div className="container-liz mb-3">
          <ReadFailure retry={() => void clientQ.refetch()}>
            Falha ao atualizar a identificação do consultante.
          </ReadFailure>
        </div>
      )}
      {uploadingAvatar && (
        <p role="status" className="container-liz mb-3 text-sm text-muted-foreground">
          Enviando foto do consultante…
        </p>
      )}
      <div className="container-liz -mt-2 relative z-20 flex gap-6 items-start atlas-tabs">
        {/* Main Content (Tabs) */}
        <div className="flex-1 min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => goToTab(v as DossierTab)}
            activationMode="manual"
            className="w-full"
          >
            {/* STICKY NAV TABS — rolagem horizontal no mobile */}
            <div className="sticky top-0 z-30 -mx-[18px] flex items-center gap-2 border-b border-border/40 bg-surface-archive px-[18px] py-2 sm:mx-0 sm:px-0">
              <div
                ref={tabScrollRef}
                className="min-w-0 flex-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <TabsList className="flex h-auto w-max flex-nowrap justify-start gap-1 rounded-full border border-border/40 bg-surface-document p-1 shadow-md">
                  {(
                    [
                      { value: "overview", label: "Visão geral", Icon: FileText },
                      { value: "genogram", label: "Genossociograma", Icon: TreePine },
                      { value: "timeline", label: "Linha do tempo", Icon: History },
                      { value: "patterns", label: "Evidências", Icon: Activity },
                      { value: "intake", label: "Anamnese", Icon: null },
                      { value: "sessions", label: "Sessões", Icon: null },
                      { value: "clan", label: "Planilha", Icon: null },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-4 py-2 font-semibold whitespace-nowrap text-muted-foreground transition-colors"
                    >
                      {Icon && <Icon className="size-3.5" aria-hidden />} {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Atalho rápido Genograma ↔ Planilha — as duas telas de dados do clã mais usadas */}
              {(activeTab === "genogram" || activeTab === "clan") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => goToTab(activeTab === "genogram" ? "clan" : "genogram")}
                  className="atlas-dossier-quick-tab hidden shrink-0 gap-1.5 font-semibold 2xl:flex"
                >
                  <Repeat className="size-3.5" />
                  {activeTab === "genogram" ? (
                    <>
                      <Table2 className="size-3.5" /> Ver planilha
                    </>
                  ) : (
                    <>
                      <TreePine className="size-3.5" /> Ver genossociograma
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="mt-4">
              {/* Visão Geral (Resumo Executivo Clinico) */}
              <TabsContent value="overview">
                {intelQ.isSuccess && family && family.every((person) => person.is_proband) && (
                  <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
                    <div>
                      <h2 className="font-semibold text-primary">Começar a árvore da família</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Traga uma planilha ou registre o primeiro familiar.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="min-h-11"
                        variant="outline"
                        onClick={() => goToTab("clan")}
                      >
                        Abrir planilha para importar
                      </Button>
                      <Button className="min-h-11" onClick={() => goToTab("genogram")}>
                        Abrir mapa para adicionar familiar
                      </Button>
                    </div>
                  </section>
                )}

                <div className="mb-6">
                  {journeyErrors.length ? (
                    <ReadFailure
                      retry={() => journeyErrors.forEach((query) => void query.refetch())}
                    >
                      Não foi possível atualizar a etapa do acompanhamento.
                    </ReadFailure>
                  ) : journeyStages ? (
                    <JourneyStrip stages={journeyStages} />
                  ) : (
                    <p role="status" className="text-sm text-muted-foreground">
                      Carregando etapa do acompanhamento…
                    </p>
                  )}
                </div>
                <div className="grid gap-6 xl:grid-cols-3">
                  <section className="xl:col-span-2 space-y-6">
                    {intelQ.data && patterns.length > 0 ? (
                      <Panel title="Evidências detectadas">
                        <p className="text-[15px] text-ink">
                          A leitura automática do genossociograma identificou{" "}
                          <strong>
                            {patterns.length}{" "}
                            {patterns.length === 1 ? "padrão sistêmico" : "padrões sistêmicos"}
                          </strong>{" "}
                          nos registros atuais.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-soft">
                          {patterns.slice(0, 3).map((pattern) => (
                            <li key={pattern.id}>{pattern.title}</li>
                          ))}
                        </ul>
                        <Button
                          variant="link"
                          className="min-h-11 px-0 text-[14px]"
                          onClick={() => goToTab("patterns")}
                        >
                          Conferir evidências e fontes
                        </Button>
                      </Panel>
                    ) : (
                      intelQ.isSuccess && (
                        <Panel title="Evidências">
                          <p className="text-[15px] text-muted-foreground">
                            A leitura do genossociograma não encontrou repetições nos dados atuais.
                          </p>
                        </Panel>
                      )
                    )}

                    <Panel title="Lacunas do caso" accent="gold">
                      {intelQ.isError && !intelQ.isFetching ? (
                        <ReadFailure retry={() => void intelQ.refetch()}>
                          Não foi possível ler o genossociograma.
                        </ReadFailure>
                      ) : !intelQ.data ? (
                        <p role="status" className="text-[15px] text-muted-foreground">
                          Verificando…
                        </p>
                      ) : gaps.length === 0 ? (
                        <p className="text-[15px] text-muted-foreground">
                          Sem lacunas nos campos verificados.
                        </p>
                      ) : (
                        <>
                          <ul className="ml-5 list-disc space-y-1 text-[15px]">
                            {gaps.slice(0, 6).map((g) => (
                              <li key={g}>{g}</li>
                            ))}
                          </ul>
                          {gaps.length > 6 && (
                            <p className="mt-2 text-[14px] text-muted-foreground">
                              + {gaps.length - 6} outras lacunas
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => goToTab("clan")}
                            className="mt-3 inline-flex min-h-11 items-center text-[15px] font-medium text-primary underline underline-offset-4"
                          >
                            Completar na planilha do clã
                          </button>
                        </>
                      )}
                    </Panel>

                    <Panel title="Queixa apresentada" accent="forest">
                      {client.presenting_complaint ? (
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/80 font-serif">
                          {client.presenting_complaint}
                        </p>
                      ) : (
                        <EmptyLine>Sem queixa registrada ainda.</EmptyLine>
                      )}
                    </Panel>

                    <Panel title="Notas clínicas" accent="gold">
                      {client.clinical_notes ? (
                        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/80 font-serif">
                          {client.clinical_notes}
                        </p>
                      ) : (
                        <EmptyLine>
                          Sem notas no dossiê. Use Editar dossiê para adicionar.
                        </EmptyLine>
                      )}
                    </Panel>

                    {client.tags && client.tags.length > 0 && (
                      <Panel title="Marcadores">
                        <div className="flex flex-wrap gap-2">
                          {client.tags.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="font-semibold px-2 py-1 bg-background border border-border"
                            >
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </Panel>
                    )}
                  </section>

                  <aside className="space-y-6">
                    <TabSuspense>
                      <CaseDashboard clientId={client.id} />
                    </TabSuspense>

                    <Panel title="Identificação do consultante">
                      <dl>
                        <InfoRow label="Nome completo" value={client.full_name} />
                        <InfoRow label="Gênero" value={genderLabel} />
                        <InfoRow
                          label="Nascimento"
                          value={client.birth_date ? formatBirthDate(client.birth_date) : "—"}
                        />
                        <InfoRow label="Cidade" value={client.birthplace ?? "—"} />
                        <InfoRow label="Telefone" value={client.phone ?? "—"} />
                        <InfoRow label="E-mail" value={client.email ?? "—"} />
                      </dl>
                    </Panel>
                    <ClinicalIntelligencePanel clientId={clientId} />

                    <Panel
                      title="Consentimento geral"
                      icon={
                        client.consent_given_at ? (
                          <ShieldCheck className="size-4 text-clinical-positive" />
                        ) : (
                          <ShieldAlert className="size-4 text-clinical-warning" />
                        )
                      }
                    >
                      {client.consent_given_at ? (
                        <>
                          <p className="text-[13px] text-foreground font-medium">
                            Consentimento registrado em{" "}
                            <strong className="text-clinical-positive">
                              {new Date(client.consent_given_at).toLocaleDateString("pt-BR")}
                            </strong>
                          </p>
                          {client.consent_notes && (
                            <p className="mt-2 text-[12px] text-muted-foreground">
                              {client.consent_notes}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[13px] font-bold text-clinical-warning">
                          Consentimento geral pendente.
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="mt-3 min-h-11"
                        onClick={() => goToTab("sessions")}
                      >
                        Autorizações de áudio
                      </Button>
                    </Panel>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent value="genogram">
                <TabSuspense>
                  <GenogramCanvas
                    key={client.id}
                    clientId={client.id}
                    focusPersonId={focusPerson}
                    reviewParentagePersonId={review === "parentage" ? focusPerson : undefined}
                    resumePersonId={mapFocus?.clientId === clientId ? mapFocus.personId : undefined}
                    onFocusPerson={rememberMapFocus}
                    onOpenSpreadsheet={() => goToTab("clan")}
                  />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="timeline">
                <TabSuspense>
                  <ClientTimeline
                    key={`${client.id}:${focusEvent ?? ""}`}
                    clientId={client.id}
                    focusEvent={focusEvent}
                  />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="patterns">
                <TabSuspense>
                  <PatternsPanel clientId={client.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="intake">
                <TabSuspense>
                  <IntakeForm
                    clientId={client.id}
                    professionalId={user.id}
                    focusQuestion={focusQuestion}
                  />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="clan">
                <TabSuspense>
                  <ClanSpreadsheet
                    clientId={client.id}
                    onOpenGenogram={() => goToTab("genogram")}
                    focusPersonId={focusPerson}
                    onReviewParentage={(personId) =>
                      void navigate({
                        from: Route.fullPath,
                        search: (prev) => ({
                          ...prev,
                          tab: "genogram",
                          person: personId,
                          review: "parentage",
                          event: undefined,
                        }),
                      })
                    }
                  />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="sessions">
                <TabSuspense>
                  <SessionsPanel
                    key={client.id}
                    clientId={client.id}
                    clientName={display}
                    focusedSessionId={focusedSessionId}
                    focusConsent={focus === "audio-consent"}
                  />
                </TabSuspense>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <ClientFormDialog
        open={editing}
        onOpenChange={setEditing}
        professionalId={user.id}
        editing={client}
      />
      {reportOpen && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              Carregando opções do relatório…
            </span>
          }
        >
          <DossierReportDialog
            key={clientId}
            clientId={clientId}
            userId={user.id}
            onClose={() => setReportOpen(false)}
          />
        </Suspense>
      )}

      <AlertDialog open={deleting} onOpenChange={(open) => !remove.isPending && setDeleting(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-primary">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você vai excluir permanentemente o dossiê de <strong>{client.full_name}</strong>,
              incluindo mapa, planilha, notas, sessões, áudios e foto do perfil. Se a limpeza de
              arquivos for interrompida, termine em Configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? "Excluindo…" : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function ClientNotFound() {
  return (
    <div className="container-liz py-24 text-center">
      <h1 className="font-serif text-4xl font-bold text-primary">Dossiê indisponível</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        O dossiê solicitado não consta entre os seus casos.
      </p>
      <Button asChild className="mt-8" variant="forest">
        <Link to="/app/clientes">Voltar para clientes</Link>
      </Button>
    </div>
  );
}

function ReadFailure({ retry, children }: { retry: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-sm text-destructive">
      <span role="alert">{children}</span>
      <Button variant="link" className="min-h-11 px-1 text-sm text-forest" onClick={retry}>
        <RefreshCw className="size-4" aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}

function JourneyStrip({
  stages,
}: {
  stages: {
    key: string;
    label: string;
    description: string;
    status: "done" | "current" | "future";
  }[];
}) {
  return (
    <details className="rounded-xl border border-border bg-card px-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-ring">
        Acompanhamento · {stages.find((s) => s.status === "current")?.label}
      </summary>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((s, i) => {
          const isCurrent = s.status === "current";
          const isDone = s.status === "done";
          return (
            <div key={s.key} className="flex-1 min-w-[100px]">
              <div className="flex items-center gap-1">
                <div
                  className={`size-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold ${
                    isCurrent
                      ? "bg-forest ring-4 ring-forest/15"
                      : isDone
                        ? "bg-forest"
                        : "bg-cream border border-border text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full ${isDone ? "bg-forest" : "bg-border"}`}
                  />
                )}
              </div>
              <p
                aria-current={isCurrent ? "step" : undefined}
                className={`mt-2 text-sm font-semibold ${isCurrent ? "text-forest" : isDone ? "text-primary" : "text-muted-foreground"}`}
              >
                {s.label}
              </p>
              <p className="mb-3 mt-1 text-sm leading-snug text-muted-foreground">
                {s.description}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Panel({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: "forest" | "gold";
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "forest" ? "accent-bar-forest" : accent === "gold" ? "accent-bar-gold" : "";

  return (
    <section className={`surface shadow-surface rounded-[1rem] p-6 ${accentClass}`}>
      <div className="mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
        {icon}
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border/40 py-2.5 text-sm first:border-0 first:pt-0">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] wrap-anywhere text-right text-foreground font-medium">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] italic text-muted-foreground">{children}</p>;
}
