import { describe, expect, it } from "vitest";
import { agendaSession, sessionHistory, type AgendaSessionRow } from "./agenda-model";
import { appointmentDurationMin, shiftDateKey, startOfCivilDay } from "./scheduling";

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
