import { describe, expect, it } from "vitest";
import { buildLogicalGraph, layoutGraph } from "./build";
import { largeFamily, smallFamily, type SyntheticFamily } from "./fixtures";

function check(f: SyntheticFamily) {
  const g = buildLogicalGraph({ persons: f.persons, rels: f.rels as never, probandId: f.probandId });
  const pl = layoutGraph(g);
  return { g, pl };
}

for (const [name, make] of [
  ["pequena", smallFamily],
  ["grande", largeFamily],
] as const) {
  describe(`árvore ${name} (sintética)`, () => {
    const f = make();
    const { g, pl } = check(f);

    it("todas as pessoas aparecem posicionadas", () => {
      for (const p of f.persons) expect(pl.personPos.has(p.id), p.full_name).toBe(true);
    });
    it("cliente e irmãos ocupam o topo (menor Y)", () => {
      const minY = Math.min(...[...pl.personPos.values()].map((v) => v.y));
      const top = f.persons.filter((p) => p.is_proband || p.relationship_to_proband === "Irmã(o)");
      for (const p of top) expect(pl.personPos.get(p.id)!.y).toBe(minY);
    });
    it("todo filho fica acima dos seus genitores e ligado à união dos genitores corretos", () => {
      for (const r of f.rels) {
        const child = pl.personPos.get(r.to_person_id)!;
        const parent = pl.personPos.get(r.from_person_id)!;
        expect(child.y, `${r.to_person_id} acima de ${r.from_person_id}`).toBeLessThan(parent.y);
        const unionId = g.edges.find((e) => e.kind === "child" && e.personId === r.to_person_id)?.unionId;
        expect(unionId).toBeTruthy();
        expect(g.unions.get(unionId!)!.partners).toContain(r.from_person_id);
      }
    });
    it("nenhum familiar sem genitor declarado recebe pais", () => {
      const declared = new Set(f.rels.map((r) => r.to_person_id));
      for (const p of f.persons) {
        if (declared.has(p.id)) continue;
        expect(g.edges.some((e) => e.kind === "child" && e.personId === p.id), p.full_name).toBe(false);
      }
    });
  });
}
