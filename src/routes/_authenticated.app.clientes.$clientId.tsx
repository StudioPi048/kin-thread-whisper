import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Library,
  Mic,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { ClientTimeline } from "@/components/clients/client-timeline";
import { PatternsPanel } from "@/components/clients/patterns-panel";
import { GenogramCanvas } from "@/components/genogram/genogram-canvas";
import { IntakeForm } from "@/components/intake/intake-form";
import { calcAge, formatBirthDate, genderOptions, initialsFrom } from "@/lib/clients";

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

  return (
    <div className="container-liz py-8 md:py-12">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/app/clientes" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-3.5" /> Clientes
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-foreground">{display}</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-lilac-soft font-serif text-2xl text-primary">
            {initialsFrom(client.full_name)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-gold">Dossiê clínico</p>
            <h1 className="mt-2 font-serif text-4xl text-primary md:text-5xl">{display}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {age !== null && <span>{age} anos</span>}
              {client.birth_date && <span>· {formatBirthDate(client.birth_date)}</span>}
              {client.birthplace && <span>· {client.birthplace}</span>}
              {client.status === "archived" && (
                <Badge variant="secondary" className="ml-1">Arquivado</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Editar
          </Button>
          <Button variant="outline" onClick={() => toggleArchive.mutate()}>
            {client.status === "active" ? (
              <>
                <Archive className="size-4" /> Arquivar
              </>
            ) : (
              <>
                <ArchiveRestore className="size-4" /> Reativar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview" className="mt-10">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="intake">Anamnese</TabsTrigger>
          <TabsTrigger value="genogram">Genossociograma</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="patterns">Padrões</TabsTrigger>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
          <TabsTrigger value="library">Referências</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 space-y-6">
              <Panel title="Queixa apresentada">
                {client.presenting_complaint ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {client.presenting_complaint}
                  </p>
                ) : (
                  <EmptyLine>Sem queixa registrada ainda.</EmptyLine>
                )}
              </Panel>
              <Panel title="Notas clínicas">
                {client.clinical_notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {client.clinical_notes}
                  </p>
                ) : (
                  <EmptyLine>Sem notas ainda. Você pode ditar por voz em breve.</EmptyLine>
                )}
              </Panel>
              {client.tags && client.tags.length > 0 && (
                <Panel title="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {client.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Panel>
              )}
            </section>

            <aside className="space-y-6">
              <Panel title="Identificação">
                <InfoRow label="Nome completo" value={client.full_name} />
                <InfoRow label="Gênero" value={genderLabel} />
                <InfoRow label="Local de nascimento" value={client.birthplace ?? "—"} />
                <InfoRow label="Telefone" value={client.phone ?? "—"} />
                <InfoRow label="E-mail" value={client.email ?? "—"} />
              </Panel>
              <Panel
                title="Consentimento LGPD"
                icon={
                  client.consent_given_at ? (
                    <ShieldCheck className="size-4 text-emerald-700" />
                  ) : (
                    <ShieldAlert className="size-4 text-amber-700" />
                  )
                }
              >
                {client.consent_given_at ? (
                  <>
                    <p className="text-sm text-foreground">
                      Consentimento registrado em{" "}
                      <strong>
                        {new Date(client.consent_given_at).toLocaleDateString("pt-BR")}
                      </strong>
                      .
                    </p>
                    {client.consent_notes && (
                      <p className="mt-2 text-xs text-muted-foreground">{client.consent_notes}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-amber-800">
                    Sem consentimento registrado. Registre antes de anotar dados sensíveis.
                  </p>
                )}
              </Panel>
              <Panel title="Metadados">
                <InfoRow
                  label="Criado em"
                  value={new Date(client.created_at).toLocaleString("pt-BR")}
                />
                <InfoRow
                  label="Atualizado em"
                  value={new Date(client.updated_at).toLocaleString("pt-BR")}
                />
              </Panel>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="intake" className="mt-8">
          <IntakeForm clientId={client.id} professionalId={user.id} />
        </TabsContent>

        <TabsContent value="genogram" className="mt-8">
          <GenogramCanvas clientId={client.id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-8">
          <ClientTimeline clientId={client.id} />
        </TabsContent>

        <TabsContent value="patterns" className="mt-8">
          <PatternsPanel clientId={client.id} />
        </TabsContent>




        <TabsContent value="sessions" className="mt-8">
          <ComingSoon
            icon={Mic}
            title="Sessões & prontuário por voz"
            body="Etapa 5: grave o áudio ao final da sessão. A plataforma transcreve, estrutura em SOAP e associa ao cliente."
          />
        </TabsContent>

        <TabsContent value="library" className="mt-8">
          <ComingSoon
            icon={Library}
            title="Referências ligadas ao caso"
            body="Etapa 6: capítulos de Schützenberger, Jodorowsky e Hellinger relacionados automaticamente ao dossiê."
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}

function ClientNotFound() {
  return (
    <div className="container-liz py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Instituto Liz</p>
      <h1 className="mt-4 font-serif text-4xl text-primary">Dossiê não encontrado</h1>
      <p className="mt-3 text-muted-foreground">
        Este cliente não existe ou foi removido.
      </p>
      <Button asChild className="mt-8">
        <Link to="/app/clientes">Voltar para clientes</Link>
      </Button>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-[10px] font-medium uppercase tracking-[0.28em] text-gold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border/70 py-2 text-sm first:border-0 first:pt-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-foreground">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-muted-foreground">{children}</p>;
}

function ComingSoon({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 p-16 text-center">
      <Icon className="mx-auto size-8 text-lilac" />
      <p className="mt-4 font-serif text-2xl text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
