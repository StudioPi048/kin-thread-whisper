import { type LogicalGraph, type Placement, NODE_W, NODE_H, genY } from "./build";

type Violation = { rule: string; detail: string; ids: string[] };

export function checkLayoutInvariants(g: LogicalGraph, placement: Placement): Violation[] {
  const violations: Violation[] = [];
  const EPS = 0.5;

  const { personPos, unionPos } = placement;

  // 1) União deve estar exatamente no meio dos dois parceiros
  for (const [uid, u] of g.unions.entries()) {
    if (u.partners.length === 2) {
      const a = personPos.get(u.partners[0]);
      const b = personPos.get(u.partners[1]);
      const un = unionPos.get(uid);

      if (a && b && un) {
        const centerA = a.x + NODE_W / 2;
        const centerB = b.x + NODE_W / 2;
        const expectedCenter = (centerA + centerB) / 2;

        if (Math.abs(un.x - expectedCenter) > EPS) {
          violations.push({
            rule: "UNIAO_FORA_DO_MEIO",
            detail: `União ${uid} em x=${un.x}, esperado x=${expectedCenter}`,
            ids: [uid, u.partners[0], u.partners[1]],
          });
        }
      }
    }
  }

  // 2) Orientação: topo exclusivo, faixas verticais e cada filiação
  // com o sentido correto na vista ancestral ou de descendentes.
  const probandPos = g.probandId ? personPos.get(g.probandId) : undefined;
  for (const [pid, pe] of g.persons) {
    const p = personPos.get(pid);
    if (!p) continue;
    if (Math.abs(p.y - genY(pe.generation)) > EPS)
      violations.push({
        rule: "FORA_DA_FAIXA_DA_GERACAO",
        detail: `${pid} y=${p.y} geração ${pe.generation}`,
        ids: [pid],
      });
    if (g.topRowIds.has(pid) !== Math.abs(p.y) <= EPS)
      violations.push({
        rule: "TOPO_EXCLUSIVO",
        detail: `${pid} está fora da sua faixa em relação ao consulente`,
        ids: [pid],
      });
    if (probandPos && p.y < probandPos.y - EPS)
      violations.push({ rule: "ACIMA_DO_CLIENTE", detail: `${pid} acima do cliente`, ids: [pid] });
  }
  for (const e of g.edges) {
    const u = g.unions.get(e.unionId);
    const p = personPos.get(e.personId);
    if (!u || !p || e.kind !== "child") continue;
    for (const par of u.partners) {
      const pp = personPos.get(par);
      if (!pp) continue;
      const invalid = u.direction === "up" ? pp.y <= p.y + EPS : pp.y >= p.y - EPS;
      if (invalid)
        violations.push({
          rule: "GENITOR_EM_FAIXA_INCOERENTE",
          detail: `${par} e ${e.personId} em faixas incompatíveis com ${u.direction}`,
          ids: [par, e.personId],
        });
    }
  }

  // 3) Nenhum card pode se sobrepor a outro
  const nodes = Array.from(personPos.entries());
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [id1, p1] = nodes[i];
      const [id2, p2] = nodes[j];
      const w = NODE_W;
      const h = NODE_H; // Full card height including text

      if (Math.abs(p1.x - p2.x) < w - EPS && Math.abs(p1.y - p2.y) < h - EPS) {
        violations.push({
          rule: "SOBREPOSICAO",
          detail: `${id1} e ${id2} se sobrepõem: P1(${p1.x}, ${p1.y}) P2(${p2.x}, ${p2.y})`,
          ids: [id1, id2],
        });
      }
    }
  }

  return violations;
}
