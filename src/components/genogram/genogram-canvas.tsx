import { parentLinePatterns, validateParentLink } from "@/lib/family-relationships";
import { clinicalIntelQuery, getMappablePersons, invalidateCase } from "@/lib/clinical-intel";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  getNodesBounds,
  getViewportForBounds,
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  Handle,
  Position,
  type NodeProps,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./genogram-editor.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Link2,
  Trash2,
  TreePine,
  Printer,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Layers,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Crosshair,
  Box,
  Ellipsis,
  GitBranch,
  Search,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { personSymbol } from "./person-symbol";
import { useUnsaved } from "@/components/unsaved/unsaved-guard";
import { RevisionTracker } from "@/lib/unsaved";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutHistory,
  saveDraft,
  readDraft,
  clearDraft,
  type Snapshot,
  constrainSnapshotY,
} from "@/lib/geno/layout-history";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { PersonNode, type PersonNodeData } from "./person-node";
import { PersonFormDialog } from "./person-form-dialog";
import { RelationshipFormDialog } from "./relationship-form-dialog";
import { relationshipLabel, relationshipQualifiers } from "@/lib/genogram";
import { ensureProband } from "@/lib/ensure-proband";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];
type NodePositionRow = Database["public"]["Tables"]["genogram_node_positions"]["Row"];
type LayoutRow = Database["public"]["Tables"]["genogram_layouts"]["Row"];

const SpatialView = lazy(() =>
  import("./genogram-spatial-view").then((module) => ({ default: module.GenogramSpatialView })),
);

type QuickRelative = { personId: string; kind: "Pai" | "Mãe" | "Filho(a)" | "Irmã(o)" };
type ParentProposal = { childId: string; parentIds: string[] };
type RelationshipSeed = {
  from?: string;
  to?: string;
  type?: "parent" | "union";
  qualifier?: string;
};
const personName = (person?: PersonRow) =>
  person?.full_name || person?.preferred_name || "Pessoa sem nome";

/**
 * UnionNode — cidadão de primeira classe do grafo.
 * Renderiza um pequeno diamante ameixa no ponto exato da união entre os
 * parceiros. A etiqueta pertence ao nó, nunca ao edge — evita colisões
 * com a linha do casal.
 */
const UNION_SIZE = 12;
const UnionNodeComponent = ({ data }: NodeProps) => {
  const d = (data as { label?: string; kind?: string; isSingle?: boolean }) ?? {};
  const isDivorce = d.kind === "divorcio";
  return (
    <div
      style={{ width: UNION_SIZE, height: UNION_SIZE, position: "relative" }}
      className="pointer-events-none"
    >
      {d.label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-card/95 px-1.5 py-0.5 text-[14px] font-bold uppercase tracking-[0.08em] text-forest shadow-sm"
          style={{ top: -22 }}
        >
          {d.label}
        </div>
      )}
      {!d.isSingle && (
        <div
          className="absolute rounded-sm bg-foreground"
          style={{ width: 7, height: 7, left: 2.5, top: 2.5, transform: "rotate(45deg)" }}
        />
      )}
      {isDivorce && (
        <svg
          className="absolute pointer-events-none"
          style={{ left: -12, top: -8, width: 36, height: 28 }}
          viewBox="0 0 36 28"
        >
          <path d="M8 22 L16 4" stroke="var(--graphite)" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M20 22 L28 4" stroke="var(--graphite)" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      )}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="top-target"
        type="target"
        position={Position.Top}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="bottom-target"
        type="target"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className="opacity-0 pointer-events-none"
      />
      <Handle
        id="right-target"
        type="target"
        position={Position.Right}
        className="opacity-0 pointer-events-none"
      />
    </div>
  );
};

function GenerationBandNode({ data }: NodeProps) {
  const isEven = (data.generation as number) % 2 === 0;
  return (
    <div
      style={{ width: 15000, height: GENERATION_GAP, pointerEvents: "none" }}
      className={`border-b border-dashed border-forest/20 ${isEven ? "bg-forest/[0.02]" : "bg-transparent"}`}
    />
  );
}

const nodeTypes = { person: PersonNode, union: UnionNodeComponent, band: GenerationBandNode };

function StraightStepEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
  data,
}: EdgeProps) {
  const isStraight = Math.abs(sourceX - targetX) < 1 || Math.abs(sourceY - targetY) < 1;
  const edgeData = data as Record<string, unknown> | undefined;
  const unionX = edgeData?.unionX as number | undefined;
  const isPrimaryParent = edgeData?.isPrimaryParent as boolean | undefined;
  const isFirstSibling = edgeData?.isFirstSibling as boolean | undefined;
  const relationshipType = edgeData?.relationshipType as string | undefined;
  const qualifier = edgeData?.qualifier as string | undefined;

  // Use consistent Ys to ensure horizontal bars align perfectly across children with different node heights
  const midY =
    (edgeData?.consistentMidY as number | undefined) ?? sourceY + (targetY - sourceY) / 2;
  const trunkY = (edgeData?.consistentTrunkY as number | undefined) ?? targetY + 15;

  let path = "";

  if (unionX !== undefined) {
    if (isFirstSibling) {
      path += `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${unionX} ${midY} `;
      if (isPrimaryParent) {
        path += `M ${unionX} ${midY} L ${unionX} ${trunkY} `;
      }
    }
    if (isPrimaryParent) {
      path += `M ${unionX} ${trunkY} L ${targetX} ${trunkY} L ${targetX} ${targetY} `;
    }
  } else {
    path = isStraight
      ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      : `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  }

  // If path is empty, we don't render this edge visually, it was already drawn by another sibling's edge!
  if (!path.trim()) return null;

  const labelX = (sourceX + targetX) / 2;
  const labelY = Math.abs(sourceY - targetY) < 1 ? sourceY - 10 : midY - 10;
  const showUnionBreakMark =
    relationshipType === "union" &&
    (qualifier === "divorce" || qualifier === "separation" || qualifier === "rupture");
  const breakMarkCount = qualifier === "divorce" || qualifier === "rupture" ? 2 : 1;
  const breakY = Math.abs(sourceY - targetY) < 1 ? sourceY : midY;

  return (
    <>
      <BaseEdge
        path={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        interactionWidth={interactionWidth}
        labelX={labelX}
        labelY={labelY}
      />
      {showUnionBreakMark &&
        Array.from({ length: breakMarkCount }).map((_, i) => {
          const offset = breakMarkCount === 2 ? (i === 0 ? -5 : 5) : 0;
          const x = labelX + offset;
          return (
            <path
              key={i}
              d={`M ${x - 7} ${breakY + 12} L ${x + 7} ${breakY - 12}`}
              fill="none"
              stroke="var(--graphite)"
              strokeWidth={2.5}
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })}
    </>
  );
}

function nodeShapeSize(node: Node | undefined): number {
  const data = node?.data as PersonNodeData | undefined;
  return data?.is_proband ? PROBAND_SHAPE_SIZE : PERSON_SHAPE_SIZE;
}

function nodeCenterX(node: Node | undefined): number {
  if (!node) return 0;
  const measured =
    (node as Node & { measured?: { width?: number } }).measured?.width ?? node.width ?? NODE_W;
  return node.position.x + measured / 2;
}

function nodeBottomY(node: Node | undefined): number {
  if (!node) return 0;
  const measured =
    (node as Node & { measured?: { height?: number } }).measured?.height ?? node.height ?? NODE_H;
  return node.position.y + measured;
}

function nodeUnionY(node: Node | undefined): number {
  if (!node) return 0;
  return node.position.y + nodeShapeSize(node) / 2;
}

/**
 * PedigreeEdge — barra de irmãos que nasce de UM UnionNode.
 * data.unionId aponta para o UnionNode (fonte lógica); data.childIds lista
 * os filhos daquela união (fonte lógica). Nenhuma decisão vem de proximidade.
 */
function PedigreeEdge({ style, markerEnd, markerStart, interactionWidth, data }: EdgeProps) {
  const edgeData = data as
    | {
        unionId?: string;
        childIds?: string[];
        childKinds?: Record<string, string>;
        suggestedChildIds?: string[];
        direction?: "up" | "down";
      }
    | undefined;
  const unionId = edgeData?.unionId;
  const childIds = edgeData?.childIds ?? [];
  const live = useStore((store) => {
    const children = childIds
      .map((id) => store.nodeLookup.get(id) as unknown as Node | undefined)
      .filter((node): node is Node => Boolean(node));
    const union = unionId
      ? (store.nodeLookup.get(unionId) as unknown as Node | undefined)
      : undefined;
    return { children, union };
  });

  if (!live.union || !live.children.length) return null;
  const unionX = live.union.position.x;
  const unionY = live.union.position.y;
  const down = edgeData?.direction === "down";
  const groups = new Map<string, { x: number; y: number }[]>();
  for (const node of live.children) {
    const kind = edgeData?.childKinds?.[node.id] ?? "biological";
    const isSuggested = edgeData?.suggestedChildIds?.includes(node.id);
    const key = `${node.position.y}:${isSuggested ? "suggested" : kind}`;
    const points = groups.get(key) ?? [];
    points.push({ x: nodeCenterX(node), y: down ? node.position.y - 5 : nodeBottomY(node) + 5 });
    groups.set(key, points);
  }
  return [...groups].map(([key, points], index) => {
    const crossY = down
      ? Math.min(...points.map((point) => point.y))
      : Math.max(...points.map((point) => point.y));
    const barY = (crossY + unionY) / 2 + (index % 3) * 5;
    const left = Math.min(unionX, ...points.map((point) => point.x));
    const right = Math.max(unionX, ...points.map((point) => point.x));
    const path = [
      `M ${left} ${barY} H ${right}`,
      ...points.map(({ x, y }) => `M ${x} ${y} V ${barY}`),
      `M ${unionX} ${barY} V ${unionY}`,
    ].join(" ");

    const kind = key.split(":")[1];
    const suggested = kind === "suggested";
    return (
      <BaseEdge
        key={key}
        path={path}
        style={{
          ...style,
          ...(suggested
            ? { stroke: "var(--bronze)", strokeDasharray: "4 5" }
            : { strokeDasharray: parentLinePatterns[kind] }),
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
    );
  });
}

/**
 * PartnerEdge — linha horizontal entre pessoa e UnionNode.
 * Sempre reta horizontal na Y da união; nunca cruza outros nós porque as
 * duas pessoas do casal estão em COUPLE_GAP da união por construção.
 */
function PartnerEdge({ style, interactionWidth, data }: EdgeProps) {
  const edgeData = data as { personId?: string; unionId?: string } | undefined;
  const live = useStore((store) => ({
    person: edgeData?.personId
      ? (store.nodeLookup.get(edgeData.personId) as unknown as Node | undefined)
      : undefined,
    union: edgeData?.unionId
      ? (store.nodeLookup.get(edgeData.unionId) as unknown as Node | undefined)
      : undefined,
  }));
  if (!live.person || !live.union) return null;
  const px = nodeCenterX(live.person);
  const py = nodeUnionY(live.person);
  const ux = live.union.position.x;
  const uy = live.union.position.y;

  const shapeSize = nodeShapeSize(live.person);
  const R = shapeSize / 2;
  const safeGap = 2;

  let path = "";
  if (Math.abs(py - uy) < 12) {
    const startX = px < ux ? px + R + safeGap : px - R - safeGap;
    path = `M ${startX} ${uy} L ${ux} ${uy}`;
  } else {
    const startY = py < uy ? nodeBottomY(live.person) + safeGap : py - R - safeGap;
    path = `M ${px} ${startY} L ${px} ${uy} L ${ux} ${uy}`;
  }

  return <BaseEdge path={path} style={style} interactionWidth={interactionWidth} />;
}

const edgeTypes = { straightStep: StraightStepEdge, pedigree: PedigreeEdge, partner: PartnerEdge };

interface CanvasProps {
  clientId: string;
  /** Familiar a selecionar e centralizar ao abrir (ex.: vindo da linha do tempo). */
  focusPersonId?: string;
}

export function GenogramCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <GenogramCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ── Constantes visuais (delegadas ao engine) ─────────────────
import {
  NODE_W,
  NODE_H,
  PERSON_SHAPE as PERSON_SHAPE_SIZE,
  PROBAND_SHAPE as PROBAND_SHAPE_SIZE,
  GEN_GAP as GENERATION_GAP,
  buildLogicalGraph,
  layoutGraph,
  placeUnionHub,
  validateGraph,
  getResolvedParents,
  getSuggestedParents,
  type GenogramWarning,
} from "@/lib/geno/build";

/**
 * Constrói nós/edges React-Flow a partir do grafo lógico + layout.
 * Nenhuma decisão de conexão parte de posição; tudo vem do grafo lógico.
 */
function buildRenderGraph(
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
      position: { x: -7500, y: g * GENERATION_GAP - 20 },
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

function GenogramCanvasInner({ clientId, focusPersonId }: CanvasProps) {
  const qc = useQueryClient();

  const familyQuery = useQuery(clinicalIntelQuery(clientId));
  const layoutQuery = useQuery({
    queryKey: ["genogram", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genogram_layouts")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const layout: LayoutRow | null = data?.[0] ?? null;
      if (!layout) return { layout, positions: [] as NodePositionRow[] };
      const response = await supabase
        .from("genogram_node_positions")
        .select("*")
        .eq("layout_id", layout.id);
      if (response.error) throw response.error;
      return { layout, positions: response.data ?? [] };
    },
  });

  const data = useMemo(() => {
    if (!familyQuery.data || !layoutQuery.data) return null;
    return {
      persons: familyQuery.data.persons,
      rels: familyQuery.data.relationships,
      ...layoutQuery.data,
    };
  }, [familyQuery.data, layoutQuery.data]);
  const qualifiedPersons = useMemo(
    () => getMappablePersons(data?.persons ?? [], data?.rels ?? []),
    [data?.persons, data?.rels],
  );
  const probandId = qualifiedPersons.find((p) => p.is_proband)?.id;
  const renderGraph = useMemo(
    () => (data ? buildRenderGraph(qualifiedPersons, data.rels, probandId, data.positions) : null),
    [data, qualifiedPersons, probandId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const warnings = renderGraph?.warnings ?? [];
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [focusRequest, setFocusRequest] = useState<{ personId: string }>();
  const [connection, setConnection] = useState<{ originId: string | null } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    if (!connection) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setConnection(null);
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [connection]);
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [quickRelative, setQuickRelative] = useState<QuickRelative | null>(null);
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    seed?: RelationshipSeed;
    editing?: RelRow | null;
  }>({ open: false });

  const [layoutDirty, setLayoutDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLayoutFixed, setIsLayoutFixed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [parentProposal, setParentProposal] = useState<ParentProposal | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  // Revisões do arranjo: um save só limpa o que existia quando começou
  const revRef = useRef(new RevisionTracker());
  const [dirtyTick, setDirtyTick] = useState(0);
  const [draftStored, setDraftStored] = useState(true);
  const markLayoutDirty = useCallback(() => {
    revRef.current.bump();
    setLayoutDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [pendingDraft, setPendingDraft] = useState<Snapshot | null>(null);
  const [, forceHistory] = useState(0);
  const historyRef = useRef(new LayoutHistory());
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? ""));
  }, []);
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    setIsLayoutFixed(data?.layout?.is_fixed ?? false);
  }, [data?.layout?.is_fixed]);
  const rfInstance = useReactFlow();
  const openPerson = useCallback(
    (id: string) => {
      setFocusedPersonId(id);
      setPanelOpen(true);
      if (isMobile) setMobileSheetOpen(true);
    },
    [isMobile],
  );

  const locatePerson = useCallback(
    (id: string) => {
      setFocusedPersonId(id);
      setPanelOpen(true);
      setFocusRequest({ personId: id });
      const reduced =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.reduceMotion === "true";
      const node = rfInstance.getNode(id);
      if (node) {
        void rfInstance.setCenter(nodeCenterX(node), (node.position.y + nodeBottomY(node)) / 2, {
          duration: reduced ? 0 : 200,
          zoom: 1.1,
        });
      }
    },
    [rfInstance],
  );

  const focusedOnceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPersonId) {
      focusedOnceRef.current = null;
      return;
    }
    if (
      focusedOnceRef.current === focusPersonId ||
      !nodes.some((node) => node.id === focusPersonId)
    )
      return;
    const timer = window.setTimeout(() => {
      focusedOnceRef.current = focusPersonId;
      locatePerson(focusPersonId);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [focusPersonId, nodes, locatePerson]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportPdf = useCallback(async () => {
    const nodes = rfInstance.getNodes().filter((node) => node.type !== "band");
    const viewportEl = rootRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (nodes.length === 0 || !viewportEl) {
      toast.error("Nada pra exportar ainda.");
      return;
    }
    setIsExportingPdf(true);
    try {
      const bounds = getNodesBounds(nodes);
      const padding = 120;
      const imageWidth = Math.ceil(bounds.width) + padding * 2;
      const imageHeight = Math.ceil(bounds.height) + padding * 2;
      const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.1, 2, 0.08);

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#ffffff",
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        style: {
          visibility: "visible",
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const pdf = new jsPDF({
        orientation: imageWidth >= imageHeight ? "landscape" : "portrait",
        unit: "mm",
        format: "a3",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
      const pdfWidth = imageWidth * ratio;
      const pdfHeight = imageHeight * ratio;
      pdf.addImage(
        dataUrl,
        "PNG",
        (pageWidth - pdfWidth) / 2,
        (pageHeight - pdfHeight) / 2,
        pdfWidth,
        pdfHeight,
      );
      pdf.save(`genossociograma-${clientId.slice(0, 8)}.pdf`);
    } catch {
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [rfInstance, clientId]);

  const handleQuickAdd = useCallback((personId: string, kind: QuickRelative["kind"]) => {
    setQuickRelative({ personId, kind });
    setCreatingPerson(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await ensureProband(clientId);
      if (!cancelled && result) {
        invalidateCase(qc, clientId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, qc]);

  const mapInitialized = useRef(false);
  const withQuickAdd = useCallback(
    (list: Node[]) =>
      list.map((node) =>
        node.type === "person"
          ? {
              ...node,
              data: {
                ...node.data,
                onQuickAdd: (kind: QuickRelative["kind"]) => handleQuickAdd(node.id, kind),
              },
            }
          : node,
      ),
    [handleQuickAdd],
  );

  useEffect(() => {
    if (!renderGraph) return;
    const next = withQuickAdd(renderGraph.nodes);
    // Atualizar a família não substitui um movimento que ainda está em rascunho.
    setNodes((previous) => {
      if (revRef.current.isClean()) return next;
      const previousById = new Map(previous.map((node) => [node.id, node]));
      return next.map((node) => {
        const existing = previousById.get(node.id);
        return existing && node.type !== "band" && node.position.y === existing.position.y
          ? { ...node, position: { ...node.position, x: existing.position.x } }
          : node;
      });
    });
    setEdges(renderGraph.edges);
    if (mapInitialized.current) return;
    const people = next.filter((node) => node.type === "person");
    if (!people.length) return;
    const timer = window.setTimeout(() => {
      mapInitialized.current = true;
      void rfInstance.fitView({ nodes: people, padding: 0.18, maxZoom: 1.2 });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [renderGraph, withQuickAdd, setNodes, setEdges, rfInstance]);

  // Lock dragging strictly to X axis
  const onNodesChangeCustom = useCallback(
    (changes: NodeChange[]) => {
      const hasPositionChange = changes.some(
        (change) => change.type === "position" && change.position,
      );
      const nextChanges = changes.map((change) => {
        if (change.type === "position" && change.position) {
          const node = rfInstance.getNode(change.id);
          if (node && (node.type === "person" || node.type === "union")) {
            return {
              ...change,
              position: { x: change.position.x, y: node.position.y },
              positionAbsolute: change.positionAbsolute
                ? { x: change.positionAbsolute.x, y: node.position.y }
                : undefined,
            };
          }
        }
        return change;
      });
      if (hasPositionChange) markLayoutDirty();
      onNodesChange(nextChanges);
    },
    [onNodesChange, rfInstance, markLayoutDirty],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if (connection) return;
      const person = data?.persons.find((p) => p.id === node.id);
      if (person) setEditingPerson(person);
    },
    [data, connection],
  );

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler>(
    (_, edge) => {
      const rel = data?.rels.find((r) => r.id === edge.id);
      if (rel) setRelDialog({ open: true, editing: rel });
    },
    [data],
  );

  const legendFlags = useMemo(() => {
    const ps = data?.persons ?? [];
    const sym = ps.map((p) => personSymbol(p));
    return {
      masculino: sym.includes("masculino"),
      feminino: sym.includes("feminino"),
      aborto: sym.includes("aborto"),
      outro: sym.some((x) => x !== "masculino" && x !== "feminino" && x !== "aborto"),
      falecido: ps.some((p) => p.is_deceased || !!p.death_date),
    };
  }, [data]);

  const deleteSelected = useMutation({
    mutationFn: async () => {
      const nodeIds = nodes
        .filter((n) => n.type === "person" && n.selected && n.id !== probandId)
        .map((n) => n.id);
      const edgeIds = edges
        .filter((e) => e.selected && data?.rels.some((r) => r.id === e.id))
        .map((e) => e.id);
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      if (edgeIds.length > 0) {
        const { error } = await supabase
          .from("genogram_relationships")
          .delete()
          .eq("client_id", clientId)
          .in("id", edgeIds);
        if (error) throw error;
      }
      if (nodeIds.length > 0) {
        const { error } = await supabase
          .from("genogram_persons")
          .delete()
          .eq("client_id", clientId)
          .eq("is_proband", false)
          .in("id", nodeIds);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateCase(qc, clientId);
      toast.success("Removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const snapshot = useCallback((): Snapshot => {
    const out: Snapshot = {};
    for (const n of rfInstance.getNodes()) {
      if (n.type === "person") out[n.id] = [n.position.x, n.position.y];
    }
    return out;
  }, [rfInstance]);
  const applySnapshot = useCallback(
    (snap: Snapshot) => {
      // Só X do snapshot; Y permanece na faixa da geração (cliente+irmãos no topo)
      const safe = constrainSnapshotY(snap, snapshot());
      setNodes((ns) =>
        ns.map((n) =>
          safe[n.id] ? { ...n, position: { x: safe[n.id][0], y: safe[n.id][1] } } : n,
        ),
      );
      markLayoutDirty();
    },
    [setNodes, snapshot, markLayoutDirty],
  );
  const undoLayout = () => {
    const prev = historyRef.current.undo(snapshot());
    if (prev) applySnapshot(prev);
    forceHistory((x) => x + 1);
  };
  const redoLayout = () => {
    const next = historyRef.current.redo(snapshot());
    if (next) applySnapshot(next);
    forceHistory((x) => x + 1);
  };

  // Rascunho local (IDs + coordenadas) enquanto há alteração não salva
  useEffect(() => {
    if (layoutDirty && userId) setDraftStored(saveDraft(userId, clientId, snapshot()));
  }, [layoutDirty, nodes, userId, clientId, snapshot]);
  // Oferece recuperar rascunho mais novo que o layout salvo
  useEffect(() => {
    if (!userId || !data) return;
    const d = readDraft(userId, clientId);
    const savedAt = data.layout?.updated_at ? new Date(data.layout.updated_at).getTime() : 0;
    setPendingDraft(d && d.at > savedAt && Object.keys(d.positions).length ? d.positions : null);
  }, [userId, clientId, data]);

  const saveLayout = useMutation({
    mutationFn: async () => {
      const rev = revRef.current.begin();
      const currentNodes = rfInstance.getNodes();
      const personNodes = currentNodes.filter((node) => node.type === "person");
      const savedAt = new Date().toISOString();

      // Ensure layout exists or create one
      let layoutId = data?.layout?.id;
      if (!layoutId) {
        const { data: newLayout, error: layoutErr } = await supabase
          .from("genogram_layouts")
          .insert({ client_id: clientId, name: "Layout Atual", is_fixed: false })
          .select("*")
          .single();
        if (layoutErr) throw layoutErr;
        layoutId = newLayout.id;
        qc.setQueryData(["genogram", clientId], {
          layout: newLayout,
          positions: [] as NodePositionRow[],
        });
      }

      // Prepare positions to upsert
      const positionsToUpsert = personNodes.map((node) => ({
        layout_id: layoutId,
        node_id: node.id,
        node_type: "person",
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
        layout_mode: "MANUAL",
      }));

      // Upsert node positions using the unique constraint
      const { error: upsertErr } = await supabase
        .from("genogram_node_positions")
        .upsert(positionsToUpsert, { onConflict: "layout_id,node_id" });

      if (upsertErr) throw upsertErr;

      const { error: stampError } = await supabase
        .from("genogram_layouts")
        .update({ updated_at: savedAt })
        .eq("id", layoutId);
      if (stampError) throw stampError;
      return { savedAt, rev };
    },
    onSuccess: ({ savedAt, rev }) => {
      if (revRef.current.confirm(rev)) {
        setLayoutDirty(false);
        if (userId) clearDraft(userId, clientId);
      } else {
        // Houve movimento durante o salvamento: continua pendente e o rascunho fica
        if (userId) setDraftStored(saveDraft(userId, clientId, snapshot()));
        setDirtyTick((t) => t + 1);
      }
      setLastSavedAt(
        new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
      void qc.invalidateQueries({ queryKey: ["genogram", clientId] });
    },
    onError: (e) =>
      toast.error(
        `Não foi possível salvar o arranjo. ${
          draftStored
            ? "As posições ficam como rascunho neste navegador até você salvar ou descartar."
            : "Não foi possível guardar rascunho neste navegador: não feche nem saia desta tela antes de salvar."
        } ${e instanceof Error ? e.message : ""}`,
      ),
  });

  // Proteção de saída (navegação interna, troca de aba e fechar a aba)
  useUnsaved(`layout:${clientId}`, {
    label: "Arranjo do genossociograma",
    isDirty: () => layoutDirty || saveLayout.isPending,
    save: async () => {
      await saveLayout.mutateAsync();
      if (!revRef.current.isClean()) await saveLayout.mutateAsync();
      if (!revRef.current.isClean()) throw new Error("posições mudaram durante o salvamento");
    },
    discard: () => {
      revRef.current.reset();
      setLayoutDirty(false);
      if (userId) clearDraft(userId, clientId);
    },
  });

  // Auto-Save Effect (Debounce 2s)
  useEffect(() => {
    if (!layoutDirty) return;
    if (saveLayout.isPending || saveLayout.isError) return;
    const t = setTimeout(() => {
      saveLayout.mutate();
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDirty, dirtyTick, saveLayout.isPending, saveLayout.isError]);

  const toggleLayoutFixed = useMutation({
    mutationFn: async () => {
      const layoutId = data?.layout?.id;
      if (!layoutId) throw new Error("Salve um arranjo antes de fixar as posições.");
      const newValue = !isLayoutFixed;
      const { error } = await supabase
        .from("genogram_layouts")
        .update({ is_fixed: newValue })
        .eq("id", layoutId);
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      setIsLayoutFixed(newValue);
      toast.success(newValue ? "Layout fixado" : "Layout destravado");
      invalidateCase(qc, clientId);
    },
    onError: (e) => toast.error("Erro ao alterar fixação do layout"),
  });

  const organizeLayout = () => {
    if (!data || isLayoutFixed) return;
    historyRef.current.push(snapshot());
    forceHistory((count) => count + 1);
    const automatic = buildRenderGraph(qualifiedPersons, data.rels, probandId);
    setNodes(withQuickAdd(automatic.nodes));
    markLayoutDirty();
    window.requestAnimationFrame(
      () =>
        void rfInstance.fitView({
          nodes: automatic.nodes.filter((node) => node.type === "person"),
          padding: 0.18,
          maxZoom: 1.2,
        }),
    );
  };

  const confirmParents = useMutation({
    mutationFn: async ({ childId, parentIds }: ParentProposal) => {
      const latest = await qc.fetchQuery({ ...clinicalIntelQuery(clientId), staleTime: 0 });
      const graph = buildLogicalGraph({
        persons: getMappablePersons(latest.persons, latest.relationships),
        rels: latest.relationships,
        probandId: latest.persons.find((person) => person.is_proband)?.id,
      });
      const candidates = getSuggestedParents(graph, childId).map((parent) => parent.personId);
      if (
        candidates.length !== parentIds.length ||
        parentIds.some((id) => !candidates.includes(id))
      ) {
        throw new Error("A filiação mudou. Abra a ficha e revise os pais sugeridos.");
      }
      const existing = latest.relationships.filter((rel) => rel.relationship_type === "parent");
      for (const parentId of parentIds) {
        const reason = validateParentLink(parentId, childId, existing);
        if (reason) throw new Error(reason);
        existing.push({
          id: `pending-${parentId}`,
          from_person_id: parentId,
          to_person_id: childId,
        } as RelRow);
      }
      const { error } = await supabase.from("genogram_relationships").insert(
        parentIds.map((id) => ({
          client_id: clientId,
          from_person_id: id,
          to_person_id: childId,
          relationship_type: "parent",
          qualifier: "biological",
        })),
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCase(qc, clientId);
      setParentProposal(null);
      toast.success("Filiação confirmada.");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível registrar a filiação.",
      ),
  });

  const persons = data?.persons ?? [];
  const focusedPerson =
    persons.find((p) => p.id === focusedPersonId) ??
    persons.find((p) => p.is_proband) ??
    persons[0];
  const qualifiedCount = nodes.filter((node) => node.type === "person").length;
  const socialCount = edges.filter((edge) => edge.data?.relationshipType).length;
  const selectedPersonCount = nodes.filter(
    (n) => n.type === "person" && n.selected && n.id !== probandId,
  ).length;
  const selectedEdgeCount = edges.filter(
    (edge) => edge.selected && data?.rels.some((rel) => rel.id === edge.id),
  ).length;
  const visibleEdges = showSocialLinks
    ? edges
    : edges.filter((edge) => !edge.data?.relationshipType);
  const resolvedParents =
    focusedPerson && renderGraph ? getResolvedParents(renderGraph.graph, focusedPerson.id) : [];
  const suggestedParents =
    focusedPerson && renderGraph ? getSuggestedParents(renderGraph.graph, focusedPerson.id) : [];
  const directParents = [...resolvedParents, ...suggestedParents];
  const remainingLinks = (data?.rels ?? []).filter(
    (rel) =>
      (rel.from_person_id === focusedPerson?.id || rel.to_person_id === focusedPerson?.id) &&
      !directParents.some((parent) => parent.relationshipId === rel.id),
  );
  const quickTarget = persons.find((person) => person.id === quickRelative?.personId);
  const quickTag =
    quickTarget?.is_proband && quickRelative?.kind !== "Irmã(o)" ? quickRelative?.kind : undefined;
  const onCreated = (id: string) => {
    setFocusedPersonId(id);
    setPanelOpen(true);
    if (!quickRelative) return;
    const relativeIsParent = quickRelative.kind === "Pai" || quickRelative.kind === "Mãe";
    const from = relativeIsParent
      ? id
      : quickRelative.kind === "Filho(a)"
        ? quickRelative.personId
        : undefined;
    setRelDialog({
      open: true,
      seed: {
        from,
        to: relativeIsParent ? quickRelative.personId : id,
        type: "parent",
      },
    });
  };

  const mappedIds = new Set(nodes.filter((node) => node.type === "person").map((node) => node.id));
  const originId = connection?.originId;
  const originName = persons.find((person) => person.id === originId);
  const startConnection = (id: string | null = null) => {
    setMobileSheetOpen(false);
    setConnection({ originId: id });
  };

  const selectPair = useCallback(
    (firstId: string, secondId: string) => {
      if (firstId === secondId) return;
      const first = renderGraph?.graph.persons.get(firstId);
      const second = renderGraph?.graph.persons.get(secondId);
      if (!first || !second) return;

      let seed: RelationshipSeed = { from: firstId, to: secondId };
      // Adjacent ancestral levels give the form a starting orientation. The form
      // still lets the editor choose the type and reverse the direction.
      const isAncestral = (lane: string) => lane !== "social" && lane !== "descendant";
      if (
        Math.abs(first.generation - second.generation) === 1 &&
        isAncestral(first.lane) &&
        isAncestral(second.lane)
      ) {
        const [parent, child] =
          first.generation > second.generation ? [first, second] : [second, first];
        seed = { type: "parent", from: parent.id, to: child.id };
      }
      setConnection(null);
      setRelDialog({ open: true, seed });
    },
    [renderGraph],
  );

  const activatePerson = useCallback(
    (id: string) => {
      if (!connection) return openPerson(id);
      if (!connection.originId) {
        setConnection({ originId: id });
        return;
      }
      if (connection.originId !== id) selectPair(connection.originId, id);
    },
    [connection, openPerson, selectPair],
  );

  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      if (connection) selectPair(source, target);
    },
    [connection, selectPair],
  );

  const positionedNodes = useMemo(() => {
    const positions = new Map(nodes.map((node) => [node.id, node.position]));
    return nodes.map((node) => {
      const union = renderGraph?.graph.unions.get(node.id);
      const position = union && placeUnionHub(union, positions);
      return position ? { ...node, position } : node;
    });
  }, [nodes, renderGraph]);

  const interactiveNodes = useMemo(
    () =>
      positionedNodes.map((node) =>
        node.type === "person"
          ? {
              ...node,
              data: {
                ...node.data,
                connecting: connection !== null,
                connectionOrigin: node.id === originId,
                onChooseConnection: () => activatePerson(node.id),
              },
            }
          : { ...node, connectable: false },
      ),
    [positionedNodes, connection, originId, activatePerson],
  );
  const personPanel = focusedPerson ? (
    <>
      <header className="mb-4">
        <h2>{personName(focusedPerson)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {focusedPerson.is_proband
            ? "Consultante"
            : focusedPerson.relationship_to_proband || "Parentesco não informado"}
        </p>
      </header>
      <section className="border-y border-border py-4" aria-label="Filiação da pessoa selecionada">
        <h3 className="text-sm font-semibold text-foreground">Filiação</h3>
        {directParents.length ? (
          <ul className="mt-2 divide-y divide-border">
            {directParents.map((parent) => {
              const person = persons.find((row) => row.id === parent.personId);
              const entry = data?.rels.find((row) => row.id === parent.relationshipId);
              const kind = relationshipQualifiers.parent.find(
                (item) => item.value === parent.kind,
              )?.label;
              return (
                <li key={parent.personId} className="py-2">
                  <button
                    type="button"
                    className="block min-h-9 text-left text-sm font-semibold text-forest hover:underline"
                    onClick={() => {
                      locatePerson(parent.personId);
                      if (isMobile) setMobileSheetOpen(false);
                    }}
                  >
                    {personName(person)}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {parent.source === "explicit"
                      ? kind || "Natureza por confirmar"
                      : "Sugerido pelo parentesco"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 min-h-11"
                    onClick={() => {
                      setMobileSheetOpen(false);
                      setRelDialog({
                        open: true,
                        editing: entry,
                        seed: { from: parent.personId, to: focusedPerson.id, type: "parent" },
                      });
                    }}
                  >
                    {entry ? "Revisar vínculo" : "Confirmar filiação"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="my-2 text-sm text-muted-foreground">
            Nenhum pai ou mãe identificado no mapa.
          </p>
        )}
        {suggestedParents.length > 0 && (
          <div className="my-3 rounded-md border border-border bg-background p-3">
            <p className="text-sm text-muted-foreground">
              Use a confirmação conjunta somente se todos os pais sugeridos forem biológicos.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 min-h-11"
              onClick={() => {
                setMobileSheetOpen(false);
                setParentProposal({
                  childId: focusedPerson.id,
                  parentIds: suggestedParents.map((parent) => parent.personId),
                });
              }}
            >
              {suggestedParents.length === 1 ? "Confirmar sugestão" : "Confirmar pais sugeridos"}
            </Button>
          </div>
        )}
        {resolvedParents.filter((parent) => parent.source === "explicit").length < 2 && (
          <Button
            size="sm"
            variant="forest"
            className="mt-2 min-h-11"
            onClick={() => {
              setMobileSheetOpen(false);
              setRelDialog({ open: true, seed: { to: focusedPerson.id, type: "parent" } });
            }}
          >
            <Link2 className="size-4" /> Definir filiação
          </Button>
        )}
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setMobileSheetOpen(false);
            setEditingPerson(focusedPerson);
          }}
        >
          Editar pessoa
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            startConnection(focusedPerson.id);
          }}
        >
          Conectar a…
        </Button>
      </div>
      {remainingLinks.length > 0 && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Outros vínculos ({remainingLinks.length})
          </summary>
          <ul className="divide-y divide-border">
            {remainingLinks.map((rel) => {
              const isSource = rel.from_person_id === focusedPerson.id;
              const other = persons.find(
                (person) => person.id === (isSource ? rel.to_person_id : rel.from_person_id),
              );
              return (
                <li key={rel.id} className="py-2">
                  <button
                    type="button"
                    className="min-h-11 text-left text-sm hover:underline"
                    onClick={() => {
                      setMobileSheetOpen(false);
                      setRelDialog({ open: true, editing: rel });
                    }}
                  >
                    <span className="block font-semibold text-forest">{personName(other)}</span>
                    {rel.relationship_type === "parent" && isSource
                      ? "Filho ou filha"
                      : relationshipLabel(rel.relationship_type, rel.qualifier)}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      <dl>
        {focusedPerson.preferred_name &&
          focusedPerson.preferred_name !== focusedPerson.full_name && (
            <div>
              <dt>Nome completo</dt>
              <dd>{focusedPerson.full_name}</dd>
            </div>
          )}
        <div>
          <dt>Nascimento</dt>
          <dd>
            {focusedPerson.birth_date
              ? new Date(focusedPerson.birth_date + "T12:00:00").toLocaleDateString("pt-BR")
              : "Não informado"}
          </dd>
        </div>
        {(focusedPerson.is_deceased || focusedPerson.death_date) && (
          <div>
            <dt>Falecimento</dt>
            <dd>
              {focusedPerson.death_date
                ? new Date(focusedPerson.death_date + "T12:00:00").toLocaleDateString("pt-BR")
                : "Data não informada"}
            </dd>
          </div>
        )}
        {focusedPerson.notes && (
          <div>
            <dt>Observações</dt>
            <dd>{focusedPerson.notes}</dd>
          </div>
        )}
      </dl>
    </>
  ) : (
    <>
      <h2>Pessoas e relações</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Selecione uma pessoa no mapa para consultar sua filiação.
      </p>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "atlas-genogram bg-background",
        !panelOpen && "gv-panel-collapsed",
        isFullscreen && "geno-editor-expanded",
      )}
    >
      <div className="atlas-map-workspace [min-height:0]">
        <div className="geno-editor-toolbar" aria-label="Ferramentas do genossociograma">
          <div className="geno-editor-modes" role="group" aria-label="Modo de visualização">
            <Button
              size="sm"
              variant={view === "2d" ? "forest" : "ghost"}
              aria-pressed={view === "2d"}
              onClick={() => setView("2d")}
            >
              2D
            </Button>
            <Button
              size="sm"
              variant={view === "3d" ? "forest" : "ghost"}
              aria-pressed={view === "3d"}
              onClick={() => setView("3d")}
              aria-label="3D"
            >
              <Box className="size-4" aria-hidden /> 3D
            </Button>
          </div>

          <Button
            size="sm"
            variant={connection ? "forest" : "outline"}
            aria-pressed={!!connection}
            disabled={qualifiedCount < 2}
            onClick={() => (connection ? setConnection(null) : startConnection())}
          >
            <Link2 className="size-4" aria-hidden /> Conectar
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Adicionar pessoa"
            onClick={() => {
              setQuickRelative(null);
              setCreatingPerson(true);
            }}
          >
            <UserPlus className="size-4" aria-hidden />{" "}
            <span className="hidden sm:inline">Pessoa</span>
          </Button>

          {view === "2d" && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden xl:inline-flex"
              disabled={!qualifiedCount || isLayoutFixed || saveLayout.isPending}
              onClick={organizeLayout}
              title="Reorganizar por filiação"
            >
              <RotateCcw className="size-4" /> Organizar
            </Button>
          )}

          <div className="geno-editor-find">
            <label htmlFor="geno-locate" className="sr-only">
              Localizar familiar
            </label>
            <Search className="size-4 shrink-0" aria-hidden />
            <select
              id="geno-locate"
              value=""
              onChange={(event) => {
                const id = event.currentTarget.value;
                if (!id) return;
                if (connection) activatePerson(id);
                else locatePerson(id);
              }}
            >
              <option value="">{connection ? "Escolher familiar…" : "Localizar familiar…"}</option>
              {persons
                .filter((person) => mappedIds.has(person.id))
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {personName(person)}
                    {person.relationship_to_proband &&
                    person.relationship_to_proband !== personName(person)
                      ? " · " + person.relationship_to_proband
                      : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="geno-editor-tools">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Localizar consultante"
              title="Localizar consultante"
              disabled={!probandId}
              onClick={() => probandId && locatePerson(probandId)}
            >
              <Crosshair className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={isFullscreen ? "Sair da tela ampla" : "Tela ampla"}
              title={isFullscreen ? "Sair da tela ampla" : "Tela ampla"}
              onClick={() => setIsFullscreen((value) => !value)}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={isMobile ? "Abrir ficha" : panelOpen ? "Recolher ficha" : "Mostrar ficha"}
              title={isMobile ? "Abrir ficha" : panelOpen ? "Recolher ficha" : "Mostrar ficha"}
              aria-expanded={isMobile ? mobileSheetOpen : panelOpen}
              onClick={() =>
                isMobile ? setMobileSheetOpen(true) : setPanelOpen((current) => !current)
              }
            >
              {panelOpen && !isMobile ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </Button>
            <Popover open={toolsOpen} onOpenChange={setToolsOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Mais ferramentas"
                  title="Mais ferramentas"
                >
                  <Ellipsis className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <div className="geno-editor-menu" aria-label="Opções do mapa">
                  {view === "2d" && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          organizeLayout();
                          setToolsOpen(false);
                        }}
                        disabled={!qualifiedCount || isLayoutFixed || saveLayout.isPending}
                      >
                        <RotateCcw className="size-4" /> Organizar
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Desfazer posição"
                        disabled={!historyRef.current.canUndo || isLayoutFixed}
                        onClick={() => {
                          undoLayout();
                          setToolsOpen(false);
                        }}
                      >
                        <Undo2 className="size-4" /> Desfazer posição
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label="Refazer posição"
                        disabled={!historyRef.current.canRedo || isLayoutFixed}
                        onClick={() => {
                          redoLayout();
                          setToolsOpen(false);
                        }}
                      >
                        <Redo2 className="size-4" /> Refazer posição
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={saveLayout.isPending || !layoutDirty}
                        onClick={() => {
                          saveLayout.mutate();
                          setToolsOpen(false);
                        }}
                      >
                        <Save className="size-4" />{" "}
                        {saveLayout.isPending ? "Salvando…" : "Salvar layout agora"}
                      </Button>
                      {data?.layout?.id && (
                        <Button
                          variant="ghost"
                          disabled={toggleLayoutFixed.isPending}
                          onClick={() => {
                            toggleLayoutFixed.mutate();
                            setToolsOpen(false);
                          }}
                        >
                          {isLayoutFixed ? (
                            <Unlock className="size-4" />
                          ) : (
                            <Lock className="size-4" />
                          )}
                          {isLayoutFixed ? "Liberar posições" : "Fixar posições"}
                        </Button>
                      )}
                    </>
                  )}
                  {socialCount > 0 && (
                    <Button
                      variant="ghost"
                      aria-pressed={showSocialLinks}
                      onClick={() => {
                        setShowSocialLinks((current) => !current);
                        setToolsOpen(false);
                      }}
                    >
                      <GitBranch className="size-4" />{" "}
                      {showSocialLinks
                        ? "Ocultar vínculos sociais"
                        : `Vínculos sociais (${socialCount})`}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={qualifiedCount < 2}
                    onClick={() => {
                      setToolsOpen(false);
                      setConnection(null);
                      setRelDialog({ open: true });
                    }}
                  >
                    <Link2 className="size-4" /> Preencher vínculo
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={isExportingPdf || !qualifiedCount}
                    aria-label="Exportar mapa 2D em PDF A3"
                    onClick={() => {
                      void exportPdf();
                      setToolsOpen(false);
                    }}
                  >
                    {isExportingPdf ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Printer className="size-4" />
                    )}
                    Exportar PDF A3
                  </Button>
                  {view === "2d" && (selectedPersonCount > 0 || selectedEdgeCount > 0) && (
                    <Button
                      variant="ghost"
                      disabled={deleteSelected.isPending}
                      className="text-destructive"
                      onClick={() => {
                        setConfirmDelete(true);
                        setToolsOpen(false);
                      }}
                    >
                      <Trash2 className="size-4" /> Remover seleção
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {connection && (
          <div className="geno-editor-connect-bar">
            <Link2 className="size-4 shrink-0" aria-hidden />
            <span role="status">
              {originName ? (
                <>
                  <strong>{personName(originName)}</strong> · escolha a segunda pessoa
                </>
              ) : (
                "Escolha a primeira pessoa no mapa."
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setConnection(null)}>
              Cancelar
            </Button>
          </div>
        )}

        {/* ── CANVAS ──────── */}
        <div className="atlas-map-stage">
          {qualifiedCount > 0 && !connection && (
            <div className="geno-editor-status">
              {warnings.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="geno-editor-review">
                      <AlertTriangle className="size-4" /> {warnings.length} para revisar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(24rem,calc(100vw-2rem))] max-h-96 overflow-y-auto"
                    align="start"
                  >
                    <h3 className="mb-2 text-sm font-semibold">Pendências do mapa</h3>
                    <ul className="divide-y divide-border">
                      {warnings.map((warning) => (
                        <li
                          key={warning.personId + warning.message}
                          className="py-2 text-sm leading-snug"
                        >
                          {mappedIds.has(warning.personId) ? (
                            <button
                              type="button"
                              className="min-h-11 text-left hover:underline"
                              onClick={() => {
                                locatePerson(warning.personId);
                                if (isMobile) setMobileSheetOpen(true);
                              }}
                            >
                              {warning.message}
                            </button>
                          ) : (
                            warning.message
                          )}
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    title="Legenda do mapa"
                    aria-label="Legenda do mapa"
                  >
                    <Layers className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-2 text-sm" align="start">
                  <h3 className="font-semibold">Legenda do mapa</h3>
                  {legendFlags.masculino && <p>Quadrado · masculino</p>}
                  {legendFlags.feminino && <p>Círculo · feminino</p>}
                  {legendFlags.outro && <p>Losango · não binário ou desconhecido</p>}
                  {legendFlags.aborto && <p>Triângulo · perda gestacional</p>}
                  {legendFlags.falecido && <p>Traço no símbolo · falecimento</p>}
                  <p>Linha contínua · filiação biológica</p>
                  <p>Linha pontilhada em bronze · filiação sugerida</p>
                  <p>Linha tracejada · confira a natureza do vínculo na ficha</p>
                </PopoverContent>
              </Popover>
              {(layoutDirty || lastSavedAt) && view === "2d" && (
                <span role="status" className="geno-editor-save-status">
                  {layoutDirty
                    ? saveLayout.isPending
                      ? "Salvando…"
                      : "Alterações pendentes"
                    : `Salvo às ${lastSavedAt}`}
                </span>
              )}
            </div>
          )}
          {familyQuery.isError || layoutQuery.isError ? (
            <section
              className="flex h-full flex-col items-center justify-center gap-3 p-6"
              role="alert"
            >
              <h3 className="font-semibold">Não foi possível carregar o genossociograma.</h3>
              <p>Seus dados não foram alterados. Tente carregar novamente.</p>
              <Button
                variant="outline"
                onClick={() => {
                  void familyQuery.refetch();
                  void layoutQuery.refetch();
                }}
              >
                Tentar novamente
              </Button>
            </section>
          ) : familyQuery.isLoading || layoutQuery.isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-11 w-11 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              <p className="text-[14px] text-muted-foreground">Carregando a árvore...</p>
            </div>
          ) : qualifiedPersons.length === 0 ? (
            <EmptyCanvas onCreate={() => setCreatingPerson(true)} />
          ) : (
            <>
              <div
                className={cn(
                  "absolute inset-0",
                  view === "3d" && "invisible",
                  connection && "geno-linking",
                )}
                aria-hidden={view === "3d"}
                inert={view === "3d"}
              >
                <ReactFlow
                  nodes={interactiveNodes}
                  edges={visibleEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChangeCustom}
                  onEdgesChange={onEdgesChange}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onNodeDragStart={() => {
                    historyRef.current.push(snapshot());
                    forceHistory((x) => x + 1);
                  }}
                  onNodeClick={(_, node) => node.type === "person" && activatePerson(node.id)}
                  onEdgeDoubleClick={onEdgeDoubleClick}
                  onConnect={onConnect}
                  isValidConnection={(pair) =>
                    !!connection && !!pair.source && !!pair.target && pair.source !== pair.target
                  }
                  nodesDraggable={!isLayoutFixed && !connection}
                  nodesConnectable={!!connection}
                  elementsSelectable={!connection}
                  deleteKeyCode={null}
                  panOnDrag={isMobile}
                  panActivationKeyCode="Space"
                  minZoom={0.075}
                  maxZoom={2.5}
                  proOptions={{ hideAttribution: true }}
                  defaultEdgeOptions={{
                    type: "step",
                    style: { strokeWidth: 2, stroke: "var(--color-forest)" },
                  }}
                  ariaLabelConfig={{
                    "controls.zoomIn.ariaLabel": "Aproximar mapa",
                    "controls.zoomOut.ariaLabel": "Afastar mapa",
                    "controls.fitView.ariaLabel": "Enquadrar mapa",
                  }}
                  fitView
                  fitViewOptions={{
                    padding: 0.18,
                    nodes: nodes.filter((n) => n.type === "person"),
                  }}
                >
                  <Background
                    color="var(--color-border)"
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    style={{ opacity: 0.25 }}
                  />
                  <Controls
                    className="overflow-hidden rounded-md"
                    showInteractive={false}
                    fitViewOptions={{
                      nodes: nodes.filter((n) => n.type === "person"),
                      padding: 0.18,
                    }}
                  />
                </ReactFlow>
              </div>
              {view === "3d" && (
                <Suspense
                  fallback={
                    <div className="p-4 text-sm" role="status">
                      Carregando visualização 3D…
                    </div>
                  }
                >
                  <SpatialView
                    key={clientId}
                    nodes={positionedNodes}
                    edges={visibleEdges}
                    onSelectPerson={activatePerson}
                    connectionOriginId={originId}
                    selectedPersonId={connection ? originId : focusedPerson?.id}
                    focusRequest={focusRequest}
                  />
                </Suspense>
              )}
              {(pendingDraft || saveLayout.isError) && (
                <div
                  className="absolute inset-x-2 bottom-2 z-20 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2 text-sm"
                  role="status"
                >
                  {saveLayout.isError ? (
                    <>
                      <span>
                        {draftStored
                          ? "Arranjo não salvo (rascunho de posições neste navegador)."
                          : "Arranjo não salvo e sem rascunho no navegador — não saia antes de salvar."}
                      </span>
                      <Button size="sm" className="min-h-11" onClick={() => saveLayout.mutate()}>
                        Tentar salvar de novo
                      </Button>
                    </>
                  ) : (
                    <>
                      <span>Há um arranjo não salvo de uma sessão anterior.</span>
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          historyRef.current.push(snapshot());
                          applySnapshot(pendingDraft!);
                          setPendingDraft(null);
                        }}
                      >
                        Recuperar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          if (userId) clearDraft(userId, clientId);
                          setPendingDraft(null);
                        }}
                      >
                        Descartar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isMobile ? (
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Ficha da pessoa selecionada</SheetTitle>
            </SheetHeader>
            <div className="atlas-person-panel atlas-person-panel--sheet">{personPanel}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <aside
          className="atlas-person-panel"
          aria-label="Ficha da pessoa selecionada"
          hidden={!panelOpen}
        >
          {personPanel}
        </aside>
      )}

      <PersonFormDialog
        open={creatingPerson}
        onOpenChange={(open) => {
          setCreatingPerson(open);
          if (!open) setQuickRelative(null);
        }}
        clientId={clientId}
        defaultRelationship={quickTag}
        defaultGender={
          quickRelative?.kind === "Pai"
            ? "masculino"
            : quickRelative?.kind === "Mãe"
              ? "feminino"
              : undefined
        }
        allPersons={persons}
        onCreated={onCreated}
      />
      <PersonFormDialog
        open={Boolean(editingPerson)}
        onOpenChange={(o) => !o && setEditingPerson(null)}
        clientId={clientId}
        editing={editingPerson}
        allPersons={persons}
      />
      <RelationshipFormDialog
        open={relDialog.open}
        onOpenChange={(o) =>
          setRelDialog((prev) => ({
            ...prev,
            open: o,
            ...(o ? {} : { seed: undefined, editing: null }),
          }))
        }
        clientId={clientId}
        persons={persons}
        seed={relDialog.seed}
        editing={relDialog.editing}
      />

      <AlertDialog
        open={!!parentProposal}
        onOpenChange={(open) => {
          if (!open && !confirmParents.isPending) setParentProposal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar filiação biológica?</AlertDialogTitle>
            <AlertDialogDescription>
              {personName(persons.find((person) => person.id === parentProposal?.childId))}
              {" ficará com a filiação registrada para "}
              {parentProposal?.parentIds
                .map((id) => personName(persons.find((person) => person.id === id)))
                .join(" e ")}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmParents.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!parentProposal || confirmParents.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (parentProposal) confirmParents.mutate(parentProposal);
              }}
            >
              {confirmParents.isPending ? "Registrando…" : "Registrar filiação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-ink">
              Remover o que está selecionado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPersonCount > 0 && selectedEdgeCount > 0
                ? `Isso apaga ${selectedPersonCount} pessoa(s) e ${selectedEdgeCount} vínculo(s) selecionados. Não pode ser desfeito.`
                : selectedPersonCount > 0
                  ? `Isso apaga ${selectedPersonCount} pessoa(s) selecionada(s) e os dados clínicos ligados a elas. Não pode ser desfeito.`
                  : `Isso apaga ${selectedEdgeCount} vínculo(s) selecionado(s). Não pode ser desfeito.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSelected.mutate()}
              className="bg-clinical-critical text-white hover:bg-clinical-critical/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center border-2 border-dashed border-forest/40 bg-forest-soft">
        <TreePine className="size-9 text-forest" />
      </div>

      <div>
        <p className="font-serif text-3xl font-semibold text-white">
          A árvore começa por uma pessoa
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          Adicione o <strong>paciente-índice</strong> primeiro. Depois construa em torno dele: pais,
          avós, irmãos, uniões, filhos.
        </p>
      </div>

      <Button onClick={onCreate} size="lg" variant="forest">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
