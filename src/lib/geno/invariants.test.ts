import { describe, it, expect } from "vitest";
import {
  buildLogicalGraph,
  genY,
  getResolvedParents,
  layoutGraph,
  type LogicalGraph,
} from "./build";
import type { PersonRow } from "@/lib/patterns";

let n = 0;
function p(rel: string, name = rel, extra: Partial<PersonRow> = {}): PersonRow {
  n++;
  return {
    id: `p${n}`,
    client_id: "c",
    full_name: name,
    preferred_name: null,
    gender: null,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    is_proband: rel === "Consulente",
    occupation: null,
    notes: null,
    tags: [],
    position_x: 0,
    position_y: 0,
    created_at: "",
    updated_at: "",
    cause_of_death: null,
    health_conditions: [],
    life_events: [],
    relationship_to_proband: rel,
    temperament: null,
    vices: null,
    gestational_weeks: null,
    birth_order: null,
    ...extra,
  } as PersonRow;
}
const parentUnion = (g: LogicalGraph, id: string) =>
  g.edges.find((e) => e.kind === "child" && e.personId === id)?.unionId;

function family() {
  n = 0;
  const persons = [
    p("Consulente", "Cliente"),
    p("Irmã(o)", "Irmã"),
    p("Irmã(o)", "Irmão"),
    p("Pai"),
    p("Mãe"),
    p("Avô paterno"),
    p("Avó paterna"),
    p("Avô materno"),
    p("Avó materna"),
  ];
  const g = buildLogicalGraph({ persons, rels: [] });
  return { persons, g, pl: layoutGraph(g) };
}

describe("genossociograma: cliente e irmãos no topo", () => {
  it("cliente é geração 0 e fica em y=0 (topo)", () => {
    const { g, pl } = family();
    expect(g.persons.get(g.probandId!)!.generation).toBe(0);
    const ys = [...pl.personPos.values()].map((v) => v.y);
    expect(pl.personPos.get(g.probandId!)!.y).toBe(Math.min(...ys));
  });
  it("irmãos ficam na mesma linha do cliente", () => {
    const { persons, pl } = family();
    const y0 = pl.personPos.get(persons[0].id)!.y;
    expect(pl.personPos.get(persons[1].id)!.y).toBe(y0);
    expect(pl.personPos.get(persons[2].id)!.y).toBe(y0);
  });
  it("pais abaixo do cliente e avós abaixo dos pais (Y cresce para baixo)", () => {
    const { persons, pl } = family();
    const y = (i: number) => pl.personPos.get(persons[i].id)!.y;
    expect(y(3)).toBeGreaterThan(y(0));
    expect(y(4)).toBeGreaterThan(y(0));
    expect(y(5)).toBeGreaterThan(y(3));
    expect(y(8)).toBeGreaterThan(y(4));
  });
  it("cliente e irmãos são filhos da MESMA união Pai+Mãe", () => {
    const { persons, g } = family();
    const u = parentUnion(g, persons[0].id)!;
    expect(u).toBeTruthy();
    expect(parentUnion(g, persons[1].id)).toBe(u);
    expect(parentUnion(g, persons[2].id)).toBe(u);
    expect(new Set(g.unions.get(u)!.partners)).toEqual(new Set([persons[3].id, persons[4].id]));
  });
  it("pai liga-se à união dos avós paternos; mãe à dos maternos", () => {
    const { persons, g } = family();
    const up = g.unions.get(parentUnion(g, persons[3].id)!)!;
    const um = g.unions.get(parentUnion(g, persons[4].id)!)!;
    expect(new Set(up.partners)).toEqual(new Set([persons[5].id, persons[6].id]));
    expect(new Set(um.partners)).toEqual(new Set([persons[7].id, persons[8].id]));
  });
});

describe("múltiplas uniões", () => {
  it("união com marriage_order 2 recebe rótulo de 2º casamento", () => {
    n = 0;
    const persons = [p("Consulente"), p("Pai"), p("Mãe")];
    const rels = [
      {
        id: "r",
        client_id: "c",
        from_person_id: persons[1].id,
        to_person_id: persons[2].id,
        relationship_type: "union",
        qualifier: null,
        start_date: null,
        end_date: null,
        notes: null,
        created_at: "",
        updated_at: "",
        marriage_order: 2,
      },
    ];
    const g = buildLogicalGraph({ persons, rels: rels as never });
    const u = g.unions.get(parentUnion(g, persons[0].id)!)!;
    expect(u.label).toBe("2º casamento");
  });
});

const rel = (
  from: string,
  to: string,
  type: "parent" | "union",
  extra: Record<string, unknown> = {},
) => ({
  id: `r_${from}_${to}_${type}`,
  client_id: "c",
  from_person_id: from,
  to_person_id: to,
  relationship_type: type,
  qualifier: null,
  start_date: null,
  end_date: null,
  notes: null,
  created_at: "",
  updated_at: "",
  marriage_order: null,
  ...extra,
});

describe("filiação explícita, meios-irmãos e órfãos", () => {
  function setup() {
    n = 0;
    const cli = p("Consulente", "Cliente");
    const irma = p("Irmã(o)", "Irmã");
    const pai = p("Pai");
    const mae = p("Mãe");
    const outra = p("", "Segunda esposa do pai");
    const meio = p("", "Meio-irmão");
    const avo = p("Avô paterno");
    const orfao = p("Irmã(o) do avô materno", "Tio-avô solto");
    const persons = [cli, irma, pai, mae, outra, meio, avo, orfao];
    const rels = [
      rel(pai.id, meio.id, "parent"),
      rel(outra.id, meio.id, "parent"),
      rel(pai.id, outra.id, "union", { marriage_order: 2 }),
    ];
    const g = buildLogicalGraph({ persons, rels: rels as never });
    return { g, pl: layoutGraph(g), cli, irma, pai, mae, outra, meio, avo, orfao, persons };
  }

  it("cliente e irmãos continuam no topo; pais e avós abaixo", () => {
    const { pl, cli, irma, pai, avo } = setup();
    const Y = (x: PersonRow) => pl.personPos.get(x.id)!.y;
    const minY = Math.min(...[...pl.personPos.values()].map((v) => v.y));
    expect(Y(cli)).toBe(minY);
    expect(Y(irma)).toBe(Y(cli));
    expect(Y(pai)).toBeGreaterThan(Y(cli));
    expect(Y(avo)).toBeGreaterThan(Y(pai));
  });

  it("meio-irmão fica na união Pai+Segunda esposa, não na de Pai+Mãe", () => {
    const { g, cli, meio, pai, outra } = setup();
    const uCli = parentUnion(g, cli.id)!;
    const uMeio = parentUnion(g, meio.id)!;
    expect(uMeio).toBeTruthy();
    expect(uMeio).not.toBe(uCli);
    expect(new Set(g.unions.get(uMeio)!.partners)).toEqual(new Set([pai.id, outra.id]));
    expect(g.unions.get(uMeio)!.label).toBe("2º casamento");
  });

  it("meio-irmão na mesma linha do cliente (geração 0)", () => {
    const { pl, cli, meio } = setup();
    expect(pl.personPos.get(meio.id)!.y).toBe(pl.personPos.get(cli.id)!.y);
  });

  it("órfão não recebe pais falsos, aparece com aviso na geração reconhecida", () => {
    const { g, pl, orfao, avo } = setup();
    expect(parentUnion(g, orfao.id)).toBeUndefined();
    expect(g.warnings.some((w) => w.personId === orfao.id)).toBe(true);
    expect(pl.personPos.get(orfao.id)!.y).toBe(pl.personPos.get(avo.id)!.y);
  });

  it("ninguém duplicado nem perdido; cada filho em uma única união", () => {
    const { g, pl, persons } = setup();
    for (const x of persons) expect(pl.personPos.has(x.id)).toBe(true);
    const childEdges = g.edges.filter((e) => e.kind === "child").map((e) => e.personId);
    expect(new Set(childEdges).size).toBe(childEdges.length);
  });

  it("duas uniões do mesmo genitor têm filhos distintos", () => {
    const { g, pai } = setup();
    const us = [...g.unions.values()].filter(
      (u) => u.partners.includes(pai.id) && u.partners.length === 2,
    );
    expect(us.length).toBe(2);
    const [a, b] = us.map((u) => new Set(u.children));
    for (const c of a) expect(b.has(c)).toBe(false);
  });

  it("filiação explícita tem precedência sobre a tag", () => {
    n = 0;
    const cli = p("Consulente");
    const pai = p("Pai");
    const mae = p("Mãe");
    const x = p("Irmã(o)", "Irmão só por pai");
    const g = buildLogicalGraph({
      persons: [cli, pai, mae, x],
      rels: [rel(pai.id, x.id, "parent")] as never,
    });
    const u = g.unions.get(parentUnion(g, x.id)!)!;
    expect(u.partners).toEqual([pai.id]);
    expect(parentUnion(g, cli.id)).not.toBe(u.id);
  });
});

import { checkLayoutInvariants } from "./verify";
describe("sem sobreposição de cartões", () => {
  it("família com meio-irmão e órfão não sobrepõe cartões", () => {
    n = 0;
    const cli = p("Consulente"),
      pai = p("Pai"),
      mae = p("Mãe"),
      outra = p("", "Outra"),
      meio = p("", "Meio");
    const orf = p("Avó materna", "Avó");
    const g = buildLogicalGraph({
      persons: [cli, pai, mae, outra, meio, orf],
      rels: [rel(pai.id, meio.id, "parent"), rel(outra.id, meio.id, "parent")] as never,
    });
    const v = checkLayoutInvariants(g, layoutGraph(g)).filter((x) => x.rule.includes("SOBREP"));
    expect(v).toEqual([]);
  });
});

describe("filiações confiáveis no mapa ampliado", () => {
  it("liga tios-avós e tios-bisavós à linha certa mesmo com nomes iguais", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const mae = p("Mãe");
    const avo = p("Avô paterno", "Miguel");
    const avoMat = p("Avô materno", "Miguel");
    const tioAvo = p("Irmã(o) do avô paterno", "Miguel");
    const tioAvoMat = p("Irmã(o) do avô materno", "Miguel");
    const biso = p("Bisavô paterno (pai do avô)", "Miguel");
    const bisoMat = p("Bisavô materno (pai do avô)", "Miguel");
    const tioBiso = p("Irmã(o) do Bisavô paterno (pai do avô)", "Miguel");
    const tri = p("", "Genitor cadastrado do bisavô paterno");
    const duplication = p("Bisavô paterno (pai do avô)", "Miguel");
    const indefinido = p("Irmã(o) da Bisavó materna (mãe do avô)", "Miguel");

    const persons = [
      duplication,
      tioBiso,
      bisoMat,
      biso,
      tioAvoMat,
      avo,
      cli,
      pai,
      mae,
      avoMat,
      tioAvo,
      tri,
      indefinido,
    ];
    const rels = [
      rel(biso.id, avo.id, "parent"),
      rel(tri.id, biso.id, "parent"),
      rel(biso.id, tioAvo.id, "parent"),
      rel(bisoMat.id, tioAvoMat.id, "parent"),
      rel(tri.id, tioBiso.id, "parent"),
    ];
    const graph = buildLogicalGraph({ persons, rels: rels as never });
    expect(getResolvedParents(graph, tioAvo.id)).toMatchObject([
      { personId: biso.id, kind: "biological", source: "explicit" },
    ]);
    expect(getResolvedParents(graph, tioAvoMat.id).map((x) => x.personId)).toEqual([bisoMat.id]);
    expect(getResolvedParents(graph, tioBiso.id).map((x) => x.personId)).toEqual([tri.id]);
    expect(getResolvedParents(graph, duplication.id)).toEqual([]);
    expect(graph.pendingPersonIds.has(duplication.id)).toBe(true);
    expect(getResolvedParents(graph, indefinido.id)).toEqual([]);
    expect(graph.pendingPersonIds.has(indefinido.id)).toBe(true);

    const layout = layoutGraph(graph);
    const rootX = layout.personPos.get(cli.id)!.x;
    expect(layout.personPos.get(tioAvo.id)!.x).toBeLessThan(rootX);
    expect(layout.personPos.get(tioAvoMat.id)!.x).toBeGreaterThan(rootX);
    expect(layout.personPos.get(tioBiso.id)!.y).toBe(genY(3));
    expect(layout.personPos.get(tri.id)!.y).toBe(genY(4));
    expect(checkLayoutInvariants(graph, layout)).toEqual([]);
  });

  it("deixa candidatos ambíguos sem conexão até confirmação por ID", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const avoA = p("Avô paterno", "Carlos");
    const avoB = p("Avô paterno", "Carlos");
    const biso = p("Bisavô paterno (pai do avô)");
    const tioAvo = p("Irmã(o) do avô paterno");
    const indefinido = p("Irmão do avô");
    const persons = [cli, pai, avoA, avoB, biso, tioAvo, indefinido];

    for (const list of [persons, [...persons].reverse()]) {
      const graph = buildLogicalGraph({ persons: list, rels: [] });
      for (const person of [pai, avoA, avoB, tioAvo, indefinido]) {
        expect(getResolvedParents(graph, person.id), person.full_name).toEqual([]);
      }
      expect(graph.pendingPersonIds.has(tioAvo.id)).toBe(true);
      expect(graph.pendingPersonIds.has(indefinido.id)).toBe(true);
    }
  });

  it("uma etiqueta de colateral não copia os pais do ancestral conhecido", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const avo = p("Avô paterno");
    const biso = p("Bisavô paterno (pai do avô)");
    const tioAvo = p("Irmã(o) do avô paterno");
    const graph = buildLogicalGraph({ persons: [cli, pai, avo, biso, tioAvo], rels: [] });
    expect(getResolvedParents(graph, avo.id).map((link) => link.personId)).toEqual([biso.id]);
    expect(getResolvedParents(graph, tioAvo.id)).toEqual([]);
    expect(graph.pendingPersonIds.has(tioAvo.id)).toBe(true);
    expect(graph.persons.get(tioAvo.id)!.generation).toBe(2);
  });

  it("só coloca irmão sem pais no topo quando o parentesco biológico foi declarado", () => {
    const cli = p("Consulente");
    const irmaoSemDados = p("Irmã(o)");
    const irmaoDeclarado = p("Irmão de sangue");
    const graph = buildLogicalGraph({ persons: [cli, irmaoSemDados, irmaoDeclarado], rels: [] });
    expect(graph.topRowIds).toEqual(new Set([cli.id, irmaoDeclarado.id]));
    expect(graph.pendingPersonIds.has(irmaoSemDados.id)).toBe(true);
    expect(getResolvedParents(graph, irmaoDeclarado.id)).toEqual([]);
  });

  it("mantém irmãos adotivos, cônjuge e descendentes literais abaixo do topo", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const mae = p("Mãe");
    const avo = p("Avô paterno");
    const sangue = p("Irmã(o)");
    const meio = p("Meio-irmã");
    const adocao = p("Irmã(o)", "Irmã adotiva");
    const outraMae = p("");
    const conjuge = p("Cônjuge");
    const filha = p("Filho(a)");
    const neta = p("Neta");
    const rels = [
      rel(pai.id, meio.id, "parent"),
      rel(outraMae.id, meio.id, "parent"),
      rel(pai.id, adocao.id, "parent", { qualifier: "adoptive" }),
      rel(cli.id, conjuge.id, "union"),
      rel(cli.id, filha.id, "parent"),
      rel(conjuge.id, filha.id, "parent"),
      rel(filha.id, neta.id, "parent"),
    ];
    const graph = buildLogicalGraph({
      persons: [cli, pai, mae, avo, sangue, meio, adocao, outraMae, conjuge, filha, neta],
      rels: rels as never,
    });
    expect(graph.topRowIds).toEqual(new Set([cli.id, sangue.id, meio.id]));
    expect(graph.persons.get(adocao.id)!.lane).toBe("social");
    expect(graph.persons.get(conjuge.id)!.lane).toBe("social");
    expect(graph.persons.get(avo.id)!.generation).toBe(2);
    expect(getResolvedParents(graph, adocao.id)).toMatchObject([
      { personId: pai.id, kind: "adoptive", source: "explicit" },
    ]);
    expect(
      getResolvedParents(graph, filha.id)
        .map((link) => link.personId)
        .sort(),
    ).toEqual([cli.id, conjuge.id].sort());
    expect(graph.persons.get(filha.id)!.lane).toBe("descendant");
    expect(graph.persons.get(filha.id)!.generation).toBeGreaterThan(2);
    expect(graph.unions.get(parentUnion(graph, filha.id)!)!.direction).toBe("down");
    expect(graph.persons.get(neta.id)!.generation).toBeGreaterThan(
      graph.persons.get(filha.id)!.generation,
    );
    expect(checkLayoutInvariants(graph, layoutGraph(graph))).toEqual([]);
  });

  it("um meio-irmão paterno legado recebe só o pai conhecido e filho do consulente desce em faixa própria", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const mae = p("Mãe");
    const meiaIrma = p("Meia-irmã paterna");
    const filho = p("Filho(a)");
    const social = p("Irmão de criação");
    const graph = buildLogicalGraph({
      persons: [cli, pai, mae, meiaIrma, filho, social],
      rels: [],
    });
    expect(graph.topRowIds).toEqual(new Set([cli.id, meiaIrma.id]));
    expect(getResolvedParents(graph, meiaIrma.id)).toMatchObject([
      { personId: pai.id, source: "legacy" },
    ]);
    expect(getResolvedParents(graph, filho.id)).toMatchObject([
      { personId: cli.id, source: "legacy" },
    ]);
    expect(getResolvedParents(graph, social.id)).toEqual([]);
    expect(graph.persons.get(social.id)!.lane).toBe("social");
    expect(graph.persons.get(filho.id)!.lane).toBe("descendant");
    expect(checkLayoutInvariants(graph, layoutGraph(graph))).toEqual([]);
  });

  it("não substitui um conflito explícito por uma filiação presumida", () => {
    const cli = p("Consulente");
    const pai = p("Pai");
    const mae = p("Mãe");
    const hr = p("Irmã(o)");
    const xs = [p(""), p(""), p("")];
    const graph = buildLogicalGraph({
      persons: [cli, pai, mae, hr, ...xs],
      rels: xs.map((x) => rel(x.id, hr.id, "parent")) as never,
    });
    expect(graph.errors.join(" ")).toMatch(/3 genitores/);
    expect(getResolvedParents(graph, hr.id)).toEqual([]);
    expect(graph.topRowIds.has(hr.id)).toBe(false);
    expect(graph.pendingPersonIds.has(hr.id)).toBe(true);
  });
});
