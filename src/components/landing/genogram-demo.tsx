import { useMemo } from "react";
import { buildLogicalGraph, layoutGraph, NODE_W } from "@/lib/geno/build";
import { smallFamily } from "@/lib/geno/fixtures";

const BOX = 64; // tamanho do símbolo desenhado na demonstração

/**
 * Demonstração da landing: família SINTÉTICA desenhada pelo mesmo motor do app
 * (buildLogicalGraph + layoutGraph). Cliente e irmã no topo; pais e avós abaixo.
 */
export function GenogramDemo() {
  const { nodes, lines, vb } = useMemo(() => {
    const f = smallFamily();
    const g = buildLogicalGraph({ persons: f.persons, rels: f.rels as never, probandId: f.probandId });
    const pl = layoutGraph(g);
    const center = (id: string) => {
      const p = pl.personPos.get(id)!;
      return { x: p.x + NODE_W / 2, y: p.y + BOX / 2 };
    };
    const nodes = f.persons
      .filter((p) => pl.personPos.has(p.id))
      .map((p) => ({ p, c: center(p.id) }));
    const lines: { x1: number; y1: number; x2: number; y2: number; k: string }[] = [];
    for (const e of g.edges) {
      const u = pl.unionPos.get(e.unionId);
      if (!u || !pl.personPos.has(e.personId)) continue;
      const c = center(e.personId);
      if (e.kind === "partner") lines.push({ x1: c.x, y1: c.y, x2: u.x, y2: u.y, k: `p-${e.personId}-${e.unionId}` });
      else lines.push({ x1: u.x, y1: u.y, x2: c.x, y2: c.y + BOX / 2, k: `c-${e.personId}-${e.unionId}` });
    }
    const xs = nodes.map((n) => n.c.x);
    const ys = nodes.map((n) => n.c.y);
    const pad = 110;
    const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - 60} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + 160}`;
    return { nodes, lines, vb };
  }, []);

  return (
    <figure className="gv-family-example" aria-labelledby="demo-cap">
      <div className="gv-example-top">
        <span>Genossociograma</span>
        <span>Exemplo sintético · nomes fictícios</span>
      </div>
      <svg viewBox={vb} role="img" aria-label="Exemplo: cliente e irmã no topo, pais abaixo, avós paternos abaixo do pai" className="h-auto w-full">
        {lines.map((l) => (
          <line key={l.k} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" strokeOpacity={0.55} strokeWidth={3} />
        ))}
        {nodes.map(({ p, c }) => {
          const fem = p.gender === "F";
          return (
            <g key={p.id}>
              {fem ? (
                <circle cx={c.x} cy={c.y} r={BOX / 2} fill="var(--color-background, #fff)" stroke="currentColor" strokeWidth={p.is_proband ? 6 : 3} />
              ) : (
                <rect x={c.x - BOX / 2} y={c.y - BOX / 2} width={BOX} height={BOX} fill="var(--color-background, #fff)" stroke="currentColor" strokeWidth={3} />
              )}
              {p.is_deceased && (
                <>
                  <line x1={c.x - BOX / 2} y1={c.y - BOX / 2} x2={c.x + BOX / 2} y2={c.y + BOX / 2} stroke="currentColor" strokeWidth={3} />
                  <line x1={c.x + BOX / 2} y1={c.y - BOX / 2} x2={c.x - BOX / 2} y2={c.y + BOX / 2} stroke="currentColor" strokeWidth={3} />
                </>
              )}
              <text x={c.x} y={c.y + BOX / 2 + 30} textAnchor="middle" fontSize={24} fill="currentColor">
                {p.full_name.replace(/ \(fictíci[oa]\)/, "")}
              </text>
              <text x={c.x} y={c.y + BOX / 2 + 56} textAnchor="middle" fontSize={19} fill="currentColor" opacity={0.75}>
                {p.is_proband ? "Cliente" : p.relationship_to_proband}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption id="demo-cap" className="gv-example-bottom">
        <span>Desenhado pelo mesmo motor da plataforma</span>
        <span>Cliente no topo · gerações anteriores abaixo</span>
      </figcaption>
    </figure>
  );
}
