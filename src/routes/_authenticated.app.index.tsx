import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users, Sparkles, ClipboardCheck, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentHeader } from "@/components/ui/document-header";

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

  // Padrões transgeracionais ainda não reconhecidos (IA clínica)
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

  const subtitle = hasPriorities
    ? `Você tem ${todaySessions.length} ${todaySessions.length === 1 ? "sessão marcada" : "sessões marcadas"} para hoje.`
    : "Clientes, atendimentos e histórias familiares em um só lugar.";

  return (
    <div className="pb-12">
      <DocumentHeader
        breadcrumb="Mesa de trabalho"
        title={`${greetingByHour()}, ${firstName}.`}
        subtitle={subtitle}
        actions={
          <Link to="/app/agenda" className="cta-gold">
            Abrir agenda <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="container-liz">
        <div className="atlas-facts">
          <span>
            <strong>{clients.length}</strong> clientes ativos
          </span>
          <span>
            <strong>{todaySessions.length}</strong> sessões hoje
          </span>
          <span>
            <strong>{pendingConsent.length}</strong> consentimentos pendentes
          </span>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <section className="atlas-section">
            <div className="atlas-section-title">
              <h2>Seu dia de atendimento</h2>
              <CalendarClock size={21} className="text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="skeleton h-40" />
            ) : todaySessions.length ? (
              todaySessions.map((s) => (
                <Link
                  className="atlas-row"
                  key={s.id}
                  to="/app/clientes/$clientId"
                  params={{ clientId: s.client_id }}
                  search={{ tab: "sessions" }}
                >
                  <time className="w-14 shrink-0 font-medium tabular-nums">
                    {new Date(s.session_date).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <div className="flex-1">
                    <span>{clientName(s.client_id)}</span>
                    <small>{s.title || "Atendimento"}</small>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))
            ) : (
              <div className="py-12">
                <p className="font-serif text-2xl">Nenhuma sessão marcada para hoje.</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Consulte a agenda ou abra um dossiê para continuar o acompanhamento.
                </p>
              </div>
            )}
          </section>
          <section className="atlas-section">
            <div className="atlas-section-title">
              <h2>Retomar um dossiê</h2>
              <Users size={21} className="text-muted-foreground" />
            </div>
            {clients
              .slice()
              .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
              .slice(0, 5)
              .map((c) => (
                <Link
                  key={c.id}
                  className="atlas-row"
                  to="/app/clientes/$clientId"
                  params={{ clientId: c.id }}
                >
                  <span className="atlas-avatar">
                    {(c.preferred_name || c.full_name).slice(0, 1)}
                  </span>
                  <div className="flex-1">
                    {c.preferred_name || c.full_name}
                    <small>Abrir história familiar</small>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            {!clients.length && !isLoading && (
              <p className="py-8 text-sm text-muted-foreground">
                Cadastre seu primeiro cliente para reunir sua história e seus atendimentos.
              </p>
            )}
            <Link
              to="/app/clientes"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium"
            >
              Ver todos os clientes <ArrowRight size={15} />
            </Link>
          </section>
          <section className="atlas-section">
            <div className="atlas-section-title">
              <h2>Consentimentos</h2>
              <ClipboardCheck size={21} className="text-muted-foreground" />
            </div>
            {pendingConsent.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                className="atlas-row"
                to="/app/clientes/$clientId"
                params={{ clientId: c.id }}
              >
                <div className="flex-1">
                  {c.preferred_name || c.full_name}
                  <small>Consentimento ainda não registrado</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))}
            {!pendingConsent.length && (
              <p className="text-sm text-muted-foreground">
                Nenhum consentimento pendente entre os clientes cadastrados.
              </p>
            )}
          </section>
          <section className="atlas-section">
            <div className="atlas-section-title">
              <h2>Padrões para revisar</h2>
              <Sparkles size={21} className="text-muted-foreground" />
            </div>
            {openPatterns.map((p) => (
              <Link
                key={p.id}
                className="atlas-row"
                to="/app/clientes/$clientId"
                params={{ clientId: p.client_id }}
                search={{ tab: "patterns" }}
              >
                <div>
                  <span>{p.title}</span>
                  <small>{clientName(p.client_id)}</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))}
            {!openPatterns.length && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nenhum padrão em aberto foi encontrado nos registros disponíveis.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
