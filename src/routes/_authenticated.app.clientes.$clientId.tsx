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
} from "lucide-react";
import { toast } from "sonner";
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
import { supabase } from "@/integrations/supabase/client";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";

import { calcAge, formatBirthDate, genderOptions, initialsFrom } from "@/lib/clients";

function TabSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-plum border-r-transparent"></div>
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12">
      {/* Editorial Plum Header */}
      <div className="block-plum pb-10 pt-4 px-6 relative overflow-hidden">
        {/* Giant decorative initial */}
        <span className="section-number absolute -right-4 -bottom-10 opacity-[0.03] text-white">
          {initials}
        </span>

        <div className="container-liz relative z-10">
          <nav className="flex items-center gap-1 text-[12px] uppercase tracking-[0.1em] font-bold text-white/50 mb-8">
            <Link
              to="/app/clientes"
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Clientes
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="truncate text-gold">{display}</span>
          </nav>

          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-5">
              <motion.div
                layoutId={`avatar-${client.id}`}
                className="relative flex size-24 shrink-0 items-center justify-center rounded-md bg-lavender font-serif text-3xl font-bold text-white shadow-lg overflow-hidden group cursor-pointer"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}

                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                  <Camera className="size-5 text-white mb-1" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender-mid">
                  Dossiê Clínico
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="font-serif text-4xl font-bold text-white md:text-5xl">
                    {display}
                  </h1>
                  <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(true)}
                      className="text-white hover:bg-white/10"
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleArchive.mutate()}
                      className="text-white hover:bg-white/10"
                      title={client.status === "active" ? "Arquivar" : "Reativar"}
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
                      className="text-red-300 hover:bg-red-500/20 hover:text-red-200"
                      onClick={() => setDeleting(true)}
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] font-medium text-white/70">
                  {age !== null && <span className="text-white">{age} anos</span>}
                  {client.birth_date && <span>· {formatBirthDate(client.birth_date)}</span>}
                  {client.birthplace && <span>· {client.birthplace}</span>}
                  {client.status === "archived" && (
                    <Badge
                      variant="secondary"
                      className="ml-1 bg-white/10 text-white hover:bg-white/20"
                    >
                      Arquivado
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </header>
        </div>
      </div>

      <div className="container-liz -mt-6 relative z-20">
        <Tabs defaultValue="genogram" className="w-full">
          <TabsList className="w-full justify-start h-auto p-1.5 bg-white shadow-sm rounded-full overflow-x-auto flex-nowrap gap-1">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              <FileText className="size-4" /> Visão geral
            </TabsTrigger>
            <TabsTrigger
              value="genogram"
              className="flex items-center gap-2 py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              <TreePine className="size-4" /> Genossociograma
            </TabsTrigger>
            <TabsTrigger
              value="timeline"
              className="flex items-center gap-2 py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              <History className="size-4" /> Linha do tempo
            </TabsTrigger>
            <TabsTrigger
              value="patterns"
              className="flex items-center gap-2 py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              <Activity className="size-4" /> Padrões
            </TabsTrigger>
            <TabsTrigger
              value="intake"
              className="py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              Anamnese
            </TabsTrigger>
            <TabsTrigger
              value="sessions"
              className="py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              Sessões
            </TabsTrigger>
            <TabsTrigger
              value="clan"
              className="py-2 px-5 rounded-full text-muted-foreground font-medium data-[state=active]:bg-plum/10 data-[state=active]:text-plum data-[state=active]:font-bold transition-all"
            >
              Planilha
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="overview">
              <div className="grid gap-6 xl:grid-cols-3">
                <section className="xl:col-span-2 space-y-6">
                  <Panel title="Queixa apresentada" accent="lavender">
                    {client.presenting_complaint ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80 font-serif">
                        {client.presenting_complaint}
                      </p>
                    ) : (
                      <EmptyLine>Sem queixa registrada ainda.</EmptyLine>
                    )}
                  </Panel>
                  <Panel title="Notas clínicas" accent="gold">
                    {client.clinical_notes ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80 font-serif">
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
                  <Panel title="Identificação">
                    <InfoRow label="Nome completo" value={client.full_name} />
                    <InfoRow label="Gênero" value={genderLabel} />
                    <InfoRow label="Nascimento" value={client.birthplace ?? "—"} />
                    <InfoRow label="Telefone" value={client.phone ?? "—"} />
                    <InfoRow label="E-mail" value={client.email ?? "—"} />
                  </Panel>
                  <Panel
                    title="Consentimento LGPD"
                    icon={
                      client.consent_given_at ? (
                        <ShieldCheck className="size-4 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="size-4 text-amber-600" />
                      )
                    }
                  >
                    {client.consent_given_at ? (
                      <>
                        <p className="text-[13px] text-foreground font-medium">
                          Consentimento registrado em{" "}
                          <strong className="text-emerald-700">
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
                      <p className="text-[13px] font-bold text-amber-700">
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
      <Button asChild className="mt-8" variant="lavender">
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
  accent?: "lavender" | "gold" | "plum";
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "lavender"
      ? "accent-bar-lavender"
      : accent === "gold"
        ? "accent-bar-gold"
        : accent === "plum"
          ? "accent-bar-plum"
          : "";

  return (
    <section className={`rounded-[1rem] glass-card p-6 ${accentClass}`}>
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
