import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import {
  GenealogyDivider,
  QuoteConnector,
  GENEALOGY_QUOTES,
} from "@/components/ui/narrative-connector";

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
  const { data: clients = [] } = useQuery({
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
  const { data: todaySessions = [] } = useQuery({
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
  const { data: openPatterns = [] } = useQuery({
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
    <div className="relative min-h-screen overflow-hidden bg-transparent pb-20 font-serif text-ink selection:bg-gold-soft">
      {/* Selo de cera — assinatura da mesa clínica (arte real "arquivo vivo") */}
      <img
        src="/assets/objects/wax_seal_tree.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute top-4 right-6 hidden w-[168px] rotate-[-7deg] mix-blend-darken lg:block xl:right-20"
      />

      {/* Herbário do arquivo — botânicas prensadas, quase invisíveis, no rodapé */}
      <img
        src="/assets/photos/section2_botanicals.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 hidden w-[420px] opacity-[0.07] mix-blend-multiply [mask-image:linear-gradient(to_top_right,black_30%,transparent_75%)] lg:block"
      />

      {/* Header Contextual (Mesa Clínica) */}
      <DocumentHeader
        breadcrumb="Mesa Clínica"
        title={`${greetingByHour()}, ${firstName}.`}
        subtitle={subtitle}
      />

      <main className="container-liz max-w-4xl space-y-16 py-12">
        {/* Resumo do arquivo — linha editorial, sem cards de KPI */}
        <p className="font-sans text-[13px] tracking-[0.01em] text-ink/50">
          <span className="font-serif text-lg font-bold text-ink/80">{clients.length}</span>{" "}
          {clients.length === 1 ? "cliente ativo" : "clientes ativos"}
          <span aria-hidden className="mx-3 text-ink/25">
            ·
          </span>
          <span className="font-serif text-lg font-bold text-ink/80">{openPatterns.length}</span>{" "}
          {openPatterns.length === 1 ? "padrão em aberto" : "padrões em aberto"}
          <span aria-hidden className="mx-3 text-ink/25">
            ·
          </span>
          <span className="font-serif text-lg font-bold text-ink/80">{pendingConsent.length}</span>{" "}
          {pendingConsent.length === 1 ? "consentimento pendente" : "consentimentos pendentes"}
        </p>

        {/* Fio editorial — citação real do campo */}
        <QuoteConnector quote={GENEALOGY_QUOTES[0]} />

        {/* Prioridade Clínica — sessões de hoje */}
        <section>
          <h2 className="mb-6 font-sans text-[11px] font-bold tracking-widest text-warm-gray uppercase">
            Prioridade Clínica
          </h2>
          {hasPriorities ? (
            <ul className="m-0 list-none p-0">
              {todaySessions.map((s) => (
                <li key={s.id} className="border-b border-ink/10 py-4">
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: s.client_id }}
                    className="group flex items-baseline justify-between gap-4 no-underline"
                  >
                    <span className="font-serif text-xl text-ink transition-colors group-hover:text-forest-soft md:text-2xl">
                      {clientName(s.client_id)}
                      {s.title && <span className="text-ink/45 italic"> — {s.title}</span>}
                    </span>
                    <span className="shrink-0 font-sans text-[13px] font-semibold text-ink/50 tabular-nums">
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
            <div className="border-b border-ink/10 py-4">
              <p className="m-0 font-serif text-xl text-ink/55 italic md:text-2xl">
                Nenhuma prioridade clínica urgente registrada para hoje.
              </p>
            </div>
          )}
          <div className="mt-8">
            <Link to="/app/clientes">
              <Button
                variant="ghost"
                className="group px-0 font-sans font-medium text-forest hover:bg-forest/5"
              >
                Acessar arquivo de clientes
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Segundo Cérebro & Hipóteses — padrões não reconhecidos */}
        <section>
          <h2 className="mb-6 font-sans text-[11px] font-bold tracking-widest text-warm-gray uppercase">
            Segundo Cérebro &amp; Hipóteses
          </h2>
          {openPatterns.length > 0 ? (
            <ul className="m-0 list-none space-y-4 p-0">
              {openPatterns.map((p) => (
                <li
                  key={p.id}
                  className={`bg-surface-manuscript py-4 pr-4 pl-5 ${
                    p.severity === "high" || p.severity === "alta"
                      ? "border-l-[3px] border-l-material-terracotta"
                      : "border-l-[3px] border-l-material-olive"
                  }`}
                >
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: p.client_id }}
                    className="group block no-underline"
                  >
                    <p className="m-0 font-serif text-lg text-ink italic transition-colors group-hover:text-forest-soft">
                      {p.title}
                    </p>
                    <p className="mt-1 mb-0 font-sans text-[13px] text-ink/55">
                      {clientName(p.client_id)}
                      {p.description ? ` — ${p.description}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-b border-ink/10 py-4">
              <p className="m-0 font-serif text-lg text-ink/60 italic">
                Nenhuma hipótese transgeracional em fase de investigação no momento.
              </p>
            </div>
          )}
        </section>

        {/* Pendências Clínicas — consentimentos em aberto */}
        <section>
          <h2 className="mb-6 font-sans text-[11px] font-bold tracking-widest text-warm-gray uppercase">
            Pendências Clínicas
          </h2>
          {hasPendencies ? (
            <ul className="m-0 list-none p-0">
              {pendingConsent.slice(0, 4).map((c) => (
                <li key={c.id} className="border-b border-ink/10 py-4">
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: c.id }}
                    className="group flex items-center justify-between gap-4 no-underline"
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
              {pendingConsent.length > 4 && (
                <li className="py-3">
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
            <div className="border-b border-ink/10 py-4">
              <p className="m-0 font-serif text-lg text-ink/60 italic">
                Seus prontuários e anotações estão em dia.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Fechamento editorial */}
      <div className="container-liz pt-16 pb-8">
        <GenealogyDivider opacity={0.2} />
      </div>
    </div>
  );
}
