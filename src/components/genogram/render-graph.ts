import type { Edge, Node } from "@xyflow/react";
import type { Tables } from "@/integrations/supabase/types";
import { relationshipLabel } from "@/lib/genogram";
import {
  buildLogicalGraph,
  layoutGraph,
  validateGraph,
  GEN_GAP,
  type GenogramWarning,
} from "@/lib/geno/build";

type PersonRow = Tables<"genogram_persons">;
type RelRow = Tables<"genogram_relationships">;
type NodePositionRow = Tables<"genogram_node_positions">;

/**
 * Constrói nós/edges React-Flow a partir do grafo lógico + layout.
 * Nenhuma decisão de conexão parte de posição; tudo vem do grafo lógico.
 */
export function buildRenderGraph(
  persons: PersonRow[],
  rels: RelRow[],
  probandId: string | undefined,
  positions?: NodePositionRow[],
) {
  const graph = buildLogicalGraph({ persons, rels, probandId, positions });
  const validation = validateGraph(graph);
  if (!validation.ok) {
    // Não bloqueia o render; loga para o console pra manter a UX suave.

    console.warn("[genograma] invariantes falharam:", validation.errors);
  }
  const placement = layoutGraph(graph);

  const nodes: Node[] = [];

  // Bandas de geração (background)
  for (const g of new Set([...graph.persons.values()].map((person) => person.generation))) {
    nodes.push({
      id: `gen_bg_${g}`,
      type: "band",
      position: { x: -7500, y: g * GEN_GAP - 20 },
      data: { generation: g },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }

  // Pessoas
  for (const [pid, person] of graph.persons) {
    const pos = placement.personPos.get(pid);
    if (!pos) continue;
    nodes.push({
      id: pid,
      type: "person",
      position: pos,
      zIndex: 5,
      data: {
        full_name: person.row.full_name,
        preferred_name: person.row.preferred_name,
        gender: person.row.gender,
        birth_date: person.row.birth_date,
        death_date: person.row.death_date,
        is_deceased: person.row.is_deceased,
        is_proband: person.row.is_proband,
        relationship_to_proband: person.row.relationship_to_proband,
        notes: person.row.notes,
        generation: person.generation,
        lane: person.lane,
        branchId: person.branchId,
      },
    });
  }

  // Uniões
  for (const [uid, union] of graph.unions) {
    const pos = placement.unionPos.get(uid);
    if (!pos) continue;
    nodes.push({
      id: uid,
      type: "union",
      position: pos,
      origin: [0.5, 0.5],
      data: {
        isSingle: union.partners.length === 1,
        label: union.label,
        kind: union.kind,
        generation: union.generation,
        branchId: union.branchId,
      },
      draggable: false,
      selectable: false,
      zIndex: 4,
    });
  }

  // Edges: partner + child (nunca pessoa↔pessoa)
  const edges: Edge[] = [];
  const seenChildUnion = new Set<string>();
  const childKindsByUnion = new Map<string, Record<string, string>>();
  const suggestionsByUnion = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "child") continue;
    const children = childKindsByUnion.get(edge.unionId) ?? {};
    children[edge.personId] = edge.childKind ?? "biological";
    childKindsByUnion.set(edge.unionId, children);
    if (edge.suggested) {
      const suggestions = suggestionsByUnion.get(edge.unionId) ?? [];
      suggestions.push(edge.personId);
      suggestionsByUnion.set(edge.unionId, suggestions);
    }
  }
  for (const e of graph.edges) {
    if (e.kind === "partner") {
      edges.push({
        id: `partner_${e.personId}_${e.unionId}`,
        source: e.personId,
        target: e.unionId,
        sourceHandle: "right",
        targetHandle: "left-target",
        type: "partner",
        style: { stroke: "var(--color-foreground)", strokeWidth: 2 },
        data: { personId: e.personId, unionId: e.unionId },
        zIndex: 2,
      });
    }
  }
  for (const [uid, union] of graph.unions) {
    if (seenChildUnion.has(uid) || union.children.length === 0) continue;
    seenChildUnion.add(uid);
    edges.push({
      id: `pedigree_${uid}`,
      source: uid,
      target: union.children[0],
      sourceHandle: "bottom",
      targetHandle: "top-target",
      type: "pedigree",
      style: { stroke: "var(--color-forest)", strokeWidth: 2 },
      data: {
        unionId: uid,
        childIds: union.children,
        childKinds: childKindsByUnion.get(uid),
        suggestedChildIds: suggestionsByUnion.get(uid),
        direction: union.direction,
      },
      zIndex: 2,
    });
  }

  const extra: GenogramWarning[] = [
    ...graph.errors.map((message, i) => ({ personId: `err-${i}`, personName: "", message })),
    ...(placement.normalizedY
      ? [
          {
            personId: "norm-y",
            personName: "",
            message: `${placement.normalizedY} posição(ões) salva(s) estavam fora da faixa da geração e foram alinhadas (cliente e irmãos no topo). A posição horizontal foi mantida; salve o layout para gravar.`,
          },
        ]
      : []),
    ...(placement.adjustedX
      ? [
          {
            personId: "norm-x",
            personName: "",
            message: `${placement.adjustedX} posição(ões) foram ajustadas para separar os familiares e seus vínculos.`,
          },
        ]
      : []),
  ];
  for (const rel of rels) {
    if (rel.relationship_type !== "emotional" && rel.relationship_type !== "sibling") continue;
    if (graph.persons.has(rel.from_person_id) && graph.persons.has(rel.to_person_id)) {
      edges.push(relToEdge(rel));
    }
  }
  return { graph, nodes, edges, warnings: [...extra, ...graph.warnings] };
}

const MARRIAGE_MARK: Record<number, string> = {
  1: "①",
  2: "②",
  3: "③",
  4: "④",
  5: "⑤",
};

function unionLabel(r: RelRow): string {
  const base = relationshipLabel(r.relationship_type, r.qualifier);
  if (base === "Parental" || base === "Parental · Biológico") return "";

  if (r.relationship_type !== "union") return base;
  const order = (r as RelRow & { marriage_order?: number | null }).marriage_order;
  if (!order || order < 1) return base;
  const mark = MARRIAGE_MARK[order] ?? `${order}ª`;
  return `${mark} ${base}`;
}

function relToEdge(r: RelRow): Edge {
  const stroke = colorFor(r);
  const dashed =
    r.relationship_type === "sibling"
      ? "4 5"
      : r.qualifier === "close" || r.qualifier === "fusion"
        ? "12 3 2 3"
        : "7 5";
  const thick = r.qualifier === "fusion";
  const isUnion = r.relationship_type === "union";
  const order = (r as RelRow & { marriage_order?: number | null }).marriage_order ?? null;
  // 2ª/3ª união: linha um pouco mais grossa para diferenciar
  const unionExtra = isUnion && order && order > 1 ? 1 : 0;
  return {
    id: r.id,
    source: r.from_person_id,
    target: r.to_person_id,
    sourceHandle: isUnion ? "right" : undefined,
    targetHandle: isUnion ? "left" : undefined,
    type: "step",
    label: unionLabel(r),
    labelStyle: {
      fontSize: 12,
      fontWeight: 600,
      fill: isUnion ? "var(--color-forest)" : "var(--color-muted-foreground)",
      fontFamily: "var(--font-sans)",
    },
    labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.98, rx: 3, ry: 3 },
    labelBgPadding: [4, 6] as [number, number],
    data: { relationshipType: r.relationship_type, qualifier: r.qualifier, marriageOrder: order },
    style: {
      stroke,
      strokeWidth: (thick ? 3 : 2) + unionExtra,
      strokeDasharray: dashed,
    },
  };
}

function colorFor(r: RelRow): string {
  if (r.relationship_type === "parent") return "var(--color-forest)";
  if (r.relationship_type === "sibling") return "var(--color-forest)";
  if (r.relationship_type === "union") return "var(--color-foreground)";
  switch (r.qualifier) {
    case "conflict":
    case "rupture":
      return "var(--color-destructive)";
    case "fusion":
    case "close":
      return "var(--color-forest)";
    default:
      return "var(--color-muted-foreground)";
  }
}
