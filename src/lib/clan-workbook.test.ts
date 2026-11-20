import { describe, expect, it } from "vitest";
import { readClanWorkbook, type ClanSheet } from "./clan-import";
import { createClanWorkbook, planClanWorkbook } from "./clan-workbook";
import { consultanteFamily } from "./geno/fixtures";

const peopleWith = (rows: string[][]): ClanSheet => ({
  name: "Pessoas",
  header: ["ID da pessoa", "Nome"],
  rows,
});
const linksWith = (rows: string[][]): ClanSheet => ({
  name: "Vínculos",
  header: ["Origem", "Destino", "Tipo", "Natureza"],
  rows,
});

describe("conciliação da planilha do clã", () => {
  it("associa homônimos aos genitores escolhidos pelos IDs", () => {
    const preview = planClanWorkbook({
      peopleSheet: peopleWith([
        ["tio1", "Miguel"],
        ["tio2", "Miguel"],
        ["p1", "Rosa"],
        ["p2", "João"],
      ]),
      linksSheet: linksWith([
        ["p1", "tio1", "Filiação", "Biológico"],
        ["p2", "tio2", "Filiação", "Por confirmar"],
      ]),
      existingPeople: [],
      existingLinks: [],
      choices: {},
      replaceParentage: false,
    });
    expect(preview.blocking).toBe(false);
    expect(preview.plan.people.map(({ key, patch }) => [key, patch.full_name])).toEqual([
      ["tio1", "Miguel"],
      ["tio2", "Miguel"],
      ["p1", "Rosa"],
      ["p2", "João"],
    ]);
    expect(preview.plan.parentages.map(({ child_key, parents }) => [child_key, parents])).toEqual([
      ["tio1", [{ key: "p1", kind: "biological" }]],
      ["tio2", [{ key: "p2", kind: "unknown" }]],
    ]);
  });

  it("exige decisão explícita antes de conciliar um nome existente", () => {
    const { persons, rels } = consultanteFamily();
    const pai = persons.find(({ full_name }) => full_name === "Pai")!;
    const input = {
      peopleSheet: peopleWith([["gerador", "Pai"]]),
      existingPeople: persons,
      existingLinks: rels,
      replaceParentage: false,
    };
    const pending = planClanWorkbook({ ...input, choices: {} });
    expect(pending.blocking).toBe(true);
    expect(pending.people[0].candidates.map(({ id }) => id)).toEqual([pai.id]);
    const reviewed = planClanWorkbook({ ...input, choices: { gerador: pai.id } });
    expect(reviewed.blocking).toBe(false);
    expect(reviewed.plan.people[0]).toMatchObject({ person_id: pai.id, key: "gerador", patch: {} });
  });

  it("bloqueia ampliação de uma filiação com dois pais até aprovar a substituição", () => {
    const { persons, rels } = consultanteFamily();
    const first = persons.find(({ full_name }) => full_name === "Avô paterno")!;
    const planned = persons.find(({ full_name }) => full_name === "Avó materna")!;
    const child = persons.find(({ full_name }) => full_name === "Pai")!;
    const input = {
      peopleSheet: peopleWith([]),
      linksSheet: linksWith([
        [first.id, child.id, "parent", "biological"],
        [planned.id, child.id, "parent", "biological"],
      ]),
      existingPeople: persons,
      existingLinks: rels,
      choices: {},
    };
    expect(planClanWorkbook({ ...input, replaceParentage: false }).blocking).toBe(true);
    const approved = planClanWorkbook({ ...input, replaceParentage: true });
    expect(approved.blocking).toBe(false);
    expect(approved.plan.parentages[0].expected).toHaveLength(2);
    expect(approved.plan.parentages[0].parents.map(({ key }) => key)).toEqual([
      first.id,
      planned.id,
    ]);
  });

  it("reabre a exportação da árvore inteira sem criar nem alterar familiares", async () => {
    const { persons, rels } = consultanteFamily();
    persons[5].birth_date_partial = "1923–1925";
    const workbook = await createClanWorkbook(persons, rels);
    const XLSX = await import("xlsx");
    const [peopleSheet, linksSheet] = await readClanWorkbook(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
      "xlsx",
    );
    expect(peopleSheet.rows).toHaveLength(35);
    expect(linksSheet.rows).toHaveLength(53);
    const preview = planClanWorkbook({
      peopleSheet,
      linksSheet,
      existingPeople: persons,
      existingLinks: rels,
      choices: {},
      replaceParentage: true,
    });
    expect(preview.blocking).toBe(false);
    expect(preview.actionable).toBe(false);
    expect(preview.plan.parentages).toEqual([]);
  });
});
