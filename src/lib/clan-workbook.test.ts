import { describe, expect, it } from "vitest";
import { readClanWorkbook, type ClanSheet } from "./clan-import";
import {
  createClanWorkbook,
  getClanPersonKey,
  isClanParentageSheet,
  planClanWorkbook,
  type WorkbookParentageReview,
} from "./clan-workbook";
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

async function serializedPlanInput(...args: Parameters<typeof createClanWorkbook>) {
  const XLSX = await import("xlsx");
  const workbook = await createClanWorkbook(...args);
  const [peopleSheet, linksSheet, reviewSheet] = await readClanWorkbook(
    XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    "xlsx",
  );
  return { peopleSheet, linksSheet, reviewSheet };
}

function reviewedFamily() {
  const { persons, rels } = consultanteFamily();
  const proband = { ...persons.find((person) => person.is_proband)!, parentage_reviewed: true };
  const relationships = rels
    .filter((link) => link.relationship_type === "parent" && link.to_person_id === proband.id)
    .map((link, index) => ({
      ...link,
      qualifier: index ? "foster" : null,
      start_date: index ? null : "1984-01-15",
      end_date: index ? "2013-06-10" : null,
      notes: index ? null : "  Informação preservada\nSegunda linha",
    }));
  const parents = relationships.map((link, index) => ({
    ...persons.find((person) => person.id === link.from_person_id)!,
    parentage_reviewed: index === 0,
  }));
  const makeReview = (id: string, number: number, child: string, links: typeof relationships) =>
    ({
      id,
      review_number: number,
      client_id: proband.client_id,
      child_id: child,
      professional_id: "profissional-teste",
      decision: "confirm",
      source: "document",
      note: "Documento sintético conferido",
      before_links: [],
      after_links: links,
      before_reviewed: false,
      after_reviewed: true,
      undone_review_id: null,
      created_at: "2026-11-20T12:34:59.742619+00:00",
      workbook_import: false,
      imported_review_key: null,
      imported_review_created_at: null,
      imported_review_decision: null,
    }) satisfies WorkbookParentageReview;
  const review = makeReview("revisao-corrente", 3, proband.id, relationships);
  const noParents = makeReview("revisao-sem-genitores", 4, parents[0].id, []);
  const history = [
    { ...review, id: "revisao-antiga", review_number: 1, note: "Histórico anterior" },
    review,
    noParents,
  ];
  return { people: [proband, ...parents], relationships, history, review, noParents };
}

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

  it("reimporta o XLSX nativo no mesmo caso sem regravar filiações ou revisões", async () => {
    const { people, relationships, history } = reviewedFamily();
    const sheets = await serializedPlanInput(people, relationships, history);
    expect(isClanParentageSheet(sheets.reviewSheet)).toBe(true);
    expect(sheets.reviewSheet.rows).toHaveLength(people.length);
    expect(JSON.stringify(sheets.reviewSheet.rows)).not.toContain("revisao-antiga");
    expect(JSON.stringify(sheets.reviewSheet.rows)).toContain("revisao-sem-genitores");
    const sameDossier = planClanWorkbook({
      ...sheets,
      existingPeople: people,
      existingLinks: relationships,
      existingReviews: history,
      choices: {},
      replaceParentage: false,
    });
    expect(sameDossier.blocking).toBe(false);
    expect(sameDossier.actionable).toBe(false);
    expect(sameDossier.plan.parentages).toEqual([]);
  });

  it("transporta ID lógico, natureza nula, datas, notas, estado sem pais e proveniência entre casos", async () => {
    const { people, relationships, history, review, noParents } = reviewedFamily();
    const sheets = await serializedPlanInput(people, relationships, history);
    const [proband, ...parents] = people;
    const mappedProband = { ...proband, id: "consultante-destino", parentage_reviewed: false };
    const request = { ...sheets, choices: {}, replaceParentage: false };
    const transfer = planClanWorkbook({
      ...request,
      existingPeople: [mappedProband],
      existingLinks: [],
    });
    expect(transfer.blocking).toBe(false);
    expect(transfer.plan.parentages).toHaveLength(2);
    expect(
      transfer.plan.parentages.find(({ child_key }) => child_key === "consultante"),
    ).toMatchObject({
      expected_reviewed: false,
      expected_review_id: null,
      expected: [],
      parents: relationships.map((link, index) => ({
        key: getClanPersonKey(parents[index]),
        kind: link.qualifier,
        link: {
          key: link.id,
          relationship_id: null,
          expected_updated_at: null,
          start_date: link.start_date,
          end_date: link.end_date,
          notes: link.notes,
        },
      })),
      restore: {
        reviewed: true,
        review: {
          original_id: review.id,
          original_created_at: review.created_at,
          decision: review.decision,
          source: review.source,
          note: review.note,
        },
      },
    });
    expect(
      transfer.plan.parentages.find(({ child_key }) => child_key === parents[0].id),
    ).toMatchObject({
      parents: [],
      restore: { reviewed: true, review: { original_id: noParents.id } },
    });

    const destinationPeople = [
      mappedProband,
      ...parents.map((person, index) => ({
        ...person,
        id: `destino-${index}`,
        clan_reference: getClanPersonKey(person),
      })),
    ].map((person) => ({
      ...person,
      parentage_reviewed: person.id === mappedProband.id || person.parentage_reviewed,
    }));
    const destinationLinks = relationships.map((link, index) => ({
      ...link,
      id: `vinculo-destino-${index}`,
      from_person_id: destinationPeople[index + 1].id,
      to_person_id: mappedProband.id,
      updated_at: "2026-11-21T17:00:00+00:00",
      clan_reference: link.id,
    }));
    const destinationReviews = [review, noParents].map((entry, index) => ({
      ...entry,
      id: `registro-de-importacao-${index}`,
      child_id: destinationPeople[index].id,
      after_links: index ? [] : destinationLinks,
      created_at: "2026-11-21T17:00:00+00:00",
      workbook_import: true,
      imported_review_key: entry.id,
      imported_review_created_at: entry.created_at.replace("+00:00", "Z"),
      imported_review_decision: entry.decision,
    }));
    const roundtrip = planClanWorkbook({
      ...request,
      existingPeople: destinationPeople,
      existingLinks: destinationLinks,
      existingReviews: destinationReviews,
    });
    expect(roundtrip.blocking).toBe(false);
    expect(roundtrip.actionable).toBe(false);
    const exportedAgain = await serializedPlanInput(
      destinationPeople,
      destinationLinks,
      destinationReviews,
    );
    expect(exportedAgain.linksSheet.rows).toEqual(sheets.linksSheet.rows);
    expect(JSON.stringify(exportedAgain.reviewSheet.rows)).toContain(review.id);
    expect(JSON.stringify(exportedAgain.reviewSheet.rows)).not.toContain("registro-de-importacao");
  });

  it("bloqueia mudanças de identidade, datas inválidas e a remoção implícita de genitores", async () => {
    const { people, relationships, history } = reviewedFamily();
    const sheets = await serializedPlanInput(people, relationships, history);
    const input = {
      ...sheets,
      existingPeople: people,
      existingLinks: relationships,
      existingReviews: history,
      choices: {},
      replaceParentage: false,
    };
    const foreign = { ...relationships[0], clan_reference: "identidade-de-outra-origem" };
    const conflicting = planClanWorkbook({
      ...input,
      existingLinks: [foreign, ...relationships.slice(1)],
      linksSheet: {
        ...sheets.linksSheet,
        rows: [
          ["id-de-outro-arquivo", ...sheets.linksSheet.rows[0].slice(1)],
          ...sheets.linksSheet.rows.slice(1),
        ],
      },
    });
    expect(conflicting.relations.some(({ detail }) => detail.includes("outro ID lógico"))).toBe(
      true,
    );
    expect(conflicting.blocking).toBe(true);
    const invalid = planClanWorkbook({
      ...input,
      linksSheet: {
        ...sheets.linksSheet,
        rows: sheets.linksSheet.rows.map((row) => {
          const cells = [...row];
          cells[5] = "2024-02-30";
          return cells;
        }),
      },
    });
    expect(invalid.blocking).toBe(true);
    const hasExtra = planClanWorkbook({ ...input, linksSheet: { ...sheets.linksSheet, rows: [] } });
    expect(hasExtra.blocking).toBe(true);
    const approved = planClanWorkbook({
      ...input,
      linksSheet: { ...sheets.linksSheet, rows: [] },
      replaceParentage: true,
    });
    expect(approved.blocking).toBe(false);
    expect(
      approved.plan.parentages.find(({ child_key }) => child_key === "consultante"),
    ).toMatchObject({ parents: [], expected_review_id: "revisao-corrente" });
  });
});
