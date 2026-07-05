import type { LogicalGraph, PersonEntity } from "./build"; // just for typings

// Dummy constants for scratch
const NODE_W = 160;
const SIBLING_GAP = 230;
const COUPLE_GAP = 220;
const GEN_GAP = 250;
const PERSON_SHAPE = 76;

interface Extent {
  left: number;
  right: number;
}

export function layoutGraph(g: LogicalGraph) {
  const personPos = new Map<string, { x: number; y: number }>();
  const unionPos = new Map<string, { x: number; y: number }>();

  if (!g.probandId) return { personPos, unionPos };
  const proband = g.persons.get(g.probandId);
  if (!proband) return { personPos, unionPos };

  // Índices
  const parentUnionOfPerson = new Map<string, string>();
  for (const e of g.edges) {
    if (e.kind === "child") parentUnionOfPerson.set(e.personId, e.unionId);
  }

  const y = (gen: number) => gen * GEN_GAP;

  const placePerson = (id: string, cx: number, gen: number) => {
    personPos.set(id, { x: cx - NODE_W / 2, y: y(gen) });
  };

  const personExtents = new Map<string, Extent>();
  const unionD = new Map<string, number>();

  // PASSO 1: Bottom-up compute width (extents)
  const computeExtent = (personId: string, side: "root" | "paternal" | "maternal"): Extent => {
    if (personExtents.has(personId)) return personExtents.get(personId)!;
    
    let left = -NODE_W / 2;
    let right = NODE_W / 2;
    
    const person = g.persons.get(personId);
    if (!person) return { left, right };
    
    const parentUnionId = parentUnionOfPerson.get(personId);
    if (parentUnionId) {
      const pu = g.unions.get(parentUnionId);
      if (pu) {
        const partners = pu.partners.map((pid) => g.persons.get(pid)).filter(Boolean) as PersonEntity[];
        
        // Sort: paternal (pai) à esquerda, maternal (mãe) à direita
        partners.sort((a, b) => {
          const relA = (a.row.relationship_to_proband || "").toLowerCase();
          const relB = (b.row.relationship_to_proband || "").toLowerCase();
          const isMale = (r: string) => r.includes("pai") || r.includes("avô") || r.includes("bisavô");
          const isFemale = (r: string) => r.includes("mãe") || r.includes("mae") || r.includes("avó") || r.includes("bisavó");
          if (isMale(relA) && !isMale(relB)) return -1;
          if (isFemale(relA) && !isFemale(relB)) return 1;
          if (!isMale(relA) && isMale(relB)) return 1;
          if (!isFemale(relA) && isFemale(relB)) return -1;
          const gA = (a.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
          const gB = (b.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
          return gA - gB;
        });
        
        if (partners.length === 2) {
          const pExt = computeExtent(partners[0].id, "paternal");
          const mExt = computeExtent(partners[1].id, "maternal");
          
          let D = (COUPLE_GAP + pExt.right - mExt.left) / 2;
          if (D < COUPLE_GAP / 2) D = COUPLE_GAP / 2;
          
          unionD.set(parentUnionId, D);
          
          const parentsLeft = -D + pExt.left;
          const parentsRight = D + mExt.right;
          
          left = Math.min(left, parentsLeft);
          right = Math.max(right, parentsRight);
        } else if (partners.length === 1) {
          const gender = partners[0].row.gender?.toLowerCase() || "";
          const pSide = gender.startsWith("m") ? "paternal" : "maternal";
          const ext = computeExtent(partners[0].id, pSide);
          unionD.set(parentUnionId, 0); // Fica no centro se for 1 só
          left = Math.min(left, ext.left);
          right = Math.max(right, ext.right);
        }
        
        // Irmãos da pessoa (outros filhos desta união)
        const siblings = pu.children.filter((cid) => cid !== personId);
        if (siblings.length > 0) {
          let direction = 1;
          if (side === "paternal") direction = -1;
          
          if (side !== "root") {
            const farthestSib = siblings.length * (NODE_W + SIBLING_GAP);
            if (direction === -1) {
              left = Math.min(left, -farthestSib - NODE_W / 2);
            } else {
              right = Math.max(right, farthestSib + NODE_W / 2);
            }
          } else {
            // Irmãos do root se alternam
            const sibCount = siblings.length;
            const leftCount = Math.ceil(sibCount / 2);
            const rightCount = Math.floor(sibCount / 2);
            left = Math.min(left, -leftCount * (NODE_W + SIBLING_GAP) - NODE_W / 2);
            right = Math.max(right, rightCount * (NODE_W + SIBLING_GAP) + NODE_W / 2);
          }
        }
      }
    }
    
    const ext = { left, right };
    personExtents.set(personId, ext);
    return ext;
  };

  // Pre-computa a árvore inteira partindo do proband
  computeExtent(proband.id, "root");

  // PASSO 2: Top-down assign positions
  const assignPosition = (personId: string, cx: number, gen: number, side: "root" | "paternal" | "maternal") => {
    placePerson(personId, cx, gen);
    
    const parentUnionId = parentUnionOfPerson.get(personId);
    if (!parentUnionId) return;
    
    const pu = g.unions.get(parentUnionId);
    if (!pu) return;
    
    const parentGen = gen + 1;
    // A união do casal parental fica alinhada horizontalmente e verticalmente centralizada na geração deles
    unionPos.set(parentUnionId, { x: cx, y: y(parentGen) + PERSON_SHAPE / 2 });
    
    const partners = pu.partners.map((pid) => g.persons.get(pid)).filter(Boolean) as PersonEntity[];
    partners.sort((a, b) => {
      const relA = (a.row.relationship_to_proband || "").toLowerCase();
      const relB = (b.row.relationship_to_proband || "").toLowerCase();
      const isMale = (r: string) => r.includes("pai") || r.includes("avô") || r.includes("bisavô");
      const isFemale = (r: string) => r.includes("mãe") || r.includes("mae") || r.includes("avó") || r.includes("bisavó");
      if (isMale(relA) && !isMale(relB)) return -1;
      if (isFemale(relA) && !isFemale(relB)) return 1;
      if (!isMale(relA) && isMale(relB)) return 1;
      if (!isFemale(relA) && isFemale(relB)) return -1;
      const gA = (a.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
      const gB = (b.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
      return gA - gB;
    });
    
    if (partners.length === 2) {
      const D = unionD.get(parentUnionId) ?? (COUPLE_GAP / 2);
      assignPosition(partners[0].id, cx - D, parentGen, "paternal");
      assignPosition(partners[1].id, cx + D, parentGen, "maternal");
    } else if (partners.length === 1) {
      const gender = partners[0].row.gender?.toLowerCase() || "";
      const pSide = gender.startsWith("m") ? "paternal" : "maternal";
      assignPosition(partners[0].id, cx, parentGen, pSide);
    }
    
    // Satélites (irmãos)
    const siblings = pu.children.filter((cid) => cid !== personId);
    if (siblings.length > 0) {
      if (side === "root") {
        let leftIdx = 1;
        let rightIdx = 1;
        siblings.forEach((sibId, i) => {
          if (i % 2 === 0) {
            placePerson(sibId, cx - leftIdx * (NODE_W + SIBLING_GAP), gen);
            leftIdx++;
          } else {
            placePerson(sibId, cx + rightIdx * (NODE_W + SIBLING_GAP), gen);
            rightIdx++;
          }
        });
      } else {
        const direction = side === "maternal" ? 1 : -1;
        siblings.forEach((sibId, i) => {
          placePerson(sibId, cx + direction * (i + 1) * (NODE_W + SIBLING_GAP), gen);
        });
      }
    }
  };

  // Inicia a atribuição top-down
  assignPosition(proband.id, 0, 0, "root");

  return { personPos, unionPos };
}
