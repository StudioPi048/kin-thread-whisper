import { describe, it, expect } from "vitest";
import { buildHypotheses, evidenceForCase } from "./evidence";
import type { PersonRow, RelationshipRow } from "./patterns";

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
          facts: ["A", "B"].map((recordId) => ({
            source: "genogram_persons",
            recordId,
            field: "occupation",
            value: "Médico",
          })),
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
      {
        id: "a",
        full_name: "Cliente",
        relationship_to_proband: "Consulente",
        birth_date: null,
      } as unknown as PersonRow,
    ]);
    expect(g).toContain("Pai não cadastrado.");
    expect(g).toContain("Mãe não cadastrada.");
    expect(g).toContain("Data de nascimento de Cliente desconhecida.");
  });

  it("mantém a fonte de uma filiação tipificada como lacuna até a revisão", () => {
    const proband = person("Consultante", { is_proband: true, client_id: "teste" });
    const other = ["Pai", "Mãe"].map((name) => person(name, { client_id: "teste" }));
    const relationships = other.map(({ id }) => ({
      id: `link-${id}`,
      client_id: "teste",
      from_person_id: id,
      to_person_id: proband.id,
      qualifier: "biological",
      relationship_type: "parent",
    })) as RelationshipRow[];
    const message = "Confirme a fonte da filiação de Consultante.";
    expect(informationGaps([proband, ...other], relationships)).toContain(message);
    expect(
      informationGaps([{ ...proband, parentage_reviewed: true }, ...other], relationships),
    ).not.toContain(message);
  });
});

import { sectionCompletion, INTAKE_UNKNOWN } from "./intake";
describe("progresso da anamnese", () => {
  it("conta 'desconhecido' como respondido e separa no total", () => {
    const r = sectionCompletion(
      { presenting_intention: "x", signature_notes: INTAKE_UNKNOWN },
      "opening",
    );
    expect(r).toEqual({ filled: 2, unknown: 1, total: 2 });
  });
  it("vazio não conta", () => {
    expect(sectionCompletion({ presenting_intention: "  " }, "opening").filled).toBe(0);
  });
});
