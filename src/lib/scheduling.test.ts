import { describe, expect, it } from "vitest";
import { dateKeyInTz, timeInTz, validateReschedule, zonedLocalToUtc } from "./scheduling";

const base = { sessionId: "s1", tz: "America/Sao_Paulo", durationMin: 50, existing: [] };

describe("fuso horário", () => {
  it("São Paulo 09:00 = 12:00 UTC", () => {
    expect(zonedLocalToUtc("2026-11-02", "09:00", "America/Sao_Paulo")?.toISOString()).toBe(
      "2026-11-02T12:00:00.000Z",
    );
  });
  it("Lisboa no verão (UTC+1) e no inverno (UTC+0)", () => {
    expect(zonedLocalToUtc("2026-07-01", "10:00", "Europe/Lisbon")?.toISOString()).toBe(
      "2026-07-01T09:00:00.000Z",
    );
    expect(zonedLocalToUtc("2026-12-01", "10:00", "Europe/Lisbon")?.toISOString()).toBe(
      "2026-12-01T10:00:00.000Z",
    );
  });
  it("horário inexistente no salto de verão é rejeitado", () => {
    expect(zonedLocalToUtc("2026-03-08", "02:30", "America/New_York")).toBeNull();
  });
  it("dia e hora no fuso, não no do servidor", () => {
    expect(dateKeyInTz("2026-11-03T01:30:00Z", "America/Sao_Paulo")).toBe("2026-11-02");
    expect(timeInTz("2026-11-03T01:30:00Z", "America/Sao_Paulo")).toBe("22:30");
  });
});

describe("reagendamento", () => {
  const other = { id: "s2", startISO: "2026-11-02T13:00:00.000Z", durationMin: 60 }; // 10:00–11:00 SP

  it("aceita horário livre", () => {
    const r = validateReschedule({ ...base, date: "2026-11-02", time: "08:00", existing: [other] });
    expect(r).toEqual({
      ok: true,
      startISO: "2026-11-02T11:00:00.000Z",
      endISO: "2026-11-02T11:50:00.000Z",
    });
  });
  it("detecta sobreposição causada pela duração", () => {
    const r = validateReschedule({ ...base, date: "2026-11-02", time: "09:30", existing: [other] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflicts.map((c) => c.id)).toEqual(["s2"]);
  });
  it("encostar no fim de outro atendimento não conflita", () => {
    const r = validateReschedule({ ...base, date: "2026-11-02", time: "11:00", existing: [other] });
    expect(r.ok).toBe(true);
  });
  it("ignora a própria sessão", () => {
    const r = validateReschedule({
      ...base,
      sessionId: "s2",
      date: "2026-11-02",
      time: "10:00",
      existing: [other],
    });
    expect(r.ok).toBe(true);
  });
  it("mesmo horário local em outro fuso pode conflitar", () => {
    // 09:00 em Manaus (UTC-4) = 13:00 UTC = 10:00 SP → conflita
    const r = validateReschedule({
      ...base,
      tz: "America/Manaus",
      date: "2026-11-02",
      time: "09:00",
      existing: [other],
    });
    expect(r.ok).toBe(false);
  });
  it("rejeita duração fora de 10–480 e fuso desconhecido", () => {
    expect(
      validateReschedule({ ...base, durationMin: 5, date: "2026-11-02", time: "08:00" }).ok,
    ).toBe(false);
    expect(
      validateReschedule({ ...base, durationMin: 500, date: "2026-11-02", time: "08:00" }).ok,
    ).toBe(false);
    expect(
      validateReschedule({ ...base, tz: "Mars/Base", date: "2026-11-02", time: "08:00" }).ok,
    ).toBe(false);
  });
  it("rejeita data inválida", () => {
    expect(validateReschedule({ ...base, date: "2026-13-02", time: "08:00" }).ok).toBe(false);
  });
});
