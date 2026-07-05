import type { LogicalGraph, Placement } from "./build";

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
        const centerA = a.x + 160 / 2; // NODE_W = 160
        const centerB = b.x + 160 / 2;
        const expectedCenter = (centerA + centerB) / 2;

        if (Math.abs(un.x - expectedCenter) > EPS) {
          violations.push({
            rule: 'UNIAO_FORA_DO_MEIO',
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
        const childCenter = childPos.x + 160 / 2;
        if (Math.abs(childCenter - un.x) > EPS) {
          violations.push({
            rule: 'FILHO_UNICO_DESALINHADO',
            detail: `Filho ${childId} em x=${childCenter}, união em x=${un.x}`,
            ids: [uid, childId],
          });
        }
      }
    }
  }

  // 4) Nenhum card pode se sobrepor a outro
  const nodes = Array.from(personPos.entries());
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [id1, p1] = nodes[i];
      const [id2, p2] = nodes[j];
      const w = 160;
      const h = 90;

      if (
        Math.abs(p1.x - p2.x) < w - EPS &&
        Math.abs(p1.y - p2.y) < h - EPS
      ) {
        violations.push({ 
          rule: 'SOBREPOSICAO', 
          detail: `${id1} e ${id2} se sobrepõem: P1(${p1.x}, ${p1.y}) P2(${p2.x}, ${p2.y})`, 
          ids: [id1, id2] 
        });
      }
    }
  }

  return violations;
}
