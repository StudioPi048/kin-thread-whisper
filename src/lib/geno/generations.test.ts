import { describe, it, expect } from "vitest";
import { buildLogicalGraph, layoutGraph, genY, GEN_GAP } from "./build";
import { checkLayoutInvariants } from "./verify";
import { LayoutHistory } from "./layout-history";
import { constrainSnapshotY } from "./layout-history";
import type { PersonRow } from "@/lib/patterns";

// Famílias 100% sintéticas
let n = 0;
function p(name: string, extra: Partial<PersonRow> = {}): PersonRow {
  n++;
  return {
    id: `s${n}`,
    client_id: "c",
    full_name: name,
    preferred_name: null,
    gender: null,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    is_proband: false,
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
    relationship_to_proband: null,
    temperament: null,
    vices: null,
    gestational_weeks: null,
    birth_order: null,
    ...extra,
  } as PersonRow;
}
const par = (from: string, to: string, qualifier: string | null = null) => ({
  id: `r_${from}_${to}`,
  client_id: "c",
  from_person_id: from,
  to_person_id: to,
  relationship_type: "parent",
  qualifier,
  start_date: null,
  end_date: null,
  notes: null,
  created_at: "",
  updated_at: "",
  marriage_order: null,
});
const shuffle = <T,>(a: T[], seed = 7) => {
  const r = [...a];
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

function threeGen() {
  n = 0;
  const cli = p("Cliente", { is_proband: true });
  const irmao = p("Irmão");
  const pai = p("Pai X");
  const mae = p("Mãe Y");
  const avoP = p("Avô A");
  const avaP = p("Avó B");
  const avoM = p("Avô C");
  const avaM = p("Avó D");
  const rels = [
    par(pai.id, cli.id),
    par(mae.id, cli.id),
    par(pai.id, irmao.id),
    par(mae.id, irmao.id),
    par(avoP.id, pai.id),
    par(avaP.id, pai.id),
    par(avoM.id, mae.id),
    par(avaM.id, mae.id),
  ];
  return { cli, irmao, pai, mae, avoP, avaP, avoM, avaM, persons: [cli, irmao, pai, mae, avoP, avaP, avoM, avaM], rels };
}

describe("gerações resolvidas só por filiação explícita (sem tags)", () => {
  it("três gerações, relações embaralhadas: cliente/irmão 0, pais 1, avós 2", () => {
    for (const seed of [1, 3, 11, 42]) {
      const f = threeGen();
      const g = buildLogicalGraph({ persons: shuffle(f.persons, seed), rels: shuffle(f.rels, seed + 1) as never, probandId: f.cli.id });
      const gen = (id: string) => g.persons.get(id)!.generation;
      expect(gen(f.cli.id)).toBe(0);
      expect(gen(f.irmao.id)).toBe(0);
      expect(gen(f.pai.id)).toBe(1);
      expect(gen(f.mae.id)).toBe(1);
      for (const a of [f.avoP, f.avaP, f.avoM, f.avaM]) expect(gen(a.id)).toBe(2);
      const pl = layoutGraph(g);
      const bad = checkLayoutInvariants(g, pl).filter((v) => v.rule !== "SOBREPOSICAO");
      expect(bad).toEqual([]);
      expect(pl.personPos.get(f.cli.id)!.y).toBe(0);
      expect(pl.personPos.get(f.avoP.id)!.y).toBe(2 * GEN_GAP);
    }
  });

  it("meio-irmão: ambos os genitores ficam abaixo dele, em uniões distintas", () => {
    n = 0;
    const cli = p("Cliente", { is_proband: true });
    const meio = p("Meio-irmão");
    const pai = p("Pai");
    const mae = p("Mãe");
    const outra = p("Outra mãe");
    const rels = [par(outra.id, meio.id), par(pai.id, meio.id), par(pai.id, cli.id), par(mae.id, cli.id)];
    const g = buildLogicalGraph({ persons: [meio, outra, pai, mae, cli], rels: rels as never, probandId: cli.id });
    const pl = layoutGraph(g);
    const y = (id: string) => pl.personPos.get(id)!.y;
    expect(y(meio.id)).toBe(y(cli.id));
    expect(y(pai.id)).toBeGreaterThan(y(meio.id));
    expect(y(outra.id)).toBeGreaterThan(y(meio.id));
    const uOf = (id: string) => g.edges.find((e) => e.kind === "child" && e.personId === id)!.unionId;
    expect(uOf(meio.id)).not.toBe(uOf(cli.id));
  });

  it("ciclo/contradição gera erro explícito sem estourar pilha", () => {
    n = 0;
    const a = p("A", { is_proband: true });
    const b = p("B");
    const c = p("C");
    const rels = [par(a.id, b.id), par(b.id, c.id), par(c.id, a.id)];
    const g = buildLogicalGraph({ persons: [a, b, c], rels: rels as never, probandId: a.id });
    expect(g.errors.some((e) => /contradit/i.test(e))).toBe(true);
    const pl = layoutGraph(g);
    expect([...pl.personPos.values()].every((v) => v.y >= 0)).toBe(true);
  });

  it("mais de 2 genitores: erro visível, nada descartado em silêncio", () => {
    n = 0;
    const cli = p("Cliente", { is_proband: true });
    const ps = [p("G1"), p("G2"), p("G3")];
    const g = buildLogicalGraph({ persons: [cli, ...ps], rels: ps.map((x) => par(x.id, cli.id)) as never, probandId: cli.id });
    expect(g.errors.some((e) => /3 genitores/.test(e))).toBe(true);
    expect(g.persons.size).toBe(4);
  });

  it("qualifier de adoção vira childKind adoptive", () => {
    n = 0;
    const cli = p("Cliente", { is_proband: true });
    const m = p("Mãe adotiva");
    const g = buildLogicalGraph({ persons: [cli, m], rels: [par(m.id, cli.id, "adotiva")] as never, probandId: cli.id });
    expect(g.edges.find((e) => e.kind === "child" && e.personId === cli.id)?.childKind).toBe("adoptive");
  });
});

describe("faixa Y fixa por geração (layout salvo, arrasto, rascunho)", () => {
  it("layout salvo invertido é normalizado: X preservado, Y na faixa da geração", () => {
    const f = threeGen();
    const positions = [
      { node_id: f.cli.id, node_type: "person", x: 999, y: 2000 },
      { node_id: f.avoP.id, node_type: "person", x: -555, y: -800 },
    ] as never;
    const g = buildLogicalGraph({ persons: f.persons, rels: f.rels as never, probandId: f.cli.id, positions });
    const pl = layoutGraph(g);
    expect(pl.personPos.get(f.cli.id)).toEqual({ x: 999, y: 0 });
    expect(pl.personPos.get(f.avoP.id)).toEqual({ x: -555, y: genY(2) });
    expect(pl.normalizedY).toBe(2);
    const orientation = ["FORA_DA_FAIXA_DA_GERACAO", "ACIMA_DO_CLIENTE", "GENITOR_ACIMA_DO_FILHO", "GERACAO_FILHO_INCOERENTE", "GERACAO_CASAL_INCOERENTE"];
    expect(checkLayoutInvariants(g, pl).filter((v) => orientation.includes(v.rule))).toEqual([]);
  });

  it("rascunho/undo inválido só aplica X; Y continua da geração", () => {
    const current = { a: [10, 0] as [number, number], b: [20, 320] as [number, number] };
    const draft = { a: [50, 900] as [number, number], b: [70, -10] as [number, number], ghost: [1, 1] as [number, number] };
    expect(constrainSnapshotY(draft, current)).toEqual({ a: [50, 0], b: [70, 320] });
    const h = new LayoutHistory();
    h.push(draft);
    expect(constrainSnapshotY(h.undo(current)!, current).a[1]).toBe(0);
  });
});
