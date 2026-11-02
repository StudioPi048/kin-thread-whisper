import { describe, it, expect } from "vitest";
import { readVisits, recordVisit, onboardingSteps } from "./recent-activity";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    m,
  };
};

describe("retomada por usuário", () => {
  it("guarda cliente+aba mais recente primeiro, sem duplicar", () => {
    const s = mem();
    recordVisit("u1", "c1", "genogram", s, 1);
    recordVisit("u1", "c2", "sessions", s, 2);
    recordVisit("u1", "c1", "timeline", s, 3);
    expect(readVisits("u1", s).map((v) => `${v.clientId}:${v.tab}`)).toEqual([
      "c1:timeline",
      "c2:sessions",
    ]);
  });
  it("isola usuários", () => {
    const s = mem();
    recordVisit("u1", "c1", "genogram", s, 1);
    expect(readVisits("u2", s)).toEqual([]);
  });
  it("armazena apenas IDs, aba e horário", () => {
    const s = mem();
    recordVisit("u1", "c1", "genogram", s, 1);
    expect(Object.keys(readVisits("u1", s)[0]).sort()).toEqual(["at", "clientId", "tab"]);
  });
});

describe("onboarding com dados reais", () => {
  it("conta progresso pelos registros existentes", () => {
    const r = onboardingSteps({ clients: 1, persons: 3, relationships: 0, sessions: 0 });
    expect(r.done).toBe(2);
    expect(r.total).toBe(4);
  });
});
