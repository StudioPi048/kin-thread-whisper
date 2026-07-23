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
export type NodePositionRow = Database["public"]["Tables"]["genogram_node_positions"]["Row"];
export type LayoutRow = Database["public"]["Tables"]["genogram_layouts"]["Row"];

// ── Constantes de layout ──────────────────────────────────────
export const NODE_W = 140;
export const NODE_H = 180;
export const PERSON_SHAPE = 76;
export const PROBAND_SHAPE = 84;
export const GEN_GAP = 320;
export const COUPLE_GAP = 64; // distância centro-a-centro dentro de um casal
export const SIBLING_GAP = 20; // distância centro-a-centro padrão
export const BRANCH_GAP = 16; // folga entre subárvores ancestrais irmãs
export const BRANCH_SEPARATION = 160; // folga extra paterno vs materno

export function getSiblingStep(siblingsCount: number): number {
  if (siblingsCount <= 1) return 110;
  if (siblingsCount <= 3) return 125;
  return 140;
}

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

export interface GenogramWarning {
  personId: string;
  personName: string;
  message: string;
}

export interface LogicalGraph {
  probandId: string | null;
  persons: Map<string, PersonEntity>;
  unions: Map<string, UnionEntity>;
  edges: LogicalEdge[];
  errors: string[];
  /** Pessoas visíveis mas sem âncora genealógica real — o que fazer pra corrigir cada uma. */
  warnings: GenogramWarning[];
  positions: Map<string, NodePositionRow>;
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
    "Irmã(o) do Pai",
    "Irmã(o) da Mãe",
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
    "Irmã(o) do Bisavô paterno (pai do avô)",
    "Irmã(o) da Bisavó paterna (mãe do avô)",
    "Irmã(o) do Bisavô paterno (pai da avó)",
    "Irmã(o) da Bisavó paterna (mãe da avó)",
    "Irmã(o) do Bisavô materno (pai do avô)",
    "Irmã(o) da Bisavó materna (mãe do avô)",
    "Irmã(o) do Bisavô materno (pai da avó)",
    "Irmã(o) da Bisavó materna (mãe da avó)",
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
  positions?: NodePositionRow[];
}

export function buildLogicalGraph({
  persons,
  rels,
  probandId,
  positions,
}: BuildOptions): LogicalGraph {
  const g: LogicalGraph = {
    probandId: null,
    persons: new Map(),
    unions: new Map(),
    edges: [],
    errors: [],
    warnings: [],
    positions: new Map(),
  };

  if (positions) {
    for (const pos of positions) {
      g.positions.set(pos.node_id, pos);
    }
  }

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
    const order =
      (rel as (RelRow & { marriage_order?: number | null }) | undefined)?.marriage_order ?? null;
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

  const tiosPat = get("Irmã(o) do Pai");
  const tiosMat = get("Irmã(o) da Mãe");
  if (pai) addPerson(pai, 1, "paternal");
  if (mae) addPerson(mae, 1, "maternal");
  tiosPat.forEach((t) => addPerson(t, 1, "paternal"));
  tiosMat.forEach((t) => addPerson(t, 1, "maternal"));

  // Um ancestral direto (avô/avó/bisavô/bisavó) é UMA pessoa só — mas na
  // prática o clínico às vezes reusa o mesmo texto de ancestral pra um grupo
  // inteiro de irmãos (em vez de usar a tag "irmã(o) do/da X" pra cada um).
  // `first()` sozinho pegaria só o primeiro cadastro e derrubaria o resto
  // pro fallback "todos aparecem" (satélite solto do paciente). Em vez disso,
  // o primeiro cadastro (ordem de criação) vira a âncora e os excedentes
  // entram como irmãos dela — reaproveitando addSiblingGroup, que já existe.
  const avoPatAll = get("Avô paterno");
  const avoPatFAll = get("Avó paterna");
  const avoMatAll = get("Avô materno");
  const avoMatFAll = get("Avó materna");
  const avoPat = avoPatAll[0];
  const avoPatF = avoPatFAll[0];
  const avoMat = avoMatAll[0];
  const avoMatF = avoMatFAll[0];
  if (avoPat) addPerson(avoPat, 2, "paternal");
  if (avoPatF) addPerson(avoPatF, 2, "paternal");
  if (avoMat) addPerson(avoMat, 2, "maternal");
  if (avoMatF) addPerson(avoMatF, 2, "maternal");

  const tioAvoPatAvo = [...get("Irmã(o) do avô paterno"), ...avoPatAll.slice(1)];
  const tioAvoPatAva = [...get("Irmã(o) da avó paterna"), ...avoPatFAll.slice(1)];
  const tioAvoMatAvo = [...get("Irmã(o) do avô materno"), ...avoMatAll.slice(1)];
  const tioAvoMatAva = [...get("Irmã(o) da avó materna"), ...avoMatFAll.slice(1)];
  tioAvoPatAvo.forEach((p) => addPerson(p, 2, "paternal"));
  tioAvoPatAva.forEach((p) => addPerson(p, 2, "paternal"));
  tioAvoMatAvo.forEach((p) => addPerson(p, 2, "maternal"));
  tioAvoMatAva.forEach((p) => addPerson(p, 2, "maternal"));

  const bp1All = get("Bisavô paterno (pai do avô)");
  const bp2All = get("Bisavó paterna (mãe do avô)");
  const bp3All = get("Bisavô paterno (pai da avó)");
  const bp4All = get("Bisavó paterna (mãe da avó)");
  const bm1All = get("Bisavô materno (pai do avô)");
  const bm2All = get("Bisavó materna (mãe do avô)");
  const bm3All = get("Bisavô materno (pai da avó)");
  const bm4All = get("Bisavó materna (mãe da avó)");
  const bp1 = bp1All[0];
  const bp2 = bp2All[0];
  const bp3 = bp3All[0];
  const bp4 = bp4All[0];
  const bm1 = bm1All[0];
  const bm2 = bm2All[0];
  const bm3 = bm3All[0];
  const bm4 = bm4All[0];
  [bp1, bp2, bp3, bp4].forEach((p) => p && addPerson(p, 3, "paternal"));
  [bm1, bm2, bm3, bm4].forEach((p) => p && addPerson(p, 3, "maternal"));

  // ── Irmãos dos bisavós (tios-bisavós) ───────────────────────
  // Um tag por bisavô/bisavó real (mesma desambiguação "pai do avô" / "mãe
  // do avô" / "pai da avó" / "mãe da avó" já usada nos bisavós), então cada
  // grupo de irmãos ancora exatamente na pessoa certa — sem chute.
  // Sem trisavós no sistema, a união-satélite nasce sem parceiros (addUnion
  // já aceita isso — só bloqueia quando partners E children estão vazios).
  const addSiblingGroup = (
    id: string,
    anchor: PersonRow | undefined,
    siblings: PersonRow[],
    generation: number,
    branchId: BranchId,
  ) => {
    // Sem âncora, não registra aqui — melhor deixar cair no fallback "todos
    // aparecem" (satélite do paciente) do que marcar como "já processado"
    // sem nunca ganhar união/posição, o que os deixaria invisíveis de vez.
    if (!anchor || siblings.length === 0) return;
    siblings.forEach((p) => addPerson(p, generation, branchId));
    addUnion({ id, partners: [], children: [anchor, ...siblings], generation, branchId });
  };
  addSiblingGroup(
    "u_sib_bp1",
    bp1,
    [...get("Irmã(o) do Bisavô paterno (pai do avô)"), ...bp1All.slice(1)],
    3,
    "paternal",
  );
  addSiblingGroup(
    "u_sib_bp2",
    bp2,
    [...get("Irmã(o) da Bisavó paterna (mãe do avô)"), ...bp2All.slice(1)],
    3,
    "paternal",
  );
  addSiblingGroup(
    "u_sib_bp3",
    bp3,
    [...get("Irmã(o) do Bisavô paterno (pai da avó)"), ...bp3All.slice(1)],
    3,
    "paternal",
  );
  addSiblingGroup(
    "u_sib_bp4",
    bp4,
    [...get("Irmã(o) da Bisavó paterna (mãe da avó)"), ...bp4All.slice(1)],
    3,
    "paternal",
  );
  addSiblingGroup(
    "u_sib_bm1",
    bm1,
    [...get("Irmã(o) do Bisavô materno (pai do avô)"), ...bm1All.slice(1)],
    3,
    "maternal",
  );
  addSiblingGroup(
    "u_sib_bm2",
    bm2,
    [...get("Irmã(o) da Bisavó materna (mãe do avô)"), ...bm2All.slice(1)],
    3,
    "maternal",
  );
  addSiblingGroup(
    "u_sib_bm3",
    bm3,
    [...get("Irmã(o) do Bisavô materno (pai da avó)"), ...bm3All.slice(1)],
    3,
    "maternal",
  );
  addSiblingGroup(
    "u_sib_bm4",
    bm4,
    [...get("Irmã(o) da Bisavó materna (mãe da avó)"), ...bm4All.slice(1)],
    3,
    "maternal",
  );

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
  } else {
    // Sem nenhum avô/avó paterno cadastrado: tios paternos ainda precisam
    // ancorar no pai (nível dele), senão caem no fallback "todos aparecem"
    // e ficam lado a lado com o paciente — parecendo irmãos dele.
    addSiblingGroup("u_sib_pai", pai, tiosPat, 1, "paternal");
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
  } else {
    addSiblingGroup("u_sib_mae", mae, tiosMat, 1, "maternal");
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
  // Mesmo problema um nível acima: sem nenhum bisavô cadastrado, os tios-avós
  // ancoram no avô/avó correspondente em vez de virar satélite do paciente.
  if (!bp1 && !bp2) addSiblingGroup("u_sib_avoPat", avoPat, tioAvoPatAvo, 2, "paternal");
  if (!bp3 && !bp4) addSiblingGroup("u_sib_avoPatF", avoPatF, tioAvoPatAva, 2, "paternal");
  if (!bm1 && !bm2) addSiblingGroup("u_sib_avoMat", avoMat, tioAvoMatAvo, 2, "maternal");
  if (!bm3 && !bm4) addSiblingGroup("u_sib_avoMatF", avoMatF, tioAvoMatAva, 2, "maternal");

  // ── Garantia "todos aparecem": ninguém cadastrado some do desenho ──
  // tiosPat/tiosMat/tios-avós/bisavós-satélite foram adicionados a g.persons
  // mais cedo mesmo quando a âncora (avós/bisavós) não existe — nesse caso
  // eles nunca ganham união e ficariam presos sem posição (nem "reconhecido"
  // nem "satélite"). Em vez de caçar cada caso hardcoded, caminha a partir
  // de pai/mãe pelas uniões já construídas: quem não é alcançável dali —
  // seja por nunca ter batido em nenhum parentesco, seja por ter ficado
  // "registrado" sem união de verdade — vira satélite do paciente. O canvas
  // só desenha quem tem posição no layout, então visível-mas-solto é sempre
  // melhor que invisível.
  const adjacency = new Map<string, Set<string>>();
  for (const u of g.unions.values()) {
    const members = [...u.partners, ...u.children];
    for (const a of members) {
      let set = adjacency.get(a);
      if (!set) {
        set = new Set();
        adjacency.set(a, set);
      }
      for (const b of members) if (a !== b) set.add(b);
    }
  }
  const reachableFromParents = new Set<string>();
  if (pai) reachableFromParents.add(pai.id);
  if (mae) reachableFromParents.add(mae.id);
  const queue = [...reachableFromParents];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!reachableFromParents.has(next)) {
        reachableFromParents.add(next);
        queue.push(next);
      }
    }
  }
  const irmaoIds = new Set(irmaos.map((s) => s.id));
  const orphans = persons.filter(
    (p) =>
      p.id !== proband.id &&
      p.id !== pai?.id &&
      p.id !== mae?.id &&
      !irmaoIds.has(p.id) &&
      !reachableFromParents.has(p.id),
  );
  orphans.forEach((p) => addPerson(p, 0, "other"));

  // Cada órfão vira satélite visível (bom), mas o motivo fica escondido do
  // clínico — sem isso, "por que essa pessoa está solta do lado do
  // paciente?" só se descobre lendo código. Um aviso por pessoa, com o que
  // fazer: falta ancestral cadastrado (parentesco reconhecido) ou falta
  // escolher a opção certa do menu (texto livre não reconhecido).
  for (const p of orphans) {
    const name = p.full_name?.trim() || "(sem nome)";
    const rawRel = p.relationship_to_proband?.trim();
    let message: string;
    if (!rawRel) {
      message = `${name}: linha sem parentesco definido — preencha ou apague essa linha na planilha.`;
    } else if (SYSTEM_KEYS.has(canonicalKey(p.relationship_to_proband))) {
      message = `${name}: parentesco "${rawRel}" reconhecido, mas falta cadastrar o ancestral correspondente para conectá-la(o) no lugar certo da árvore.`;
    } else {
      message = `${name}: parentesco "${rawRel}" não foi reconhecido — escolha uma opção específica da lista de parentesco em vez de texto livre.`;
    }
    g.warnings.push({ personId: p.id, personName: name, message });
  }

  // ── União central: Pai ⟷ Mãe (sintetizada mesmo sem RelRow) ─
  const rootPartners = [pai, mae].filter(Boolean) as PersonRow[];
  const probandChildren = [proband, ...irmaos, ...orphans];
  if (rootPartners.length > 0 || probandChildren.length > 1) {
    addUnion({
      id: `u_root_${proband.id}`,
      partners: rootPartners,
      children: probandChildren,
      generation: 1,
      branchId: "proband",
      rel: findUnionRel(pai, mae),
    });
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

  interface Extent {
    left: number;
    right: number;
  }
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
        const partners = pu.partners
          .map((pid) => g.persons.get(pid))
          .filter(Boolean) as PersonEntity[];

        // Sort: paternal (pai) à esquerda, maternal (mãe) à direita
        partners.sort((a, b) => {
          const relA = (a.row.relationship_to_proband || "").toLowerCase();
          const relB = (b.row.relationship_to_proband || "").toLowerCase();
          const isMale = (r: string) =>
            r.includes("pai") || r.includes("avô") || r.includes("bisavô");
          const isFemale = (r: string) =>
            r.includes("mãe") || r.includes("mae") || r.includes("avó") || r.includes("bisavó");
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

          const step = getSiblingStep(siblings.length);
          const siblingsWidth = siblings.length * step;
          if (side !== "root") {
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
            left = left - leftCount * step - BRANCH_GAP;
            right = right + rightCount * step + BRANCH_GAP;
          }
        }
      }
    }

    const ext = { left, right };
    personExtents.set(personId, ext);
    return ext;
  };

  // PASSO 2: Top-down assign positions
  const assignPosition = (
    personId: string,
    cx: number,
    gen: number,
    side: "root" | "paternal" | "maternal",
  ) => {
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
      const isFemale = (r: string) =>
        r.includes("mãe") || r.includes("mae") || r.includes("avó") || r.includes("bisavó");
      if (isMale(relA) && !isMale(relB)) return -1;
      if (isFemale(relA) && !isFemale(relB)) return 1;
      if (!isMale(relA) && isMale(relB)) return 1;
      if (!isFemale(relA) && isFemale(relB)) return -1;
      const gA = (a.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
      const gB = (b.row.gender || "").toLowerCase().startsWith("m") ? -1 : 1;
      return gA - gB;
    });

    if (partners.length === 2) {
      const D = unionD.get(parentUnionId) ?? COUPLE_GAP / 2;
      assignPosition(partners[0].id, cx - D, parentGen, "paternal");
      assignPosition(partners[1].id, cx + D, parentGen, "maternal");
    } else if (partners.length === 1) {
      const gender = partners[0].row.gender?.toLowerCase() || "";
      const pSide = gender.startsWith("m") ? "paternal" : "maternal";
      assignPosition(partners[0].id, cx, parentGen, pSide);
    }

    // Satélites (irmãos) pendurados do lado correto, fora da bounding box dos pais
    const siblings = pu.children.filter((cid) => cid !== personId);

    // Organiza os irmãos do mais velho para o mais novo
    siblings.sort((a, b) => {
      const pA = g.persons.get(a)?.row.birth_date;
      const pB = g.persons.get(b)?.row.birth_date;
      if (!pA && !pB) return 0;
      if (!pA) return 1;
      if (!pB) return -1;
      return new Date(pA).getTime() - new Date(pB).getTime();
    });

    if (siblings.length > 0) {
      let parentsLeft = -NODE_W / 2;
      let parentsRight = NODE_W / 2;

      if (partners.length === 2) {
        const pExt = personExtents.get(partners[0].id) || { left: -NODE_W / 2, right: NODE_W / 2 };
        const mExt = personExtents.get(partners[1].id) || { left: -NODE_W / 2, right: NODE_W / 2 };
        const D = unionD.get(parentUnionId) ?? COUPLE_GAP / 2;
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

      const step = getSiblingStep(siblings.length);
      if (side === "root") {
        let leftIdx = 0;
        let rightIdx = 0;
        siblings.forEach((sibId, i) => {
          if (i % 2 === 0) {
            placePerson(sibId, cx + parentsLeft - BRANCH_GAP - NODE_W / 2 - leftIdx * step, gen);
            leftIdx++;
          } else {
            placePerson(sibId, cx + parentsRight + BRANCH_GAP + NODE_W / 2 + rightIdx * step, gen);
            rightIdx++;
          }
        });
      } else {
        if (side === "maternal") {
          siblings.forEach((sibId, i) => {
            placePerson(sibId, cx + parentsRight + BRANCH_GAP + NODE_W / 2 + i * step, gen);
          });
        } else {
          siblings.forEach((sibId, i) => {
            placePerson(sibId, cx + parentsLeft - BRANCH_GAP - NODE_W / 2 - i * step, gen);
          });
        }
      }
    }
  };

  // Inicializa a árvore calculando larguras
  computeExtent(proband.id, "root");

  // Atribui as posições definitivas travando o eixo primário
  assignPosition(proband.id, 0, 0, "root");

  // ── Integração do Modelo Stateful Híbrido Incremental ──
  const finalPersonPos = new Map<string, { x: number; y: number }>();
  const finalUnionPos = new Map<string, { x: number; y: number }>();

  // 1. Aplica todas as posições salvas (Ancoragem Absoluta)
  for (const [id, pos] of g.positions) {
    if (pos.node_type === "person") finalPersonPos.set(id, { x: pos.x, y: pos.y });
    if (pos.node_type === "union") finalUnionPos.set(id, { x: pos.x, y: pos.y });
  }

  // 2. Função de Shift Dinâmico: encontra a âncora mais próxima
  const getShift = (pid: string): { dx: number; dy: number } => {
    const parentUnionId = parentUnionOfPerson.get(pid);
    if (parentUnionId) {
      if (finalUnionPos.has(parentUnionId)) {
        const ideal = unionPos.get(parentUnionId);
        const final = finalUnionPos.get(parentUnionId);
        if (ideal && final) return { dx: final.x - ideal.x, dy: final.y - ideal.y };
      }
      const pu = g.unions.get(parentUnionId);
      if (pu) {
        for (const partnerId of pu.partners) {
          if (finalPersonPos.has(partnerId)) {
            const ideal = personPos.get(partnerId);
            const final = finalPersonPos.get(partnerId);
            if (ideal && final) return { dx: final.x - ideal.x, dy: final.y - ideal.y };
          }
        }
      }
    }
    if (finalPersonPos.has(proband.id)) {
      const ideal = personPos.get(proband.id);
      const final = finalPersonPos.get(proband.id);
      if (ideal && final) return { dx: final.x - ideal.x, dy: final.y - ideal.y };
    }
    return { dx: 0, dy: 0 };
  };

  // 3. Aplica o shift aos nós não-salvos (Posicionamento Relativo)
  for (const [pid, idealPos] of personPos) {
    if (!finalPersonPos.has(pid)) {
      const shift = getShift(pid);
      finalPersonPos.set(pid, { x: idealPos.x + shift.dx, y: idealPos.y + shift.dy });
    }
  }

  for (const [uid, idealPos] of unionPos) {
    if (!finalUnionPos.has(uid)) {
      const union = g.unions.get(uid);
      if (union) {
        let shift = { dx: 0, dy: 0 };
        const partnerAnchors = union.partners.filter((p) => g.positions.has(p));
        if (partnerAnchors.length > 0) {
          const pId = partnerAnchors[0];
          const pIdeal = personPos.get(pId);
          const pFinal = finalPersonPos.get(pId);
          if (pIdeal && pFinal) shift = { dx: pFinal.x - pIdeal.x, dy: pFinal.y - pIdeal.y };
        } else if (finalPersonPos.has(proband.id)) {
          const ideal = personPos.get(proband.id);
          const final = finalPersonPos.get(proband.id);
          if (ideal && final) shift = { dx: final.x - ideal.x, dy: final.y - ideal.y };
        }
        finalUnionPos.set(uid, { x: idealPos.x + shift.dx, y: idealPos.y + shift.dy });
      } else {
        finalUnionPos.set(uid, { x: idealPos.x, y: idealPos.y });
      }
    }
  }

  const placement = { personPos: finalPersonPos, unionPos: finalUnionPos };
  if (import.meta.env.DEV) {
    const violations = checkLayoutInvariants(g, placement);
    if (violations.length > 0) {
      console.warn(`Genogram layout: ${violations.length} violação(ões)`, violations);
    }
  }

  return placement;
}
