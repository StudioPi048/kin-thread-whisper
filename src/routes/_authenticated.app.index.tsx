import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, ClipboardCheck, Check, X, RefreshCw, Network } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { readVisits, readPref, writePref, onboardingSteps, type Visit } from "@/lib/recent-activity";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Mesa de trabalho — GENEALIZ" },
      { name: "description", content: "Próximos atendimentos, pendências e casos retomados." },
      { property: "og:title", content: "Mesa de trabalho — GENEALIZ" },
      { property: "og:description", content: "Próximos atendimentos, pendências e casos retomados." },
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
  patterns: "Padrões",
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
    <div role="alert" className="flex flex-wrap items-center gap-3 text-[15px] text-destructive">
      {msg}
      <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden /> Tentar de novo
      </Button>
    </div>
  );
}

const card = "rounded-xl border border-border bg-card p-4 sm:p-5";
const h2 = "text-[17px] font-semibold text-foreground";

function AppHome() {
  const { user } = Route.useRouteContext();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [onbHidden, setOnbHidden] = useState(true);
  useEffect(() => {
    setVisits(readVisits(user.id));
    setOnbHidden(readPref(user.id, "onboarding", { hidden: false }).hidden);
  }, [user.id]);

  const profileQ = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const clientsQ = useQuery({
    queryKey: ["mesa-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name, consent_given_at")
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upcomingQ = useQuery({
    queryKey: ["mesa-sessions-upcoming"],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const { data, error } = await supabase
        .from("clinical_sessions")
        .select("id, client_id, session_date, title, status, duration_seconds")
        .gte("session_date", start.toISOString())
        .lt("session_date", end.toISOString())
        .order("session_date", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingRecordsQ = useQuery({
    queryKey: ["mesa-pending-records"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clinical_sessions")
        .select("id", { count: "exact", head: true })
        .lt("session_date", new Date().toISOString())
        .neq("status", "completed");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const onbQ = useQuery({
    queryKey: ["mesa-onboarding-counts"],
    enabled: !onbHidden,
    queryFn: async () => {
      const c = (t: "clients" | "genogram_persons" | "genogram_relationships" | "clinical_sessions") =>
        supabase.from(t).select("id", { count: "exact", head: true });
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
  const pendingConsent = clients.filter((c) => !c.consent_given_at).length;
  const resumable = visits.filter((v) => clients.some((c) => c.id === v.clientId)).slice(0, 4);
  const now = Date.now();
  const next = (upcomingQ.data ?? []).find((s) => new Date(s.session_date).getTime() >= now - 30 * 60_000);
  const onb = onbQ.data;
  const showOnb = !onbHidden && onb && onb.done < onb.total;

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="container-liz space-y-5 py-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-[30px] font-semibold leading-tight text-foreground">
          {greetingByHour()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <span className="text-[15px] text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </header>

      {showOnb && (
        <section aria-labelledby="onb-h" className={`${card} space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="onb-h" className={h2}>
              Primeiros passos · {onb.done} de {onb.total}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Dispensar primeiros passos"
              onClick={() => {
                writePref(user.id, "onboarding", { hidden: true });
                setOnbHidden(true);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={onb.done} aria-valuemin={0} aria-valuemax={onb.total} aria-label="Progresso dos primeiros passos">
            <div className="h-full bg-primary" style={{ width: `${(onb.done / onb.total) * 100}%` }} />
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {onb.steps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-[15px]">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[13px] ${s.done ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
                  aria-hidden
                >
                  {s.done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={s.done ? "text-muted-foreground line-through" : "text-foreground"}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (concluído)" : " (pendente)"}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="next-h" className={`${card} space-y-3`}>
          <h2 id="next-h" className={`${h2} flex items-center gap-2`}>
            <CalendarClock className="size-5 text-primary" aria-hidden /> Próximo atendimento
          </h2>
          {upcomingQ.isLoading ? (
            <p role="status" className="text-[15px] text-muted-foreground">Carregando agenda…</p>
          ) : upcomingQ.isError ? (
            <ErrorRow msg="Não foi possível carregar a agenda." onRetry={() => upcomingQ.refetch()} />
          ) : next ? (
            <>
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId: next.client_id }}
                search={{ tab: "sessions" }}
                className="block rounded-lg border border-border p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-[20px] font-semibold tabular-nums">{fmtTime(next.session_date)}</span>
                <span className="block text-[15px] font-medium">{nameOf(next.client_id)}</span>
                <span className="block text-[14px] text-muted-foreground">
                  {next.duration_seconds ? `${Math.round(next.duration_seconds / 60)} min · ` : ""}
                  {next.title || "Atendimento"}
                </span>
              </Link>
              {(upcomingQ.data ?? []).filter((s) => s.id !== next.id).slice(0, 3).map((s) => (
                <p key={s.id} className="text-[14px] text-muted-foreground">
                  {fmtTime(s.session_date)} · {nameOf(s.client_id)}
                </p>
              ))}
            </>
          ) : (
            <p className="text-[15px] text-muted-foreground">Nenhum atendimento nos próximos 7 dias.</p>
          )}
          <Link to="/app/agenda" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-primary underline-offset-4 hover:underline">
            Abrir agenda <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        <section aria-labelledby="pend-h" className={`${card} space-y-3`}>
          <h2 id="pend-h" className={`${h2} flex items-center gap-2`}>
            <ClipboardCheck className="size-5 text-primary" aria-hidden /> Pendências
          </h2>
          {clientsQ.isError ? (
            <ErrorRow msg="Não foi possível carregar os casos." onRetry={() => clientsQ.refetch()} />
          ) : pendingRecordsQ.isError ? (
            <ErrorRow msg="Não foi possível carregar os registros." onRetry={() => pendingRecordsQ.refetch()} />
          ) : clientsQ.isLoading || pendingRecordsQ.isLoading ? (
            <p role="status" className="text-[15px] text-muted-foreground">Carregando…</p>
          ) : (
            <ul className="space-y-2 text-[15px]">
              <li>
                <Link to="/app/agenda" className="flex min-h-11 items-center justify-between gap-2 hover:underline">
                  <span>Registros de sessão pendentes</span>
                  <strong className="tabular-nums">{pendingRecordsQ.data}</strong>
                </Link>
              </li>
              <li>
                <Link to="/app/clientes" className="flex min-h-11 items-center justify-between gap-2 hover:underline">
                  <span>Consentimentos a conferir</span>
                  <strong className="tabular-nums">{pendingConsent}</strong>
                </Link>
              </li>
            </ul>
          )}
        </section>

        <section aria-labelledby="resume-h" className={`${card} space-y-3`}>
          <h2 id="resume-h" className={`${h2} flex items-center gap-2`}>
            <Network className="size-5 text-primary" aria-hidden /> Retomar
          </h2>
          {clientsQ.isLoading ? (
            <p role="status" className="text-[15px] text-muted-foreground">Carregando…</p>
          ) : resumable.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">
              Os casos que você abrir aparecem aqui, na aba em que parou.
            </p>
          ) : (
            <ul className="space-y-1">
              {resumable.map((v) => (
                <li key={v.clientId}>
                  <Link
                    to="/app/clientes/$clientId"
                    params={{ clientId: v.clientId }}
                    search={{ tab: (TAB_LABEL[v.tab] ? v.tab : "overview") as "overview" }}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate text-[15px] font-medium">{nameOf(v.clientId)}</span>
                    <span className="shrink-0 text-[14px] text-muted-foreground">
                      {TAB_LABEL[v.tab] ?? "Visão geral"} · {new Date(v.at).toLocaleDateString("pt-BR")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/clientes" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-primary underline-offset-4 hover:underline">
            Todos os clientes <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>

      {!clientsQ.isLoading && !clientsQ.isError && clients.length === 0 && (
        <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-[15px]">Nenhum caso cadastrado ainda.</p>
          <Button asChild className="min-h-11">
            <Link to="/app/clientes">Cadastrar caso</Link>
          </Button>
        </section>
      )}

      <Link
        to="/app/biblioteca"
        className="flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card hover:border-primary"
      >
        <img
          src="/assets/genealiz/archive-library.jpg"
          alt="Acervo de estudo ilustrativo"
          loading="lazy"
          className="h-24 w-32 shrink-0 object-cover sm:w-48"
        />
        <span className="py-3 pr-4 text-[15px]">
          <strong className="block font-serif text-[20px]">Biblioteca</strong>
          Conceitos, autores e leituras para consultar.
        </span>
      </Link>
    </div>
  );
}
