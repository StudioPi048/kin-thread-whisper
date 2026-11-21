import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronDown, Clock, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ReactivationConflict } from "@/lib/agenda-model";
import { readWorkspaceClientPage } from "@/lib/workspace-client-search";
import {
  cancelSession,
  getAgendaWeek,
  rescheduleSession,
  scheduleSession,
  type AgendaSessionDTO,
  type RescheduleResponse,
  type WeekSessionDTO,
} from "@/lib/agenda.functions";
import {
  DEFAULT_TZ,
  MAX_DURATION,
  MIN_DURATION,
  browserTz,
  dateKeyInTz,
  formatDurationMinutes,
  shiftDateKey,
  timeInTz,
  zonedTimeOccurrences,
} from "@/lib/scheduling";
import {
  AUDIO_LABEL,
  CLINICAL_LABEL,
  invalidateSessionViews,
  type ClinicalStatus,
} from "@/lib/session-state";

const STATUS_TONE: Record<ClinicalStatus, string> = {
  scheduled: "border-forest/30 text-forest bg-forest/5",
  in_progress: "border-bronze/40 text-bronze bg-gold-muted/30",
  pending_record: "border-clinical-warning/40 text-clinical-warning bg-clinical-warning/10",
  completed: "border-clinical-positive/30 text-clinical-positive bg-clinical-positive/10",
  canceled: "border-border text-muted-foreground",
};

export function StatusPill({ status }: { status: ClinicalStatus }) {
  return (
    <span
      className={
        "inline-flex rounded-md border px-2 py-0.5 text-sm font-semibold " + STATUS_TONE[status]
      }
    >
      {CLINICAL_LABEL[status]}
    </span>
  );
}

type Appointment = Pick<
  WeekSessionDTO,
  | "id"
  | "clientId"
  | "patient"
  | "dateKey"
  | "startISO"
  | "updatedAt"
  | "durationMin"
  | "clinicalStatus"
  | "overdue"
>;

function CancellationDialog({ session, onClose }: { session: Appointment; onClose: () => void }) {
  const qc = useQueryClient();
  const cancel = useServerFn(cancelSession);
  const [original] = useState(session);
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      cancel({ data: { sessionId: original.id, expectedUpdatedAt: original.updatedAt } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setMessage(result.errors.join(" "));
        setStale(result.stale === true);
        return;
      }
      await invalidateSessionViews(qc, result.clientId);
      toast.success("Atendimento cancelado.");
      onClose();
    },
    onError: () => setMessage("O servidor não confirmou o cancelamento. Tente de novo."),
  });
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar atendimento?</AlertDialogTitle>
          <AlertDialogDescription>
            O atendimento de {original.patient} ficará no histórico como cancelado e o horário será
            liberado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {message && (
          <p role="alert" className="text-sm text-clinical-critical">
            {message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" disabled={mutation.isPending}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11"
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              if (stale) {
                void invalidateSessionViews(qc, original.clientId).finally(onClose);
              } else {
                setMessage("");
                mutation.mutate();
              }
            }}
          >
            {mutation.isPending
              ? "Cancelando…"
              : stale
                ? "Atualizar Agenda"
                : "Confirmar cancelamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function appointmentDestination(
  session: Appointment,
  agendaView: "day" | "week" = "day",
  originDate = session.dateKey,
) {
  return {
    to: "/app/clientes/$clientId" as const,
    params: { clientId: session.clientId },
    search: {
      tab: "sessions" as const,
      session: session.id,
      from: "agenda" as const,
      agendaDate: originDate,
      agendaView,
    },
  };
}

export function AppointmentActions({ session }: { session: Appointment }) {
  const [dialog, setDialog] = useState<"move" | "cancel" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {(session.clinicalStatus === "scheduled" || session.overdue) && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-auto min-h-11 whitespace-normal"
            onClick={() => setDialog("move")}
          >
            Reagendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-auto min-h-11 whitespace-normal"
            onClick={() => setDialog("cancel")}
          >
            Cancelar atendimento
          </Button>
        </>
      )}
      {dialog === "move" && <AppointmentDialog session={session} onClose={() => setDialog(null)} />}
      {dialog === "cancel" && (
        <CancellationDialog session={session} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

export function DayList({
  sessions,
  preparation,
}: {
  sessions: AgendaSessionDTO[];
  preparation?: (session: AgendaSessionDTO) => ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section
      aria-labelledby="day-list-title"
      className="border-y border-border bg-card px-3 py-4 md:px-5"
    >
      <h2 id="day-list-title" className="mb-2 text-base font-semibold text-primary">
        Atendimentos do dia
      </h2>
      <ul className="divide-y divide-border">
        {sessions.map((session) => {
          const expanded = open === session.id;
          const canceled = session.clinicalStatus === "canceled";
          return (
            <li key={session.id} className="py-1.5">
              <div className="flex items-center gap-1">
                <Link
                  {...appointmentDestination(session)}
                  className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span
                    className={
                      "font-semibold tabular-nums " +
                      (canceled ? "text-muted-foreground line-through" : "text-primary")
                    }
                  >
                    {session.start}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-semibold text-foreground">
                    {session.patient}
                  </span>
                  <StatusPill status={session.clinicalStatus} />
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Detalhes do atendimento de ${session.patient}`}
                  aria-expanded={expanded}
                  aria-controls={expanded ? "day-" + session.id : undefined}
                  onClick={() => setOpen(expanded ? null : session.id)}
                >
                  <ChevronDown className={expanded ? "size-4 rotate-180" : "size-4"} aria-hidden />
                </Button>
              </div>
              {expanded && (
                <div id={"day-" + session.id} className="space-y-3 px-2 pb-2 pt-1 text-sm">
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-muted-foreground">
                    {session.end && (
                      <>
                        <dt>Término</dt>
                        <dd className="text-foreground">{appointmentEndLabel(session)}</dd>
                      </>
                    )}
                    <dt>Duração</dt>
                    <dd className="text-foreground">
                      {session.durationMin === null
                        ? "Não informada"
                        : formatDurationMinutes(session.durationMin)}
                    </dd>
                    {session.sessionNumber !== null && (
                      <>
                        <dt>Tipo</dt>
                        <dd className="text-foreground">
                          {session.type}
                          {!session.isFirst && " · sessão " + session.sessionNumber}
                        </dd>
                      </>
                    )}
                    <dt>Áudio</dt>
                    <dd className="text-foreground">{AUDIO_LABEL[session.audioState]}</dd>
                    {session.lastEvolution && (
                      <>
                        <dt>Registro</dt>
                        <dd className="break-words text-foreground">{session.lastEvolution}</dd>
                      </>
                    )}
                  </dl>
                  <AppointmentActions session={session} />
                  {preparation?.(session)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type ScheduleProps = {
  clientId?: string;
  clientName?: string;
  date?: string;
  onClose: () => void;
  onSaved?: (day: string) => void;
};

export function ScheduleDialog(props: ScheduleProps) {
  return <AppointmentDialog {...props} />;
}

const selectClass =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base sm:text-sm";
const tzOptions = [
  DEFAULT_TZ,
  "America/Manaus",
  "America/Recife",
  "America/Rio_Branco",
  "Europe/Lisbon",
  "UTC",
];

function AppointmentDialog({
  session,
  clientId,
  clientName,
  date,
  onClose,
  onSaved,
}: ScheduleProps & { session?: Appointment }) {
  const qc = useQueryClient();
  const create = useServerFn(scheduleSession);
  const move = useServerFn(rescheduleSession);
  const formId = useId();
  const displayTz = browserTz();
  const [original] = useState(session);
  const [requestId, setRequestId] = useState(() => session?.id ?? crypto.randomUUID());
  const selectedPerson = session?.patient ?? clientName;
  const [form, setForm] = useState({
    clientId: session?.clientId ?? clientId ?? "",
    title: "",
    date: session
      ? dateKeyInTz(session.startISO, displayTz)
      : (date ?? dateKeyInTz(new Date(), displayTz)),
    time: session ? timeInTz(session.startISO, displayTz) : "",
    duration: String(session?.durationMin ?? 60),
    tz: displayTz,
  });
  const [occurrence, setOccurrence] = useState<number | undefined>();
  const occurrences = zonedTimeOccurrences(form.date, form.time, form.tz);
  const originalOccurrence = original
    ? occurrences.findIndex(
        (option) =>
          Math.floor(option.getTime() / 60_000) ===
          Math.floor(Date.parse(original.startISO) / 60_000),
      )
    : -1;
  const occurrenceValue = occurrence ?? (originalOccurrence >= 0 ? originalOccurrence : undefined);
  const [result, setResult] = useState<Extract<RescheduleResponse, { ok: false }> | null>(null);

  const chooseClient = !session && !clientId;
  const [clientSearch, setClientSearch] = useState("");
  const [activeClientSearch, setActiveClientSearch] = useState("");
  const [clientPage, setClientPage] = useState(0);
  const [chosenClient, setChosenClient] = useState<{ id: string; name: string }>();
  useEffect(() => {
    if (!chooseClient) return;
    const timer = window.setTimeout(() => {
      setActiveClientSearch(clientSearch.trim());
      setClientPage(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [chooseClient, clientSearch]);
  const clients = useQuery({
    queryKey: ["agenda-client-options", activeClientSearch, clientPage],
    queryFn: () =>
      readWorkspaceClientPage(supabase, {
        search: activeClientSearch,
        offset: clientPage * 24,
        limit: 24,
      }),
    enabled: chooseClient,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const data = {
        sessionId: requestId,
        date: form.date,
        time: form.time,
        durationMin: Number(form.duration),
        tz: form.tz,
        occurrence,
      };
      return original
        ? move({
            data: {
              ...data,
              expectedUpdatedAt: original.updatedAt,
              originalStartISO: original.startISO,
            },
          })
        : create({ data: { ...data, clientId: form.clientId, title: form.title } });
    },
    onSuccess: async (answer) => {
      if (!answer.ok) {
        setResult(answer);
        return;
      }
      await invalidateSessionViews(qc, answer.clientId);
      toast.success(session ? "Atendimento reagendado." : "Atendimento agendado.");
      onSaved?.(dateKeyInTz(answer.startISO, displayTz));
      onClose();
    },
    onError: () =>
      setResult({ ok: false, errors: ["O servidor não confirmou. Tente de novo."], conflicts: [] }),
  });

  const edit = (patch: Partial<typeof form>) => {
    if (result && !result.stale) setResult(null);
    if (patch.date !== undefined || patch.time !== undefined || patch.tz !== undefined)
      setOccurrence(undefined);
    if (!session) setRequestId(crypto.randomUUID());
    setForm((previous) => ({ ...previous, ...patch }));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? "Reagendar atendimento" : "Agendar atendimento"}</DialogTitle>
          <DialogDescription>
            {selectedPerson ||
              (chooseClient
                ? "Escolha o cliente, a data e o horário."
                : "Defina a data e o horário.")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!result?.stale) mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {chooseClient && (
              <div className="min-w-0 space-y-1 sm:col-span-2">
                <Label htmlFor={formId + "-client-search"}>Buscar cliente por nome</Label>
                <Input
                  id={formId + "-client-search"}
                  type="search"
                  className="min-h-11"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                />
                <Label htmlFor={formId + "-client"}>Cliente</Label>
                <select
                  id={formId + "-client"}
                  className={selectClass}
                  value={form.clientId}
                  disabled={clients.isPending || clients.isError}
                  required
                  onChange={(event) => {
                    const id = event.target.value;
                    const name = event.target.selectedOptions[0]?.text;
                    setChosenClient(id && name ? { id, name } : undefined);
                    edit({ clientId: id });
                  }}
                >
                  <option value="">
                    {clients.isPending ? "Carregando clientes…" : "Selecione um cliente"}
                  </option>
                  {chosenClient &&
                    !clients.data?.clients.some(({ id }) => id === chosenClient.id) && (
                      <option value={chosenClient.id}>{chosenClient.name}</option>
                    )}
                  {(clients.data?.clients ?? []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
                {(clientPage > 0 || clients.data?.hasMore) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={clientPage === 0}
                      onClick={() => setClientPage(clientPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={!clients.data?.hasMore}
                      onClick={() => setClientPage(clientPage + 1)}
                    >
                      Próxima
                    </Button>
                    {clients.data && (
                      <span role="status" className="text-sm text-muted-foreground">
                        {clients.data.total} clientes
                      </span>
                    )}
                  </div>
                )}
                {clients.isError && (
                  <div className="flex flex-wrap items-center gap-2" role="alert">
                    <span className="text-sm text-clinical-critical">
                      Não foi possível carregar os clientes.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void clients.refetch()}
                    >
                      Tentar de novo
                    </Button>
                  </div>
                )}
                {clients.isSuccess && clients.data.total === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {activeClientSearch
                      ? "Nenhum cliente encontrado."
                      : "Cadastre ou reative um cliente em Clientes para agendar."}
                  </p>
                )}
              </div>
            )}
            {!session && (
              <div className="min-w-0 space-y-1 sm:col-span-2">
                <Label htmlFor={formId + "-title"}>Título (opcional)</Label>
                <Input
                  id={formId + "-title"}
                  maxLength={120}
                  value={form.title}
                  onChange={(event) => edit({ title: event.target.value })}
                  className="min-h-11"
                />
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <Label htmlFor={formId + "-date"}>Data</Label>
              <Input
                id={formId + "-date"}
                type="date"
                required
                min={dateKeyInTz(new Date(), form.tz)}
                value={form.date}
                onChange={(event) => edit({ date: event.target.value })}
                className="min-h-11 min-w-0"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={formId + "-time"}>Horário</Label>
              <Input
                id={formId + "-time"}
                type="time"
                required
                value={form.time}
                onChange={(event) => edit({ time: event.target.value })}
                className="min-h-11 min-w-0"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={formId + "-duration"}>Duração (min)</Label>
              <Input
                id={formId + "-duration"}
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                required
                value={form.duration}
                onChange={(event) => edit({ duration: event.target.value })}
                className="min-h-11 min-w-0"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={formId + "-tz"}>Fuso horário</Label>
              <select
                id={formId + "-tz"}
                className={selectClass}
                value={form.tz}
                onChange={(event) => edit({ tz: event.target.value })}
              >
                {[...new Set([displayTz, ...tzOptions])].map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
            {occurrences.length > 1 && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={formId + "-occurrence"}>Ocorrência do horário</Label>
                <select
                  id={formId + "-occurrence"}
                  className={selectClass}
                  required
                  value={occurrenceValue ?? ""}
                  onChange={(event) =>
                    setOccurrence(
                      event.target.value === "" ? undefined : Number(event.target.value),
                    )
                  }
                >
                  <option value="">Selecione a ocorrência</option>
                  {occurrences.map((instant, index) => (
                    <option key={instant.toISOString()} value={index}>
                      {index + 1}ª ocorrência · {instant.toISOString().slice(11, 16)} UTC
                    </option>
                  ))}
                </select>
              </div>
            )}
            {result && (
              <div
                role="alert"
                className="rounded-md border border-clinical-critical/30 p-3 text-sm text-clinical-critical sm:col-span-2"
              >
                <ul className="space-y-1">
                  {result.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                  {result.conflicts.map((slot) => (
                    <li key={slot.id}>
                      {slot.patient} às {slot.start}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Voltar
              </Button>
              {result?.stale && original && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void invalidateSessionViews(qc, original.clientId).finally(onClose)
                  }
                >
                  Atualizar Agenda
                </Button>
              )}
              <Button
                type="submit"
                className="min-h-11"
                disabled={!form.clientId || mutation.isPending || result?.stale}
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {session ? "Confirmar novo horário" : "Agendar"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function mondayOf(dateKey: string) {
  const day = new Date(dateKey + "T12:00:00Z").getUTCDay();
  return shiftDateKey(dateKey, -((day + 6) % 7));
}

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
const SHORT_CIVIL_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function appointmentEndLabel({
  dateKey,
  endDateKey,
  end,
}: Pick<WeekSessionDTO, "dateKey" | "endDateKey" | "end">) {
  if (!end || !endDateKey || endDateKey === dateKey) return end;
  return `${end} (${SHORT_CIVIL_DATE.format(new Date(`${endDateKey}T12:00:00Z`))})`;
}

export function ReactivationConflictDialog({
  clientId,
  clientName,
  conflicts,
  checking,
  onRetry,
  onClose,
}: {
  clientId: string;
  clientName: string;
  conflicts: ReactivationConflict[];
  checking: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [selected, select] = useState<ReactivationConflict | null>(null);
  const tz = browserTz();
  const format = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: tz,
  });
  if (selected) {
    return (
      <AppointmentDialog
        session={{
          id: selected.id,
          clientId,
          patient: clientName,
          dateKey: dateKeyInTz(selected.startISO, tz),
          startISO: selected.startISO,
          updatedAt: selected.updatedAt,
          durationMin: selected.durationMin,
          clinicalStatus: "scheduled",
          overdue: Date.parse(selected.startISO) <= Date.now(),
        }}
        onClose={() => select(null)}
        onSaved={onRetry}
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !checking) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confira os horários antes de reativar</DialogTitle>
          <DialogDescription>
            {clientName} continua arquivado. Resolva os conflitos para voltar à Agenda.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="py-3">
              <p className="font-medium">{format.format(new Date(conflict.startISO))}</p>
              <p className="text-sm text-muted-foreground">
                Coincide com {conflict.conflictName} em{" "}
                {format.format(new Date(conflict.conflictStartISO))}.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 min-h-11"
                disabled={checking}
                onClick={() => select(conflict)}
              >
                Reagendar
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={checking}
            onClick={onClose}
          >
            Manter arquivado
          </Button>
          <Button type="button" className="min-h-11" disabled={checking} onClick={onRetry}>
            {checking ? "Verificando…" : "Verificar novamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WeekView({
  dateKey,
  onPickDay,
}: {
  dateKey: string;
  onPickDay: (key: string) => void;
}) {
  const tz = browserTz();
  const weekStart = mondayOf(dateKey);
  const readWeek = useServerFn(getAgendaWeek);
  const week = useQuery({
    queryKey: ["agenda-week", weekStart, tz],
    queryFn: () => readWeek({ data: { weekStart, tz } }),
  });

  if (week.isLoading)
    return (
      <div role="status" className="p-4 text-sm text-muted-foreground">
        Carregando semana…
      </div>
    );
  if (week.isError)
    return (
      <div
        role="alert"
        className="surface flex flex-wrap items-center gap-2 rounded-xl border border-border p-4"
      >
        Não foi possível carregar a semana.
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => void week.refetch()}
        >
          <RefreshCw className="size-4" aria-hidden /> Tentar de novo
        </Button>
      </div>
    );

  const days = Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index));
  return (
    <section
      aria-label="Semana"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
    >
      {days.map((day) => {
        const date = new Date(day + "T12:00:00Z");
        const list = (week.data ?? []).filter((item) => item.dateKey === day);
        return (
          <div
            key={day}
            className={
              "min-w-0 space-y-2 rounded-lg border p-3 " +
              (day === dateKey ? "border-forest bg-forest-mist" : "border-border") +
              (list.length ? " bg-card" : "")
            }
          >
            <button
              type="button"
              className="flex min-h-11 w-full items-baseline justify-between gap-2 rounded-md px-2 text-left hover:bg-secondary focus-visible:ring-2"
              onClick={() => onPickDay(day)}
              title="Abrir este dia"
            >
              <span className="text-sm capitalize text-muted-foreground">
                {WEEKDAY.format(date)}
              </span>
              <span className="font-semibold tabular-nums text-primary">{date.getUTCDate()}</span>
            </button>
            {!list.length ? (
              <p className="px-2 text-sm text-muted-foreground">Sem atendimentos</p>
            ) : (
              <ul className="space-y-2">
                {list.map((slot) => (
                  <li key={slot.id} className="rounded-md border border-border bg-card p-2 text-sm">
                    <p className="flex items-center gap-1 font-semibold tabular-nums">
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {slot.start}
                      {slot.end && " – " + appointmentEndLabel(slot)}
                    </p>
                    <Link
                      {...appointmentDestination(slot, "week", dateKey)}
                      className="flex min-h-11 items-center gap-1.5 break-words font-semibold text-forest hover:underline"
                    >
                      <span className="min-w-0">{slot.patient}</span>
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </Link>
                    <StatusPill status={slot.clinicalStatus} />
                    {(slot.clinicalStatus === "scheduled" || slot.overdue) && (
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-forest">
                          Ações
                        </summary>
                        <AppointmentActions session={slot} />
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
