/**
 * Genossociograma – motor lógico único.
 *
 * Pipeline:
 *   Supabase rows  ──▶  buildLogicalGraph  ──▶  validateGraph  ──▶  layoutGraph
 *                       (Pessoa | União |         (invariantes)      (posições)
 *                        arestas lógicas)
 *
 * Regras clínicas travadas (não altere):
 *   • Paciente sempre em y = 0.
 *   • Ancestrais descem em Y positivo (geração 1 = pais em y=GEN_GAP, etc).
 *   • Ramo paterno estritamente à esquerda; materno à direita.
 *   • Toda filiação passa por UnionNode; nunca liga Pessoa↔Pessoa direto.
 *
 * A saída expõe entidades React-Flow-ready, mas nenhuma decisão de conexão
 * depende de coordenadas — todas nascem da estrutura lógica.
 */
import type { Database } from "@/integrations/supabase/types";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

// ── Constantes de layout ──────────────────────────────────────
export const NODE_W = 160;
export const NODE_H = 210;
export const PERSON_SHAPE = 76;
export const PROBAND_SHAPE = 84;
export const GEN_GAP = 250;
export const COUPLE_GAP = 64; // distância centro-a-centro dentro de um casal
export const SIBLING_GAP = 28; // distância centro-a-centro entre irmãos diretos
export const BRANCH_GAP = 140; // folga entre subárvores ancestrais irmãs
export const BRANCH_SEPARATION = 260; // folga extra paterno vs materno

// ── Tipos ──────────────────────────────────────────────────────
export type UnionKind =
  | "casamento"
  | "uniao_estavel"
  | "uniao"
  | "divorcio"
  | "segundo_casamento"
  | "namoro"
  | "desconhecido";

export type BranchId = "proband" | "paternal" | "maternal" | "other" | string;

export interface PersonEntity {
  id: string;
  row: PersonRow;
  generation: number;
  branchId: BranchId;
}

export interface UnionEntity {
  id: string;
  partners: string[]; // 1 ou 2 personIds; um pode ser sintético "unknown"
  children: string[];
  kind: UnionKind;
  label: string;
  generation: number; // = geração do casal (pais)
  branchId: BranchId;
}

export interface LogicalEdge {
  kind: "partner" | "child";
  personId: string;
  unionId: string;
  childKind?: "biological" | "adoptive" | "foster";
}

export interface LogicalGraph {
  probandId: string | null;
  persons: Map<string, PersonEntity>;
  unions: Map<string, UnionEntity>;
  edges: LogicalEdge[];
  errors: string[];
}

// ── Normalização de tags de parentesco ────────────────────────
function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([oa]\)/g, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYSTEM_KEYS = new Set(
  [
    "Consulente",
    "Paciente",
    "Irmã(o)",
    "Pai",
    "Mãe",
    "Tio(a) paterno(a)",
    "Tio(a) materno(a)",
    "Avô paterno",
    "Avó paterna",
    "Avô materno",
    "Avó materna",
    "Bisavô paterno (pai do avô)",
    "Bisavó paterna (mãe do avô)",
    "Bisavô paterno (pai da avó)",
    "Bisavó paterna (mãe da avó)",
    "Bisavô materno (pai do avô)",
    "Bisavó materna (mãe do avô)",
    "Bisavô materno (pai da avó)",
    "Bisavó materna (mãe da avó)",
    "Irmã(o) do avô paterno",
    "Irmã(o) da avó paterna",
    "Irmã(o) do avô materno",
    "Irmã(o) da avó materna",
    "Irmã(o) do bisavô paterno",
    "Irmã(o) do bisavô materno",
    "Cônjuge",
    "Filho(a)",
    "Aborto",
  ].map(clean),
);

function canonicalKey(rel: string | null | undefined): string {
  const raw = clean(rel);
  if (SYSTEM_KEYS.has(raw)) return raw;
  return clean(smartNormalizeRelationship(rel)) || raw;
}

// ── Rótulo humano do tipo de união ────────────────────────────
export function unionKindLabel(kind: UnionKind, order?: number | null): string {
  const map: Record<UnionKind, string> = {
    casamento: "Casamento",
    uniao_estavel: "União estável",
    uniao: "União",
    divorcio: "Divórcio",
    segundo_casamento: "Recasamento",
    namoro: "Namoro",
    desconhecido: "União",
  };
  const base = map[kind] ?? "União";
  if (kind === "casamento" && order && order > 1) return `${order}º casamento`;
  return base;
}

function deriveUnionKind(rel: RelRow | undefined): UnionKind {
  if (!rel) return "desconhecido";
  if (rel.qualifier === "divorce" || rel.qualifier === "rupture") return "divorcio";
  if (rel.qualifier === "separation") return "divorcio";
  const t = (rel.relationship_type || "").toLowerCase();
  if (t === "union") return "casamento";
  return "desconhecido";
}

// ── Construção do grafo lógico ────────────────────────────────
interface BuildOptions {
  persons: PersonRow[];
  rels: RelRow[];
  probandId?: string;
}

export function buildLogicalGraph({ persons, rels, probandId }: BuildOptions): LogicalGraph {
  const g: LogicalGraph = {
    probandId: null,
    persons: new Map(),
    unions: new Map(),
    edges: [],
    errors: [],
  };

  const byKey = new Map<string, PersonRow[]>();
  for (const p of persons) {
    const key = canonicalKey(p.relationship_to_proband) || (p.is_proband ? "consulente" : "");
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }
  const get = (tag: string): PersonRow[] => byKey.get(clean(tag)) ?? [];
  const first = (tag: string): PersonRow | undefined => get(tag)[0];

  const proband =
    (probandId && persons.find((p) => p.id === probandId)) ||
    first("Consulente") ||
    first("Paciente") ||
    persons.find((p) => p.is_proband) ||
    persons[0];
  if (!proband) return g;
  g.probandId = proband.id;

  // Índice de uniões manuais (para achar kind/qualifier/marriage_order do casal)
  const unionRels = new Map<string, RelRow>();
  for (const r of rels) {
    if (r.relationship_type === "union" && r.from_person_id && r.to_person_id) {
      const key = [r.from_person_id, r.to_person_id].sort().join("|");
      unionRels.set(key, r);
    }
  }
  const findUnionRel = (a?: PersonRow, b?: PersonRow) => {
    if (!a || !b) return undefined;
    return unionRels.get([a.id, b.id].sort().join("|"));
  };

  const addPerson = (row: PersonRow, generation: number, branchId: BranchId) => {
    if (g.persons.has(row.id)) return;
    g.persons.set(row.id, { id: row.id, row, generation, branchId });
  };

  const addUnion = (params: {
    id: string;
    partners: PersonRow[];
    children: PersonRow[];
    generation: number;
    branchId: BranchId;
    rel?: RelRow;
  }) => {
    const { id, partners, children, generation, branchId, rel } = params;
    if (partners.length === 0 && children.length === 0) return null;
    const kind = deriveUnionKind(rel);
    const order = (rel as (RelRow & { marriage_order?: number | null }) | undefined)?.marriage_order ?? null;
    const label = unionKindLabel(kind, order);
    const union: UnionEntity = {
      id,
      partners: partners.map((p) => p.id),
      children: children.map((c) => c.id),
      kind,
      label,
      generation,
      branchId,
    };
    g.unions.set(id, union);
    for (const p of partners) {
      g.edges.push({ kind: "partner", personId: p.id, unionId: id });
    }
    for (const c of children) {
      g.edges.push({ kind: "child", personId: c.id, unionId: id, childKind: "biological" });
    }
    return union;
  };

  // ── Registrar pessoas por geração/ramo ───────────────────────
  addPerson(proband, 0, "proband");

  const pai = first("Pai");
  const mae = first("Mãe");
  const irmaos = get("Irmã(o)");
  irmaos.forEach((s) => addPerson(s, 0, "proband"));

  const tiosPat = get("Tio(a) paterno(a)");
  const tiosMat = get("Tio(a) materno(a)");
  if (pai) addPerson(pai, 1, "paternal");
  if (mae) addPerson(mae, 1, "maternal");
  tiosPat.forEach((t) => addPerson(t, 1, "paternal"));
  tiosMat.forEach((t) => addPerson(t, 1, "maternal"));

  const avoPat = first("Avô paterno");
  const avoPatF = first("Avó paterna");
  const avoMat = first("Avô materno");
  const avoMatF = first("Avó materna");
  if (avoPat) addPerson(avoPat, 2, "paternal");
  if (avoPatF) addPerson(avoPatF, 2, "paternal");
  if (avoMat) addPerson(avoMat, 2, "maternal");
  if (avoMatF) addPerson(avoMatF, 2, "maternal");

  const tioAvoPatAvo = get("Irmã(o) do avô paterno");
  const tioAvoPatAva = get("Irmã(o) da avó paterna");
  const tioAvoMatAvo = get("Irmã(o) do avô materno");
  const tioAvoMatAva = get("Irmã(o) da avó materna");
  tioAvoPatAvo.forEach((p) => addPerson(p, 2, "paternal"));
  tioAvoPatAva.forEach((p) => addPerson(p, 2, "paternal"));
  tioAvoMatAvo.forEach((p) => addPerson(p, 2, "maternal"));
  tioAvoMatAva.forEach((p) => addPerson(p, 2, "maternal"));

  const bp1 = first("Bisavô paterno (pai do avô)");
  const bp2 = first("Bisavó paterna (mãe do avô)");
  const bp3 = first("Bisavô paterno (pai da avó)");
  const bp4 = first("Bisavó paterna (mãe da avó)");
  const bm1 = first("Bisavô materno (pai do avô)");
  const bm2 = first("Bisavó materna (mãe do avô)");
  const bm3 = first("Bisavô materno (pai da avó)");
  const bm4 = first("Bisavó materna (mãe da avó)");
  [bp1, bp2, bp3, bp4].forEach((p) => p && addPerson(p, 3, "paternal"));
  [bm1, bm2, bm3, bm4].forEach((p) => p && addPerson(p, 3, "maternal"));

  // ── União central: Pai ⟷ Mãe (sintetizada mesmo sem RelRow) ─
  const rootPartners = [pai, mae].filter(Boolean) as PersonRow[];
  const probandChildren = [proband, ...irmaos];
  if (rootPartners.length > 0) {
    addUnion({
      id: `u_root_${proband.id}`,
      partners: rootPartners,
      children: probandChildren,
      generation: 1,
      branchId: "proband",
      rel: findUnionRel(pai, mae),
    });
  }

  // ── União dos avós paternos → pai + tios paternos ───────────
  const patGpPartners = [avoPat, avoPatF].filter(Boolean) as PersonRow[];
  const patGpKids = [pai, ...tiosPat].filter(Boolean) as PersonRow[];
  if (patGpPartners.length > 0 && patGpKids.length > 0) {
    addUnion({
      id: `u_gp_pat`,
      partners: patGpPartners,
      children: patGpKids,
      generation: 2,
      branchId: "paternal",
      rel: findUnionRel(avoPat, avoPatF),
    });
  }

  // ── União dos avós maternos → mãe + tios maternos ───────────
  const matGpPartners = [avoMat, avoMatF].filter(Boolean) as PersonRow[];
  const matGpKids = [mae, ...tiosMat].filter(Boolean) as PersonRow[];
  if (matGpPartners.length > 0 && matGpKids.length > 0) {
    addUnion({
      id: `u_gp_mat`,
      partners: matGpPartners,
      children: matGpKids,
      generation: 2,
      branchId: "maternal",
      rel: findUnionRel(avoMat, avoMatF),
    });
  }

  // ── União dos bisavós → avô/avó + tios-avós correspondentes ─
  const addGgpUnion = (
    id: string,
    p1: PersonRow | undefined,
    p2: PersonRow | undefined,
    child: PersonRow | undefined,
    siblings: PersonRow[],
    branchId: BranchId,
  ) => {
    const partners = [p1, p2].filter(Boolean) as PersonRow[];
    const kids = [child, ...siblings].filter(Boolean) as PersonRow[];
    if (partners.length === 0 || kids.length === 0) return;
    addUnion({
      id,
      partners,
      children: kids,
      generation: 3,
      branchId,
      rel: findUnionRel(p1, p2),
    });
  };
  addGgpUnion("u_ggp_pat_avo", bp1, bp2, avoPat, tioAvoPatAvo, "paternal");
  addGgpUnion("u_ggp_pat_ava", bp3, bp4, avoPatF, tioAvoPatAva, "paternal");
  addGgpUnion("u_ggp_mat_avo", bm1, bm2, avoMat, tioAvoMatAvo, "maternal");
  addGgpUnion("u_ggp_mat_ava", bm3, bm4, avoMatF, tioAvoMatAva, "maternal");

  // ── Pessoas sem tag: entram como "other" na geração 1 ───────
  for (const p of persons) {
    if (!g.persons.has(p.id)) {
      addPerson(p, 1, "other");
    }
  }

  return g;
}

// ── Validador estrutural ──────────────────────────────────────
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateGraph(g: LogicalGraph): ValidationResult {
  const errors: string[] = [];

  if (!g.probandId) errors.push("Sem paciente-índice identificado.");

  // Cada filho tem no máximo uma união de origem
  const parentUnionOf = new Map<string, string>();
  for (const e of g.edges) {
    if (e.kind !== "child") continue;
    if (parentUnionOf.has(e.personId)) {
      errors.push(`Pessoa ${e.personId} pertence a duas fratrias.`);
    } else {
      parentUnionOf.set(e.personId, e.unionId);
    }
  }

  // Nenhuma união órfã
  for (const [uid, u] of g.unions) {
    if (u.partners.length === 0 && u.children.length === 0) {
      errors.push(`União ${uid} sem parceiros e sem filhos.`);
    }
  }

  // Parceiro repetido: mesma dupla em duas uniões distintas
  const pairSeen = new Map<string, string>();
  for (const [uid, u] of g.unions) {
    if (u.partners.length !== 2) continue;
    const key = [...u.partners].sort().join("|");
    if (pairSeen.has(key) && pairSeen.get(key) !== uid) {
      errors.push(`Mesma dupla aparece em duas uniões (${uid} e ${pairSeen.get(key)}).`);
    }
    pairSeen.set(key, uid);
  }

  return { ok: errors.length === 0, errors };
}

// ── Layout ───────────────────────────────────────────────────
import { checkLayoutInvariants } from "./verify";

export interface Placement {
  personPos: Map<string, { x: number; y: number }>;
  unionPos: Map<string, { x: number; y: number }>;
}

/**
 * Recursivamente coloca uma união e sua ascendência.
 * Retorna a caixa envolvente {minX, maxX} e o center absoluto do CASAL.
 */
interface SubtreeBox {
  minX: number;
  maxX: number;
  coupleCenter: number;
}

export function layoutGraph(g: LogicalGraph): Placement {
  const personPos = new Map<string, { x: number; y: number }>();
  const unionPos = new Map<string, { x: number; y: number }>();

  if (!g.probandId) return { personPos, unionPos };
  const proband = g.persons.get(g.probandId);
  if (!proband) return { personPos, unionPos };

  const parentUnionOfPerson = new Map<string, string>();
  for (const e of g.edges) {
    if (e.kind === "child") parentUnionOfPerson.set(e.personId, e.unionId);
  }

  const y = (gen: number) => gen * GEN_GAP;

  const placePerson = (id: string, cx: number, gen: number) => {
    personPos.set(id, { x: cx - NODE_W / 2, y: y(gen) });
  };

  interface Extent { left: number; right: number; }
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
        
        // Satélites (irmãos) da pessoa
        const siblings = pu.children.filter((cid) => cid !== personId);
        if (siblings.length > 0) {
          let direction = 1;
          if (side === "paternal") direction = -1;
          
          if (side !== "root") {
            // Cada irmão ocupa o espaço dele mesmo + SIBLING_GAP
            const siblingsWidth = siblings.length * (NODE_W + SIBLING_GAP);
            if (direction === -1) {
              left = left - siblingsWidth - BRANCH_GAP;
            } else {
              right = right + siblingsWidth + BRANCH_GAP;
            }
          } else {
            // Irmãos do root se alternam
            const sibCount = siblings.length;
            const leftCount = Math.ceil(sibCount / 2);
            const rightCount = Math.floor(sibCount / 2);
            left = left - leftCount * (NODE_W + SIBLING_GAP) - BRANCH_GAP;
            right = right + rightCount * (NODE_W + SIBLING_GAP) + BRANCH_GAP;
          }
        }
      }
    }
    
    const ext = { left, right };
    personExtents.set(personId, ext);
    return ext;
  };

  // PASSO 2: Top-down assign positions
  const assignPosition = (personId: string, cx: number, gen: number, side: "root" | "paternal" | "maternal") => {
    placePerson(personId, cx, gen);
    
    const parentUnionId = parentUnionOfPerson.get(personId);
    if (!parentUnionId) return;
    
    const pu = g.unions.get(parentUnionId);
    if (!pu) return;
    
    const parentGen = gen + 1;
    // A união do casal parental fica exatamente sobre a pessoa, verticalmente centralizada na geração deles
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
    
    // Satélites (irmãos) pendurados do lado correto, fora da bounding box dos pais
    const siblings = pu.children.filter((cid) => cid !== personId);
    if (siblings.length > 0) {
      let parentsLeft = -NODE_W / 2;
      let parentsRight = NODE_W / 2;
      
      if (partners.length === 2) {
        const pExt = personExtents.get(partners[0].id) || { left: -NODE_W / 2, right: NODE_W / 2 };
        const mExt = personExtents.get(partners[1].id) || { left: -NODE_W / 2, right: NODE_W / 2 };
        const D = unionD.get(parentUnionId) ?? (COUPLE_GAP / 2);
        parentsLeft = -D + pExt.left;
        parentsRight = D + mExt.right;
      } else if (partners.length === 1) {
        const gender = partners[0].row.gender?.toLowerCase() || "";
        const pSide = gender.startsWith("m") ? "paternal" : "maternal";
        const ext = personExtents.get(partners[0].id) || { left: -NODE_W / 2, right: NODE_W / 2 };
        if (pSide === "paternal") {
          parentsLeft = ext.left;
        } else {
          parentsRight = ext.right;
        }
      }

      if (side === "root") {
        let leftIdx = 0;
        let rightIdx = 0;
        siblings.forEach((sibId, i) => {
          if (i % 2 === 0) {
            placePerson(sibId, cx + parentsLeft - BRANCH_GAP - NODE_W / 2 - leftIdx * (NODE_W + SIBLING_GAP), gen);
            leftIdx++;
          } else {
            placePerson(sibId, cx + parentsRight + BRANCH_GAP + NODE_W / 2 + rightIdx * (NODE_W + SIBLING_GAP), gen);
            rightIdx++;
          }
        });
      } else {
        if (side === "maternal") {
          siblings.forEach((sibId, i) => {
            placePerson(sibId, cx + parentsRight + BRANCH_GAP + NODE_W / 2 + i * (NODE_W + SIBLING_GAP), gen);
          });
        } else {
          siblings.forEach((sibId, i) => {
            placePerson(sibId, cx + parentsLeft - BRANCH_GAP - NODE_W / 2 - i * (NODE_W + SIBLING_GAP), gen);
          });
        }
      }
    }
  };

  // Inicializa a árvore calculando larguras
  computeExtent(proband.id, "root");

  // Atribui as posições definitivas travando o eixo primário
  assignPosition(proband.id, 0, 0, "root");

  const placement = { personPos, unionPos };
  const violations = checkLayoutInvariants(g, placement);
  console.log(violations.length === 0 ? '✅ Layout OK' : `❌ ${violations.length} violação(ões)`);
  if (violations.length > 0) {
    console.table(violations);
  }

  return placement;
}
