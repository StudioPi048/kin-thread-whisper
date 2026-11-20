import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, BookOpen, Check, X, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getPendingRecordCount } from "@/lib/agenda.functions";
import { activeAudioConsent, readAudioConsents } from "@/lib/audio-consent";
import { profileQuery } from "@/lib/profile";
import {
  appointmentDurationMin,
  browserTz,
  dateKeyInTz,
  formatDurationMinutes,
  timeInTz,
} from "@/lib/scheduling";
import {
  readVisits,
  readPref,
  writePref,
  onboardingSteps,
  type Visit,
} from "@/lib/recent-activity";
import "@/components/archive/work-desk.css";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Mesa de trabalho — GENEALIZ" },
      { name: "description", content: "Próximos atendimentos, pendências e casos retomados." },
      { property: "og:title", content: "Mesa de trabalho — GENEALIZ" },
      {
        property: "og:description",
        content: "Próximos atendimentos, pendências e casos retomados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppHome,
});

const TAB_LABEL: Record<string, string> = {
  overview: "Visão geral",
  genogram: "Genossociograma",
  clan: "Planilha do clã",
  timeline: "Linha do tempo",
  patterns: "Evidências",
  intake: "Anamnese",
  sessions: "Sessões",
};

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ErrorRow({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div role="alert" className="work-desk-error">
      {msg}
      <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden /> Tentar de novo
      </Button>
    </div>
  );
}

function AppHome() {
  const { user } = Route.useRouteContext();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [onbHidden, setOnbHidden] = useState(true);
  useEffect(() => {
    setVisits(readVisits(user.id));
    setOnbHidden(readPref(user.id, "onboarding", { hidden: false }).hidden);
  }, [user.id]);

  const profileQ = useQuery(profileQuery(user.id));

  const clientsQ = useQuery({
    queryKey: ["mesa-clients", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, consent_given_at")
        .eq("professional_id", user.id)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upcomingQ = useQuery({
    queryKey: ["mesa-sessions-upcoming", user.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const upcoming = () =>
        supabase
          .from("clinical_sessions")
          .select(
            "id, client_id, session_date, title, status, duration_seconds, planned_duration_minutes, clients(full_name, preferred_name)",
          )
          .eq("user_id", user.id)
          .gte("session_date", now)
          .order("session_date")
          .order("id")
          .limit(6);
      const [scheduled, legacy] = await Promise.all([
        upcoming().eq("clinical_status", "scheduled"),
        upcoming().is("clinical_status", null),
      ]);
      const error = scheduled.error ?? legacy.error;
      if (error) throw error;
      return [...(scheduled.data ?? []), ...(legacy.data ?? [])]
        .sort(
          (a, b) =>
            Date.parse(a.session_date) - Date.parse(b.session_date) || a.id.localeCompare(b.id),
        )
        .slice(0, 6);
    },
  });

  const pendingRecordsQ = useQuery({
    queryKey: ["mesa-pending-records", user.id],
    queryFn: async () => {
      const [count, records] = await Promise.all([
        getPendingRecordCount(),
        supabase.rpc("mesa_pending_clinical_records", {}),
      ]);
      if (records.error) throw records.error;
      return { count, records: records.data ?? [] };
    },
  });

  const onbQ = useQuery({
    queryKey: ["mesa-onboarding-counts"],
    enabled: !onbHidden,
    queryFn: async () => {
      const c = (
        t: "clients" | "genogram_persons" | "genogram_relationships" | "clinical_sessions",
      ) => supabase.from(t).select("id", { count: "exact", head: true });
      const [a, b, r, s] = await Promise.all([
        c("clients"),
        c("genogram_persons"),
        c("genogram_relationships"),
        c("clinical_sessions"),
      ]);
      for (const x of [a, b, r, s]) if (x.error) throw x.error;
      return onboardingSteps({
        clients: a.count ?? 0,
        persons: b.count ?? 0,
        relationships: r.count ?? 0,
        sessions: s.count ?? 0,
      });
    },
  });

  const clients = clientsQ.data ?? [];
  const nameOf = (id: string) => {
    const c = clients.find((x) => x.id === id);
    return c ? c.preferred_name || c.full_name : "Cliente";
  };
  const firstName = profileQ.data?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";
  const pendingGeneral = clients.filter((c) => !c.consent_given_at);
  const resumable = visits
    .filter(
      (visit) =>
        Number.isFinite(new Date(visit.at).getTime()) &&
        clients.some((client) => client.id === visit.clientId),
    )
    .slice(0, 4);
  const next = upcomingQ.data?.[0];
  const nextDuration = next ? appointmentDurationMin(next) : null;
  const consentQ = useQuery({
    queryKey: ["audio-consent", next?.client_id],
    queryFn: () => readAudioConsents(supabase, next!.client_id),
    enabled: !!next,
    retry: false,
  });
  const nextRecording = next && activeAudioConsent(consentQ.data ?? [], "recording", next.id);
  const nextProcessing =
    next && activeAudioConsent(consentQ.data ?? [], "external_processing", next.id);
  const onb = onbQ.data;
  const showOnb = !onbHidden && onb && onb.done < onb.total;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const today = new Date();
  const tz = browserTz();
  const nextDate = next ? new Date(next.session_date) : null;

  return (
    <div className="container-liz work-desk">
      <header className="work-desk-heading">
        <div>
          <h1>Mesa de trabalho</h1>
          <p>
            {greetingByHour()}
            {firstName ? `, ${firstName}.` : "."}
          </p>
        </div>
        <div className="work-desk-heading-tools">
          <time dateTime={dateKeyInTz(today, tz)}>
            {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </time>
          <Button asChild variant={next ? "outline" : "forest"}>
            <Link to="/app/agenda">
              <CalendarDays aria-hidden /> Abrir agenda
            </Link>
          </Button>
        </div>
      </header>

      <div className="work-desk-columns">
        <section aria-labelledby="next-h" className="work-desk-agenda">
          <div className="work-next" data-empty={(!upcomingQ.isLoading && !next) || undefined}>
            <h2 id="next-h">Próximo atendimento</h2>
            {upcomingQ.isLoading ? (
              <div role="status" className="work-next-loading">
                <p>Carregando agenda…</p>
                <div className="work-skeleton" aria-hidden />
              </div>
            ) : upcomingQ.isError ? (
              <ErrorRow
                msg="Não foi possível carregar a agenda."
                onRetry={() => upcomingQ.refetch()}
              />
            ) : next && nextDate ? (
              <div className="work-next-details">
                <time dateTime={next.session_date}>
                  <strong>{timeInTz(nextDate, tz)}</strong>
                  <span>
                    {nextDate.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </time>
                <div className="work-next-client">
                  <p className="work-next-name">
                    {next.clients?.preferred_name ||
                      next.clients?.full_name ||
                      nameOf(next.client_id)}
                  </p>
                  <p>
                    {next.title || "Atendimento"}
                    {nextDuration !== null && ` · ${formatDurationMinutes(nextDuration)}`}
                  </p>
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: next.client_id }}
                    search={{ tab: "sessions", session: next.id }}
                    className="work-next-link"
                  >
                    Abrir atendimento <ArrowRight size={17} aria-hidden />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="work-next-empty">Nenhum atendimento futuro agendado.</p>
            )}
          </div>

          {(upcomingQ.data?.length ?? 0) > 1 && (
            <div className="work-upcoming">
              <h3>Em seguida</h3>
              <ul className="work-desk-ledger">
                {upcomingQ.data?.slice(1, 4).map((session) => (
                  <li key={session.id}>
                    <Link
                      to="/app/clientes/$clientId"
                      params={{ clientId: session.client_id }}
                      search={{ tab: "sessions", session: session.id }}
                      className="work-desk-row work-desk-appointment"
                    >
                      <time dateTime={session.session_date}>{fmtTime(session.session_date)}</time>
                      <span>
                        {session.clients?.preferred_name ||
                          session.clients?.full_name ||
                          nameOf(session.client_id)}
                      </span>
                      <ArrowRight size={17} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="work-desk-secondary" aria-labelledby="resume-h">
          <section className="work-desk-section">
            <h2 id="resume-h">Retomar dossiê</h2>
            {clientsQ.isLoading ? (
              <div role="status" className="work-desk-muted">
                <span>Carregando casos…</span>
                <div className="work-skeleton" aria-hidden />
              </div>
            ) : clientsQ.isError ? (
              <ErrorRow
                msg="Não foi possível carregar os casos."
                onRetry={() => clientsQ.refetch()}
              />
            ) : resumable.length > 0 ? (
              <ul className="work-desk-ledger">
                {resumable.map((visit) => (
                  <li key={visit.clientId}>
                    <Link
                      to="/app/clientes/$clientId"
                      params={{ clientId: visit.clientId }}
                      search={{
                        tab: (TAB_LABEL[visit.tab] ? visit.tab : "overview") as "overview",
                      }}
                      className="work-desk-row work-desk-resume"
                    >
                      <span>
                        <strong>{nameOf(visit.clientId)}</strong>
                        <span>{TAB_LABEL[visit.tab] ?? "Visão geral"}</span>
                      </span>
                      <time dateTime={dateKeyInTz(new Date(visit.at), tz)}>
                        {new Date(visit.at).toLocaleDateString("pt-BR")}
                      </time>
                      <ArrowRight size={17} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="work-desk-muted">
                {clients.length > 0
                  ? "Os dossiês que você abrir ficam aqui, na aba em que parou."
                  : "Nenhum caso cadastrado."}
              </p>
            )}
            <Link to="/app/clientes" className="work-desk-text-link">
              {!clientsQ.isLoading && !clientsQ.isError && clients.length === 0
                ? "Cadastrar caso"
                : "Todos os clientes"}
              <ArrowRight size={17} aria-hidden />
            </Link>
          </section>
          <Link to="/app/biblioteca" className="work-desk-reference">
            <BookOpen size={19} aria-hidden />
            <span>Consultar biblioteca</span>
            <ArrowRight size={17} aria-hidden />
          </Link>
        </aside>
        <section aria-labelledby="pend-h" className="work-desk-section work-desk-review">
          <h2 id="pend-h">Pendências</h2>
          <div className="work-desk-pending">
            <section aria-labelledby="pending-records">
              <h3 id="pending-records">Registros de sessão</h3>
              {pendingRecordsQ.isError ? (
                <ErrorRow
                  msg="Não foi possível carregar os registros."
                  onRetry={() => pendingRecordsQ.refetch()}
                />
              ) : pendingRecordsQ.isLoading ? (
                <p className="work-desk-muted" role="status">
                  Carregando registros…
                </p>
              ) : pendingRecordsQ.data?.records.length ? (
                <ul className="work-desk-ledger">
                  {pendingRecordsQ.data.records.map((record) => (
                    <li key={record.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: record.client_id }}
                        search={{ tab: "sessions", session: record.id }}
                        className="work-desk-row"
                      >
                        <span>
                          <strong>{nameOf(record.client_id)}</strong>
                          <time dateTime={record.session_date}>{fmtTime(record.session_date)}</time>
                        </span>
                        <ArrowRight size={17} aria-hidden />
                      </Link>
                    </li>
                  ))}
                  {pendingRecordsQ.data.count > pendingRecordsQ.data.records.length && (
                    <li>
                      <Link to="/app/agenda" className="work-desk-text-link">
                        Ver todos os {pendingRecordsQ.data.count} registros{" "}
                        <ArrowRight size={17} aria-hidden />
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="work-desk-muted">Nenhum registro de sessão pendente.</p>
              )}
            </section>
            <section aria-labelledby="pending-consents">
              <h3 id="pending-consents">Consentimentos gerais</h3>
              {clientsQ.isError ? (
                <ErrorRow
                  msg="Não foi possível conferir os consentimentos."
                  onRetry={() => clientsQ.refetch()}
                />
              ) : clientsQ.isLoading ? (
                <p className="work-desk-muted" role="status">
                  Conferindo casos…
                </p>
              ) : pendingGeneral.length ? (
                <ul className="work-desk-ledger">
                  {pendingGeneral.slice(0, 3).map((client) => (
                    <li key={client.id}>
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: client.id }}
                        search={{ tab: "overview" }}
                        className="work-desk-row"
                      >
                        <span>{nameOf(client.id)}</span>
                        <ArrowRight size={17} aria-hidden />
                      </Link>
                    </li>
                  ))}
                  {pendingGeneral.length > 3 && (
                    <li>
                      <Link to="/app/clientes" className="work-desk-text-link">
                        Conferir outros casos <ArrowRight size={17} aria-hidden />
                      </Link>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="work-desk-muted">
                  {clients.length > 0
                    ? "Registrados nos casos ativos."
                    : "Nenhum caso ativo para conferir."}
                </p>
              )}
            </section>
            {next && (
              <section aria-labelledby="pending-audio">
                <h3 id="pending-audio">Áudio do próximo atendimento</h3>
                {consentQ.isError ? (
                  <ErrorRow
                    msg="Autorizações de áudio indisponíveis."
                    onRetry={() => consentQ.refetch()}
                  />
                ) : consentQ.isLoading ? (
                  <p className="work-desk-muted" role="status">
                    Conferindo autorizações…
                  </p>
                ) : (
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: next.client_id }}
                    search={{ tab: "sessions", session: next.id, focus: "audio-consent" }}
                    className="work-desk-row"
                  >
                    <span>
                      <span>
                        Gravação {nextRecording ? "autorizada" : "sem autorização vigente"}
                      </span>
                      <span>
                        Processamento {nextProcessing ? "autorizado" : "sem autorização vigente"}
                      </span>
                    </span>
                    <ArrowRight size={17} aria-hidden />
                  </Link>
                )}
              </section>
            )}
          </div>
        </section>
      </div>

      {showOnb && (
        <section aria-labelledby="onb-h" className="work-desk-onboarding">
          <div className="work-desk-onboarding-head">
            <h2 id="onb-h">Primeiros passos</h2>
            <span>
              {onb.done} de {onb.total} concluídos
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dispensar primeiros passos"
              onClick={() => {
                writePref(user.id, "onboarding", { hidden: true });
                setOnbHidden(true);
              }}
            >
              <X aria-hidden />
            </Button>
          </div>
          <ol>
            {onb.steps.map((step, index) => (
              <li key={step.id}>
                <span className="work-desk-step" data-done={step.done || undefined} aria-hidden>
                  {step.done ? <Check size={16} /> : index + 1}
                </span>
                <span>
                  {step.label}
                  <span className="sr-only">{step.done ? " (concluído)" : " (pendente)"}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link to="/" hash="caso-ficticio" className="work-desk-text-link">
            Praticar no Consultante fictício <ArrowRight size={17} aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}
