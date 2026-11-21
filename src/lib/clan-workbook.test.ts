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

  it("valida a árvore final para qualquer ordem das substituições de filiação", () => {
    const { persons, rels } = consultanteFamily();
    const [first, second, third] = persons.slice(-3);
    const stored = {
      ...rels.find((link) => link.relationship_type === "parent")!,
      from_person_id: second.id,
      to_person_id: first.id,
    };
    const rows = [
      [first.id, second.id, "parent", "biological"],
      [third.id, first.id, "parent", "biological"],
    ];
    const preview = (links: string[][]) =>
      planClanWorkbook({
        peopleSheet: peopleWith([]),
        linksSheet: linksWith(links),
        existingPeople: persons,
        existingLinks: [stored],
        choices: {},
        replaceParentage: true,
      });
    expect(preview(rows).blocking).toBe(false);
    expect(preview([...rows].reverse()).blocking).toBe(false);
    expect(preview([...rows, [second.id, third.id, "parent", "biological"]]).blocking).toBe(true);
  });

  it("permite trocar ordinais do mesmo casal e aponta uma ordem repetida", () => {
    const { persons, rels } = consultanteFamily();
    const union = rels.find(({ relationship_type }) => relationship_type === "union")!;
    const existingLinks = [
      { ...union, marriage_order: 1 },
      { ...union, id: "another-union", marriage_order: 2 },
    ];
    const preview = (orders: number[]) =>
      planClanWorkbook({
        peopleSheet: peopleWith([]),
        linksSheet: {
          name: "Vínculos",
          header: ["ID do vínculo", "Origem", "Destino", "Tipo", "Natureza", "Ordem da união"],
          rows: orders.map((order, index) => [
            existingLinks[index].id,
            union.from_person_id,
            union.to_person_id,
            "union",
            union.qualifier ?? "",
            String(order),
          ]),
        },
        existingPeople: persons,
        existingLinks,
        choices: {},
        replaceParentage: false,
      });
    expect(preview([2, 1]).blocking).toBe(false);
    expect(preview([2]).blocking).toBe(true);
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

  it("reimporta o modelo parcialmente preenchido e mantém uma ficha sem nome que já tem dados", async () => {
    const { persons, rels } = consultanteFamily();
    const empty = {
      ...persons[1],
      id: "reserved",
      full_name: "",
      birth_date: null,
      birth_order: null,
    };
    const partial = { ...empty, id: "partial", notes: "Informação a conferir" };
    const existingPeople = [...persons, empty, partial];
    const workbook = await createClanWorkbook(existingPeople, rels);
    const XLSX = await import("xlsx");
    const [peopleSheet, linksSheet] = await readClanWorkbook(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
      "xlsx",
    );
    expect(peopleSheet.rows.some((row) => row[0] === empty.id)).toBe(false);
    expect(peopleSheet.rows.some((row) => row[0] === partial.id)).toBe(true);
    peopleSheet.rows.find((row) => row[0] === persons[1].id)![1] = "Nome corrigido";
    const preview = planClanWorkbook({
      peopleSheet,
      linksSheet,
      existingPeople,
      existingLinks: rels,
      choices: {},
      replaceParentage: false,
    });
    expect(preview.blocking).toBe(false);
    expect(preview.people.find(({ key }) => key === partial.id)?.state).toBe("keep");
    expect(preview.plan.people.find(({ key }) => key === persons[1].id)?.patch.full_name).toBe(
      "Nome corrigido",
    );
  });

  it("compara as datas exatas com a ficha salva antes de confirmar a importação", () => {
    const { persons } = consultanteFamily();
    const saved = { ...persons[1], birth_date: "1950-01-01", death_date: "2021-01-01" };
    const preview = planClanWorkbook({
      peopleSheet: {
        name: "Pessoas",
        header: ["ID da pessoa", "Nome", "Nascimento"],
        rows: [[saved.id, saved.full_name, "2024-01-01"]],
      },
      existingPeople: [saved],
      existingLinks: [],
      choices: {},
      replaceParentage: false,
    });
    expect(preview.blocking).toBe(true);
    expect(preview.people[0]).toMatchObject({ line: 2, name: saved.full_name, state: "error" });
    expect(preview.people[0].changes.join(" ")).toContain("Nascimento e Falecimento");
    expect(preview.plan.people).toHaveLength(0);
  });

  it("transporta duas uniões com os mesmos participantes e preserva a ordem em arquivo antigo", async () => {
    const { persons, rels } = consultanteFamily();
    const first = rels.find((rel) => rel.relationship_type === "union")!;
    const unions = [
      { ...first, marriage_order: 1 },
      { ...first, id: "next-union", marriage_order: 2 },
    ];
    const workbook = await createClanWorkbook(persons, unions);
    const XLSX = await import("xlsx");
    const [peopleSheet, linksSheet] = await readClanWorkbook(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
      "xlsx",
    );
    const input = { peopleSheet, linksSheet, choices: {}, replaceParentage: false };
    const transfer = planClanWorkbook({
      ...input,
      existingPeople: [persons[0]],
      existingLinks: [],
    });
    expect(transfer.blocking).toBe(false);
    expect(transfer.plan.links.map(({ key, marriage_order }) => [key, marriage_order])).toEqual([
      [unions[0].id, 1],
      [unions[1].id, 2],
    ]);
    const legacyLink = {
      ...linksSheet,
      header: linksSheet.header.slice(0, -1),
      rows: [linksSheet.rows[1].slice(0, -1)],
    };
    const legacy = planClanWorkbook({
      ...input,
      linksSheet: legacyLink,
      existingPeople: persons,
      existingLinks: unions,
    });
    expect(legacy.blocking).toBe(false);
    expect(legacy.plan.links).toHaveLength(0);
  });
});
