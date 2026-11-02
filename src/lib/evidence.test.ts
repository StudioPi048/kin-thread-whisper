import { describe, it, expect } from "vitest";
import { buildHypotheses, evidenceForCase } from "./evidence";
import type { PersonRow } from "./patterns";

const person = (id: string, extra: Partial<PersonRow>) =>
  ({
    id,
    full_name: id,
    preferred_name: null,
    health_conditions: [],
    life_events: [],
    tags: [],
    ...extra,
  }) as unknown as PersonRow;

describe("evidências → hipóteses", () => {
  it("sem dados não gera hipótese (sem fallback fixo)", () => {
    expect(evidenceForCase([], []).hypotheses).toEqual([]);
    expect(buildHypotheses([], [])).toEqual([]);
  });
  it("hipótese sempre cita fontes reais e limites, sem número de confiança", () => {
    const persons = [person("A", { occupation: "Médico" }), person("B", { occupation: "Médico" })];
    const hs = buildHypotheses(
      [
        {
          id: "x",
          type: "shared_occupation",
          title: "t",
          description: "d",
          severity: "info",
          personIds: ["A", "B"],
        },
      ],
      persons,
    );
    expect(hs).toHaveLength(1);
    expect(hs[0].sources).toEqual(["A", "B"]);
    expect(hs[0].limits).toMatch(/não indica causa/);
    expect(JSON.stringify(hs[0])).not.toMatch(/\d+\s?%/);
  });
});

import { informationGaps } from "./evidence";
describe("lacunas reais", () => {
  it("aponta pai/mãe ausentes e datas desconhecidas", () => {
    const g = informationGaps([
      { id: "a", full_name: "Cliente", relationship_to_proband: "Consulente", birth_date: null } as unknown as PersonRow,
    ]);
    expect(g).toContain("Pai não cadastrado.");
    expect(g).toContain("Mãe não cadastrada.");
    expect(g).toContain("Data de nascimento de Cliente desconhecida.");
  });
});
