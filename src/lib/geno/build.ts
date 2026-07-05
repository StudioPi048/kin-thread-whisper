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
export const COUPLE_GAP = 220; // distância centro-a-centro dentro de um casal
export const SIBLING_GAP = 230; // distância centro-a-centro entre irmãos
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

  // Índices auxiliares
  const parentUnionOfPerson = new Map<string, string>(); // person → union onde é filho
  const partnerUnionsOfPerson = new Map<string, string[]>(); // person → uniões onde é parceiro
  for (const e of g.edges) {
    if (e.kind === "child") parentUnionOfPerson.set(e.personId, e.unionId);
    else {
      const arr = partnerUnionsOfPerson.get(e.personId) ?? [];
      arr.push(e.unionId);
      partnerUnionsOfPerson.set(e.personId, arr);
    }
  }

  const y = (gen: number) => gen * GEN_GAP;

  const placePerson = (id: string, cx: number, gen: number) => {
    personPos.set(id, { x: cx - NODE_W / 2, y: y(gen) });
  };

  /**
   * Coloca a união `unionId` com centro do casal em `coupleCenter`.
   * Recursivamente coloca as sub-árvores ancestrais de cada parceiro
   * (união que gerou aquele parceiro). Retorna o bounding-box horizontal
   * do conjunto (casal + ancestrais).
   */
  const layoutUnionAncestors = (unionId: string, coupleCenter: number): SubtreeBox => {
    const u = g.unions.get(unionId);
    if (!u) return { minX: coupleCenter, maxX: coupleCenter, coupleCenter };

    const gen = u.generation;
    // Casal
    const partners = u.partners.map((pid) => g.persons.get(pid)).filter(Boolean) as PersonEntity[];
    // Ordem confiável: o grafo lógico já monta partners como [pai/paterno, mãe/materno].
    // Como fallback: usa o tag de parentesco (pai/avô à esquerda; mãe/avó à direita)
    // e só cai no gender field quando tudo mais falha.
    partners.sort((a, b) => {
      const relA = (a.row.relationship_to_proband || "").toLowerCase();
      const relB = (b.row.relationship_to_proband || "").toLowerCase();
      const isMaleTag = (r: string) =>
        r.includes("pai") || r.includes("avô") || r.includes("bisavô") || r.startsWith("tio");
      const isFemaleTag = (r: string) =>
        r.includes("mãe") || r.includes("mae") || r.includes("avó") || r.includes("bisavó") || r.startsWith("tia");
      let scoreA = 0;
      let scoreB = 0;
      if (isMaleTag(relA)) scoreA = -1;
      else if (isFemaleTag(relA)) scoreA = 1;
      if (isMaleTag(relB)) scoreB = -1;
      else if (isFemaleTag(relB)) scoreB = 1;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const genderA = (a.row.gender || "").toLowerCase();
      const genderB = (b.row.gender || "").toLowerCase();
      const gA = genderA.includes("masc") || genderA === "m" ? -1 : 1;
      const gB = genderB.includes("masc") || genderB === "m" ? -1 : 1;
      return gA - gB;
    });

    let leftCx: number;
    let rightCx: number | null;
    if (partners.length === 2) {
      leftCx = coupleCenter - COUPLE_GAP / 2;
      rightCx = coupleCenter + COUPLE_GAP / 2;
    } else {
      leftCx = coupleCenter;
      rightCx = null;
    }

    // Colocação dos parceiros
    if (partners[0]) placePerson(partners[0].id, leftCx, gen);
    if (partners[1] && rightCx !== null) placePerson(partners[1].id, rightCx, gen);

    // União fica no centro
    unionPos.set(unionId, { x: coupleCenter, y: y(gen) + PERSON_SHAPE / 2 });

    let boxMin = Math.min(leftCx, rightCx ?? leftCx) - NODE_W / 2;
    let boxMax = Math.max(leftCx, rightCx ?? leftCx) + NODE_W / 2;

    // Ancestrais de cada parceiro (união que o gerou)
    for (let i = 0; i < partners.length; i++) {
      const partner = partners[i];
      const cx = i === 0 ? leftCx : (rightCx ?? leftCx);
      const parentUnionId = parentUnionOfPerson.get(partner.id);
      if (!parentUnionId) continue;
      const parentUnion = g.unions.get(parentUnionId);
      if (!parentUnion) continue;

      // Filhos desta união ancestral (parceiro + seus irmãos)
      const siblings = parentUnion.children
        .map((cid) => g.persons.get(cid))
        .filter(Boolean) as PersonEntity[];

      // Layout dos filhos: parceiro deve ficar exatamente em `cx`.
      // Os irmãos são distribuídos com SIBLING_GAP.
      const idx = siblings.findIndex((s) => s.id === partner.id);
      const anchor = idx >= 0 ? idx : (siblings.length - 1) / 2;

      // Ramo paterno (i===0): irmãos vão à ESQUERDA do parceiro.
      // Ramo materno (i===1): irmãos vão à DIREITA do parceiro.
      // Isso garante que os tios não invadam o outro ramo.
      let siblingCoords: { id: string; cx: number }[];
      if (i === 0) {
        // parceiro à direita da fratria
        siblingCoords = siblings.map((s, j) => ({
          id: s.id,
          cx: cx - (siblings.length - 1 - j) * SIBLING_GAP,
        }));
        // realinha para que o parceiro caia exatamente em cx
        const partnerCoord = siblingCoords.find((c) => c.id === partner.id);
        if (partnerCoord) {
          const shift = cx - partnerCoord.cx;
          siblingCoords = siblingCoords.map((c) => ({ id: c.id, cx: c.cx + shift }));
        }
      } else {
        // parceiro à esquerda da fratria
        siblingCoords = siblings.map((s, j) => ({
          id: s.id,
          cx: cx + j * SIBLING_GAP,
        }));
        const partnerCoord = siblingCoords.find((c) => c.id === partner.id);
        if (partnerCoord) {
          const shift = cx - partnerCoord.cx;
          siblingCoords = siblingCoords.map((c) => ({ id: c.id, cx: c.cx + shift }));
        }
      }
      // Reposiciona todos os irmãos (parceiro será re-posicionado no mesmo cx)
      for (const sc of siblingCoords) placePerson(sc.id, sc.cx, gen);

      // Ancestrais desta união
      const ancestorCenter =
        siblingCoords.reduce((s, c) => s + c.cx, 0) / siblingCoords.length;
      // usa idx do casal ancestral para posicionar seu centro acima do meio da fratria
      const ancBox = layoutUnionAncestors(parentUnionId, ancestorCenter);
      boxMin = Math.min(boxMin, ancBox.minX, ...siblingCoords.map((c) => c.cx - NODE_W / 2));
      boxMax = Math.max(boxMax, ancBox.maxX, ...siblingCoords.map((c) => c.cx + NODE_W / 2));
    }

    return { minX: boxMin, maxX: boxMax, coupleCenter };
  };

  // ── Ponto de entrada: paciente + irmãos no y=0 ───────────────
  // Encontra a união do paciente
  const rootUnionId = parentUnionOfPerson.get(proband.id);
  const probandFamily = rootUnionId ? g.unions.get(rootUnionId) : undefined;

  // Coloca os filhos do casal-raiz em y=0
  const siblings = probandFamily
    ? (probandFamily.children.map((cid) => g.persons.get(cid)).filter(Boolean) as PersonEntity[])
    : [proband];

  // Paciente no centro absoluto (x=0). Irmãos alternam ao redor.
  const probandIdx = siblings.findIndex((s) => s.id === proband.id);
  const siblingCenters = siblings.map((_, i) => (i - probandIdx) * SIBLING_GAP);
  siblings.forEach((s, i) => placePerson(s.id, siblingCenters[i], 0));

  // Ancestrais: coloca a união dos pais centralizada acima do paciente
  if (rootUnionId) {
    layoutUnionAncestors(rootUnionId, 0);

    // Após colocar tudo, verifica se os subgrafos paterno e materno se sobrepõem;
    // se sim, força uma separação horizontal mínima. Isso preserva a regra de
    // ramos disjuntos.
    separateBranches(g, personPos, unionPos);
  }

  return { personPos, unionPos };
}

/**
 * Se subgrafos paterno e materno se sobrepuseram, aplica shift horizontal.
 * Ramo paterno inteiro à esquerda, materno à direita, com folga BRANCH_SEPARATION.
 */
function separateBranches(
  g: LogicalGraph,
  personPos: Map<string, { x: number; y: number }>,
  unionPos: Map<string, { x: number; y: number }>,
) {
  let patMax = -Infinity;
  let matMin = Infinity;
  for (const [pid, pos] of personPos) {
    const person = g.persons.get(pid);
    if (!person) continue;
    if (person.generation === 0) continue; // não mexer no paciente/irmãos
    if (person.branchId === "paternal") patMax = Math.max(patMax, pos.x + NODE_W);
    if (person.branchId === "maternal") matMin = Math.min(matMin, pos.x);
  }
  if (!Number.isFinite(patMax) || !Number.isFinite(matMin)) return;
  const overlap = patMax + BRANCH_SEPARATION - matMin;
  if (overlap <= 0) return;
  const half = overlap / 2;
  for (const [pid, pos] of personPos) {
    const person = g.persons.get(pid);
    if (!person || person.generation === 0) continue;
    if (person.branchId === "paternal") personPos.set(pid, { x: pos.x - half, y: pos.y });
    if (person.branchId === "maternal") personPos.set(pid, { x: pos.x + half, y: pos.y });
  }
  for (const [uid, pos] of unionPos) {
    const union = g.unions.get(uid);
    if (!union) continue;
    if (union.branchId === "paternal") unionPos.set(uid, { x: pos.x - half, y: pos.y });
    if (union.branchId === "maternal") unionPos.set(uid, { x: pos.x + half, y: pos.y });
  }
}
