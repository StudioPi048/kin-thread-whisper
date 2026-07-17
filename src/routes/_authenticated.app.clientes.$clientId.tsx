import { useEffect, useState } from "react";
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

import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  TreePine,
  Activity,
  History,
  FileText,
  Camera,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Layers,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClinicalDocument } from "@/components/ui/clinical-document";
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
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClinicalIntelligencePanel } from "@/components/clients/clinical-intelligence-panel";
import { DocumentHeader } from "@/components/ui/document-header";

import { calcAge, formatBirthDate, genderOptions, initialsFrom } from "@/lib/clients";

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest border-r-transparent"></div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const Route = createFileRoute("/_authenticated/app/clientes/$clientId")({
  component: ClientDossierPage,
  notFoundComponent: ClientNotFound,
});

function ClientDossierPage() {
  const { clientId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  // Padrões reais detectados pelo motor — alimentam a hipótese clínica sem inventar dados
  const { data: patterns = [] } = useQuery({
    queryKey: ["client-patterns", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patterns_detected")
        .select("id, title, pattern_type, severity, acknowledged_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessionCount = 0 } = useQuery({
    queryKey: ["client-session-count", clientId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clinical_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      if (!client) return;
      const next = client.status === "active" ? "archived" : "active";
      const { error } = await supabase.from("clients").update({ status: next }).eq("id", client.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      toast.success(next === "archived" ? "Dossiê arquivado." : "Dossiê reativado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dossiê removido.");
      navigate({ to: "/app/clientes" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  // Resolve stored avatar path to a signed URL (bucket is private).
  useEffect(() => {
    let cancelled = false;
    const path = (client as { avatar_url?: string | null } | undefined)?.avatar_url;
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    supabase.storage
      .from("client-avatars")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setAvatarUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (isLoading) {
    return (
      <div className="container-liz py-12">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-40 animate-pulse rounded-lg bg-muted/70" />
      </div>
    );
  }

  if (!client) return <ClientNotFound />;

  const display = client.preferred_name || client.full_name;
  const age = calcAge(client.birth_date);
  const genderLabel = genderOptions.find((g) => g.value === client.gender)?.label ?? "—";
  const initials = initialsFrom(client.full_name);

  // Gramática visual derivada dos padrões reais (nunca inventada)
  const REPETITION_TYPES = new Set([
    "shared_death_age",
    "shared_cause_of_death",
    "shared_health_condition",
    "shared_occupation",
    "anniversary_syndrome",
  ]);
  const clamp3 = (n: number) => Math.min(3, n) as 0 | 1 | 2 | 3;
  const repetitionCount = patterns.filter((p) => REPETITION_TYPES.has(p.pattern_type)).length;
  const ruptureCount = patterns.filter((p) => p.pattern_type === "relationship_ruptures").length;
  const anniversary = patterns.find((p) => p.pattern_type === "anniversary_syndrome");
  const hypothesisGrammar = {
    stage: patterns.some((p) => p.acknowledged_at)
      ? ("investigada" as const)
      : ("observada" as const),
    intensities: {
      trauma: clamp3(ruptureCount),
      repetition: clamp3(repetitionCount),
      exclusion: 0 as const,
      loyalty: 0 as const,
      secret: 0 as const,
    },
    temporalAnchor: anniversary ? anniversary.title : null,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12">
      <DocumentHeader
        breadcrumb={
          <>
            <Link to="/app/clientes" className="hover:text-gold transition-colors">
              Clientes
            </Link>
            <span className="mx-1.5 opacity-40">/</span>
            {display}
          </>
        }
        title={
          <div className="flex items-center gap-4">
            <motion.div
              layoutId={`avatar-${client.id}`}
              className="relative flex size-14 shrink-0 items-center justify-center rounded-lg bg-archive-old font-serif text-2xl font-bold text-ink shadow-sm overflow-hidden group cursor-pointer border border-border/40"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}

              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                <Camera className="size-4 text-white mb-0.5" />
                <span className="text-[8px] font-bold uppercase tracking-wider text-white">
                  Trocar
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            </motion.div>
            <span className="tracking-tight">{display}</span>
          </div>
        }
        subtitle={
          <div className="flex flex-wrap items-center gap-6 text-[13px] text-ink/70 not-italic mt-2 font-sans tracking-normal font-normal">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 opacity-50" />
              <span className="font-medium">{client.email || "Sem e-mail"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 opacity-50" />
              <span className="font-medium">{client.phone || "Sem telefone"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 opacity-50" />
              <span className="font-medium">{client.birthplace || "Local não informado"}</span>
              <span className="opacity-40 mx-1">•</span>
              <span className="font-medium">{age !== null ? `${age} anos` : "Idade omitida"}</span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-4 bg-surface-document/60 px-4 py-1.5 rounded-full border border-border/40">
              <span
                className="flex items-center gap-1.5 text-[12px] font-semibold text-ink/80"
                title="Sessões registradas"
              >
                <CalendarDays className="size-3.5" /> {sessionCount}{" "}
                {sessionCount === 1 ? "sessão" : "sessões"}
              </span>
              <div className="w-px h-3 bg-border/60" />
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-ink shadow-sm">
                <Sparkles className="size-3.5 text-gold" /> IA Clínica
              </span>
            </div>
          </div>
        }
        actions={
          <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity bg-surface-document/60 p-1 rounded-md border border-border/40">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              className="hover:bg-black/5"
              title="Editar"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleArchive.mutate()}
              className="hover:bg-black/5"
              title={client.status === "active" ? "Arquivar" : "Reativar"}
            >
              {client.status === "active" ? (
                <Archive className="size-3.5" />
              ) : (
                <ArchiveRestore className="size-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-clinical-critical hover:bg-clinical-critical/10 hover:text-clinical-critical"
              onClick={() => setDeleting(true)}
              title="Excluir"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        }
      />

      <div className="container-liz -mt-2 relative z-20 flex gap-6 items-start">
        {/* Main Content (Tabs) */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="genogram" className="w-full">
            {/* STICKY NAV TABS — rolagem horizontal no mobile */}
            <div className="sticky top-0 z-30 -mx-6 border-b border-border/40 bg-surface-archive/85 px-6 py-2 backdrop-blur-md sm:mx-0 sm:px-0">
              <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList className="flex h-auto w-max flex-nowrap justify-start gap-1 rounded-full border border-border/40 bg-surface-document p-1 shadow-md">
                  {(
                    [
                      { value: "overview", label: "Visão geral", Icon: FileText },
                      { value: "genogram", label: "Genossociograma", Icon: TreePine },
                      { value: "timeline", label: "Linhas de Herança", Icon: History },
                      { value: "patterns", label: "Padrões", Icon: Activity },
                      { value: "intake", label: "Anamnese", Icon: null },
                      { value: "sessions", label: "Sessões", Icon: null },
                      { value: "clan", label: "Planilha", Icon: null },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold whitespace-nowrap text-muted-foreground transition-all data-[state=active]:bg-forest data-[state=active]:text-white"
                    >
                      {Icon && <Icon className="size-3.5" />} {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <div className="mt-6">
              {/* Visão Geral (Resumo Executivo Clinico) */}
              <TabsContent value="overview">
                <div className="grid gap-6 xl:grid-cols-3">
                  <section className="xl:col-span-2 space-y-6">
                    {/* Hipótese clínica alimentada pelos padrões reais do motor */}
                    {patterns.length > 0 ? (
                      <ClinicalDocument title="Hipótese Clínica (IA)" grammar={hypothesisGrammar}>
                        <p className="font-serif">
                          O motor de padrões identificou{" "}
                          <strong>
                            {patterns.length}{" "}
                            {patterns.length === 1 ? "padrão sistêmico" : "padrões sistêmicos"}
                          </strong>{" "}
                          no clã de {display}:{" "}
                          {patterns
                            .slice(0, 3)
                            .map((p) => p.title)
                            .join("; ")}
                          {patterns.length > 3 ? "…" : "."}
                        </p>
                        <p className="mt-3 font-sans text-[12px] text-muted-foreground">
                          Hipóteses são provisórias e dependem da sua validação clínica. Veja os
                          detalhes na aba Padrões.
                        </p>
                      </ClinicalDocument>
                    ) : (
                      <section className="border-l-[3px] border-l-material-olive bg-surface-manuscript px-5 py-4">
                        <h3 className="m-0 font-serif text-lg font-bold text-ink">
                          Hipótese Clínica
                        </h3>
                        <p className="mt-2 mb-0 font-serif text-[15px] text-ink/55 italic">
                          Nenhum padrão sistêmico detectado até aqui. A hipótese se formará conforme
                          o genossociograma e as sessões ganharem profundidade.
                        </p>
                      </section>
                    )}

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
                        <EmptyLine>Sem notas ainda. Você pode ditar por voz em breve.</EmptyLine>
                      )}
                    </Panel>

                    {client.tags && client.tags.length > 0 && (
                      <Panel title="Tags">
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

                    <Panel title="Identificação do Paciente-Índice">
                      <InfoRow label="Nome completo" value={client.full_name} />
                      <InfoRow label="Gênero" value={genderLabel} />
                      <InfoRow
                        label="Nascimento"
                        value={client.birth_date ? formatBirthDate(client.birth_date) : "—"}
                      />
                      <InfoRow label="Cidade" value={client.birthplace ?? "—"} />
                      <InfoRow label="Telefone" value={client.phone ?? "—"} />
                      <InfoRow label="E-mail" value={client.email ?? "—"} />
                    </Panel>

                    <Panel
                      title="Consentimento LGPD"
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
                          Sem consentimento registrado. Registre antes de anotar dados sensíveis.
                        </p>
                      )}
                    </Panel>
                  </aside>
                </div>
              </TabsContent>

              <TabsContent value="genogram">
                <TabSuspense>
                  <GenogramCanvas clientId={client.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="timeline">
                <TabSuspense>
                  <ClientTimeline clientId={client.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="patterns">
                <TabSuspense>
                  <PatternsPanel clientId={client.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="intake">
                <TabSuspense>
                  <IntakeForm clientId={client.id} professionalId={user.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="clan">
                <TabSuspense>
                  <ClanSpreadsheet clientId={client.id} />
                </TabSuspense>
              </TabsContent>

              <TabsContent value="sessions">
                <TabSuspense>
                  <SessionsPanel clientId={client.id} />
                </TabSuspense>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Collapsible Clinical Intelligence Copilot Panel */}
        <ClinicalIntelligencePanel clientId={clientId} />
      </div>

      <ClientFormDialog
        open={editing}
        onOpenChange={setEditing}
        professionalId={user.id}
        editing={client}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-primary">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>{client.full_name}</strong> e todos os dados clínicos
              associados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir definitivamente
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
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-gold">Instituto Liz</p>
      <h1 className="mt-4 font-serif text-4xl font-bold text-primary">Dossiê não encontrado</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Este cliente não existe ou foi removido.
      </p>
      <Button asChild className="mt-8" variant="forest">
        <Link to="/app/clientes">Voltar para clientes</Link>
      </Button>
    </div>
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
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border/40 py-2.5 text-[13px] first:border-0 first:pt-0">
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-foreground font-medium">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] italic text-muted-foreground">{children}</p>;
}
