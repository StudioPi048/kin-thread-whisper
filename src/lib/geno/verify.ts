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
        const centerA = a.x + NODE_W / 2; // NODE_W = 160
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

  // 2) Filho único herda o X exato da união dos pais
  for (const [uid, u] of g.unions.entries()) {
    if (u.children.length === 1) {
      const childId = u.children[0];
      const childPos = personPos.get(childId);
      const un = unionPos.get(uid);

      if (childPos && un) {
        const childCenter = childPos.x + NODE_W / 2;
        if (Math.abs(childCenter - un.x) > EPS) {
          violations.push({
            rule: "FILHO_UNICO_DESALINHADO",
            detail: `Filho ${childId} em x=${childCenter}, união em x=${un.x}`,
            ids: [uid, childId],
          });
        }
      }
    }
  }

  // 3) Orientação: cliente+irmãos no topo, cada pessoa na faixa da sua geração,
  //    filho SEMPRE acima da união dos pais, genitores abaixo do filho.
  const probandPos = g.probandId ? personPos.get(g.probandId) : undefined;
  for (const [pid, pe] of g.persons) {
    const p = personPos.get(pid);
    if (!p) continue;
    if (Math.abs(p.y - genY(pe.generation)) > EPS)
      violations.push({ rule: "FORA_DA_FAIXA_DA_GERACAO", detail: `${pid} y=${p.y} geração ${pe.generation}`, ids: [pid] });
    if (probandPos && p.y < probandPos.y - EPS)
      violations.push({ rule: "ACIMA_DO_CLIENTE", detail: `${pid} acima do cliente`, ids: [pid] });
  }
  for (const e of g.edges) {
    const u = g.unions.get(e.unionId);
    const p = personPos.get(e.personId);
    const pe = g.persons.get(e.personId);
    if (!u || !p || !pe) continue;
    if (e.kind === "child" && pe.generation !== u.generation - 1)
      violations.push({ rule: "GERACAO_FILHO_INCOERENTE", detail: `${e.personId} em ${e.unionId}`, ids: [e.personId, e.unionId] });
    if (e.kind === "partner" && pe.generation !== u.generation)
      violations.push({ rule: "GERACAO_CASAL_INCOERENTE", detail: `${e.personId} em ${e.unionId}`, ids: [e.personId, e.unionId] });
    if (e.kind === "child")
      for (const par of u.partners) {
        const pp = personPos.get(par);
        if (pp && pp.y <= p.y + EPS)
          violations.push({ rule: "GENITOR_ACIMA_DO_FILHO", detail: `${par} não está abaixo de ${e.personId}`, ids: [par, e.personId] });
      }
  }

  // 4) Nenhum card pode se sobrepor a outro
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
