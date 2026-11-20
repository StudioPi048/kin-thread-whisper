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
  return NODE_W + SIBLING_GAP + (siblingsCount > 3 ? 16 : 0);
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

export type PersonLane = "ancestral" | "social" | "descendant" | "pending";

export interface PersonEntity {
  id: string;
  row: PersonRow;
  generation: number;
  branchId: BranchId;
  lane: PersonLane;
}

export interface UnionEntity {
  id: string;
  partners: string[]; // 1 ou 2 personIds; um pode ser sintético "unknown"
  children: string[];
  kind: UnionKind;
  label: string;
  generation: number; // = geração do casal (pais)
  branchId: BranchId;
  direction: "up" | "down";
}

export interface LogicalEdge {
  kind: "partner" | "child";
  personId: string;
  unionId: string;
  childKind?: ParentKind;
  suggested?: boolean;
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
  topRowIds: Set<string>;
  pendingPersonIds: Set<string>;
  parentsByChild: Map<string, ResolvedParent[]>;
  suggestedParentsByChild: Map<string, ResolvedParent[]>;
}

// Compatibilidade com planilhas antigas. Cada par declara os pais da pessoa
// indicada pelo caminho completo. Os rótulos não substituem vínculos por ID.
const ANCESTOR_FAMILIES = [
  { child: "Consulente", parents: ["Pai", "Mãe"], generation: 1, id: "root" },
  { child: "Pai", parents: ["Avô paterno", "Avó paterna"], generation: 2, id: "gp_pat" },
  { child: "Mãe", parents: ["Avô materno", "Avó materna"], generation: 2, id: "gp_mat" },
  {
    child: "Avô paterno",
    parents: ["Bisavô paterno (pai do avô)", "Bisavó paterna (mãe do avô)"],
    generation: 3,
    id: "ggp_pat_avo",
  },
  {
    child: "Avó paterna",
    parents: ["Bisavô paterno (pai da avó)", "Bisavó paterna (mãe da avó)"],
    generation: 3,
    id: "ggp_pat_ava",
  },
  {
    child: "Avô materno",
    parents: ["Bisavô materno (pai do avô)", "Bisavó materna (mãe do avô)"],
    generation: 3,
    id: "ggp_mat_avo",
  },
  {
    child: "Avó materna",
    parents: ["Bisavô materno (pai da avó)", "Bisavó materna (mãe da avó)"],
    generation: 3,
    id: "ggp_mat_ava",
  },
] as const;

type Side = "paternal" | "maternal";
type AncestorSlot = { genderRole: Side; generation: number; branchId: Side };
const ancestorSlots = new Map<string, AncestorSlot>();
for (const family of ANCESTOR_FAMILIES) {
  family.parents.forEach((role, i) => {
    const genderRole: Side = i === 0 ? "paternal" : "maternal";
    const branchId =
      family.generation === 1 ? genderRole : /pat[ea]rn/.test(role) ? "paternal" : "maternal";
    ancestorSlots.set(role, { generation: family.generation, genderRole, branchId });
  });
}
const collateralAnchors = new Map<string, string>();
for (const role of ancestorSlots.keys()) {
  collateralAnchors.set(smartNormalizeRelationship(`Irmã(o) do ${role}`), role);
  collateralAnchors.set(smartNormalizeRelationship(`Irmã(o) da ${role}`), role);
}

export type ParentKind = "biological" | "adoptive" | "foster" | "stepparent" | "unknown";

export interface ResolvedParent {
  personId: string;
  kind: ParentKind;
  source: "explicit" | "legacy" | "suggested";
  relationshipId?: string;
}

export function getResolvedParents(
  graph: LogicalGraph,
  personId: string,
): readonly ResolvedParent[] {
  return graph.parentsByChild.get(personId) ?? [];
}

/** Candidatos que só existem no desenho até aprovação explícita. */
export function getSuggestedParents(
  graph: LogicalGraph,
  personId: string,
): readonly ResolvedParent[] {
  return graph.suggestedParentsByChild.get(personId) ?? [];
}

function parentKind(qualifier: string | null): ParentKind {
  const value = qualifier
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!value || /^biolog/.test(value)) return "biological";
  if (/adot|adopt/.test(value)) return "adoptive";
  if (/acolh|criac|foster|guarda/.test(value)) return "foster";
  if (/stepparent|padrasto|madrasta/.test(value)) return "stepparent";
  return "unknown";
}

const pairKey = (ids: readonly string[]) => [...ids].sort().join("|");

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
  if (kind === "casamento" && order && order > 1) return `${order}º casamento`;
  return map[kind];
}

function deriveUnionKind(rel: RelRow | undefined): UnionKind {
  if (!rel) return "desconhecido";
  switch (rel.qualifier) {
    case "divorce":
    case "rupture":
    case "separation":
      return "divorcio";
    case "cohabitation":
      return "uniao_estavel";
    case "engagement":
      return "namoro";
    default:
      return "casamento";
  }
}

interface BuildOptions {
  persons: PersonRow[];
  rels: RelRow[];
  probandId?: string;
  positions?: NodePositionRow[];
}

/** Geração nominal para as etiquetas legadas, inclusive em listagens sem vínculos. */
export function recognizedGeneration(rel: string | null | undefined): number {
  const role = smartNormalizeRelationship(rel);
  const slot = ancestorSlots.get(collateralAnchors.get(role) ?? role);
  if (slot) return slot.generation;
  const text = role
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\b(bisav|great-grand)/.test(text)) return 3;
  if (/\b(av[oah]|grand)/.test(text)) return 2;
  if (/\b(ti[oa]|uncle|aunt)\b/.test(text)) return 1;
  return 0;
}

function reach<T>(seeds: Iterable<T>, neighbors: (node: T) => Iterable<T>): Set<T> {
  const queue = [...seeds];
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbors(queue[i])) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function indexedSets() {
  const map = new Map<string, Set<string>>();
  return {
    add(key: string, id: string) {
      const ids = map.get(key) ?? new Set<string>();
      ids.add(id);
      map.set(key, ids);
    },
    get(key: string): Iterable<string> {
      return map.get(key) ?? [];
    },
  };
}

const biologicalParents = (parents: readonly ResolvedParent[]) =>
  parents.filter((p) => p.kind === "biological");

function comparePersons(a: PersonRow, b: PersonRow): number {
  return (
    (a.birth_order ?? Number.MAX_SAFE_INTEGER) - (b.birth_order ?? Number.MAX_SAFE_INTEGER) ||
    (a.birth_date ?? "9999").localeCompare(b.birth_date ?? "9999") ||
    a.full_name.localeCompare(b.full_name, "pt-BR") ||
    a.id.localeCompare(b.id)
  );
}

function parentSide(person: PersonEntity): Side | undefined {
  const role = smartNormalizeRelationship(person.row.relationship_to_proband);
  const slot = ancestorSlots.get(role);
  if (slot) return slot.genderRole;
  const gender = person.row.gender?.toLowerCase();
  if (gender === "m" || gender === "masculino") return "paternal";
  if (gender === "f" || gender === "feminino") return "maternal";
  return undefined;
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
    positions: new Map(positions?.map((p) => [p.node_id, p])),
    topRowIds: new Set(),
    pendingPersonIds: new Set(),
    parentsByChild: new Map(),
    suggestedParentsByChild: new Map(),
  };
  if (!persons.length) return g;

  const byId = new Map(persons.map((p) => [p.id, p]));
  const byRole = new Map<string, PersonRow[]>();
  for (const p of persons) {
    const role = smartNormalizeRelationship(p.relationship_to_proband);
    const group = byRole.get(role) ?? [];
    group.push(p);
    byRole.set(role, group);
  }
  const flagged = persons.filter((p) => p.is_proband);
  const tagged = byRole.get("Consulente") ?? [];
  const proband =
    (probandId ? byId.get(probandId) : undefined) ??
    flagged.sort(comparePersons)[0] ??
    tagged.sort(comparePersons)[0] ??
    [...persons].sort(comparePersons)[0];
  g.probandId = proband.id;
  g.topRowIds.add(proband.id);
  if (!probandId && (flagged.length > 1 || (flagged.length === 0 && tagged.length !== 1))) {
    g.errors.push("Identifique um único consulente na planilha para confirmar o foco da árvore.");
  }

  const warn = (personId: string, detail: string) => {
    const name = byId.get(personId)?.full_name?.trim() || "Pessoa sem nome";
    g.pendingPersonIds.add(personId);
    g.warnings.push({ personId, personName: name, message: `${name}: ${detail}` });
  };
  for (const p of [...persons].sort(comparePersons)) {
    const role = smartNormalizeRelationship(p.relationship_to_proband);
    const slot = ancestorSlots.get(collateralAnchors.get(role) ?? role);
    g.persons.set(p.id, {
      id: p.id,
      row: p,
      generation: recognizedGeneration(role),
      branchId: p.id === proband.id ? "proband" : (slot?.branchId ?? "other"),
      lane: "pending",
    });
  }

  // A review can explicitly leave a parent unknown. Keep a legacy role from
  // recreating a relationship that the professional just removed.
  const reviewedChildren = new Set(persons.filter((p) => p.parentage_reviewed).map((p) => p.id));
  const declaredChildren = new Set(reviewedChildren);
  const childrenWithRecords = new Set<string>();
  const invalidChildren = new Set<string>();
  const unionRels = new Map<string, RelRow>();
  const siblings = new Map<string, Set<string>>();
  const ambiguousSiblingPairs = new Set<string>();
  for (const r of [...rels].sort((a, b) => a.id.localeCompare(b.id))) {
    const from = byId.get(r.from_person_id);
    const to = byId.get(r.to_person_id);
    if (r.relationship_type === "parent" && to) {
      declaredChildren.add(to.id);
      childrenWithRecords.add(to.id);
      if (!from || from.client_id !== to.client_id || r.client_id !== to.client_id) {
        warn(to.id, "um dos pais informados não consta neste dossiê. Revise a filiação.");
        continue;
      }
      if (from.id === to.id) {
        g.errors.push(`${to.full_name} foi vinculada como genitor(a) de si mesma.`);
        invalidChildren.add(to.id);
        continue;
      }
      const parents = g.parentsByChild.get(to.id) ?? [];
      const conflicting = parents.find((p) => p.personId === from.id);
      const kind = parentKind(r.qualifier);
      if (conflicting && conflicting.kind !== kind) {
        invalidChildren.add(to.id);
        warn(to.id, "o mesmo genitor tem tipos de filiação incompatíveis. Revise os vínculos.");
      } else if (!conflicting) {
        parents.push({ personId: from.id, kind, source: "explicit", relationshipId: r.id });
      }
      g.parentsByChild.set(to.id, parents);
      continue;
    }
    if (
      !from ||
      !to ||
      from.id === to.id ||
      from.client_id !== to.client_id ||
      r.client_id !== from.client_id
    )
      continue;
    if (r.relationship_type === "union") {
      unionRels.set(pairKey([from.id, to.id]), r);
    } else if (r.relationship_type === "sibling") {
      if (r.qualifier !== "biological" && r.qualifier !== "twin") {
        ambiguousSiblingPairs.add(pairKey([from.id, to.id]));
      }
      const id = from.id === proband.id ? to.id : to.id === proband.id ? from.id : null;
      if (!id) continue;
      const qualifiers = siblings.get(id) ?? new Set<string>();
      qualifiers.add(r.qualifier ?? "");
      siblings.set(id, qualifiers);
    }
  }
  for (const [child, parents] of g.parentsByChild) {
    if (parents.length <= 2) continue;
    g.errors.push(
      `${byId.get(child)?.full_name} tem ${parents.length} genitores declarados (máximo 2). Revise os vínculos.`,
    );
    invalidChildren.add(child);
  }
  for (const child of invalidChildren) g.parentsByChild.delete(child);

  const legacyUnionIds = new Map<string, string>();
  const chosenRoles = new Map<string, PersonRow>([["Consulente", proband]]);
  const pickRole = (role: string, child: PersonRow) => {
    const candidates = (byRole.get(role) ?? []).filter((p) => p.client_id === child.client_id);
    const explicit = g.parentsByChild.get(child.id) ?? [];
    const linked = candidates.filter((p) => explicit.some((link) => link.personId === p.id));
    if (declaredChildren.has(child.id)) return linked.length === 1 ? linked[0] : undefined;
    if (candidates.length > 1) {
      for (const p of candidates) {
        warn(p.id, `mais de uma pessoa ocupa "${role}". Confirme quem é o genitor na planilha.`);
      }
      return undefined;
    }
    return candidates[0];
  };

  const inferred = (p: PersonRow): ResolvedParent => ({
    personId: p.id,
    kind: "biological",
    source: "legacy",
  });
  for (const { child: childRole, parents: roles, id } of ANCESTOR_FAMILIES) {
    const child = chosenRoles.get(childRole);
    if (!child) continue;
    const slots = roles.map((role) => pickRole(role, child));
    const hints = slots.filter((p): p is PersonRow => p !== undefined);
    slots.forEach((p, i) => {
      if (p) chosenRoles.set(roles[i], p);
    });
    if (hints.length === 0) continue;
    legacyUnionIds.set(
      pairKey(hints.map((p) => p.id)),
      `u_${id === "root" ? `root_${proband.id}` : id}`,
    );
    if (!declaredChildren.has(child.id)) g.parentsByChild.set(child.id, hints.map(inferred));
  }

  // Um rótulo de colateral só localiza a faixa e o ramo. Mesmo sabendo
  // qual avô é o irmão, ele pode compartilhar apenas um dos genitores.
  for (const p of persons) {
    if (p.id === proband.id || declaredChildren.has(p.id)) continue;
    const role = smartNormalizeRelationship(p.relationship_to_proband);
    if (p.client_id !== proband.client_id) continue;
    if (role === "Filho(a)") {
      g.parentsByChild.set(p.id, [inferred(proband)]);
      continue;
    }
    const text = role
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const halfSibling = text.match(/^mei[oa][ -]irmao? (patern[oa]|matern[oa]|de pai|de mae)$/);
    if (halfSibling) {
      const side: Side = /^(patern|de pai)/.test(halfSibling[1]) ? "paternal" : "maternal";
      const parents = biologicalParents(getResolvedParents(g, proband.id)).filter(
        (link) => parentSide(g.persons.get(link.personId)!) === side,
      );
      if (parents.length === 1) {
        g.parentsByChild.set(p.id, [inferred(g.persons.get(parents[0].personId)!.row)]);
      }
      continue;
    }
    if (role !== "Irmã(o)" || siblings.has(p.id)) continue;
    const parents = getResolvedParents(g, proband.id);
    if (parents.length > 0 && parents.every((parent) => parent.kind === "biological")) {
      g.parentsByChild.set(
        p.id,
        parents.map((parent) => ({
          personId: parent.personId,
          kind: "biological",
          source: "legacy",
        })),
      );
    }
  }

  const parentsOf = (id: string) => getResolvedParents(g, id).map((p) => p.personId);
  const cyclic = new Set<string>();
  for (const [child, parents] of g.parentsByChild) {
    const ancestors = reach(
      parents.map((p) => p.personId),
      parentsOf,
    );
    if (ancestors.has(child)) cyclic.add(child);
  }
  for (const child of cyclic) {
    g.parentsByChild.delete(child);
    g.errors.push(
      `Vínculos contraditórios envolvendo ${byId.get(child)?.full_name}: existe um ciclo de filiação.`,
    );
    warn(child, "revise a filiação que forma um ciclo.");
  }

  const probandParents = new Set(
    biologicalParents(getResolvedParents(g, proband.id)).map((p) => p.personId),
  );
  const indexAncestors = reach(parentsOf(proband.id), parentsOf);
  const children = indexedSets();
  for (const [child, parents] of g.parentsByChild) {
    for (const parent of parents) children.add(parent.personId, child);
  }
  const indexDescendants = reach(children.get(proband.id), children.get);

  for (const [id, p] of g.persons) {
    if (id === proband.id || indexAncestors.has(id) || indexDescendants.has(id)) continue;
    const qualifiers = siblings.get(id);
    const shared = biologicalParents(getResolvedParents(g, id)).some((parent) =>
      probandParents.has(parent.personId),
    );
    const bloodTag = p.row.relationship_to_proband
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    const declaredBlood =
      /^irmao? (?:biologic[oa]|de sangue)(?: (?:do consulente|do paciente))?$/.test(
        bloodTag ?? "",
      ) || [...(qualifiers ?? [])].some((q) => q === "biological" || q === "twin" || q === "half");
    if (declaredBlood && qualifiers?.has("adoptive")) {
      warn(id, "a irmandade está registrada como biológica e adotiva. Confira os vínculos.");
      if (!shared) continue;
    }
    const parents = getResolvedParents(g, id);
    if (shared || (declaredBlood && parents.length === 0 && !childrenWithRecords.has(id))) {
      g.topRowIds.add(id);
      if (parents.length === 0)
        warn(id, "irmandade declarada. Informe os pais conhecidos para conectar a filiação.");
    } else if (declaredBlood && probandParents.size > 0 && parents.length > 0) {
      warn(
        id,
        "a irmandade declarada não coincide com a filiação biológica disponível. Confirme os pais.",
      );
    }
  }

  // A reprodução de uma segunda união pode ligar um ascendente a mais de um
  // ramo. Canonizamos a geração uma vez por pessoa, a partir das filiações.
  resolveGenerations(g, unionRels, siblings);

  // "Irmã(o) do Pai/Mãe" é um papel inequívoco na planilha, mas não
  // confirma que a irmandade é plena. A árvore apresenta o par candidato
  // visualmente, sem incorporá-lo aos vínculos resolvidos do dossiê.
  for (const family of ANCESTOR_FAMILIES.filter((item) => item.generation === 2)) {
    const anchor = chosenRoles.get(family.child);
    if (!anchor || invalidChildren.has(anchor.id) || cyclic.has(anchor.id)) continue;
    const resolved = getResolvedParents(g, anchor.id);
    if (!resolved.length || resolved.some((parent) => parent.kind !== "biological")) continue;
    let candidatePair = [...resolved];

    if (
      resolved.length === 1 &&
      resolved[0].source === "explicit" &&
      !reviewedChildren.has(anchor.id)
    ) {
      const [recorded] = resolved;
      const role = smartNormalizeRelationship(byId.get(recorded.personId)?.relationship_to_proband);
      const matched = family.parents.findIndex((slot) => slot === role);
      if (matched < 0) continue;
      const missingRole = family.parents[1 - matched];
      const candidates = (byRole.get(missingRole) ?? []).filter(
        (person) => person.client_id === anchor.client_id,
      );
      if (candidates.length !== 1) continue;
      const [candidate] = candidates;
      if (
        reach([candidate.id], parentsOf).has(anchor.id) ||
        g.persons.get(candidate.id)!.generation <= g.persons.get(anchor.id)!.generation
      )
        continue;
      const suggestion: ResolvedParent = {
        personId: candidate.id,
        kind: "biological",
        source: "suggested",
      };
      g.suggestedParentsByChild.set(anchor.id, [suggestion]);
      warn(anchor.id, "segundo genitor sugerido pelo ramo. Confira antes de confirmar.");
      candidatePair = [...resolved, suggestion];
    }

    if (candidatePair.length !== 2) continue;
    const familyId = `u_${family.id}`;
    const resolvedKey = pairKey(resolved.map((parent) => parent.personId));
    if (resolved.length === 1 && legacyUnionIds.get(resolvedKey) === familyId) {
      legacyUnionIds.delete(resolvedKey);
    }
    legacyUnionIds.set(pairKey(candidatePair.map((parent) => parent.personId)), familyId);
    const siblingRole = family.child === "Pai" ? "Irmã(o) do Pai" : "Irmã(o) da Mãe";
    for (const person of byRole.get(siblingRole) ?? []) {
      if (
        person.client_id !== anchor.client_id ||
        person.id === proband.id ||
        declaredChildren.has(person.id) ||
        ambiguousSiblingPairs.has(pairKey([person.id, anchor.id])) ||
        unionRels.has(pairKey([person.id, anchor.id])) ||
        candidatePair.some(
          (parent) =>
            g.persons.get(parent.personId)!.generation <= g.persons.get(person.id)!.generation ||
            reach([parent.personId], parentsOf).has(person.id),
        )
      )
        continue;
      g.suggestedParentsByChild.set(
        person.id,
        candidatePair.map(({ personId, kind }) => ({ personId, kind, source: "suggested" })),
      );
      warn(person.id, "filiação sugerida pelo ramo. Confira quais pais são compartilhados.");
    }
  }

  for (const [id, person] of g.persons) {
    if (person.lane !== "pending" || g.pendingPersonIds.has(id)) continue;
    warn(
      id,
      "sem ligação confirmada com a árvore do consulente. Informe a filiação por pessoa na planilha.",
    );
  }

  const displayChildren = new Set([
    ...g.parentsByChild.keys(),
    ...g.suggestedParentsByChild.keys(),
  ]);
  for (const child of displayChildren) {
    const suggested = getSuggestedParents(g, child);
    const parents = [...getResolvedParents(g, child), ...suggested];
    if (!parents.length) continue;
    const person = g.persons.get(child)!;
    const parentIds = parents.map((p) => p.personId);
    const key = pairKey(parentIds);
    const direction = person.lane === "descendant" ? "down" : "up";
    const id =
      (legacyUnionIds.get(key) ?? `u_exp_${key.replace(/\|/g, "_")}`) +
      (direction === "down" ? "_desc" : "");
    const kids = g.unions.get(id)?.children ?? [];
    if (!g.unions.has(id)) {
      const relation = unionRels.get(key);
      const kind = deriveUnionKind(relation);
      g.unions.set(id, {
        id,
        partners: parentIds,
        children: kids,
        kind,
        label: relation ? unionKindLabel(kind, relation.marriage_order) : "",
        generation: Math.max(...parentIds.map((p) => g.persons.get(p)!.generation)),
        branchId: person.branchId,
        direction,
      });
      for (const pid of parentIds) g.edges.push({ kind: "partner", personId: pid, unionId: id });
    }
    kids.push(child);
    const edgeKind = parents.find((p) => p.kind !== "biological")?.kind ?? "biological";
    g.edges.push({
      kind: "child",
      personId: child,
      unionId: id,
      childKind: edgeKind,
      ...(suggested.length > 0 ? { suggested: true } : {}),
    });
  }
  // Alguns casais não têm filhos registrados. Preservamos uniões explicitadas
  // sem convertê-las em filiação, inclusive cônjuge do consulente.
  for (const [key, rel] of unionRels) {
    if ([...g.unions.values()].some((u) => pairKey(u.partners) === key)) continue;
    const id = `u_exp_${key.replace(/\|/g, "_")}`;
    const partners = [rel.from_person_id, rel.to_person_id];
    const kind = deriveUnionKind(rel);
    g.unions.set(id, {
      id,
      partners,
      children: [],
      kind,
      label: unionKindLabel(kind, rel.marriage_order),
      generation: Math.max(...partners.map((p) => g.persons.get(p)!.generation)),
      branchId: "other",
      direction: "up",
    });
    for (const personId of partners) g.edges.push({ kind: "partner", personId, unionId: id });
  }

  for (const u of g.unions.values()) {
    u.children.sort((a, b) => comparePersons(g.persons.get(a)!.row, g.persons.get(b)!.row));
  }
  return g;
}

function resolveGenerations(
  g: LogicalGraph,
  unionRels: Map<string, RelRow>,
  siblings: Map<string, Set<string>>,
) {
  const parentsOf = (id: string) => getResolvedParents(g, id).map((p) => p.personId);
  const ascending = reach(g.topRowIds, parentsOf);
  const root = g.probandId!;
  const rootParentIds = parentsOf(root);
  const branches = new Map<string, Set<Side>>();
  for (const id of rootParentIds) {
    const parent = g.persons.get(id)!;
    const side = parentSide(parent);
    const equallyLabeled = rootParentIds.some(
      (p) => p !== id && parentSide(g.persons.get(p)!) === side,
    );
    if (!side || equallyLabeled) continue;
    for (const ancestor of reach([id], parentsOf)) {
      const set = branches.get(ancestor) ?? new Set<Side>();
      set.add(side);
      branches.set(ancestor, set);
    }
  }

  // A ordem topológica garante que um mesmo ancestral em dois ramos
  // mantém uma posição só. Uma geração intermediária pode ser saltada
  // quando as fontes descrevem um ancestral comum a níveis distintos.
  const children = indexedSets();
  const remaining = new Map<string, number>();
  for (const [child, parents] of g.parentsByChild) {
    for (const p of parents) children.add(p.personId, child);
    remaining.set(child, parents.length);
  }
  const descending = reach(g.topRowIds, children.get);
  const social = new Set<string>(siblings.keys());
  for (const rel of unionRels.values()) {
    if (g.topRowIds.has(rel.from_person_id)) social.add(rel.to_person_id);
    if (g.topRowIds.has(rel.to_person_id)) social.add(rel.from_person_id);
  }

  const generation = new Map<string, number>();
  const upQueue = [...g.topRowIds];
  for (const id of upQueue) generation.set(id, 0);
  for (let i = 0; i < upQueue.length; i++) {
    const child = upQueue[i];
    const next = generation.get(child)! + 1;
    for (const parent of parentsOf(child)) {
      if ((generation.get(parent) ?? -1) >= next) continue;
      generation.set(parent, next);
      upQueue.push(parent);
    }
  }
  const lastAncestor = Math.max(0, ...generation.values());

  for (const id of ascending) {
    const person = g.persons.get(id)!;
    person.lane = "ancestral";
    person.generation = generation.get(id)!;
    const sides = branches.get(id);
    if (sides?.size === 1) person.branchId = [...sides][0];
    if (sides?.size === 2) person.branchId = "other";
  }
  for (const [id, p] of g.persons) {
    if (ascending.has(id)) continue;
    const sharedParents = parentsOf(id).filter((parent) => ascending.has(parent));
    if (descending.has(id)) {
      p.lane = "descendant";
      p.generation = lastAncestor + 1;
    } else if (
      social.has(id) ||
      (sharedParents.length > 0 && sharedParents.every((parent) => generation.get(parent) === 1)) ||
      smartNormalizeRelationship(p.row.relationship_to_proband) === "Cônjuge" ||
      /^irm[ãa](?:o|\(o\))? (?:adotiv[oa]|de criaç[aã]o|socioafetiv[oa]|por afinidade)$/i.test(
        p.row.relationship_to_proband?.trim() ?? "",
      )
    ) {
      p.lane = "social";
      p.generation = 0.5;
    } else if (sharedParents.length > 0) {
      p.lane = "ancestral";
      p.generation = Math.max(
        1,
        Math.min(...sharedParents.map((parent) => generation.get(parent)!)) - 1,
      );
      const sides = new Set(sharedParents.map((parent) => g.persons.get(parent)!.branchId));
      if (sides.size === 1) p.branchId = [...sides][0];
    } else {
      p.generation = Math.max(1, p.generation);
    }
  }

  const ordered = [...g.persons.keys()].filter((id) => !remaining.has(id));
  for (let i = 0; i < ordered.length; i++) {
    for (const child of children.get(ordered[i])) {
      const count = remaining.get(child)! - 1;
      remaining.set(child, count);
      if (count === 0) ordered.push(child);
    }
  }
  for (const id of ordered) {
    const person = g.persons.get(id)!;
    if (person.lane !== "descendant") continue;
    const deepestParent = Math.max(...parentsOf(id).map((p) => g.persons.get(p)!.generation));
    person.generation = Math.max(person.generation, deepestParent + 1);
  }
  // Genitores de parentes desligados do tronco ainda precisam aparecer no
  // lugar certo em relação ao próprio filho. A cadeia ancestral conhecida
  // do consultante não é movida por essas ocorrências.
  for (const id of ordered.reverse()) {
    const person = g.persons.get(id)!;
    if (person.lane === "descendant") continue;
    for (const parent of parentsOf(id)) {
      if (ascending.has(parent)) continue;
      const p = g.persons.get(parent)!;
      p.generation = Math.max(p.generation, Math.ceil(person.generation + 0.5));
    }
  }
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
  /** Quantas posições salvas tiveram Y corrigido para a faixa da geração (x preservado). */
  normalizedY?: number;
  /** Posições guardadas sobrepostas ou entrelaçadas, reorganizadas na edição. */
  adjustedX?: number;
}

/** Y canônico por geração — cliente+irmãos (0) no topo, ancestrais abaixo. */
export const genY = (gen: number) => gen * GEN_GAP;
export const unionY = (gen: number) => gen * GEN_GAP + PERSON_SHAPE / 2;

type Point = { x: number; y: number };

/** Centro do encaixe; a vista subtrai metade do tamanho do nó para renderizá-lo. */
export function placeUnionHub(
  union: Pick<UnionEntity, "partners" | "direction">,
  positions: ReadonlyMap<string, Point>,
): Point | null {
  const partners = union.partners.flatMap((id) => {
    const position = positions.get(id);
    return position ? [position] : [];
  });
  if (partners.length !== union.partners.length || !partners.length) return null;
  const x = partners.reduce((total, p) => total + p.x + NODE_W / 2, 0) / partners.length;
  const y = partners.reduce((total, p) => total + p.y + PERSON_SHAPE / 2, 0) / partners.length;
  const blocked = [...positions].some(
    ([id, position]) =>
      !union.partners.includes(id) &&
      Math.abs(position.x + NODE_W / 2 - x) < NODE_W / 2 + 8 &&
      y >= position.y &&
      y <= position.y + NODE_H,
  );
  if (partners.length === 1 || blocked) {
    return {
      x,
      y:
        union.direction === "up"
          ? Math.min(...partners.map((partner) => partner.y)) - 12
          : Math.max(...partners.map((partner) => partner.y)) + NODE_H + 12,
    };
  }
  return { x, y };
}

type Extent = { left: number; right: number };
const cardExtent = { left: NODE_W / 2, right: NODE_W / 2 };
const NODE_STEP = NODE_W + SIBLING_GAP;
// A abertura de um casal e a folga entre casais são medidas distintas.
// Nas quatro gerações de um pedigree regular, eixos adjacentes podem ficar
// a 316px: dois casais de 160px cabem com 156px livres entre centros.
const COUPLE_BLOCK_STEP = NODE_W + 12;
const POSITION_EPS = 0.001;

function centerOfSpan(xs: readonly number[]): number {
  return (Math.min(...xs) + Math.max(...xs)) / 2;
}

export function layoutGraph(g: LogicalGraph): Placement {
  const personPos = new Map<string, { x: number; y: number }>();
  const unionPos = new Map<string, { x: number; y: number }>();
  if (!g.probandId || !g.persons.has(g.probandId)) return { personPos, unionPos };

  const root = g.probandId;
  const parentUnion = new Map<string, UnionEntity>();
  const participants = new Map<string, UnionEntity[]>();
  for (const union of g.unions.values()) {
    for (const child of union.children) {
      if (union.direction === "up") parentUnion.set(child, union);
    }
    for (const id of [...union.partners, ...union.children]) {
      const list = participants.get(id) ?? [];
      list.push(union);
      participants.set(id, list);
    }
  }

  const sortedPartners = (union: UnionEntity) =>
    [...union.partners].sort((a, b) => {
      const order = (id: string) => {
        const side = parentSide(g.persons.get(id)!);
        return side === "paternal" ? 0 : side === "maternal" ? 2 : 1;
      };
      return order(a) - order(b) || comparePersons(g.persons.get(a)!.row, g.persons.get(b)!.row);
    });
  const singleCouples = [...g.unions.values()].filter(
    (union) =>
      union.direction === "up" &&
      union.partners.length === 2 &&
      union.children.length > 0 &&
      union.partners.every(
        (id) => participants.get(id)?.filter((item) => item.partners.includes(id)).length === 1,
      ),
  );
  const partnersShareRow = (union: UnionEntity) =>
    union.partners.every((id) => g.persons.get(id)!.generation === union.generation);
  const partnerOffsets = new Map<string, number[]>();
  const extents = new Map<string, Extent>();
  const ascendingOrder = [...g.persons.values()].sort((a, b) => b.generation - a.generation);
  for (const person of ascendingOrder) {
    const origin = parentUnion.get(person.id);
    if (!origin) {
      extents.set(person.id, cardExtent);
      continue;
    }
    const [a, b] = sortedPartners(origin);
    const left = extents.get(a) ?? cardExtent;
    if (!b) {
      extents.set(person.id, left);
      partnerOffsets.set(origin.id, [0]);
      continue;
    }
    const right = extents.get(b) ?? cardExtent;
    const spacing = Math.max(NODE_STEP, left.right + right.left + BRANCH_GAP) / 2;
    partnerOffsets.set(origin.id, [-spacing, spacing]);
    extents.set(person.id, {
      left: Math.max(cardExtent.left, spacing + left.left),
      right: Math.max(cardExtent.right, spacing + right.right),
    });
  }

  const centers = new Map<string, number>([[root, 0]]);
  const row = [...g.topRowIds].sort((a, b) =>
    comparePersons(g.persons.get(a)!.row, g.persons.get(b)!.row),
  );
  const rootIndex = row.indexOf(root);
  row.forEach((id, index) => centers.set(id, (index - rootIndex) * getSiblingStep(row.length - 1)));

  // A posição de um ancestral compartilhado é atribuída uma única vez.
  const ancestralQueue = [root, ...row.filter((id) => id !== root)];
  const placedOrigins = new Set<string>();
  for (let i = 0; i < ancestralQueue.length; i++) {
    const id = ancestralQueue[i];
    const origin = parentUnion.get(id);
    if (!origin || placedOrigins.has(origin.id)) continue;
    placedOrigins.add(origin.id);
    const anchor = centers.get(id)!;
    const focusGeneration = g.persons.get(id)!.generation;
    const childCenters = new Map<number, number[]>();
    for (const child of origin.children) {
      if (centers.has(child)) continue;
      const person = g.persons.get(child)!;
      const direction = person.branchId === "paternal" ? -1 : 1;
      const others = origin.children
        .filter(
          (sibling) =>
            centers.has(sibling) && g.persons.get(sibling)!.generation === person.generation,
        )
        .map((sibling) => centers.get(sibling)!);
      const extremum = direction === -1 ? Math.min(anchor, ...others) : Math.max(anchor, ...others);
      centers.set(child, extremum + direction * getSiblingStep(origin.children.length - 1));
      ancestralQueue.push(child);
    }
    for (const child of origin.children) {
      const generation = g.persons.get(child)!.generation;
      const siblings = childCenters.get(generation) ?? [];
      siblings.push(centers.get(child)!);
      childCenters.set(generation, siblings);
    }
    const center = centerOfSpan(childCenters.get(focusGeneration) ?? [anchor]);
    const partners = sortedPartners(origin);
    partners.forEach((parent, index) => {
      if (centers.has(parent)) return;
      let dx = partnerOffsets.get(origin.id)?.[index] ?? 0;
      if (
        partners.length === 2 &&
        g.persons.get(partners[0])!.branchId === "paternal" &&
        g.persons.get(partners[1])!.branchId === "maternal"
      ) {
        const separation = Math.max(Math.abs(dx), Math.abs(center) + NODE_W / 2);
        dx = index === 0 ? -separation : separation;
      }
      centers.set(parent, center + dx);
      ancestralQueue.push(parent);
    });
  }

  // Uniões adicionais, parentes com conexão indireta e famílias desconectadas
  // ganham posições sem um novo vínculo com o tronco do consulente.
  const pendingQueue = [...centers.keys(), ...g.persons.keys()];
  let detachedX = Math.max(0, ...centers.values()) + NODE_W + BRANCH_SEPARATION;
  const visited = new Set<string>();
  for (let i = 0; i < pendingQueue.length; i++) {
    const id = pendingQueue[i];
    if (visited.has(id)) continue;
    visited.add(id);
    if (!centers.has(id)) {
      const person = g.persons.get(id)!;
      centers.set(id, person.branchId === "paternal" ? -detachedX : detachedX);
      detachedX += NODE_W + BRANCH_GAP;
    }
    for (const union of participants.get(id) ?? []) {
      const placed = union.partners.filter((p) => centers.has(p));
      const center = placed.length
        ? placed.reduce((total, p) => total + centers.get(p)!, 0) / placed.length
        : centers.get(id)!;
      for (const member of [...union.partners, ...union.children]) {
        if (centers.has(member)) continue;
        const person = g.persons.get(member)!;
        const dir = person.branchId === "paternal" ? -1 : 1;
        centers.set(member, center + dir * (NODE_W + SIBLING_GAP));
        pendingQueue.push(member);
      }
    }
  }

  let normalizedY = 0;
  let adjustedX = 0;
  const keptPositions = new Set<string>();
  const savedPeople = new Map<string, Point>();
  for (const [id, person] of g.persons) {
    const saved = g.positions.get(id);
    if (!saved || saved.node_type !== "person" || !Number.isFinite(saved.x)) continue;
    const y = genY(person.generation);
    if (Math.abs(saved.y - y) > 0.5) normalizedY++;
    savedPeople.set(id, { x: saved.x, y });
  }
  const splitPairs = new Set<string>();
  for (const union of singleCouples) {
    if (!partnersShareRow(union)) continue;
    const [a, b] = union.partners.map((id) => savedPeople.get(id));
    if (!a || !b) continue;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const split = [...savedPeople].some(
      ([id, other]) =>
        !union.partners.includes(id) &&
        other.y === a.y &&
        other.x > left + POSITION_EPS &&
        other.x < right - POSITION_EPS,
    );
    if (split) for (const id of union.partners) splitPairs.add(id);
  }
  // Posições manuais continuam válidas no eixo horizontal. A cada atualização,
  // as uniões são recentralizadas sobre os pais que já estão posicionados.
  const savedOrder = [root, ...[...savedPeople.keys()].filter((id) => id !== root)];
  for (const id of savedOrder) {
    const saved = savedPeople.get(id);
    if (!saved) continue;
    if (
      splitPairs.has(id) ||
      [...personPos.values()].some(
        (position) =>
          Math.abs(position.y - saved.y) < NODE_H && Math.abs(position.x - saved.x) < NODE_W,
      )
    ) {
      adjustedX++;
      continue;
    }
    personPos.set(id, saved);
    keptPositions.add(id);
  }
  const rootCenter = personPos.has(root) ? personPos.get(root)!.x + NODE_W / 2 : 0;
  const uniqueCouples = new Map<string, UnionEntity>();
  for (const union of singleCouples) {
    if (!union.partners.some((id) => keptPositions.has(id))) {
      for (const id of union.partners) uniqueCouples.set(id, union);
    }
  }

  function childAxis(union: UnionEntity): number | undefined {
    const generation = Math.min(...union.children.map((id) => g.persons.get(id)!.generation));
    const children = union.children.filter((id) => g.persons.get(id)!.generation === generation);
    if (children.some((id) => !personPos.has(id))) return undefined;
    return centerOfSpan(children.map((id) => personPos.get(id)!.x + NODE_W / 2));
  }

  function placeCouple(partners: string[], axis: number, halfWidth: number) {
    partners.forEach((id, index) => {
      personPos.set(id, {
        x: axis + (index === 0 ? -halfWidth : halfWidth) - NODE_W / 2,
        y: genY(g.persons.get(id)!.generation),
      });
    });
  }

  function coupleSpans(y: number, except?: string) {
    return singleCouples.flatMap((other) => {
      if (other.id === except || !partnersShareRow(other) || genY(other.generation) !== y)
        return [];
      const a = personPos.get(other.partners[0]);
      const b = personPos.get(other.partners[1]);
      return a && b ? [{ union: other, left: Math.min(a.x, b.x), right: Math.max(a.x, b.x) }] : [];
    });
  }

  function placeCompactCouple(union: UnionEntity, partners: string[], ideal: number): boolean {
    const y = genY(union.generation);
    const half = NODE_STEP / 2;
    const margin = half + COUPLE_BLOCK_STEP;
    let lower = -Infinity;
    let upper = Infinity;
    for (const [index, id] of partners.entries()) {
      const offset = index === 0 ? -half : half;
      const side = g.persons.get(id)!.branchId;
      if (side === "paternal") upper = Math.min(upper, rootCenter - NODE_W / 2 - offset);
      if (side === "maternal") lower = Math.max(lower, rootCenter + NODE_W / 2 - offset);
    }
    const slots: { from: number; to: number }[] = [];
    for (const other of personPos.values()) {
      if (Math.abs(other.y - y) >= NODE_H) continue;
      const center = other.x + NODE_W / 2;
      slots.push({ from: center - margin, to: center + margin });
    }
    let orderedLower = lower;
    let orderedUpper = upper;
    for (const { union: other, left, right } of coupleSpans(y, union.id)) {
      const from = left + NODE_W / 2 - margin;
      const to = right + NODE_W / 2 + margin;
      slots.push({ from, to });
      const otherAxis = childAxis(other) ?? (from + to) / 2;
      if (ideal < otherAxis || (ideal === otherAxis && union.id < other.id)) {
        orderedUpper = Math.min(orderedUpper, from);
      } else {
        orderedLower = Math.max(orderedLower, to);
      }
    }
    function nearest(left: number, right: number): number | undefined {
      if (left > right) return undefined;
      const limit = (x: number) => Math.max(left, Math.min(right, x));
      const candidates = [
        limit(ideal),
        ...slots.flatMap(({ from, to }) => [limit(from), limit(to)]),
      ];
      return candidates
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b)
        .find((x) =>
          slots.every(({ from, to }) => x <= from + POSITION_EPS || x >= to - POSITION_EPS),
        );
    }
    // O X manual preservado pode inviabilizar a ordem ideal, mas não quebra
    // o bloco. Procure a faixa livre mais próxima do eixo da fratria.
    const axis = nearest(orderedLower, orderedUpper) ?? nearest(lower, upper);
    if (axis === undefined) return false;
    placeCouple(partners, axis, half);
    return true;
  }

  function placeSymmetricCouple(union: UnionEntity): boolean {
    const partners = sortedPartners(union);
    if (partners.some((id) => personPos.has(id))) return false;
    const axis = childAxis(union);
    if (axis === undefined) return false;
    const preferred = ((centers.get(partners[1]) ?? 0) - (centers.get(partners[0]) ?? 0)) / 2;
    let minHalfWidth = NODE_STEP / 2;
    let maxHalfWidth = Infinity;
    const obstacles: { from: number; to: number }[] = [];
    const sameRow = partnersShareRow(union);
    if (
      sameRow &&
      coupleSpans(genY(union.generation), union.id).some(
        ({ left, right }) => axis > left + NODE_W / 2 && axis < right + NODE_W / 2,
      )
    ) {
      return placeCompactCouple(union, partners, axis);
    }
    for (const [index, id] of partners.entries()) {
      const person = g.persons.get(id)!;
      const sign = index === 0 ? -1 : 1;
      const limit = rootCenter + (person.branchId === "paternal" ? -NODE_W / 2 : NODE_W / 2);
      if (person.branchId === "paternal" || person.branchId === "maternal") {
        const boundary = (limit - axis) * sign;
        if (
          (person.branchId === "paternal" && sign < 0) ||
          (person.branchId === "maternal" && sign > 0)
        ) {
          minHalfWidth = Math.max(minHalfWidth, boundary);
        } else {
          maxHalfWidth = Math.min(maxHalfWidth, boundary);
        }
      }
      const y = genY(person.generation);
      for (const other of personPos.values()) {
        if (Math.abs(other.y - y) >= NODE_H) continue;
        const distance = (other.x + NODE_W / 2 - axis) * sign;
        const inRow = sameRow && other.y === y;
        const step = inRow ? COUPLE_BLOCK_STEP : NODE_STEP;
        if (inRow) maxHalfWidth = Math.min(maxHalfWidth, Math.abs(distance) - step);
        obstacles.push({ from: distance - step, to: distance + step });
      }
    }
    // Barreiras intergeracionais permitem abrir o par. Na mesma faixa, a
    // abertura termina antes do próximo bloco para evitar entrelaçamento.
    obstacles.sort((a, b) => a.from - b.from);
    function openTo(width: number) {
      for (const { from, to } of obstacles) {
        if (width > from + POSITION_EPS && width < to - POSITION_EPS) width = to;
      }
      return width;
    }
    const preferredWidth = openTo(Math.max(minHalfWidth, preferred));
    const width =
      preferredWidth <= maxHalfWidth + POSITION_EPS ? preferredWidth : openTo(minHalfWidth);
    if (width > maxHalfWidth + POSITION_EPS)
      return sameRow && placeCompactCouple(union, partners, axis);
    placeCouple(partners, axis, width);
    return true;
  }

  for (const [id, preferredCenter] of centers) {
    if (personPos.has(id)) continue;
    const couple = uniqueCouples.get(id);
    if (couple && placeSymmetricCouple(couple)) continue;
    const p = g.persons.get(id)!;
    const y = genY(p.generation);
    const direction =
      p.branchId === "paternal" ? -1 : p.branchId === "maternal" ? 1 : preferredCenter < 0 ? -1 : 1;
    let center = rootCenter + preferredCenter;
    if (p.branchId === "paternal") center = Math.min(center, rootCenter - NODE_W / 2);
    if (p.branchId === "maternal") center = Math.max(center, rootCenter + NODE_W / 2);
    let x = center - NODE_W / 2;
    for (;;) {
      const overlapping = [...personPos.values()].filter(
        (pos) => Math.abs(pos.y - y) < NODE_H && Math.abs(pos.x - x) < NODE_STEP - 0.001,
      );
      const spanning = coupleSpans(y).filter(
        ({ left, right }) => x > left - COUPLE_BLOCK_STEP && x < right + COUPLE_BLOCK_STEP,
      );
      if (!overlapping.length && !spanning.length) break;
      x =
        direction < 0
          ? Math.min(
              ...overlapping.map((position) => position.x),
              ...spanning.map((span) => span.left),
            ) - NODE_STEP
          : Math.max(
              ...overlapping.map((position) => position.x),
              ...spanning.map((span) => span.right),
            ) + NODE_STEP;
    }
    personPos.set(id, { x, y });
  }

  // Quando há espaço, finalize o alinhamento dos grupos depois de acomodar
  // posições guardadas, parentes laterais e colisões. Um genitor compartilhado
  // continua uma pessoa única e não é deslocado para satisfazer outra união.
  const ancestry = [...g.unions.values()]
    .filter((union) => union.direction === "up" && union.children.length)
    .sort((a, b) => a.generation - b.generation);
  for (const union of ancestry) {
    const movable = union.partners.every(
      (id) =>
        !keptPositions.has(id) &&
        participants.get(id)?.filter((item) => item.partners.includes(id)).length === 1,
    );
    if (!movable) continue;
    const hub = placeUnionHub(union, personPos)!;
    const childRow = Math.min(...union.children.map((id) => personPos.get(id)!.y));
    const children = union.children.map((id) => personPos.get(id)!).filter((p) => p.y === childRow);
    const delta = centerOfSpan(children.map((child) => child.x + NODE_W / 2)) - hub.x;
    if (Math.abs(delta) < 0.001) continue;
    if (union.partners.length === 2 && partnersShareRow(union)) {
      const [a, b] = union.partners.map((id) => personPos.get(id)!);
      const left = Math.min(a.x, b.x) + delta;
      const right = Math.max(a.x, b.x) + delta;
      const spansOutside = coupleSpans(a.y, union.id).every(
        (span) => span.right <= left || span.left >= right,
      );
      const noInside = [...personPos].every(
        ([id, point]) =>
          union.partners.includes(id) || point.y !== a.y || point.x <= left || point.x >= right,
      );
      if (!spansOutside || !noInside) continue;
    }
    const available = union.partners.every((id) => {
      const position = personPos.get(id)!;
      const x = position.x + delta;
      const side = g.persons.get(id)!.branchId;
      if (side === "paternal" && x + NODE_W > rootCenter) return false;
      if (side === "maternal" && x < rootCenter) return false;
      return [...personPos].every(
        ([otherId, other]) =>
          union.partners.includes(otherId) ||
          Math.abs(other.y - position.y) >= NODE_H ||
          Math.abs(other.x - x) >= NODE_STEP - 0.001,
      );
    });
    if (!available) continue;
    for (const id of union.partners) {
      const point = personPos.get(id)!;
      personPos.set(id, { ...point, x: point.x + delta });
    }
  }

  for (const [id, union] of g.unions) {
    const position = placeUnionHub(union, personPos);
    if (position) unionPos.set(id, position);
  }

  const placement: Placement = { personPos, unionPos, normalizedY, adjustedX };
  if (import.meta.env.DEV) {
    const violations = checkLayoutInvariants(g, placement);
    if (violations.length > 0) {
      console.warn(`Genogram layout: ${violations.length} violação(ões)`, violations);
    }
  }
  return placement;
}
