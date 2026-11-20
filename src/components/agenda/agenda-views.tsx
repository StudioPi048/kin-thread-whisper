import { useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Clock, ExternalLink, Loader2, RefreshCw } from "lucide-react";
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
  "id" | "clientId" | "patient" | "dateKey" | "startISO" | "durationMin" | "clinicalStatus"
>;

function CancellationDialog({ session, onClose }: { session: Appointment; onClose: () => void }) {
  const qc = useQueryClient();
  const cancel = useServerFn(cancelSession);
  const [message, setMessage] = useState("");
  const mutation = useMutation({
    mutationFn: () => cancel({ data: { sessionId: session.id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        setMessage(result.errors.join(" "));
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
            O atendimento de {session.patient} ficará no histórico como cancelado e o horário será
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
              setMessage("");
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Cancelando…" : "Confirmar cancelamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AppointmentActions({ session }: { session: Appointment }) {
  const [dialog, setDialog] = useState<"move" | "cancel" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" className="h-auto min-h-11 whitespace-normal">
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: session.clientId }}
          search={{
            tab: "sessions",
            session: session.id,
            from: "agenda",
            agendaDate: session.dateKey,
          }}
        >
          <ExternalLink className="size-4" aria-hidden /> Abrir atendimento
        </Link>
      </Button>
      {session.clinicalStatus === "scheduled" && (
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
      className="surface rounded-xl border border-border p-3 md:p-4"
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
              <button
                type="button"
                className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                aria-expanded={expanded}
                aria-controls={"day-" + session.id}
                onClick={() => setOpen(expanded ? null : session.id)}
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
              </button>
              {expanded && (
                <div id={"day-" + session.id} className="space-y-3 px-2 pb-2 pt-1 text-sm">
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-muted-foreground">
                    {session.end && (
                      <>
                        <dt>Término</dt>
                        <dd className="text-foreground">{session.end}</dd>
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
  const [result, setResult] = useState<Extract<RescheduleResponse, { ok: false }> | null>(null);

  const chooseClient = !session && !clientId;
  const clients = useQuery({
    queryKey: ["agenda-client-options"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Entre na sua conta para agendar.");
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, preferred_name")
        .eq("professional_id", auth.user.id)
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
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
      };
      return session
        ? move({ data })
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
    if (result) setResult(null);
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
            mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending} className="grid min-w-0 gap-3 sm:grid-cols-2">
            {chooseClient && (
              <div className="min-w-0 space-y-1 sm:col-span-2">
                <Label htmlFor={formId + "-client"}>Cliente</Label>
                <select
                  id={formId + "-client"}
                  className={selectClass}
                  value={form.clientId}
                  disabled={clients.isPending || clients.isError}
                  required
                  onChange={(event) => edit({ clientId: event.target.value })}
                >
                  <option value="">
                    {clients.isPending ? "Carregando clientes…" : "Selecione um cliente"}
                  </option>
                  {(clients.data ?? []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
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
                {clients.isSuccess && !clients.data.length && (
                  <p className="text-sm text-muted-foreground">
                    Cadastre ou reative um cliente em Clientes para agendar.
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
              <Button
                type="submit"
                className="min-h-11"
                disabled={!form.clientId || mutation.isPending}
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
              "surface min-w-0 space-y-2 rounded-xl border p-3 " +
              (day === dateKey ? "border-forest" : "border-border")
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
                      {slot.end && " – " + slot.end}
                    </p>
                    <p className="my-1 break-words font-semibold">{slot.patient}</p>
                    <StatusPill status={slot.clinicalStatus} />
                    <details className="mt-1">
                      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-forest">
                        Ações
                      </summary>
                      <AppointmentActions session={slot} />
                    </details>
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
