import { describe, expect, it } from "vitest";
import {
  agendaSession,
  readReactivationConflicts,
  sessionHistory,
  type AgendaSessionRow,
} from "./agenda-model";
import {
  agendaBoundaryDelay,
  appointmentDurationMin,
  shiftDateKey,
  startOfCivilDay,
} from "./scheduling";

const now = new Date("2026-11-20T15:00:00Z");
const appointment = (id: string, day: string, patch: Partial<AgendaSessionRow> = {}) =>
  ({
    id,
    client_id: "sample",
    status: "draft",
    session_date: day + "T18:00:00Z",
    title: null,
    clinical_status: "scheduled",
    planned_duration_minutes: 80,
    ...patch,
  }) satisfies AgendaSessionRow;

describe("Agenda", () => {
  it("numera pela ordem no caso, sem incluir cancelamentos na sequência", () => {
    const first = appointment("first", "2026-11-20");
    const canceled = appointment("canceled", "2026-11-21", { clinical_status: "canceled" });
    const second = appointment("second", "2026-11-23");
    const future = appointment("future", "2026-12-08");
    const history = sessionHistory([future, second, canceled, first]);

    expect(agendaSession(first, "America/Sao_Paulo", now, history.get(first.id))).toMatchObject({
      sessionNumber: 1,
      isFirst: true,
    });
    expect(agendaSession(second, "America/Sao_Paulo", now, history.get(second.id))).toMatchObject({
      sessionNumber: 2,
      daysSinceFirst: 3,
    });
    expect(agendaSession(canceled, "America/Sao_Paulo", now).sessionNumber).toBeNull();
  });

  it("usa a duração agendada em vez da duração da gravação", () => {
    const session = appointment("practice", "2026-11-20", { duration_seconds: 32 });
    expect(agendaSession(session, "America/Sao_Paulo", now)).toMatchObject({
      start: "15:00",
      end: "16:20",
      durationMin: 80,
    });
    expect(appointmentDurationMin({ status: "ready", duration_seconds: 190 })).toBeNull();
    expect(appointmentDurationMin({ status: "scheduled", duration_seconds: 4_500 })).toBe(75);
  });

  it("mostra o término no dia civil seguinte de acordo com o fuso da Agenda", () => {
    const session = appointment("overnight", "2026-11-20", {
      session_date: "2026-11-21T02:30:00Z",
      planned_duration_minutes: 90,
    });
    expect(agendaSession(session, "America/Sao_Paulo", now)).toMatchObject({
      dateKey: "2026-11-20",
      start: "23:30",
      endDateKey: "2026-11-21",
      end: "01:00",
    });
  });

  it("pula uma exclusão pendente na numeração do histórico", () => {
    const deleting = appointment("deleting", "2026-11-19", { status: "deleting" });
    const next = appointment("first", "2026-11-20");
    expect(sessionHistory([deleting, next]).get(next.id)?.number).toBe(1);
  });

  it("agenda a atualização da Mesa quando o primeiro compromisso vence", () => {
    expect(agendaBoundaryDelay("2026-11-20T15:01:00Z", Number(now))).toBe(60_250);
    expect(agendaBoundaryDelay("2026-11-20T14:59:00Z", Number(now))).toBe(250);
    expect(agendaBoundaryDelay(undefined, Number(now))).toBeNull();
  });

  it("preserva a versão e o horário para resolver conflitos de reativação", () => {
    const collision = {
      id: "f1a74947-4d25-4ceb-9b0c-7ea74220d286",
      startISO: "2026-11-21T10:00:00+00:00",
      updatedAt: "2026-11-20T15:00:00.123456+00:00",
      durationMin: 60,
      conflictName: "Caso fictício",
      conflictStartISO: "2026-11-21T10:30:00+00:00",
    };
    expect(
      readReactivationConflicts({ code: "23P01", details: JSON.stringify([collision]) }),
    ).toEqual([collision]);
    expect(readReactivationConflicts({ code: "23P01", details: "inválido" })).toBeNull();
    expect(
      readReactivationConflicts({ code: "42501", details: JSON.stringify([collision]) }),
    ).toBeNull();
  });

  it("só mostra texto gerado após revisão e prioriza a nota profissional", () => {
    const draft = appointment("draft", "2026-11-20", {
      structured_note: { resumo: "Texto gerado" },
    });
    expect(agendaSession(draft, "UTC", now).lastEvolution).toBeNull();
    const reviewed = { ...draft, ai_reviewed_at: "2026-11-20T19:30:00Z" };
    expect(agendaSession(reviewed, "UTC", now).lastEvolution).toBe("Texto gerado");
    expect(
      agendaSession({ ...reviewed, manual_notes: "Nota da profissional" }, "UTC", now)
        .lastEvolution,
    ).toBe("Nota da profissional");
  });

  it("usa fronteiras civis quando a meia-noite não existe", () => {
    expect(startOfCivilDay("2018-11-04", "America/Sao_Paulo").toISOString()).toBe(
      "2018-11-04T03:00:00.000Z",
    );
    expect(startOfCivilDay("2018-11-05", "America/Sao_Paulo").toISOString()).toBe(
      "2018-11-05T02:00:00.000Z",
    );
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
