import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ScrollText,
  Users,
  Sparkles,
  ClipboardCheck,
  CalendarClock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";
import { GENEALOGY_QUOTES } from "@/components/ui/narrative-connector";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function AppHome() {
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // Clientes ativos — base para contagem, pendências de consentimento e nomes
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["mesa-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, consent_given_at, updated_at")
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sessões de hoje
  const { data: todaySessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["mesa-sessions-today"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("clinical_sessions")
        .select("id, client_id, session_date, title, status")
        .gte("session_date", start.toISOString())
        .lt("session_date", end.toISOString())
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Padrões transgeracionais ainda não reconhecidos (Segundo Cérebro)
  const { data: openPatterns = [], isLoading: patternsLoading } = useQuery({
    queryKey: ["mesa-open-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patterns_detected")
        .select("id, client_id, title, description, severity, pattern_type, created_at")
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = clientsLoading || sessionsLoading || patternsLoading;

  const firstName =
    profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisadora";

  const clientName = (id: string) => {
    const c = clients.find((c) => c.id === id);
    return c ? c.preferred_name || c.full_name : "Cliente";
  };

  const pendingConsent = clients.filter((c) => !c.consent_given_at);
  const hasPriorities = todaySessions.length > 0;
  const hasPendencies = pendingConsent.length > 0;

  const subtitle = hasPriorities
    ? `Você tem ${todaySessions.length} ${todaySessions.length === 1 ? "sessão marcada" : "sessões marcadas"} para hoje.`
    : "Sua mesa clínica está limpa e organizada para o dia de hoje.";

  return (
    <div className="min-h-screen bg-transparent pb-16 text-ink">
      {/* Header Contextual (Mesa Clínica) */}
      <DocumentHeader
        breadcrumb="Mesa Clínica"
        title={`${greetingByHour()}, ${firstName}.`}
        subtitle={subtitle}
      />

      <main className="container-liz space-y-6 py-2">
        {/* Linha de indicadores — cards brancos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                icon={Users}
                value={clients.length}
                label={clients.length === 1 ? "Cliente ativo" : "Clientes ativos"}
                to="/app/clientes"
              />
              <StatCard
                icon={Sparkles}
                value={openPatterns.length}
                label={openPatterns.length === 1 ? "Padrão em aberto" : "Padrões em aberto"}
                accent={openPatterns.length > 0 ? "olive" : "muted"}
              />
              <StatCard
                icon={ClipboardCheck}
                value={pendingConsent.length}
                label={
                  pendingConsent.length === 1
                    ? "Consentimento pendente"
                    : "Consentimentos pendentes"
                }
                accent={pendingConsent.length > 0 ? "critical" : "positive"}
                to="/app/clientes"
              />
            </>
          )}
        </div>

        {/* Corpo — duas colunas que ocupam a largura */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna principal */}
          <div className="space-y-6 lg:col-span-2">
            <Panel
              icon={CalendarClock}
              title="Prioridade Clínica"
              action={
                <Link
                  to="/app/clientes"
                  className="inline-flex items-center gap-1 font-sans text-[12px] font-semibold text-forest no-underline hover:underline"
                >
                  Arquivo de clientes
                  <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              {isLoading ? (
                <PanelSkeleton rows={2} />
              ) : hasPriorities ? (
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {todaySessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: s.client_id }}
                        className="group flex items-baseline justify-between gap-4 py-3 no-underline first:pt-0"
                      >
                        <span className="font-serif text-lg text-ink transition-colors group-hover:text-forest-soft">
                          {clientName(s.client_id)}
                          {s.title && <span className="text-ink-soft italic"> — {s.title}</span>}
                        </span>
                        <span className="shrink-0 font-sans text-[13px] font-semibold text-warm-gray tabular-nums">
                          {new Date(s.session_date).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>Nenhuma sessão registrada para hoje.</EmptyLine>
              )}
            </Panel>

            <Panel icon={ScrollText} title="Pendências Clínicas">
              {isLoading ? (
                <PanelSkeleton rows={3} />
              ) : hasPendencies ? (
                <ul className="m-0 list-none divide-y divide-border p-0">
                  {pendingConsent.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: c.id }}
                        className="group flex items-center justify-between gap-4 py-3 no-underline first:pt-0"
                      >
                        <span className="font-serif text-lg text-ink transition-colors group-hover:text-forest-soft">
                          {c.preferred_name || c.full_name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-sans text-[12px] font-semibold text-clinical-critical">
                          <ScrollText className="size-3.5" aria-hidden />
                          Consentimento pendente
                        </span>
                      </Link>
                    </li>
                  ))}
                  {pendingConsent.length > 5 && (
                    <li className="pt-3">
                      <Link
                        to="/app/clientes"
                        className="font-sans text-[13px] font-medium text-forest no-underline hover:underline"
                      >
                        Ver todos os {pendingConsent.length} consentimentos pendentes
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <EmptyLine>Seus prontuários e anotações estão em dia.</EmptyLine>
              )}
            </Panel>
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            <Panel icon={Sparkles} title="Segundo Cérebro & Hipóteses">
              {isLoading ? (
                <PanelSkeleton rows={2} />
              ) : openPatterns.length > 0 ? (
                <ul className="m-0 list-none space-y-3 p-0">
                  {openPatterns.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: p.client_id }}
                        className={`group block rounded-lg border-l-[3px] bg-surface-manuscript py-3 pr-3 pl-4 no-underline ${
                          p.severity === "high" || p.severity === "alta"
                            ? "border-l-clinical-critical"
                            : "border-l-material-olive"
                        }`}
                      >
                        <p className="m-0 font-serif text-[15px] text-ink italic transition-colors group-hover:text-forest-soft">
                          {p.title}
                        </p>
                        <p className="mt-1 mb-0 font-sans text-[12px] text-warm-gray">
                          {clientName(p.client_id)}
                          {p.description ? ` — ${p.description}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>Nenhuma hipótese em investigação no momento.</EmptyLine>
              )}
            </Panel>

            {/* Citação editorial — acento de marca */}
            <figure className="m-0 rounded-2xl border border-border bg-forest px-6 py-7 text-cream shadow-surface">
              <blockquote className="m-0 font-serif text-lg leading-relaxed text-cream italic">
                "{GENEALOGY_QUOTES[0].text}"
              </blockquote>
              <figcaption className="mt-3 font-sans text-[10px] font-bold tracking-[0.16em] text-gold uppercase">
                {GENEALOGY_QUOTES[0].author}
              </figcaption>
            </figure>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Componentes locais ─────────────────────────────────────── */

function StatCard({
  icon: Icon,
  value,
  label,
  accent = "muted",
  to,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  accent?: "muted" | "olive" | "critical" | "positive";
  to?: "/app/clientes";
}) {
  const dot = {
    muted: "text-warm-gray",
    olive: "text-material-olive",
    critical: "text-clinical-critical",
    positive: "text-clinical-positive",
  }[accent];

  const inner = (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-document px-5 py-4 shadow-surface transition-shadow hover:shadow-dossier">
      <div>
        <p className="m-0 font-serif text-3xl font-bold text-ink tabular-nums">{value}</p>
        <p className="mt-0.5 font-sans text-[12px] font-medium text-warm-gray">{label}</p>
      </div>
      <Icon className={`size-6 shrink-0 ${dot}`} strokeWidth={1.5} />
    </div>
  );

  return to ? (
    <Link to={to} className="no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-document px-5 py-4 shadow-surface">
      <div className="space-y-2">
        <div className="skeleton h-8 w-10" />
        <div className="skeleton h-3 w-24" />
      </div>
      <div className="skeleton size-6 rounded-full" />
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Users;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-document p-6 shadow-surface">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="flex items-center gap-2 font-sans text-[11px] font-bold tracking-[0.14em] text-warm-gray uppercase">
          <Icon className="size-3.5 text-material-bronze" strokeWidth={1.75} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="m-0 py-1 font-serif text-[15px] text-warm-gray italic">{children}</p>;
}
