import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { DayList, ScheduleDialog, WeekView } from "@/components/agenda/agenda-views";
import { usePreferences } from "@/components/account/use-preferences";
import { GenogramThumbnail } from "@/components/genogram/genogram-thumbnail";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { Input } from "@/components/ui/input";
import { getAgendaData, type AgendaSessionDTO } from "@/lib/agenda.functions";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import { detectPatterns } from "@/lib/patterns";
import {
  browserTz,
  dateKeyInTz,
  formatDurationMinutes,
  isCivilDateKey,
  shiftDateKey,
} from "@/lib/scheduling";

type AgendaView = "day" | "week";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
  validateSearch: (search: Record<string, unknown>): { date?: string; view?: AgendaView } => ({
    ...(typeof search.date === "string" && isCivilDateKey(search.date)
      ? { date: search.date }
      : {}),
    ...(search.view === "day" || search.view === "week" ? { view: search.view } : {}),
  }),
});

const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function AgendaPage() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const preferences = usePreferences(user.id);
  const view = search.view ?? preferences.data?.agendaView ?? "day";
  const tz = browserTz();
  const today = dateKeyInTz(new Date(), tz);
  const date = search.date ?? today;
  const [schedule, setSchedule] = useState<{ clientId?: string; clientName?: string } | null>(null);

  const query = useQuery({
    queryKey: ["agenda-data", user.id, date, tz],
    queryFn: () => getAgendaData({ data: { date, tz } }),
    staleTime: 60_000,
    enabled: view === "day",
  });

  const selectDate = (next: string, nextView = view) => {
    if (!isCivilDateKey(next)) return;
    void navigate({
      search: { date: next === today ? undefined : next, view: nextView },
      replace: true,
    });
  };

  const sessions = query.data?.today ?? [];
  const validAppointments = sessions.filter((session) => session.clinicalStatus !== "canceled");
  const plannedMinutes = validAppointments.reduce(
    (sum, session) => sum + (session.durationMin ?? 0),
    0,
  );
  const withoutDuration = validAppointments.filter(
    (session) => session.durationMin === null,
  ).length;
  const dateLabel = DAY_LABEL.format(new Date(date + "T12:00:00Z"));
  const changeSize = view === "week" ? 7 : 1;

  return (
    <div className="archive-agenda-page">
      <DocumentHeader
        breadcrumb="Agenda"
        title={date === today ? "Agenda de hoje" : "Agenda"}
        subtitle={<span className="capitalize">{dateLabel}</span>}
        illustration={<img src="/assets/genealiz/acervo/relogio.webp" alt="" decoding="async" />}
        actions={
          <Button className="min-h-11" onClick={() => setSchedule({})}>
            <CalendarPlus className="size-4" aria-hidden /> Agendar atendimento
          </Button>
        }
      />

      <div className="container-liz space-y-4 pb-10 pt-4">
        <div className="archive-agenda-tools">
          <div
            role="group"
            aria-label="Visualização da agenda"
            className="flex items-center gap-1.5"
          >
            {(["day", "week"] as const).map((option) => (
              <Button
                key={option}
                variant={view === option ? "default" : "ghost"}
                className="min-h-11"
                aria-pressed={view === option}
                onClick={() => selectDate(date, option)}
              >
                {option === "day" ? "Dia" : "Semana"}
              </Button>
            ))}
          </div>
          <div
            role="group"
            aria-label="Navegar pelas datas"
            className="flex min-w-0 flex-wrap items-center gap-1"
          >
            <Button
              size="icon"
              variant="ghost"
              className="min-h-11 min-w-11"
              aria-label={view === "week" ? "Semana anterior" : "Dia anterior"}
              onClick={() => selectDate(shiftDateKey(date, -changeSize))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Input
              type="date"
              aria-label="Data da agenda"
              value={date}
              onChange={(event) => selectDate(event.target.value)}
              className="min-h-11 w-auto min-w-0"
            />
            <Button
              size="icon"
              variant="ghost"
              className="min-h-11 min-w-11"
              aria-label={view === "week" ? "Próxima semana" : "Próximo dia"}
              onClick={() => selectDate(shiftDateKey(date, changeSize))}
            >
              <ChevronRight aria-hidden />
            </Button>
            {date !== today && (
              <Button variant="outline" className="min-h-11" onClick={() => selectDate(today)}>
                Hoje
              </Button>
            )}
          </div>
        </div>

        {view === "week" ? (
          <WeekView dateKey={date} onPickDay={(day) => selectDate(day, "day")} />
        ) : query.isPending ? (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Carregando agenda…
          </p>
        ) : query.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <span className="text-clinical-critical">Não foi possível carregar a agenda.</span>
            <Button variant="outline" className="min-h-11" onClick={() => void query.refetch()}>
              <RefreshCw className="size-4" aria-hidden /> Tentar de novo
            </Button>
          </div>
        ) : (
          <>
            <dl className="archive-agenda-totals">
              <div className="flex gap-2">
                <dt>Atendimentos</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {validAppointments.length}
                </dd>
              </div>
              {plannedMinutes > 0 && (
                <div className="flex gap-2">
                  <dt>Duração registrada</dt>
                  <dd className="font-semibold text-foreground">
                    {formatDurationMinutes(plannedMinutes)}
                  </dd>
                </div>
              )}
              {withoutDuration > 0 && (
                <div className="flex gap-2">
                  <dt>Sem duração informada</dt>
                  <dd>{withoutDuration}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt>Registros pendentes</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {query.data.stats.prontuariosPendentes}
                </dd>
              </div>
            </dl>
            {sessions.length ? (
              <DayList
                sessions={sessions}
                preparation={(session) => <CasePreparation session={session} />}
              />
            ) : (
              <section className="border-b border-border bg-card px-5 py-8">
                <h2 className="text-base font-semibold text-foreground">
                  Nenhum atendimento neste dia
                </h2>
              </section>
            )}
            {query.data.orphanClients.length > 0 && (
              <details className="border-y border-border bg-card px-4 py-2">
                <summary className="min-h-11 cursor-pointer content-center font-semibold text-forest">
                  Clientes sem próxima sessão
                </summary>
                <ul className="divide-y divide-border">
                  {query.data.orphanClients.slice(0, 8).map((client) => (
                    <li
                      key={client.id}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: client.id }}
                        search={{ from: "agenda", agendaDate: date }}
                        className="inline-flex min-h-11 items-center break-words text-forest hover:underline"
                      >
                        {client.name}
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() =>
                          setSchedule({ clientId: client.id, clientName: client.name })
                        }
                      >
                        Agendar
                      </Button>
                    </li>
                  ))}
                </ul>
                {query.data.orphanClients.length > 8 && (
                  <Link
                    to="/app/clientes"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-forest hover:underline"
                  >
                    Ver todos os clientes
                  </Link>
                )}
              </details>
            )}
          </>
        )}
      </div>
      {schedule && (
        <ScheduleDialog
          {...schedule}
          date={date < today ? today : date}
          onSaved={(savedDate) => selectDate(savedDate)}
          onClose={() => setSchedule(null)}
        />
      )}
    </div>
  );
}

function CasePreparation({ session }: { session: AgendaSessionDTO }) {
  const [open, setOpen] = useState(false);
  const data = useQuery({
    ...clinicalIntelQuery(session.clientId),
    enabled: open && !!session.clientId,
  });
  return (
    <details
      className="rounded-md border border-border px-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-forest">
        Preparação do caso
      </summary>
      <div className="space-y-3 pb-3 text-sm">
        {open &&
          (data.isError ? (
            <p role="alert" className="text-clinical-critical">
              Não foi possível carregar a preparação do caso.{" "}
              <button className="underline" onClick={() => void data.refetch()}>
                Tentar de novo
              </button>
            </p>
          ) : data.isPending ? (
            <p role="status" className="text-muted-foreground">
              Carregando dados do caso…
            </p>
          ) : (
            <>
              <div className="max-w-xs">
                <GenogramThumbnail persons={data.data.persons} rels={data.data.relationships} />
              </div>
              <p className="text-muted-foreground">
                {detectPatterns(data.data.persons, data.data.relationships).length} padrões
                apontados pelos dados do caso
              </p>
            </>
          ))}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId: session.clientId }}
              search={{ tab: "genogram", from: "agenda", agendaDate: session.dateKey }}
            >
              Genossociograma
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link
              to="/app/clientes/$clientId"
              params={{ clientId: session.clientId }}
              search={{ tab: "patterns", from: "agenda", agendaDate: session.dateKey }}
            >
              Padrões do caso
            </Link>
          </Button>
        </div>
      </div>
    </details>
  );
}
