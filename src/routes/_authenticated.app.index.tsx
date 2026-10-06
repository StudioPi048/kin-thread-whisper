import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Users,
  Sparkles,
  ClipboardCheck,
  CalendarClock,
  BookOpen,
  Network,
  ArrowUpRight,
} from "lucide-react";
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
  const {
    data: todaySessions = [],
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useQuery({
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

  const recent = clients
    .slice()
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return (
    <div className="gv-desk container-liz">
      <header className="gv-desk-heading">
        <div>
          <p className="gv-category">Seu espaço de acompanhamento</p>
          <h1>
            {greetingByHour()}, {firstName}.
          </h1>
        </div>
        <span className="gv-today">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </header>
      <section className="gv-desk-lead">
        <div>
          <h2>
            Cada encontro abre
            <br />
            um novo capítulo.
          </h2>
          <p>{subtitle}</p>
          <div className="gv-desk-actions">
            <Link to="/app/clientes" className="gv-button gv-button-gold">
              Retomar um acompanhamento <ArrowRight size={16} />
            </Link>
            <Link to="/app/agenda">
              Minha agenda <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <img src="/assets/genealiz/archive-hero.jpg" alt="Arquivo familiar ilustrativo" />
        <div className="gv-desk-numbers">
          <span>
            <strong>{clients.length}</strong> clientes ativos
          </span>
          <span>
            <strong>{todaySessions.length}</strong> sessões hoje
          </span>
        </div>
      </section>
      <div className="gv-desk-columns">
        <section className="gv-work-section">
          <div className="gv-section-heading">
            <h2>Continue de onde parou</h2>
            <Link to="/app/clientes">
              Todos os clientes <ArrowUpRight size={16} />
            </Link>
          </div>
          {isLoading && <div className="skeleton h-32" />}
          {recent.slice(0, 4).map((c, i) => (
            <div className="gv-client-row" key={c.id}>
              <span className="gv-client-initial">
                {(c.preferred_name || c.full_name).slice(0, 1)}
              </span>
              <div>
                <Link to="/app/clientes/$clientId" params={{ clientId: c.id }}>
                  <strong>{c.preferred_name || c.full_name}</strong>
                </Link>
                <small>
                  {c.updated_at
                    ? `Atualizado em ${new Date(c.updated_at).toLocaleDateString("pt-BR")}`
                    : "História familiar"}
                </small>
              </div>
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId: c.id }}
                search={{ tab: "genogram" }}
                className="gv-case-link"
                aria-label={`Abrir mapa de ${c.preferred_name || c.full_name}`}
              >
                <Network size={17} />
                <span>Abrir mapa</span>
                <ArrowUpRight size={15} />
              </Link>
            </div>
          ))}
          {!clients.length && !isLoading && (
            <div className="gv-empty-start">
              <h3>Sua primeira história começa aqui.</h3>
              <p>Cadastre um cliente para reunir família, acontecimentos e atendimentos.</p>
              <Link to="/app/clientes" className="gv-button">
                Cadastrar cliente <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
        <section className="gv-day">
          <div className="gv-section-heading">
            <h2>Hoje, na agenda</h2>
            <CalendarClock size={20} />
          </div>
          {sessionsLoading ? (
            <p role="status">Carregando agenda…</p>
          ) : sessionsError ? (
            <p role="alert">Não foi possível carregar a agenda. Tente abrir a agenda completa.</p>
          ) : todaySessions.length ? (
            todaySessions.map((s) => (
              <Link
                key={s.id}
                className="gv-appointment"
                to="/app/clientes/$clientId"
                params={{ clientId: s.client_id }}
                search={{ tab: "sessions" }}
              >
                <time>
                  {new Date(s.session_date).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <div>
                  <strong>{clientName(s.client_id)}</strong>
                  <small>{s.title || "Atendimento"}</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))
          ) : (
            <div className="gv-day-empty">
              <CalendarClock size={30} />
              <h3>Um intervalo para preparar.</h3>
              <p>
                Sem sessões marcadas para hoje. Aproveite para revisar um dossiê ou planejar os
                próximos encontros.
              </p>
            </div>
          )}
          <Link to="/app/agenda" className="gv-inline-link">
            Ver agenda completa <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="gv-discover">
        <Link to="/app/biblioteca" className="gv-discover-image">
          <img
            src="/assets/genealiz/archive-library.jpg"
            alt="Acervo de estudo ilustrativo"
            loading="lazy"
          />
          <div>
            <BookOpen size={22} />
            <h2>
              Um acervo para
              <br />
              aprofundar a escuta.
            </h2>
            <span>
              Explorar a biblioteca <ArrowUpRight size={18} />
            </span>
          </div>
        </Link>
        <div className="gv-desk-notes">
          <h2>Antes do próximo encontro</h2>
          <Link to="/app/clientes">
            <ClipboardCheck size={20} />
            <div>
              <strong>
                {pendingConsent.length
                  ? `${pendingConsent.length} ${pendingConsent.length === 1 ? "consentimento" : "consentimentos"} para conferir`
                  : "Consentimentos em dia"}
              </strong>
              <p>
                {pendingConsent.length
                  ? "Revise o registro no dossiê de cada cliente."
                  : "Nenhum consentimento pendente nos registros disponíveis."}
              </p>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          <Link to="/app/guia">
            <Network size={20} />
            <div>
              <strong>Construa a história por etapas</strong>
              <p>Consulte o guia de pessoas, uniões e gerações.</p>
            </div>
            <ArrowUpRight size={17} />
          </Link>
          {openPatterns.length > 0 && (
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId: openPatterns[0].client_id }}
              search={{ tab: "patterns" }}
            >
              <Sparkles size={20} />
              <div>
                <strong>{openPatterns.length} registros para revisar</strong>
                <p>Retomar revisão · {clientName(openPatterns[0].client_id)}</p>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
