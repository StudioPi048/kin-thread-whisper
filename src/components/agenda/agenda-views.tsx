import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ExternalLink, Loader2, RefreshCw, CalendarClock } from "lucide-react";
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
  getAgendaWeek,
  rescheduleSession,
  type AgendaSessionDTO,
  type RescheduleResponse,
} from "@/lib/agenda.functions";
import { DEFAULT_TZ, MAX_DURATION, MIN_DURATION, dateKeyInTz, isValidTimeZone, timeInTz } from "@/lib/scheduling";
import { AUDIO_LABEL, CLINICAL_LABEL, type ClinicalStatus } from "@/lib/session-state";

export function browserTz(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

const STATUS_TONE: Record<ClinicalStatus, string> = {
  scheduled: "border-forest/30 text-forest bg-forest/5",
  in_progress: "border-bronze/40 text-bronze bg-gold-muted/30",
  pending_record: "border-clinical-warning/40 text-clinical-warning bg-clinical-warning/10",
  completed: "border-clinical-positive/30 text-clinical-positive bg-clinical-positive/10",
};

export function StatusPill({ status }: { status: ClinicalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-semibold ${STATUS_TONE[status]}`}>
      {CLINICAL_LABEL[status]}
    </span>
  );
}

/* ------------------------------- Lista do dia ------------------------------- */

export function DayList({
  sessions,
  agendaDate,
}: {
  sessions: AgendaSessionDTO[];
  agendaDate?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgendaSessionDTO | null>(null);
  return (
    <section aria-labelledby="day-list-title" className="surface rounded-xl border border-border p-3 md:p-4">
      <h2 id="day-list-title" className="mb-2 text-[15px] font-semibold text-primary">
        Atendimentos do dia
      </h2>
      <ul className="divide-y divide-border">
        {sessions.map((s) => {
          const expanded = open === s.id;
          return (
            <li key={s.id} className="py-2">
              <button
                type="button"
                className="flex min-h-11 w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                aria-expanded={expanded}
                aria-controls={`day-${s.id}`}
                onClick={() => setOpen(expanded ? null : s.id)}
              >
                <span className="font-mono text-[16px] font-bold tabular-nums text-primary">{s.start}</span>
                <span className="text-[14px] text-muted-foreground tabular-nums">
                  <Clock className="mr-1 inline size-3.5" aria-hidden />
                  {s.durationMin} min
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-foreground">{s.patient}</span>
                <StatusPill status={s.clinicalStatus} />
                {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
              </button>
              {expanded && (
                <div id={`day-${s.id}`} className="mt-2 space-y-3 px-2 pb-1 text-[14px]">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                    <dt>Término</dt>
                    <dd className="text-foreground">{s.end}</dd>
                    <dt>Tipo</dt>
                    <dd className="text-foreground">{s.type}{s.isFirst ? "" : ` · sessão ${s.sessionNumber}`}</dd>
                    <dt>Áudio</dt>
                    <dd className="text-foreground">{AUDIO_LABEL[s.audioState]}</dd>
                    {s.lastEvolution && (
                      <>
                        <dt>Última evolução</dt>
                        <dd className="text-foreground">{s.lastEvolution}</dd>
                      </>
                    )}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {s.clientId && (
                      <Button asChild size="sm" className="min-h-11">
                        <Link
                          to="/app/clientes/$clientId"
                          params={{ clientId: s.clientId }}
                          search={{ tab: "sessions", from: "agenda", agendaDate }}
                        >
                          <ExternalLink className="mr-1.5 size-4" /> Abrir caso
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="min-h-11" onClick={() => setEditing(s)}>
                      <CalendarClock className="mr-1.5 size-4" /> Reagendar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editing && <RescheduleDialog session={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

/* ------------------------------ Reagendamento ------------------------------ */

export function RescheduleDialog({
  session,
  onClose,
}: {
  session: { id: string; startISO: string; durationMin: number; patient: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(rescheduleSession);
  const initialTz = browserTz();
  const [form, setForm] = useState({
    date: dateKeyInTz(session.startISO, initialTz),
    time: timeInTz(session.startISO, initialTz),
    duration: String(session.durationMin),
    tz: initialTz,
  });
  const [result, setResult] = useState<RescheduleResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      fn({ data: { sessionId: session.id, date: form.date, time: form.time, durationMin: Number(form.duration), tz: form.tz } }),
    onSuccess: (r) => {
      setResult(r);
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["agenda-data"] });
        qc.invalidateQueries({ queryKey: ["agenda-week"] });
        qc.invalidateQueries({ queryKey: ["clinical_sessions"] });
        toast.success("Atendimento reagendado.");
        onClose();
      }
    },
    // Erro de rede: o formulário permanece intacto para nova tentativa.
    onError: (e) => setResult({ ok: false, errors: [e instanceof Error ? e.message : "Falha ao salvar."], conflicts: [] }),
  });

  const zones = useMemo(
    () => Array.from(new Set([initialTz, DEFAULT_TZ, "America/Manaus", "America/Recife", "America/Rio_Branco", "Europe/Lisbon", "UTC"])),
    [initialTz],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar atendimento</DialogTitle>
          <DialogDescription>{session.patient}. O horário original só muda depois da confirmação do servidor.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="rs-date">Data</Label>
            <Input id="rs-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rs-time">Horário</Label>
            <Input id="rs-time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rs-dur">Duração (min)</Label>
            <Input
              id="rs-dur"
              type="number"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={5}
              required
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rs-tz">Fuso horário</Label>
            <select
              id="rs-tz"
              className="h-11 w-full rounded-md border border-input bg-background px-2 text-[14px]"
              value={form.tz}
              onChange={(e) => setForm({ ...form, tz: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          {result && !result.ok && (
            <div role="alert" className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-[14px] text-destructive">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Não foi reagendado</p>
              <ul className="mt-1 list-disc pl-5">
                {result.errors.map((e) => <li key={e}>{e}</li>)}
                {result.conflicts.map((c) => <li key={c.id}>Conflita com {c.patient} às {c.start}</li>)}
              </ul>
            </div>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- Semana --------------------------------- */

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function mondayOf(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const delta = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0, 10);
}

export function WeekView({ dateKey, onPickDay }: { dateKey: string; onPickDay: (key: string) => void }) {
  const tz = browserTz();
  const weekStart = mondayOf(dateKey);
  const fn = useServerFn(getAgendaWeek);
  const q = useQuery({
    queryKey: ["agenda-week", weekStart, tz],
    queryFn: () => fn({ data: { weekStart, tz } }),
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const [editing, setEditing] = useState<{ id: string; startISO: string; durationMin: number; patient: string } | null>(null);

  if (q.isLoading) return <div className="skeleton h-64 rounded-xl" aria-label="Carregando semana" />;
  if (q.isError)
    return (
      <div role="alert" className="surface rounded-xl border border-border p-6 text-[15px]">
        Não foi possível carregar a semana.{" "}
        <Button variant="outline" size="sm" className="ml-2 min-h-11" onClick={() => q.refetch()}>
          <RefreshCw className="mr-1.5 size-4" /> Tentar de novo
        </Button>
      </div>
    );

  const items = q.data ?? [];
  return (
    <section aria-label="Semana" className="grid gap-2 md:grid-cols-7">
      {days.map((k) => {
        const list = items.filter((s) => s.dateKey === k);
        const d = new Date(`${k}T12:00:00Z`);
        return (
          <div key={k} className={`surface rounded-xl border p-2 ${k === dateKey ? "border-forest" : "border-border"}`}>
            <button
              type="button"
              className="mb-2 flex min-h-11 w-full items-baseline gap-2 rounded-md px-1 text-left hover:bg-secondary"
              onClick={() => onPickDay(k)}
              aria-label={`Abrir dia ${d.getUTCDate()}`}
            >
              <span className="text-[13px] font-semibold uppercase text-muted-foreground">{WD[d.getUTCDay()]}</span>
              <span className="text-[16px] font-bold text-primary">{d.getUTCDate()}</span>
            </button>
            {list.length === 0 ? (
              <p className="px-1 text-[13px] text-muted-foreground">Livre</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((s) => (
                  <li key={s.id} className="rounded-md border border-border bg-background p-2 text-[14px]">
                    <p className="font-mono font-bold tabular-nums">{s.start}–{s.end}</p>
                    <p className="truncate font-semibold">{s.patient}</p>
                    <StatusPill status={s.clinicalStatus} />
                    <div className="mt-1 flex gap-1">
                      <Link
                        to="/app/clientes/$clientId"
                        params={{ clientId: s.clientId }}
                        search={{ tab: "sessions", from: "agenda", agendaDate: k }}
                        className="text-[13px] font-semibold text-forest underline-offset-2 hover:underline"
                      >
                        Abrir
                      </Link>
                      <button
                        type="button"
                        className="text-[13px] font-semibold text-forest underline-offset-2 hover:underline"
                        onClick={() => setEditing(s)}
                      >
                        Reagendar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {editing && <RescheduleDialog session={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
