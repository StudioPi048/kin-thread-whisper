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

import { calcAge, formatBirthDate, genderOptions, initialsFrom } from "@/lib/clients";

// Design System
import { ClinicalPanel, ClinicalPanelContent, ClinicalPanelHeader, ClinicalPanelTitle } from "@/components/archive/clinical-panel";
import { StatusBadge } from "@/components/archive/status-badge";
import { SectionTitle } from "@/components/archive/section-title";

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-mahogany border-r-transparent"></div>
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
      <div className="container-archive py-12">
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12 text-foreground">
      {/* CABEÇALHO DO DOSSIÊ (Editorial) */}
      <div className="bg-card border-b border-border pb-10 pt-6 px-6 relative overflow-hidden">
        {/* Giant decorative initial */}
        <span className="section-number absolute -right-4 -bottom-10 opacity-[0.03] text-foreground select-none">
          {initials}
        </span>

        <div className="container-archive relative z-10 space-y-3">
          <nav className="flex items-center gap-1 text-sm uppercase tracking-widest font-bold text-muted-foreground mb-6">
            <Link
              to="/app/clientes"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" /> Acervo
            </Link>
            <ChevronRight className="size-4" />
            <span className="truncate text-gold">{display}</span>
          </nav>

          <header className="flex flex-col gap-4 mt-2">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <motion.div
                  layoutId={`avatar-${client.id}`}
                  className="relative flex size-24 shrink-0 items-center justify-center rounded bg-muted border border-border font-serif text-3xl font-bold text-muted-foreground shadow-sm overflow-hidden group cursor-pointer"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials}</span>
                  )}

                  <label className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                    <Camera className="size-5 text-foreground mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
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
                <div>
                  <p className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Dossiê Clínico Ativo
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <h1 className="font-serif text-5xl font-bold text-primary tracking-tight leading-none">{display}</h1>
                    <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(true)}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground h-10 w-10"
                        title="Editar" aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleArchive.mutate()}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground h-10 w-10"
                        title={client.status === "active" ? "Arquivar" : "Reativar"} aria-label={client.status === "active" ? "Arquivar" : "Reativar"}
                      >
                        {client.status === "active" ? (
                          <Archive className="size-4" />
                        ) : (
                          <ArchiveRestore className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-clinical-critical hover:bg-clinical-critical/10 hover:text-clinical-critical h-10 w-10"
                        onClick={() => setDeleting(true)}
                        title="Excluir" aria-label="Excluir"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Minimalist Info Bar */}
            <div className="flex flex-wrap items-center gap-6 border-t border-border/60 pt-6 mt-4 text-[16px] font-sans font-bold uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-3">
                <Mail className="size-4 opacity-50" /> 
                <span className="font-bold text-foreground">{client.email || "Sem e-mail"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-4 opacity-50" /> 
                <span className="font-bold text-foreground">{client.phone || "Sem telefone"}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-4 opacity-50" /> 
                <span className="font-bold text-foreground">{client.birthplace || "Local não informado"}</span>
                <span className="opacity-30 mx-2">•</span>
                <span className="font-bold text-foreground">{age !== null ? `${age} anos` : "Idade omitida"}</span>
              </div>
              
              <div className="flex-1" />
              
              <div className="flex items-center gap-4 bg-muted px-5 py-2.5 rounded shadow-sm">
                <span className="flex items-center gap-2 text-[16px] font-bold text-foreground" title="Próxima sessão" aria-label="Próxima sessão">
                  <CalendarDays className="size-4" /> {(client as { session_count?: number }).session_count || 0} sessões
                </span>
                <div className="w-px h-4 bg-border" />
                <span className="flex items-center gap-2 text-[16px] font-bold text-gold">
                  <Sparkles className="size-4 text-gold" /> IA Clínica Ativa
                </span>
              </div>
            </div>
          </header>
        </div>
      </div>

      <div className="container-archive mt-10 relative z-20 flex gap-10 items-start">
        {/* Main Content (Tabs) */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="genogram" className="w-full">
            {/* STICKY NAV TABS MAIORES E MAIS CLARAS */}
            <div className="sticky top-0 z-30 py-4 bg-background border-b border-border">
              <TabsList className="w-full justify-start h-auto p-1.5 bg-muted border border-border flex gap-2 rounded shadow-sm overflow-x-auto no-scrollbar">
                <TabsTrigger
                  value="overview"
                  className="flex-1 min-w-fit items-center gap-2 py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  <FileText className="size-4" /> Visão geral
                </TabsTrigger>
                <TabsTrigger
                  value="genogram"
                  className="flex-1 min-w-fit items-center gap-2 py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  <TreePine className="size-4" /> Genograma
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="flex-1 min-w-fit items-center gap-2 py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  <History className="size-4" /> Linha do tempo
                </TabsTrigger>
                <TabsTrigger
                  value="patterns"
                  className="flex-1 min-w-fit items-center gap-2 py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  <Activity className="size-4" /> Padrões
                </TabsTrigger>
                <TabsTrigger
                  value="intake"
                  className="flex-1 min-w-fit py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  Anamnese
                </TabsTrigger>
                <TabsTrigger
                  value="sessions"
                  className="flex-1 min-w-fit py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  Sessões
                </TabsTrigger>
                <TabsTrigger
                  value="clan"
                  className="flex-1 min-w-fit py-3 px-6 rounded font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all cursor-pointer"
                >
                  Planilha
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-10">
              {/* Visão Geral (Resumo Executivo Clinico) */}
              <TabsContent value="overview">
                <div className="grid gap-10 xl:grid-cols-3">
                  <section className="xl:col-span-2 space-y-8">
                    {/* Bloco 2: Resumo IA Clínico */}
                    <ClinicalPanel accent="mahogany">
                      <ClinicalPanelHeader>
                        <div className="flex items-center gap-3">
                          <Sparkles className="size-5 text-mahogany" />
                          <ClinicalPanelTitle>Análise IA: Resumo Sistêmico</ClinicalPanelTitle>
                        </div>
                      </ClinicalPanelHeader>
                      <ClinicalPanelContent>
                        <p className="text-lg leading-relaxed text-foreground font-serif">
                          O clã de <strong>{display}</strong> exibe repetições notáveis de queixas de
                          abandono nas três últimas gerações (particularmente na linhagem paterna). O
                          padrão de união em casamento coincide de forma significativa com mortes de
                          avós em idades próximas aos 64 anos. Recomenda-se focar na reabilitação
                          simbólica dos membros excluídos.
                        </p>
                      </ClinicalPanelContent>
                    </ClinicalPanel>

                    <ClinicalPanel accent="forest">
                      <ClinicalPanelHeader>
                        <ClinicalPanelTitle>Queixa apresentada</ClinicalPanelTitle>
                      </ClinicalPanelHeader>
                      <ClinicalPanelContent>
                        {client.presenting_complaint ? (
                          <p className="whitespace-pre-wrap text-lg leading-relaxed text-foreground/80 font-serif">
                            {client.presenting_complaint}
                          </p>
                        ) : (
                          <EmptyLine>Sem queixa registrada ainda.</EmptyLine>
                        )}
                      </ClinicalPanelContent>
                    </ClinicalPanel>

                    <ClinicalPanel accent="gold">
                      <ClinicalPanelHeader>
                        <ClinicalPanelTitle>Notas clínicas</ClinicalPanelTitle>
                      </ClinicalPanelHeader>
                      <ClinicalPanelContent>
                        {client.clinical_notes ? (
                          <p className="whitespace-pre-wrap text-lg leading-relaxed text-foreground/80 font-serif">
                            {client.clinical_notes}
                          </p>
                        ) : (
                          <EmptyLine>Sem notas ainda. Você pode ditar por voz em breve.</EmptyLine>
                        )}
                      </ClinicalPanelContent>
                    </ClinicalPanel>

                    {client.tags && client.tags.length > 0 && (
                      <ClinicalPanel>
                        <ClinicalPanelHeader>
                          <ClinicalPanelTitle>Tags de Investigação</ClinicalPanelTitle>
                        </ClinicalPanelHeader>
                        <ClinicalPanelContent>
                          <div className="flex flex-wrap gap-2">
                            {client.tags.map((t) => (
                              <StatusBadge key={t} status="neutral" variant="outline">
                                {t}
                              </StatusBadge>
                            ))}
                          </div>
                        </ClinicalPanelContent>
                      </ClinicalPanel>
                    )}
                  </section>

                  <aside className="space-y-8">
                    <TabSuspense>
                      <CaseDashboard clientId={client.id} />
                    </TabSuspense>

                    <ClinicalPanel>
                      <ClinicalPanelHeader>
                        <ClinicalPanelTitle>Ficha do Paciente-Índice</ClinicalPanelTitle>
                      </ClinicalPanelHeader>
                      <ClinicalPanelContent className="p-0">
                        <div className="divide-y divide-border">
                          <InfoRow label="Nome completo" value={client.full_name} />
                          <InfoRow label="Gênero" value={genderLabel} />
                          <InfoRow
                            label="Nascimento"
                            value={client.birth_date ? formatBirthDate(client.birth_date) : "—"}
                          />
                          <InfoRow label="Cidade" value={client.birthplace ?? "—"} />
                          <InfoRow label="Telefone" value={client.phone ?? "—"} />
                          <InfoRow label="E-mail" value={client.email ?? "—"} />
                        </div>
                      </ClinicalPanelContent>
                    </ClinicalPanel>

                    <ClinicalPanel accent={client.consent_given_at ? "none" : "none"}>
                      <ClinicalPanelHeader>
                        <div className="flex items-center gap-3">
                          {client.consent_given_at ? (
                            <ShieldCheck className="size-5 text-clinical-positive" />
                          ) : (
                            <ShieldAlert className="size-5 text-clinical-warning" />
                          )}
                          <ClinicalPanelTitle>Consentimento LGPD</ClinicalPanelTitle>
                        </div>
                      </ClinicalPanelHeader>
                      <ClinicalPanelContent>
                        {client.consent_given_at ? (
                          <>
                            <p className="text-[16px] text-foreground font-medium">
                              Consentimento registrado em{" "}
                              <strong className="text-clinical-positive font-bold">
                                {new Date(client.consent_given_at).toLocaleDateString("pt-BR")}
                              </strong>
                            </p>
                            {client.consent_notes && (
                              <p className="mt-2 text-[16px] text-muted-foreground font-serif italic">
                                "{client.consent_notes}"
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-[16px] font-bold text-clinical-warning">
                            Sem consentimento registrado. Registre antes de anotar dados sensíveis.
                          </p>
                        )}
                      </ClinicalPanelContent>
                    </ClinicalPanel>
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
        <div className="w-80 shrink-0 hidden 2xl:block">
           <ClinicalIntelligencePanel clientId={clientId} />
        </div>
      </div>

      <ClientFormDialog
        open={editing}
        onOpenChange={setEditing}
        professionalId={user.id}
        editing={client}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-3xl font-bold text-clinical-critical">
              Excluir dossiê permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg text-foreground font-serif leading-relaxed italic mt-4">
              Esta ação apaga <strong>{client.full_name}</strong> e todos os dados clínicos
              associados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="border-border text-foreground hover:bg-muted font-bold uppercase tracking-widest text-[16px] px-6 h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate()}
              className="bg-clinical-critical hover:bg-clinical-critical/90 text-white font-bold uppercase tracking-widest text-[16px] px-6 h-12"
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
    <div className="container-archive py-24 text-center">
      <p className="text-[16px] font-bold uppercase tracking-[0.3em] text-gold">Instituto Liz</p>
      <h1 className="mt-4 font-serif text-4xl font-bold text-primary">Dossiê não encontrado</h1>
      <p className="mt-3 text-[16px] text-muted-foreground">
        Este cliente não existe ou foi removido.
      </p>
      <Button asChild className="mt-8">
        <Link to="/app/clientes">Voltar para clientes</Link>
      </Button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-4 px-6 font-sans text-sm">
      <dt className="font-bold uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-foreground font-bold">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-lg italic text-muted-foreground">{children}</p>;
}
