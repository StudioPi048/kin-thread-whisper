import { parentLinePatterns } from "@/lib/family-relationships";
import { readCasePages } from "@/lib/read-case-pages";
import { editGenogram, type RemovalImpact } from "./genogram-integrity";
import {
  findPedigreeRelationship,
  groupPedigreeChildren,
  parentageTrackLabel,
  type PedigreeData,
} from "./genogram-pedigree";
import { clinicalIntelQuery, getMappablePersons, invalidateCase } from "@/lib/clinical-intel";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
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
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./genogram-editor.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  UsersRound,
  Shapes,
  Pencil,
  Link2,
  Trash2,
  TreePine,
  Printer,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Layers,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Crosshair,
  Box,
  Focus,
  Plus,
  Minus,
  Ellipsis,
  GitBranch,
  ScanText,
  PanelRightClose,
  PanelRightOpen,
  Table2,
  X,
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
  clampHorizontalMove,
  type Snapshot,
  constrainSnapshotY,
} from "@/lib/geno/layout-history";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { RelationshipFormDialog, type ProposedParentageLink } from "./relationship-form-dialog";
import { formatDateBR, relationshipLabel, relationshipQualifiers } from "@/lib/genogram";
import { formatByPrecision, precisionOf } from "@/lib/timeline";
import { ensureProband } from "@/lib/ensure-proband";
import type { Database } from "@/integrations/supabase/types";

import { ParentageReviewPanel, type ParentageDraft } from "./parentage-review-panel";
import { ParentageHistory } from "./parentage-history";
import type { ParentagePreview } from "./parentage-preview";
import {
  mapBranchNames,
  readMapViewAnchor,
  type MapViewAnchor,
  type MapBranch,
} from "./map-view-context";
import { buildRenderGraph } from "./render-graph";
import { MapNavigator } from "./map-navigator";
import { MapPersonSearch } from "./map-person-search";
import type { SpatialCamera, SpatialCameraHandle } from "./genogram-spatial-view";
import {
  parentageSources,
  parentageSnapshot,
  reviewMatchesCurrent,
  validateParentagePlan,
  type ParentageCandidate,
  type ParentageSource,
} from "@/lib/parentage-review";

const recognizedParentKinds = new Set([
  ...relationshipQualifiers.parent.map((option) => option.value),
  "unknown",
]);
const reviewParents = (draft: ParentageDraft): ParentageCandidate[] =>
  draft.proposed
    .filter(({ personId }) => personId)
    .map(({ personId, kind }) => ({
      personId,
      ...(recognizedParentKinds.has(kind) ? { kind: kind as ParentageCandidate["kind"] } : {}),
    }));

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];
type NodePositionRow = Database["public"]["Tables"]["genogram_node_positions"]["Row"];
type LayoutRow = Database["public"]["Tables"]["genogram_layouts"]["Row"];

const SpatialView = lazy(() =>
  import("./genogram-spatial-view").then((module) => ({ default: module.GenogramSpatialView })),
);

const PrintPreview = lazy(() =>
  import("./genogram-print-preview").then((module) => ({ default: module.GenogramPrintPreview })),
);

type QuickRelative = {
  personId: string;
  kind: "Pai" | "Mãe" | "Filho(a)" | "Irmã(o)";
  parents: { id: string; name: string }[];
  expected: ReturnType<typeof parentageSnapshot>;
};
const quickRelativeChoices = [
  { kind: "Pai", label: "Pai" },
  { kind: "Mãe", label: "Mãe" },
  { kind: "Filho(a)", label: "Filho ou filha" },
] as const;
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
const MAP_OVERVIEW_PADDING = { top: "64px", bottom: "20px", x: "18px" } as const;
const MAP_MIN_ZOOM = 0.0001;
const MAP_MAX_ZOOM = 2.5;
const MAP_READING_ZOOM = 1.1;
type MapFrame2D = { ids?: ReadonlySet<string> };
const UnionNodeComponent = ({ data }: NodeProps) => {
  const d =
    (data as { label?: string; kind?: string; isSingle?: boolean; focused?: boolean }) ?? {};
  const isDivorce = d.kind === "divorcio";
  return (
    <div
      style={{ width: UNION_SIZE, height: UNION_SIZE, position: "relative" }}
      className="pointer-events-none"
    >
      {d.label && (
        <div
          className={cn(
            "geno-union-label absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-card/95 px-1.5 py-0.5 text-[14px] font-bold uppercase tracking-[0.08em] text-forest shadow-sm",
            d.focused && "ring-2 ring-forest",
          )}
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

function personBounds(people: readonly Node[]) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const person of people) {
    const width = person.measured?.width ?? person.width ?? NODE_W;
    left = Math.min(left, person.position.x);
    right = Math.max(right, person.position.x + width);
    top = Math.min(top, person.position.y);
    bottom = Math.max(bottom, nodeBottomY(person));
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function personViewport(
  person: Node,
  width: number,
  height: number,
  requestedZoom: number,
  horizontal = 0.5,
  vertical = 0.5,
): Viewport {
  const worldWidth = person.measured?.width ?? person.width ?? NODE_W;
  const worldHeight = nodeBottomY(person) - person.position.y;
  const marginX = Math.min(18, width / 10);
  const marginY = Math.min(18, height / 10);
  const zoom = Math.max(
    MAP_MIN_ZOOM,
    Math.min(
      requestedZoom,
      MAP_MAX_ZOOM,
      (width - marginX * 2) / worldWidth,
      (height - marginY * 2) / worldHeight,
    ),
  );
  const halfWidth = (worldWidth * zoom) / 2;
  const halfHeight = (worldHeight * zoom) / 2;
  const x = Math.max(
    marginX + halfWidth,
    Math.min(width - marginX - halfWidth, width * horizontal),
  );
  const y = Math.max(
    marginY + halfHeight,
    Math.min(height - marginY - halfHeight, height * vertical),
  );
  return {
    x: x - nodeCenterX(person) * zoom,
    y: y - (person.position.y + worldHeight / 2) * zoom,
    zoom,
  };
}

function mapMotionDuration(duration: number) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
  )
    return 0;
  return duration;
}

function sameNodes(previous: readonly unknown[], next: readonly unknown[]) {
  return previous.length === next.length && previous.every((node, i) => node === next[i]);
}

function nodeUnionY(node: Node | undefined): number {
  if (!node) return 0;
  return node.position.y + nodeShapeSize(node) / 2;
}

function ParentagePaths({ preview, nodes }: { preview: ParentagePreview; nodes: Node[] }) {
  const child = nodes.find(({ id }) => id === preview.childId);
  if (!child) return null;
  const paths = (ids: readonly string[], offset: number) => {
    const parents = nodes.filter(({ id }) => ids.includes(id));
    if (!parents.length) return "";
    const childX = nodeCenterX(child);
    const childBottom = nodeBottomY(child) + 7;
    return parents
      .map((parent) => {
        const parentX = nodeCenterX(parent);
        const parentIsBelow = parent.position.y >= child.position.y;
        const childY = parentIsBelow ? childBottom : child.position.y - 7;
        const parentY =
          Math.abs(parent.position.y - child.position.y) < 1
            ? nodeBottomY(parent) + 7
            : parentIsBelow
              ? parent.position.y - 7
              : nodeBottomY(parent) + 7;
        const midY =
          (parentY > childY && parentIsBelow) || (parentY < childY && !parentIsBelow)
            ? (parentY + childY) / 2 + offset
            : Math.max(nodeBottomY(parent), nodeBottomY(child)) + 25 + offset;
        const exitX = childX + offset;
        return `M ${exitX} ${childY} V ${midY} H ${parentX + offset} V ${parentY}`;
      })
      .join(" ");
  };
  const current = preview.phase === "draft" ? paths(preview.previousParentIds, -4) : "";
  const proposed = paths(preview.proposedParentIds, 4);
  return (
    <ViewportPortal>
      <svg aria-hidden="true" className="geno-parentage-paths" width="1" height="1">
        {current && <path d={current} data-parentage-preview="current" />}
        {proposed && (
          <path
            d={proposed}
            data-parentage-preview={preview.phase === "confirmed" ? "confirmed" : "proposed"}
          />
        )}
      </svg>
    </ViewportPortal>
  );
}

/**
 * PedigreeEdge — barra de irmãos que nasce de UM UnionNode.
 * data.unionId aponta para o UnionNode (fonte lógica); data.childIds lista
 * os filhos daquela união (fonte lógica). Nenhuma decisão vem de proximidade.
 */
function PedigreeEdge({ style, markerEnd, markerStart, interactionWidth, data }: EdgeProps) {
  const edgeData = data as
    | (PedigreeData & { unionId?: string; childIds?: string[]; direction?: "up" | "down" })
    | undefined;
  const unionId = edgeData?.unionId;
  const childIds = edgeData?.childIds;
  const parentIds = useMemo(
    () => [
      ...new Set(
        Object.values(edgeData?.parentsByChild ?? {}).flatMap((links) =>
          links.map(({ personId }) => personId),
        ),
      ),
    ],
    [edgeData?.parentsByChild],
  );
  // Compare only the nodes this path follows so that pan and zoom don't reroute it.
  const nodePositions = useStore(
    (store) => [
      unionId ? store.nodeLookup.get(unionId) : undefined,
      ...(childIds ?? []).map((id) => store.nodeLookup.get(id)),
      ...parentIds.map((id) => store.nodeLookup.get(id)),
    ],
    sameNodes,
  );
  const union = nodePositions[0];
  const childCount = childIds?.length ?? 0;
  const children = nodePositions.slice(1, 1 + childCount).filter((node) => node !== undefined);
  const parents = nodePositions.slice(1 + childCount);
  if (!union || !children.length) return null;
  const down = edgeData?.direction === "down";
  return groupPedigreeChildren(children, (node) => node.position.y, edgeData).map(
    (group, index) => {
      const parent = group.parentId ? parents[parentIds.indexOf(group.parentId)] : undefined;
      const unionX = parent ? nodeCenterX(parent) : union.position.x;
      const unionY = parent
        ? down
          ? nodeBottomY(parent) + 5
          : parent.position.y - 5
        : union.position.y;
      const portOffset = parent ? (unionX < union.position.x ? -6 : 6) : 0;
      const points = group.children.map((node) => ({
        x: nodeCenterX(node) + portOffset,
        y: down ? node.position.y - 5 : nodeBottomY(node) + 5,
      }));
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

      const provisional = group.source !== "explicit";
      return (
        <BaseEdge
          key={group.key}
          path={path}
          style={{
            ...style,
            ...(provisional
              ? {
                  stroke: "var(--bronze)",
                  strokeDasharray: group.source === "legacy" ? "2 3" : "4 5",
                }
              : { strokeDasharray: parentLinePatterns[group.kind] }),
          }}
          markerEnd={markerEnd}
          markerStart={markerStart}
          interactionWidth={interactionWidth}
        />
      );
    },
  );
}

/**
 * PartnerEdge — linha horizontal entre pessoa e UnionNode.
 * Sempre reta horizontal na Y da união; nunca cruza outros nós porque as
 * duas pessoas do casal estão em COUPLE_GAP da união por construção.
 */
function PartnerEdge({ style, interactionWidth, data }: EdgeProps) {
  const edgeData = data as { personId?: string; unionId?: string } | undefined;
  const [person, union] = useStore(
    (store) => [
      edgeData?.personId ? store.nodeLookup.get(edgeData.personId) : undefined,
      edgeData?.unionId ? store.nodeLookup.get(edgeData.unionId) : undefined,
    ],
    sameNodes,
  );
  if (!person || !union) return null;
  const px = nodeCenterX(person);
  const py = nodeUnionY(person);
  const ux = union.position.x;
  const uy = union.position.y;

  const shapeSize = nodeShapeSize(person);
  const R = shapeSize / 2;
  const safeGap = 2;

  let path = "";
  if (Math.abs(py - uy) < 12) {
    const startX = px < ux ? px + R + safeGap : px - R - safeGap;
    path = `M ${startX} ${uy} L ${ux} ${uy}`;
  } else {
    const startY = py < uy ? nodeBottomY(person) + safeGap : py - R - safeGap;
    path = `M ${px} ${startY} L ${px} ${uy} L ${ux} ${uy}`;
  }

  return <BaseEdge path={path} style={style} interactionWidth={interactionWidth} />;
}

const edgeTypes = { straightStep: StraightStepEdge, pedigree: PedigreeEdge, partner: PartnerEdge };

interface CanvasProps {
  clientId: string;
  /** Familiar a selecionar e centralizar ao abrir (ex.: vindo da linha do tempo). */
  focusPersonId?: string;
  focusRelationId?: string;
  reviewParentagePersonId?: string;
  resumePersonId?: string;
  onOpenSpreadsheet?: () => void;
  onFocusPerson?: (personId: string) => void;
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
  placeUnionHub,
  getResolvedParents,
  getSuggestedParents,
  parentKind,
} from "@/lib/geno/build";

function GenogramCanvasInner({
  clientId,
  focusPersonId: requestedPersonId,
  focusRelationId,
  reviewParentagePersonId,
  resumePersonId,
  onOpenSpreadsheet,
  onFocusPerson,
}: CanvasProps) {
  const [initialResumeId] = useState(resumePersonId);
  const focusPersonId = requestedPersonId ?? initialResumeId;
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
        .order("id", { ascending: true })
        .limit(1);
      if (error) throw error;
      const layout: LayoutRow | null = data?.[0] ?? null;
      if (!layout) return { layout, positions: [] as NodePositionRow[] };
      const positions = await readCasePages(
        (after, limit) => {
          const page = supabase
            .from("genogram_node_positions")
            .select("*")
            .eq("layout_id", layout.id)
            .order("node_id")
            .limit(limit);
          return after ? page.gt("node_id", after) : page;
        },
        (row) => row.node_id,
      );
      return { layout, positions };
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
  const [hasOpenedSpatial, setHasOpenedSpatial] = useState(false);
  const [spatialAnchor, setSpatialAnchor] = useState<MapViewAnchor>();
  const [spatialFitRequest, setSpatialFitRequest] = useState(0);
  const spatialCameraRef = useRef<SpatialCameraHandle>(null);
  const [mapReading, setMapReading] = useState(false);
  const [readerPersonId, setReaderPersonId] = useState<string | null>(null);
  const [mapBranch, setMapBranch] = useState<MapBranch | null>(null);
  const [organizationProposal, setOrganizationProposal] = useState<Snapshot | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    personId: string;
    relatedPersonIds?: readonly string[];
  }>();
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
  const [focusedRelationshipId, setFocusedRelationshipId] = useState<string | null>(null);
  useEffect(() => {
    if (focusedPersonId) onFocusPerson?.(focusedPersonId);
  }, [focusedPersonId, onFocusPerson]);
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
  const [removalSelection, setRemovalSelection] = useState<{
    people: string[];
    links: string[];
  } | null>(null);
  const [parentageDraft, setParentageDraft] = useState<ParentageDraft | null>(null);
  const canMoveLayout = !isLayoutFixed && !connection && !organizationProposal && !parentageDraft;
  const [pickingParentSlot, setPickingParentSlot] = useState<number | null>(null);
  const [reviewDirty, setReviewDirty] = useState(false);
  const reviewSavedRef = useRef(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [historyPersonId, setHistoryPersonId] = useState<string>();
  const [historyAll, setHistoryAll] = useState(false);
  useEffect(() => {
    if (pickingParentSlot === null) return;
    const cancelPick = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setPickingParentSlot(null);
      setReviewCollapsed(false);
    };
    window.addEventListener("keydown", cancelPick);
    return () => window.removeEventListener("keydown", cancelPick);
  }, [pickingParentSlot]);
  const [confirmedParentage, setConfirmedParentage] = useState<{
    reviewId: string;
    childId: string;
    parentIds: string[];
    source: ParentageSource;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const plane2DRef = useRef<HTMLDivElement>(null);
  const mapFrame2D = useRef<MapFrame2D | null>({});
  const cameraSize2D = useRef({ width: 0, height: 0 });
  const pendingPerson2D = useRef<{ id: string; zoom: number } | null>(null);
  const reviewTriggerRef = useRef<HTMLElement | null>(null);
  const reviewEditTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const reviewMapContext = useRef<{
    viewport: Viewport;
    frame: MapFrame2D | null;
    anchor?: MapViewAnchor;
    spatialCamera?: SpatialCamera;
    branch: MapBranch | null;
    personId: string | null;
    panelOpen: boolean;
    mobileSheetOpen: boolean;
  } | null>(null);
  // Revisões do arranjo: um save só limpa o que existia quando começou
  const revRef = useRef(new RevisionTracker());
  const layoutVersion = useRef<Pick<LayoutRow, "id" | "updated_at"> | null>(null);
  const [dirtyTick, setDirtyTick] = useState(0);
  const [draftStored, setDraftStored] = useState(true);
  const markLayoutDirty = useCallback(() => {
    if (revRef.current.isClean()) layoutVersion.current = data?.layout ?? null;
    revRef.current.bump();
    setLayoutDirty(true);
    setDirtyTick((t) => t + 1);
  }, [data?.layout]);
  const usesInspectorSheet = useIsMobile(900);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [pendingDraft, setPendingDraft] = useState<Snapshot | null>(null);
  const [, forceHistory] = useState(0);
  const historyRef = useRef(new LayoutHistory());
  const positionsRef = useRef<Snapshot>({});
  const dragStartRef = useRef<Snapshot | null>(null);
  useLayoutEffect(() => {
    const positions: Snapshot = {};
    for (const node of nodes) {
      if (node.type === "person") positions[node.id] = [node.position.x, node.position.y];
    }
    positionsRef.current = positions;
  }, [nodes]);
  const snapshot = useCallback(() => dragStartRef.current ?? positionsRef.current, []);
  const rememberLayout = useCallback((positions: Snapshot) => {
    historyRef.current.push(positions);
    forceHistory((count) => count + 1);
  }, []);
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
  const nodesMeasured = useNodesInitialized();
  const connecting = connection !== null;
  const previousConnecting = useRef(connecting);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    if (previousConnecting.current === connecting) return;
    previousConnecting.current = connecting;
    // O React Flow mede os nós na montagem. Neste modo só os handles mudam.
    const people = rfInstance.getNodes().filter((node) => node.type === "person");
    if (people.length) updateNodeInternals(people.map(({ id }) => id));
  }, [connecting, rfInstance, updateNodeInternals]);

  const fitViewport2D = useCallback(
    (width: number, height: number, ids?: ReadonlySet<string>) => {
      if (!width || !height) return;
      const people = rfInstance
        .getNodes()
        .filter((node) => node.type === "person" && (!ids || ids.has(node.id)))
        .map((node) => rfInstance.getInternalNode(node.id) ?? node);
      if (!people.length) return;
      return getViewportForBounds(
        personBounds(people),
        width,
        height,
        MAP_MIN_ZOOM,
        1.2,
        MAP_OVERVIEW_PADDING,
      );
    },
    [rfInstance],
  );

  const fitPeople2D = useCallback(
    (ids?: ReadonlySet<string>) => {
      const stage = stageRef.current;
      if (!stage || !rfInstance.viewportInitialized) return false;
      const { clientWidth: width, clientHeight: height } = stage;
      const fitted = fitViewport2D(width, height, ids);
      if (!fitted) return false;
      pendingPerson2D.current = null;
      mapFrame2D.current = { ids };
      cameraSize2D.current = { width, height };
      void rfInstance.setViewport(fitted);
      return true;
    },
    [fitViewport2D, rfInstance],
  );

  const placePendingPerson2D = useCallback(() => {
    const requested = pendingPerson2D.current;
    const stage = stageRef.current;
    const node = requested && rfInstance.getInternalNode(requested.id);
    if (!stage || !requested || !node || !rfInstance.viewportInitialized) return;
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    const zoom = Math.max(requested.zoom, rfInstance.getZoom());
    pendingPerson2D.current = null;
    mapFrame2D.current = null;
    const resized = width !== cameraSize2D.current.width || height !== cameraSize2D.current.height;
    cameraSize2D.current = { width, height };
    void rfInstance.setViewport(personViewport(node, width, height, zoom), {
      duration: resized ? 0 : mapMotionDuration(200),
    });
  }, [rfInstance]);

  const framePerson2D = useCallback(
    (id: string, zoom = MAP_READING_ZOOM) => {
      pendingPerson2D.current = { id, zoom };
      requestAnimationFrame(placePendingPerson2D);
    },
    [placePendingPerson2D],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      if (!rfInstance.viewportInitialized) return;
      const { width, height } = cameraSize2D.current;
      const { clientWidth: nextWidth, clientHeight: nextHeight } = stage;
      if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return;
      if (pendingPerson2D.current) return;
      const frame = mapFrame2D.current;
      if (frame && fitPeople2D(frame.ids)) return;
      cameraSize2D.current = { width: nextWidth, height: nextHeight };
      if (!width || !height) return;
      const viewport = rfInstance.getViewport();
      void rfInstance.setViewport({
        x: viewport.x + (nextWidth - width) / 2,
        y: viewport.y + (nextHeight - height) / 2,
        zoom: viewport.zoom,
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [fitPeople2D, rfInstance]);

  function readAnchor2D() {
    const stage = stageRef.current;
    if (!stage) return;
    const { clientWidth: width, clientHeight: height } = stage;
    const fitted = fitViewport2D(width, height);
    if (!fitted) return;
    const viewport = rfInstance.getViewport();
    const anchor = readMapViewAnchor(
      rfInstance
        .getNodes()
        .filter((node) => node.type === "person")
        .map((node) => ({
          id: node.id,
          x: viewport.x + nodeCenterX(node) * viewport.zoom,
          y: viewport.y + ((node.position.y + nodeBottomY(node)) / 2) * viewport.zoom,
        })),
      width,
      height,
      viewport.zoom / fitted.zoom,
      focusedPersonId,
    );
    const overview =
      Math.abs(viewport.x - fitted.x) < width * 0.035 &&
      Math.abs(viewport.y - fitted.y) < height * 0.035 &&
      Math.abs(viewport.zoom / fitted.zoom - 1) < 0.06;
    return anchor ? { ...anchor, overview, personWidth: NODE_W * viewport.zoom } : undefined;
  }

  function switchMap(next: "2d" | "3d") {
    if (next === view) return;
    if (next === "3d") {
      setSpatialAnchor(readAnchor2D());
      setHasOpenedSpatial(true);
    } else {
      const anchor = spatialCameraRef.current?.readAnchor();
      const node = anchor && rfInstance.getInternalNode(anchor.personId);
      const stage = stageRef.current;
      if (anchor && node && stage) {
        const { clientWidth: width, clientHeight: height } = stage;
        if (anchor.overview) fitPeople2D();
        else {
          const fitted = fitViewport2D(width, height);
          const scale = anchor.personWidth
            ? anchor.personWidth / NODE_W
            : (fitted?.zoom ?? 1) * anchor.scale;
          mapFrame2D.current = null;
          cameraSize2D.current = { width, height };
          void rfInstance.setViewport(
            personViewport(node, width, height, scale, anchor.horizontal, anchor.vertical),
          );
        }
      }
    }
    setFocusRequest(undefined);
    setView(next);
  }

  function restoreReviewContext() {
    const previous = reviewMapContext.current;
    reviewMapContext.current = null;
    if (!previous) return;
    setFocusRequest(undefined);
    setFocusedPersonId(previous.personId);
    setPanelOpen(previous.panelOpen);
    setMobileSheetOpen(previous.mobileSheetOpen);
    setMapBranch(previous.branch);
    if (previous.spatialCamera) spatialCameraRef.current?.restore(previous.spatialCamera);
    else if (view === "3d") setSpatialAnchor(previous.anchor);
    mapFrame2D.current = previous.frame;
    pendingPerson2D.current = null;
    requestAnimationFrame(() => {
      if (!previous.frame || !fitPeople2D(previous.frame.ids))
        void rfInstance.setViewport(previous.viewport);
    });
  }
  const openPerson = useCallback(
    (id: string) => {
      setFocusedRelationshipId(null);
      setFocusedPersonId(id);
      setPanelOpen(true);
      if (view === "2d" && (!panelOpen || rfInstance.getZoom() < 0.55)) framePerson2D(id);
      if (usesInspectorSheet) setMobileSheetOpen(true);
    },
    [framePerson2D, usesInspectorSheet, panelOpen, rfInstance, view],
  );

  const locatePerson = useCallback(
    (id: string, revealInspector = true) => {
      setFocusedRelationshipId(null);
      setFocusedPersonId(id);
      setReaderPersonId(id);
      if (revealInspector) setPanelOpen(true);
      setFocusRequest({ personId: id });
      framePerson2D(id);
    },
    [framePerson2D],
  );

  const focusedOnceRef = useRef<string | null>(null);
  useEffect(() => {
    if (reviewParentagePersonId || focusRelationId) return;
    if (!focusPersonId) {
      focusedOnceRef.current = null;
      return;
    }
    if (
      focusedOnceRef.current === focusPersonId ||
      !nodes.some((node) => node.id === focusPersonId)
    )
      return;
    const frame = requestAnimationFrame(() => {
      focusedOnceRef.current = focusPersonId;
      locatePerson(focusPersonId);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusPersonId, focusRelationId, nodes, locatePerson, reviewParentagePersonId]);

  const relationFocusHandled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusRelationId) {
      relationFocusHandled.current = undefined;
      return;
    }
    if (reviewParentagePersonId || relationFocusHandled.current === focusRelationId) return;
    const union = nodes.find(
      (node) => node.type === "union" && node.data.relationshipId === focusRelationId,
    );
    const link = data?.rels.find(({ id }) => id === focusRelationId);
    const source = link && nodes.find(({ id }) => id === link.from_person_id);
    const target = link && nodes.find(({ id }) => id === link.to_person_id);
    if (!union && (!source || !target)) return;
    relationFocusHandled.current = focusRelationId;
    setFocusedRelationshipId(focusRelationId);
    setPanelOpen(false);
    setMobileSheetOpen(false);
    const anchor = union?.position ?? {
      x: (nodeCenterX(source!) + nodeCenterX(target!)) / 2,
      y: (source!.position.y + target!.position.y) / 2,
    };
    mapFrame2D.current = null;
    pendingPerson2D.current = null;
    void rfInstance.setCenter(anchor.x, anchor.y, { zoom: union ? 1 : 0.85 });
  }, [data?.rels, focusRelationId, nodes, reviewParentagePersonId, rfInstance]);

  const [printOpen, setPrintOpen] = useState(false);

  const handleQuickAdd = useCallback(
    (personId: string, kind: QuickRelative["kind"]) => {
      const rels = data?.rels ?? [];
      const parents = rels
        .filter((link) => link.relationship_type === "parent" && link.to_person_id === personId)
        .map((link) => ({
          id: link.from_person_id,
          name: personName(data?.persons.find(({ id }) => id === link.from_person_id)),
        }));
      setQuickRelative({ personId, kind, parents, expected: parentageSnapshot(rels, personId) });
      setCreatingPerson(true);
    },
    [data?.persons, data?.rels],
  );

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
      if (revRef.current.isClean() && !dragStartRef.current) return next;
      const previousById = new Map(previous.map((node) => [node.id, node]));
      return next.map((node) => {
        const existing = previousById.get(node.id);
        return existing && node.type !== "band" && node.position.y === existing.position.y
          ? { ...node, position: { ...node.position, x: existing.position.x } }
          : node;
      });
    });
    setEdges(renderGraph.edges);
  }, [renderGraph, withQuickAdd, setNodes, setEdges]);

  useEffect(() => {
    if (!rfInstance.viewportInitialized || !nodesMeasured) return;
    if (mapInitialized.current && !pendingPerson2D.current) return;
    let cancelled = false;
    let frame: number;
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        if (pendingPerson2D.current) {
          placePendingPerson2D();
          if (!pendingPerson2D.current) mapInitialized.current = true;
        } else if (!mapInitialized.current) {
          // A deep link can already have focused the relationship before the first fit.
          mapInitialized.current = mapFrame2D.current === null || fitPeople2D();
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [nodes, nodesMeasured, fitPeople2D, placePendingPerson2D, rfInstance.viewportInitialized]);

  const onNodesChangeCustom = useCallback(
    (changes: NodeChange[]) => {
      const start = snapshot();
      let finished = false;
      let moved = false;
      onNodesChange(
        changes.map((change) => {
          if (change.type !== "position" || !change.position) return change;
          const before = start[change.id];
          const current = positionsRef.current[change.id];
          if (!before || !current) return change;
          const x = canMoveLayout ? change.position.x : before[0];
          finished ||= !change.dragging;
          moved ||= x !== before[0];
          return { ...change, position: { x, y: current[1] } };
        }),
      );

      if (finished) {
        dragStartRef.current = null;
        if (moved) {
          rememberLayout(start);
          markLayoutDirty();
        }
      }
    },
    [canMoveLayout, markLayoutDirty, onNodesChange, rememberLayout, snapshot],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if (connection || parentageDraft) return;
      const person = data?.persons.find((p) => p.id === node.id);
      if (person) setEditingPerson(person);
    },
    [data, connection, parentageDraft],
  );

  const onEdgeDoubleClick: EdgeMouseHandler = (_, edge) => {
    if (connection || parentageDraft) return;
    const rel = data?.rels.find((item) => item.id === (edge.data?.relationshipId ?? edge.id));
    if (rel) {
      editRelationship(rel);
      return;
    }
    const children = edge.type === "pedigree" ? edge.data?.childIds : undefined;
    if (!Array.isArray(children)) return;
    const child = children.length === 1 ? children[0] : focusedPersonId;
    if (typeof child === "string" && children.includes(child)) startParentageReview(child);
    else toast.info("Selecione um filho desta união para revisar a filiação.");
  };

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

  const removalImpact = useMutation({
    mutationFn: (selection: { people: string[]; links: string[] }) =>
      editGenogram("remove_genogram_selection", {
        _client_id: clientId,
        _people: selection.people,
        _relationships: selection.links,
      }),
  });
  const deleteSelected = useMutation({
    mutationFn: async (impact: RemovalImpact) => {
      if (!removalSelection) throw new Error("Selecione os itens a remover.");
      return editGenogram("remove_genogram_selection", {
        _client_id: clientId,
        _people: removalSelection.people,
        _relationships: removalSelection.links,
        _expected: impact,
      });
    },
    onSuccess: async ({ people, relationships }) => {
      if (focusedPersonId && removalSelection?.people.includes(focusedPersonId))
        setFocusedPersonId(null);
      if (focusedRelationshipId) setFocusedRelationshipId(null);
      setRemovalSelection(null);
      await invalidateCase(qc, clientId);
      toast.success(`Removidos ${people} pessoa(s) e ${relationships} vínculo(s).`);
    },
  });
  function prepareRemoval() {
    const people =
      view === "3d"
        ? focusedPersonId && focusedPersonId !== probandId
          ? [focusedPersonId]
          : []
        : nodes
            .filter((node) => node.type === "person" && node.selected && node.id !== probandId)
            .map(({ id }) => id);
    const links = new Set(
      edges.flatMap((edge) => {
        if (!edge.selected) return [];
        const id = String(edge.data?.relationshipId ?? edge.id);
        return data?.rels.some((link) => link.id === id && link.relationship_type !== "parent")
          ? [id]
          : [];
      }),
    );
    if (
      focusedRelationshipId &&
      data?.rels.some(
        (link) => link.id === focusedRelationshipId && link.relationship_type !== "parent",
      )
    )
      links.add(focusedRelationshipId);
    if (!people.length && !links.size) return;
    const selection = { people, links: [...links] };
    deleteSelected.reset();
    setRemovalSelection(selection);
    removalImpact.mutate(selection);
  }

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
  const getMovePersonDelta = useCallback(
    (id: string, deltaX: number) =>
      canMoveLayout ? clampHorizontalMove(snapshot(), id, deltaX, NODE_W, NODE_H) : 0,
    [canMoveLayout, snapshot],
  );
  const moveSpatialPerson = useCallback(
    (id: string, deltaX: number) => {
      const boundedDelta = getMovePersonDelta(id, deltaX);
      if (Math.abs(boundedDelta) < 1) return;
      const start = snapshot();
      const [x, y] = start[id];
      rememberLayout(start);
      applySnapshot({ [id]: [x + boundedDelta, y] });
    },
    [applySnapshot, getMovePersonDelta, rememberLayout, snapshot],
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
    if (layoutDirty) return;
    setPendingDraft(d && Object.keys(d.positions).length ? d.positions : null);
  }, [userId, clientId, data, layoutDirty]);

  const saveLayout = useMutation({
    mutationFn: async () => {
      const rev = revRef.current.begin();
      const positions = Object.entries(snapshot()).map(([id, [x, y]]) => ({
        id,
        x: Math.round(x),
        y: Math.round(y),
      }));
      const before = layoutVersion.current;
      const layout = await editGenogram("save_genogram_arrangement", {
        _client_id: clientId,
        _layout_id: before?.id ?? null,
        _expected: before?.updated_at ?? null,
        _positions: positions,
      });
      layoutVersion.current = layout;
      return { savedAt: layout.updated_at, rev };
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
      void qc.invalidateQueries({ queryKey: ["genograms-list"] });
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

  const layoutWrite = useRef<Promise<{ savedAt: string; rev: number }> | null>(null);
  function persistLayout() {
    if (!layoutWrite.current) {
      const task = saveLayout.mutateAsync();
      layoutWrite.current = task;
      const release = () => {
        if (layoutWrite.current === task) layoutWrite.current = null;
      };
      void task.then(release, release);
    }
    return layoutWrite.current;
  }
  const saveLayoutInBackground = () => {
    void persistLayout().catch(() => {});
  };

  useUnsaved(`layout:${clientId}`, {
    label: "Arranjo do genossociograma",
    isDirty: () => !revRef.current.isClean() || !!layoutWrite.current,
    save: async () => {
      await persistLayout();
      if (!revRef.current.isClean()) await persistLayout();
      if (!revRef.current.isClean()) throw new Error("As posições mudaram durante o salvamento.");
    },
    discard: async () => {
      const active = layoutWrite.current;
      const confirmed = active
        ? await active.then(
            () => true,
            () => false,
          )
        : false;
      revRef.current.reset();
      setLayoutDirty(false);
      if (userId) clearDraft(userId, clientId);
      if (confirmed) {
        await layoutQuery.refetch();
        toast.info("As posições já enviadas foram salvas. As demais foram descartadas.");
      }
    },
  });

  useEffect(() => {
    if (!layoutDirty || saveLayout.isPending || saveLayout.isError) return;
    const timer = window.setTimeout(saveLayoutInBackground, 2000);
    return () => window.clearTimeout(timer);
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
    if (!data || isLayoutFixed || organizationProposal || parentageDraft) return;
    const automatic = buildRenderGraph(qualifiedPersons, data.rels, probandId);
    const positions = snapshot();
    const candidates = automatic.nodes.filter(
      (node) => node.type === "person" && (!mapBranch || node.data.branchId === mapBranch),
    );
    const moving = new Set(candidates.map(({ id }) => id));
    const fixed = nodes.filter((node) => node.type === "person" && !moving.has(node.id));
    const offsets = candidates
      .map((node) => (positions[node.id]?.[0] ?? node.position.x) - node.position.x)
      .sort((a, b) => a - b);
    const offset = mapBranch ? (offsets[Math.floor(offsets.length / 2)] ?? 0) : 0;
    const proposed: Snapshot = {};
    for (const node of candidates) {
      const x = node.position.x + offset;
      if (
        fixed.some(
          (other) =>
            node.position.y === other.position.y && Math.abs(x - other.position.x) < NODE_W + 10,
        )
      ) {
        toast.info(
          "Há familiares no caminho desta organização. Ajuste as posições ou organize a árvore inteira.",
        );
        return;
      }
      proposed[node.id] = [x, node.position.y];
    }
    if (
      !Object.keys(proposed).length ||
      candidates.every(({ id }) => proposed[id][0] === positions[id]?.[0])
    ) {
      toast.info("As posições já seguem a organização proposta.");
      return;
    }
    setOrganizationProposal(proposed);
  };

  const confirmParentage = useMutation({
    mutationFn: async (draft: ParentageDraft) => {
      const parents = reviewParents(draft);
      const removesOrChanges = draft.current.some(
        (current) =>
          !parents.some(
            (parent) =>
              parent.personId === current.personId &&
              (!parent.kind || parent.kind === current.kind),
          ),
      );
      const { data, error } = await supabase.rpc("review_parentage", {
        _client_id: clientId,
        _child_id: draft.childId,
        _expected: draft.expected,
        _parents: parents,
        _decision: removesOrChanges ? "edit" : "confirm",
        _source: draft.source,
        _note: draft.note.trim() || undefined,
      });
      if (error?.code === "PGRST202")
        throw new Error("O banco ainda precisa da atualização para salvar a revisão.");
      if (error) throw new Error(error.message);
      if (!data) throw new Error("O servidor não confirmou a revisão.");
      return {
        reviewId: data,
        childId: draft.childId,
        parentIds: parents.map(({ personId }) => personId),
        source: draft.source,
      };
    },
    onSuccess: async (result) => {
      await invalidateCase(qc, clientId);
      void qc.invalidateQueries({ queryKey: ["genogram-parentage-review", clientId] });
      reviewSavedRef.current = true;
      setConfirmedParentage(result);
      setParentageDraft(null);
      setPickingParentSlot(null);
      setReviewDirty(false);
      setReviewCollapsed(false);
      restoreReviewContext();
    },
    onError: () => {
      void invalidateCase(qc, clientId);
      void qc.invalidateQueries({ queryKey: ["genogram-parentage-review", clientId] });
    },
  });

  const undoParentage = useMutation({
    mutationFn: async (reviewId: string) => {
      const viewport = rfInstance.getViewport();
      const frame = mapFrame2D.current;
      const spatialCamera = spatialCameraRef.current?.read();
      const { data, error } = await supabase.rpc("undo_parentage_review", {
        _client_id: clientId,
        _review_id: reviewId,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("O servidor não confirmou o desfazer.");
      return { viewport, frame, spatialCamera, branch: mapBranch };
    },
    onSuccess: async ({ viewport, frame, spatialCamera, branch }, reviewId) => {
      await invalidateCase(qc, clientId);
      setConfirmedParentage((saved) => (saved?.reviewId === reviewId ? null : saved));
      void qc.invalidateQueries({ queryKey: ["genogram-parentage-review", clientId] });
      setMapBranch(branch);
      if (spatialCamera) spatialCameraRef.current?.restore(spatialCamera);
      mapFrame2D.current = frame;
      pendingPerson2D.current = null;
      requestAnimationFrame(() => {
        if (!frame || !fitPeople2D(frame.ids)) void rfInstance.setViewport(viewport);
      });
      toast.success("Filiação anterior restaurada.");
    },
    onError: (error) => {
      void invalidateCase(qc, clientId);
      void qc.invalidateQueries({ queryKey: ["genogram-parentage-review", clientId] });
      toast.error(error.message);
    },
  });

  const reviewedChildId = parentageDraft?.childId ?? focusedPersonId ?? probandId;
  const parentageHistory = useQuery({
    queryKey: ["genogram-parentage-review", clientId, reviewedChildId, historyAll],
    enabled: !!reviewedChildId && (!!parentageDraft || historyPersonId === reviewedChildId),
    retry: false,
    queryFn: async () => {
      const base = supabase
        .from("genogram_parentage_reviews")
        .select("*")
        .eq("client_id", clientId)
        .eq("child_id", reviewedChildId!)
        .order("review_number", { ascending: false });
      const { data, error } = await base.limit(historyAll ? 1000 : 8);
      if (error) throw error;
      return data ?? [];
    },
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
    (edge) =>
      edge.selected &&
      data?.rels.some((rel) => rel.id === edge.id && rel.relationship_type !== "parent"),
  ).length;
  const visibleEdges = showSocialLinks
    ? edges
    : edges.filter((edge) => !edge.data?.relationshipType || edge.id === focusedRelationshipId);
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
  const sharedUnionPeople =
    focusedPerson && renderGraph
      ? [
          ...new Set(
            [...renderGraph.graph.unions.values()]
              .filter((union) => union.children.includes(focusedPerson.id))
              .flatMap((union) => union.children)
              .filter((id) => id !== focusedPerson.id),
          ),
        ].flatMap((id) => {
          const person = persons.find((item) => item.id === id);
          return person ? [person] : [];
        })
      : [];
  const recordedUnions = remainingLinks.filter((link) => link.relationship_type === "union");
  const childrenById = new Map<string, boolean>();
  const focusId = focusedPerson?.id;
  if (view === "3d" && focusId && renderGraph) {
    const graph = renderGraph.graph;
    for (const union of graph.unions.values()) {
      if (!union.partners.includes(focusId)) continue;
      for (const id of union.children) {
        const recorded = getResolvedParents(graph, id).some(
          (parent) => parent.personId === focusId && parent.source === "explicit",
        );
        childrenById.set(id, recorded);
      }
    }
  }
  const otherLinks =
    view === "3d"
      ? remainingLinks.filter(
          (link) =>
            link.relationship_type !== "union" &&
            !(
              link.relationship_type === "parent" &&
              link.from_person_id === focusId &&
              childrenById.has(link.to_person_id)
            ),
        )
      : remainingLinks;
  const reviewChild = parentageDraft?.childId;
  const reviewCurrent = parentageDraft?.current;
  const reviewProposal = parentageDraft?.proposed;
  const parentagePreview = useMemo<ParentagePreview | undefined>(() => {
    if (reviewChild && reviewCurrent && reviewProposal) {
      return {
        childId: reviewChild,
        previousParentIds: reviewCurrent.map(({ personId }) => personId),
        proposedParentIds: reviewProposal.map(({ personId }) => personId).filter(Boolean),
        phase: "draft",
      };
    }
    return confirmedParentage
      ? {
          childId: confirmedParentage.childId,
          previousParentIds: [],
          proposedParentIds: confirmedParentage.parentIds,
          phase: "confirmed",
        }
      : undefined;
  }, [reviewChild, reviewCurrent, reviewProposal, confirmedParentage]);
  const reviewHighlights = new Set(
    parentagePreview
      ? [
          parentagePreview.childId,
          ...parentagePreview.previousParentIds,
          ...parentagePreview.proposedParentIds,
        ]
      : [],
  );

  const startParentageReview = (
    childId: string,
    opener?: HTMLElement,
    seed?: ProposedParentageLink,
    fromRoute = false,
  ) => {
    if (confirmParentage.isPending || undoParentage.isPending || !data || !renderGraph) return;
    if (!data.persons.some((person) => person.id === childId)) return;
    if (parentageDraft) return;
    reviewMapContext.current = {
      viewport: rfInstance.getViewport(),
      frame: mapFrame2D.current,
      anchor: readAnchor2D(),
      spatialCamera: spatialCameraRef.current?.read(),
      branch: mapBranch,
      personId: fromRoute ? childId : focusedPersonId,
      panelOpen: fromRoute || panelOpen,
      mobileSheetOpen,
    };
    reviewTriggerRef.current = opener ?? null;
    const current = data.rels
      .filter((link) => link.relationship_type === "parent" && link.to_person_id === childId)
      .map((link) => ({
        personId: link.from_person_id,
        kind: link.qualifier ?? "",
        notes: link.notes,
      }));
    const suggested = seed
      ? []
      : [
          ...getResolvedParents(renderGraph.graph, childId).filter(
            (parent) => parent.source === "legacy",
          ),
          ...getSuggestedParents(renderGraph.graph, childId),
        ];
    const candidates = new Map(current.map((parent) => [parent.personId, parent]));
    for (const parent of suggested) {
      if (!candidates.has(parent.personId)) {
        candidates.set(parent.personId, {
          personId: parent.personId,
          kind: parent.kind,
          notes: null,
        });
      }
    }
    let pendingParent: ParentageDraft["pendingParent"];
    if (seed) {
      const parent = { personId: seed.parentId, kind: seed.kind };
      if (candidates.size < 2 || candidates.has(parent.personId))
        candidates.set(parent.personId, { ...parent, notes: null });
      else pendingParent = parent;
    }
    const [firstParent, secondParent] = candidates.values();
    const empty = { personId: "", kind: "" };
    confirmParentage.reset();
    reviewSavedRef.current = false;
    setReviewDirty(Boolean(seed));
    setParentageDraft({
      childId,
      current,
      expected: parentageSnapshot(data.rels, childId),
      proposed: [firstParent ?? empty, secondParent ?? empty],
      pendingParent,
      suggestedIds: suggested.map(({ personId }) => personId),
      source: "unverified",
      note: seed?.note ?? "",
    });
    setReviewCollapsed(false);
    setPickingParentSlot(null);
    setWarningsOpen(false);
    setMobileSheetOpen(false);
    setConnection(null);
    setFocusedPersonId(childId);
    setPanelOpen(true);
  };

  function editRelationship(link: RelRow) {
    if (parentageDraft || connection) return;
    if (link.relationship_type === "parent") {
      startParentageReview(link.to_person_id);
      return;
    }
    setMobileSheetOpen(false);
    setRelDialog({ open: true, editing: link });
  }

  const reviewOpenedFor = useRef<string>(undefined);
  useEffect(() => {
    if (!reviewParentagePersonId) {
      reviewOpenedFor.current = undefined;
      return;
    }
    if (
      reviewOpenedFor.current === reviewParentagePersonId ||
      parentageDraft ||
      !nodes.some((node) => node.id === reviewParentagePersonId)
    )
      return;
    reviewOpenedFor.current = reviewParentagePersonId;
    startParentageReview(reviewParentagePersonId, undefined, undefined, true);
  });

  const closeParentageReview = () => {
    if (confirmParentage.isPending) return;
    setParentageDraft(null);
    setPickingParentSlot(null);
    setReviewDirty(false);
    setReviewCollapsed(false);
    restoreReviewContext();
    requestAnimationFrame(() => {
      const target = reviewTriggerRef.current?.isConnected
        ? reviewTriggerRef.current
        : (reviewEditTriggerRef.current ?? stageRef.current);
      target?.focus({ preventScroll: true });
    });
  };

  const frameParentage = (childId: string, ids: readonly string[]) => {
    const relatedPersonIds = [...new Set(ids.filter(Boolean))];
    setFocusRequest({ personId: childId, relatedPersonIds });
    if (view !== "2d") return;
    const included = new Set([childId, ...relatedPersonIds]);
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true";
    const stage = stageRef.current;
    if (!stage) return;
    const { clientWidth: width, clientHeight: height } = stage;
    const viewport = fitViewport2D(width, height, included);
    if (!viewport) return;
    pendingPerson2D.current = null;
    mapFrame2D.current = { ids: included };
    void rfInstance.setViewport(viewport, { duration: reduced ? 0 : 210 });
  };

  const showParentageOnMap = () => {
    if (!parentagePreview) return;
    frameParentage(parentagePreview.childId, [
      ...parentagePreview.previousParentIds,
      ...parentagePreview.proposedParentIds,
    ]);
    if (usesInspectorSheet) setReviewCollapsed(true);
    requestAnimationFrame(() => {
      stageRef.current?.scrollIntoView({ block: "nearest" });
      stageRef.current?.focus({ preventScroll: true });
    });
  };

  const parentageValidation = (() => {
    if (!parentageDraft || !data) return null;
    if (parentageDraft.pendingParent) return "Escolha qual lugar o novo genitor vai ocupar.";
    if (
      JSON.stringify(parentageDraft.expected) !==
      JSON.stringify(parentageSnapshot(data.rels, parentageDraft.childId))
    )
      return "Os vínculos registrados mudaram. Feche e reabra a revisão para comparar os dados atualizados.";
    const proposal = reviewParents(parentageDraft);
    if (!proposal.length && !parentageDraft.current.length)
      return "Escolha um genitor para revisar a filiação.";
    return validateParentagePlan(parentageDraft.childId, proposal, data.rels);
  })();
  const recordedSource = parentageHistory.data?.[0];
  const reviewedPerson = persons.find((person) => person.id === reviewedChildId);
  const sourceStillApplies =
    !!data &&
    !!reviewedChildId &&
    reviewMatchesCurrent(
      recordedSource,
      parentageSnapshot(data.rels, reviewedChildId),
      !!reviewedPerson?.parentage_reviewed,
    );
  const previousSource =
    recordedSource &&
    sourceStillApplies &&
    Object.hasOwn(parentageSources, recordedSource.source) &&
    (recordedSource.source !== "unverified" || recordedSource.note)
      ? { source: recordedSource.source as ParentageSource, note: recordedSource.note }
      : undefined;
  const undoableHistoryId =
    sourceStillApplies && recordedSource && recordedSource.decision !== "undo"
      ? recordedSource.id
      : undefined;

  useUnsaved(`parentage:${clientId}`, {
    label: "Revisão de filiação",
    isDirty: () =>
      Boolean(
        !reviewSavedRef.current && parentageDraft && (reviewDirty || confirmParentage.isPending),
      ),
    save: async () => {
      if (!parentageDraft) return;
      if (parentageValidation) throw new Error(parentageValidation);
      if (confirmParentage.isPending) throw new Error("Aguarde a confirmação da filiação.");
      await confirmParentage.mutateAsync(parentageDraft);
    },
    discard: () => {
      if (confirmParentage.isPending) throw new Error("Aguarde a confirmação da filiação.");
      closeParentageReview();
    },
  });

  const quickTarget = persons.find((person) => person.id === quickRelative?.personId);
  const quickTag =
    quickTarget?.is_proband && quickRelative?.kind !== "Irmã(o)" ? quickRelative?.kind : undefined;
  const onCreated = (id: string) => locatePerson(id);

  const mappedIds = new Set(nodes.filter((node) => node.type === "person").map((node) => node.id));
  const originId = connection?.originId;
  const originName = persons.find((person) => person.id === originId);
  const startConnection = (id: string | null = null) => {
    setMobileSheetOpen(false);
    setPickingParentSlot(null);
    setConnection({ originId: id });
  };
  const selectBranch = useCallback(
    (branch: MapBranch | null) => {
      setOrganizationProposal(null);
      setMapBranch(branch);
      if (view !== "2d") return;
      const ids = branch
        ? new Set(
            rfInstance
              .getNodes()
              .filter(
                (node) =>
                  node.type === "person" &&
                  (node.data.branchId === branch || node.data.generation === 0),
              )
              .map(({ id }) => id),
          )
        : undefined;
      fitPeople2D(ids);
    },
    [fitPeople2D, rfInstance, view],
  );

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
      setReaderPersonId(id);
      if (parentageDraft && pickingParentSlot !== null) {
        if (
          id === parentageDraft.childId ||
          id === parentageDraft.proposed[1 - pickingParentSlot].personId
        ) {
          toast.error("Escolha outra pessoa para este vínculo.");
          return;
        }
        const current = parentageDraft.current.find(({ personId }) => personId === id);
        const previous = parentageDraft.proposed[pickingParentSlot];
        const proposed: ParentageDraft["proposed"] = [...parentageDraft.proposed];
        proposed[pickingParentSlot] = {
          personId: id,
          kind: id === previous.personId ? previous.kind : (current?.kind ?? ""),
        };
        const pendingParent =
          parentageDraft.pendingParent?.personId === id ? undefined : parentageDraft.pendingParent;
        if (!pendingParent && parentageDraft.pendingParent?.personId === id) {
          proposed[pickingParentSlot] = parentageDraft.pendingParent;
        }
        setParentageDraft({ ...parentageDraft, proposed, pendingParent });
        setReviewDirty(true);
        setPickingParentSlot(null);
        setReviewCollapsed(false);
        return;
      }
      if (!connection) return openPerson(id);
      if (!connection.originId) {
        setConnection({ originId: id });
        return;
      }
      if (connection.originId !== id) selectPair(connection.originId, id);
    },
    [connection, openPerson, parentageDraft, pickingParentSlot, selectPair],
  );

  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      if (connection) selectPair(source, target);
    },
    [connection, selectPair],
  );

  const positionedNodes = useMemo(() => {
    const base = organizationProposal
      ? nodes.map((node) => {
          const proposed = organizationProposal[node.id];
          return proposed ? { ...node, position: { x: proposed[0], y: node.position.y } } : node;
        })
      : nodes;
    const positions = new Map(base.map((node) => [node.id, node.position]));
    return base.map((node) => {
      const union = renderGraph?.graph.unions.get(node.id);
      const position = union && placeUnionHub(union, positions);
      return position ? { ...node, position } : node;
    });
  }, [nodes, organizationProposal, renderGraph]);

  const overlappingCards = useMemo(() => {
    const rows = new Map<number, Node[]>();
    for (const node of positionedNodes) {
      if (node.type !== "person") continue;
      const row = rows.get(node.position.y) ?? [];
      row.push(node);
      rows.set(node.position.y, row);
    }
    const overlap = new Set<string>();
    for (const row of rows.values()) {
      row.sort((a, b) => a.position.x - b.position.x);
      for (let i = 1; i < row.length; i++) {
        if (row[i].position.x - row[i - 1].position.x < NODE_W) {
          overlap.add(row[i].id);
          overlap.add(row[i - 1].id);
        }
      }
    }
    return overlap;
  }, [positionedNodes]);
  const mapWarnings = [
    ...warnings.map((warning) => ({ ...warning, position: false })),
    ...[...overlappingCards].map((id) => ({
      personId: id,
      message: `${personName(persons.find((person) => person.id === id))} · cartão sobreposto`,
      position: true,
    })),
  ];

  const largeMap = qualifiedPersons.length >= 100;
  const keyboardPerson = focusedPersonId ?? probandId;
  const interactiveNodes = useMemo(
    () =>
      positionedNodes.map((node): Node => {
        if (node.type !== "person") return { ...node, connectable: false, focusable: false };
        const data = node.data as PersonNodeData;
        const name = data.full_name?.trim() || data.preferred_name?.trim() || "Pessoa sem nome";
        return {
          ...node,
          focusable: !largeMap || node.id === keyboardPerson,
          className: cn(
            node.className,
            focusedPersonId === node.id && "geno-map-current-person",
            mapBranch && data.branchId !== mapBranch && !data.is_proband && "geno-map-muted-person",
            overlappingCards.has(node.id) && "geno-map-overlap",
          ),
          ariaLabel: [
            name,
            data.relationship_to_proband === name ? null : data.relationship_to_proband,
            overlappingCards.has(node.id) ? "Posição sobreposta" : null,
          ]
            .filter(Boolean)
            .join(" · "),
          data: {
            ...data,
            connecting: connection !== null,
            connectionOrigin: node.id === originId,
            keyboardReachable: !largeMap || node.id === keyboardPerson,
            onChooseConnection: () => activatePerson(node.id),
          },
        };
      }),
    [
      positionedNodes,
      connection,
      originId,
      activatePerson,
      mapBranch,
      overlappingCards,
      largeMap,
      keyboardPerson,
      focusedPersonId,
    ],
  );

  const branchById = new Map(positionedNodes.map((node) => [node.id, node.data.branchId]));
  const colorScopedEdges =
    mapBranch || focusedRelationshipId
      ? visibleEdges.map((edge) => ({
          ...edge,
          style:
            focusedRelationshipId &&
            (edge.id === focusedRelationshipId ||
              edge.data?.relationshipId === focusedRelationshipId ||
              (edge.type === "pedigree" &&
                edge.data &&
                findPedigreeRelationship(edge.data as PedigreeData, focusedRelationshipId)))
              ? { ...edge.style, stroke: "var(--bronze)", strokeWidth: 4 }
              : edge.style,
          className: cn(
            edge.className,
            mapBranch &&
              branchById.get(edge.source) !== mapBranch &&
              branchById.get(edge.target) !== mapBranch &&
              "geno-map-muted-edge",
          ),
        }))
      : visibleEdges;
  const focusedRelationship = focusedRelationshipId
    ? data?.rels.find((link) => link.id === focusedRelationshipId)
    : undefined;
  const focusedUnionLabel =
    focusedRelationship &&
    positionedNodes.find(
      (node) => node.type === "union" && node.data.relationshipId === focusedRelationship.id,
    )?.data.label;
  const reader = persons.find((person) => person.id === readerPersonId) ?? focusedPerson;
  const focusedName = personName(focusedPerson);
  const focusedRole = focusedPerson?.is_proband
    ? "Consultante"
    : focusedPerson?.relationship_to_proband || "Parentesco não informado";
  const displayedBirth = focusedPerson?.birth_date ?? focusedPerson?.birth_date_partial;
  const displayedDeath = focusedPerson?.death_date ?? focusedPerson?.death_date_partial;

  function fitAllPeople() {
    setFocusRequest(undefined);
    setMapBranch(null);
    if (view === "3d") setSpatialFitRequest((request) => request + 1);
    fitPeople2D();
  }

  function zoomMap2D(closer: boolean) {
    const current = rfInstance.getZoom();
    const factor = current < 0.65 ? 1.72 : 1.25;
    const stage = stageRef.current;
    const overview = stage && fitViewport2D(stage.clientWidth, stage.clientHeight)?.zoom;
    const target = current * (closer ? factor : 1 / factor);
    if (!closer && overview && target <= overview && current >= overview) {
      fitAllPeople();
      return;
    }
    pendingPerson2D.current = null;
    mapFrame2D.current = null;
    void rfInstance.zoomTo(Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, target)), {
      duration: mapMotionDuration(135),
    });
  }

  function addPerson() {
    setQuickRelative(null);
    setCreatingPerson(true);
  }
  function locateRelative(id: string) {
    locatePerson(id);
    if (usesInspectorSheet) setMobileSheetOpen(false);
  }
  function editFocusedPerson() {
    if (!focusedPerson) return;
    setMobileSheetOpen(false);
    setEditingPerson(focusedPerson);
  }
  const personActionsBlocked = !!connection || !!parentageDraft;
  const reviewAction = focusedPerson && (
    <Button
      ref={reviewEditTriggerRef}
      size="sm"
      variant="forest"
      className="min-h-11"
      disabled={personActionsBlocked}
      onClick={(event) => startParentageReview(focusedPerson.id, event.currentTarget)}
    >
      <Link2 className="size-4" aria-hidden />
      {directParents.length ? "Revisar filiação" : "Definir filiação"}
    </Button>
  );
  const personActions = focusedPerson && (
    <>
      <Button
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={personActionsBlocked}
        onClick={editFocusedPerson}
      >
        <Pencil className="size-4" aria-hidden /> Editar pessoa
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={qualifiedCount < 2 || personActionsBlocked}
        onClick={() => startConnection(focusedPerson.id)}
      >
        <Link2 className="size-4" aria-hidden /> Conectar a…
      </Button>
    </>
  );
  const renderRecordedLinks = (links: RelRow[]) => (
    <ul className="geno-dock-link-list">
      {links.map((link) => {
        const isSource = link.from_person_id === focusedPerson?.id;
        const other = persons.find(
          (person) => person.id === (isSource ? link.to_person_id : link.from_person_id),
        );
        const isParentage = link.relationship_type === "parent";
        const action = isParentage
          ? "Revisar filiação"
          : link.relationship_type === "union"
            ? "Editar união"
            : "Editar vínculo";
        const unionIdentity =
          link.relationship_type === "union"
            ? [
                link.marriage_order ? `${link.marriage_order}ª união` : null,
                formatDateBR(link.start_date),
                link.end_date ? `até ${formatDateBR(link.end_date)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "";
        return (
          <li key={link.id}>
            <button
              type="button"
              className="geno-dock-link-person"
              disabled={!other || !mappedIds.has(other.id)}
              onClick={() => other && locateRelative(other.id)}
            >
              <strong>{personName(other)}</strong>
              <span>
                {isParentage && isSource
                  ? "Filho ou filha"
                  : [relationshipLabel(link.relationship_type, link.qualifier), unionIdentity]
                      .filter(Boolean)
                      .join(" · ")}
              </span>
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={[`${action} com ${personName(other)}`, unionIdentity]
                .filter(Boolean)
                .join(" · ")}
              title={action}
              disabled={personActionsBlocked}
              onClick={() => editRelationship(link)}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          </li>
        );
      })}
    </ul>
  );
  const personPanel = focusedPerson ? (
    <>
      <header className="geno-dock-person">
        <h2>{focusedName}</h2>
        {focusedRole !== focusedName && (
          <p className="mt-1 text-sm text-muted-foreground">{focusedRole}</p>
        )}
      </header>
      {view === "3d" && (
        <div
          className="geno-dock-person-actions"
          role="group"
          aria-label="Editar pessoa e vínculos"
        >
          {reviewAction}
          {personActions}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={personActionsBlocked}
              >
                <UserPlus className="size-4" aria-hidden /> Adicionar parente
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              aria-label="Escolher parentesco"
              onCloseAutoFocus={(event) => {
                if (creatingPerson) event.preventDefault();
              }}
            >
              {quickRelativeChoices.map(({ kind, label }) => (
                <DropdownMenuItem
                  key={kind}
                  className="min-h-11 cursor-pointer"
                  onSelect={() => {
                    setMobileSheetOpen(false);
                    handleQuickAdd(focusedPerson.id, kind);
                  }}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <section className="geno-dock-parentage" aria-label="Filiação da pessoa selecionada">
        <h3>Filiação</h3>
        {directParents.length ? (
          <ul className="geno-dock-parents">
            {directParents.map((parent) => {
              const person = persons.find((row) => row.id === parent.personId);
              return (
                <li key={parent.personId}>
                  <button
                    type="button"
                    className="block min-h-9 text-left text-sm font-semibold text-forest hover:underline"
                    onClick={() => locateRelative(parent.personId)}
                  >
                    {personName(person)}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {parentageTrackLabel(parent.kind, parent.source)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="my-2 text-sm text-muted-foreground">Sem filiação registrada no mapa.</p>
        )}
        {directParents.length > 0 && !focusedPerson.parentage_reviewed && (
          <p className="text-sm text-muted-foreground">Fonte da filiação a confirmar.</p>
        )}
        <div className="geno-dock-review-actions">
          {view === "2d" && reviewAction}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              locatePerson(focusedPerson.id, false);
              setMobileSheetOpen(false);
            }}
          >
            <Focus className="size-4" aria-hidden /> Focar no mapa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            aria-expanded={historyPersonId === focusedPerson.id}
            onClick={() => {
              setHistoryAll(false);
              setHistoryPersonId((current) =>
                current === focusedPerson.id ? undefined : focusedPerson.id,
              );
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Histórico de filiação
          </Button>
        </div>
        {historyPersonId === focusedPerson.id && (
          <ParentageHistory
            key={focusedPerson.id}
            entries={parentageHistory.data ?? []}
            loading={parentageHistory.isPending}
            error={parentageHistory.isError}
            onRetry={() => void parentageHistory.refetch()}
            onShowAll={() => setHistoryAll(true)}
            more={!historyAll && parentageHistory.data?.length === 8}
            undoableId={undoableHistoryId}
            pending={undoParentage.isPending}
            onUndo={(id) => undoParentage.mutate(id)}
            currentUserId={userId}
            nameFor={(id) => {
              const person = persons.find((item) => item.id === id);
              return person ? personName(person) : "Familiar indisponível";
            }}
          />
        )}
      </section>
      {view === "2d" && <div className="geno-dock-edit-actions">{personActions}</div>}
      {view === "3d" && recordedUnions.length > 0 && (
        <details className="geno-dock-relatives">
          <summary>Uniões registradas ({recordedUnions.length})</summary>
          {renderRecordedLinks(recordedUnions)}
        </details>
      )}
      {view === "3d" && childrenById.size > 0 && (
        <details className="geno-dock-relatives">
          <summary>Filhos ({childrenById.size})</summary>
          <ul className="geno-dock-link-list">
            {[...childrenById].map(([id, recorded]) => {
              const name = personName(persons.find((person) => person.id === id));
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="geno-dock-link-person"
                    onClick={() => locateRelative(id)}
                  >
                    <strong>{name}</strong>
                    <span>{recorded ? "Filiação registrada" : "Filiação sugerida"}</span>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Revisar filiação de ${name}`}
                    title="Revisar filiação"
                    disabled={personActionsBlocked}
                    onClick={(event) => startParentageReview(id, event.currentTarget)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {sharedUnionPeople.length > 0 && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Filhos da mesma união ({sharedUnionPeople.length})
          </summary>
          <ul className="divide-y divide-border">
            {sharedUnionPeople.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="min-h-11 text-left text-sm font-semibold text-forest hover:underline"
                  onClick={() => locateRelative(person.id)}
                >
                  {personName(person)}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {otherLinks.length > 0 && (
        <details className="geno-dock-relatives">
          <summary>Outros vínculos ({otherLinks.length})</summary>
          {renderRecordedLinks(otherLinks)}
        </details>
      )}
      <dl>
        {focusedPerson.preferred_name &&
          focusedPerson.preferred_name !== focusedPerson.full_name && (
            <div>
              <dt>Nome de preferência</dt>
              <dd>{focusedPerson.preferred_name}</dd>
            </div>
          )}
        <div>
          <dt>Nascimento</dt>
          <dd>
            {displayedBirth
              ? formatByPrecision(displayedBirth, precisionOf(displayedBirth))
              : "Não informado"}
          </dd>
        </div>
        {(focusedPerson.is_deceased || displayedDeath) && (
          <div>
            <dt>Falecimento</dt>
            <dd>
              {displayedDeath
                ? formatByPrecision(displayedDeath, precisionOf(displayedDeath))
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

  const reviewPanel = parentageDraft && (
    <ParentageReviewPanel
      draft={parentageDraft}
      people={qualifiedPersons}
      previousSource={previousSource}
      error={confirmParentage.error?.message}
      validation={parentageValidation}
      pending={confirmParentage.isPending}
      onChange={(draft) => {
        confirmParentage.reset();
        setReviewDirty(true);
        setParentageDraft(draft);
      }}
      onConfirm={() => confirmParentage.mutate(parentageDraft)}
      onClose={closeParentageReview}
      onShowMap={showParentageOnMap}
      onPickParent={(slot) => {
        setConnection(null);
        setPickingParentSlot(slot);
        if (usesInspectorSheet) setReviewCollapsed(true);
        requestAnimationFrame(() => {
          stageRef.current?.scrollIntoView({ block: "nearest" });
          stageRef.current?.focus({ preventScroll: true });
        });
      }}
    />
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "atlas-genogram geno-workbench",
        (usesInspectorSheet || (!panelOpen && !parentageDraft)) && "gv-panel-collapsed",
        parentageDraft && "geno-editor-reviewing",
        pickingParentSlot !== null && "geno-parentage-picking",
        isFullscreen && "geno-editor-expanded",
      )}
    >
      <header className="geno-editor-toolbar" aria-label="Ferramentas do genossociograma">
        <div className="geno-editor-modes" role="group" aria-label="Modo de visualização">
          <Button
            size="sm"
            variant={view === "2d" ? "forest" : "ghost"}
            aria-pressed={view === "2d"}
            onClick={() => switchMap("2d")}
          >
            <Shapes className="size-4" aria-hidden /> 2D
          </Button>
          <Button
            size="sm"
            variant={view === "3d" ? "forest" : "ghost"}
            aria-pressed={view === "3d"}
            onClick={() => switchMap("3d")}
            aria-label="3D"
          >
            <Box className="size-4" aria-hidden /> 3D
          </Button>
        </div>

        <div className="geno-editor-edit" role="group" aria-label="Editar o mapa">
          <Button
            size="sm"
            variant="forest"
            className="geno-editor-add-person"
            aria-label="Adicionar pessoa"
            title="Adicionar pessoa"
            disabled={!!parentageDraft}
            onClick={addPerson}
          >
            <UserPlus className="size-4" aria-hidden />{" "}
            <span>
              <span className="geno-editor-person-word">Adicionar </span>pessoa
            </span>
          </Button>
          <Button
            size="sm"
            variant={connection ? "forest" : "outline"}
            className="geno-editor-connect"
            aria-label="Conectar"
            title="Conectar duas pessoas"
            aria-pressed={!!connection}
            disabled={qualifiedCount < 2 || !!parentageDraft}
            onClick={() => (connection ? setConnection(null) : startConnection())}
          >
            <Link2 className="size-4" aria-hidden /> <span>Conectar</span>
          </Button>
        </div>

        <div className="geno-editor-navigation">
          <MapPersonSearch
            nodes={positionedNodes}
            label={
              pickingParentSlot !== null
                ? "Escolher genitor"
                : connection
                  ? "Escolher familiar"
                  : "Localizar familiar"
            }
            onChoose={(id) => {
              if (connection || pickingParentSlot !== null) activatePerson(id);
              else locatePerson(id);
            }}
          />
          {qualifiedCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="geno-editor-fit"
              aria-label="Árvore inteira"
              title="Enquadrar a árvore inteira"
              onClick={fitAllPeople}
            >
              <Focus className="size-4" aria-hidden />
              <span>Árvore inteira</span>
            </Button>
          )}
          {qualifiedCount > 0 && !connection && pickingParentSlot === null && (
            <MapNavigator
              nodes={positionedNodes}
              focusId={focusedPerson?.id}
              branch={mapBranch}
              onBranch={selectBranch}
              onLocate={(id) => locatePerson(id, false)}
            />
          )}
        </div>

        <div className="geno-editor-tools">
          <Button
            size="sm"
            variant="ghost"
            className="geno-editor-header-tool"
            aria-label={isFullscreen ? "Sair da tela ampla" : "Tela ampla"}
            title={isFullscreen ? "Sair da tela ampla" : "Tela ampla"}
            onClick={() => setIsFullscreen((value) => !value)}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" aria-hidden />
            ) : (
              <Maximize2 className="size-4" aria-hidden />
            )}
            <span>{isFullscreen ? "Sair da tela ampla" : "Tela ampla"}</span>
          </Button>
          {!parentageDraft && (
            <Button
              size="sm"
              variant="ghost"
              className="geno-editor-header-tool"
              aria-label={
                usesInspectorSheet ? "Abrir ficha" : panelOpen ? "Recolher ficha" : "Mostrar ficha"
              }
              title={
                usesInspectorSheet ? "Abrir ficha" : panelOpen ? "Recolher ficha" : "Mostrar ficha"
              }
              aria-expanded={usesInspectorSheet ? mobileSheetOpen : panelOpen}
              onClick={() => {
                if (usesInspectorSheet) setMobileSheetOpen(true);
                else setPanelOpen((current) => !current);
              }}
            >
              {!usesInspectorSheet && panelOpen ? (
                <PanelRightClose className="size-4" aria-hidden />
              ) : (
                <PanelRightOpen className="size-4" aria-hidden />
              )}
              <span>Ficha</span>
            </Button>
          )}
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
                <Button
                  variant="ghost"
                  disabled={!focusedPerson}
                  onClick={() => {
                    setToolsOpen(false);
                    if (focusedPerson) locatePerson(focusedPerson.id, false);
                  }}
                >
                  <Focus className="size-4" aria-hidden /> Focar pessoa selecionada
                </Button>
                <Button
                  variant="ghost"
                  disabled={!probandId}
                  onClick={() => {
                    setToolsOpen(false);
                    if (probandId) locatePerson(probandId, false);
                  }}
                >
                  <Crosshair className="size-4" aria-hidden /> Localizar consultante
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    organizeLayout();
                    setToolsOpen(false);
                  }}
                  disabled={
                    !qualifiedCount ||
                    isLayoutFixed ||
                    saveLayout.isPending ||
                    !!organizationProposal ||
                    !!parentageDraft
                  }
                >
                  <RotateCcw className="size-4" /> {mapBranch ? "Organizar ramo" : "Organizar"}
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
                    saveLayoutInBackground();
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
                    {isLayoutFixed ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                    {isLayoutFixed ? "Liberar posições" : "Fixar posições"}
                  </Button>
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
                {onOpenSpreadsheet && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setToolsOpen(false);
                      onOpenSpreadsheet();
                    }}
                  >
                    <Table2 className="size-4" aria-hidden /> Abrir planilha
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={!qualifiedCount}
                  aria-label="Prévia de impressão do genossociograma"
                  onClick={() => {
                    setPrintOpen(true);
                    setToolsOpen(false);
                  }}
                >
                  <Printer className="size-4" aria-hidden /> Imprimir mapa em A3
                </Button>
                {(focusedRelationshipId ||
                  (view === "3d"
                    ? focusedPersonId && focusedPersonId !== probandId
                    : selectedPersonCount > 0 || selectedEdgeCount > 0)) && (
                  <Button
                    variant="ghost"
                    disabled={
                      deleteSelected.isPending ||
                      saveLayout.isPending ||
                      !!parentageDraft ||
                      !!connection
                    }
                    className="text-destructive"
                    onClick={() => {
                      prepareRemoval();
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
      </header>
      <div className="atlas-map-workspace geno-editor-workspace">
        {organizationProposal && (
          <div className="geno-parentage-feedback">
            <span role="status">
              Prévia · {mapBranch ? mapBranchNames[mapBranch] : "Árvore inteira"}
            </span>
            <Button
              size="sm"
              variant="forest"
              onClick={() => {
                rememberLayout(snapshot());
                applySnapshot(organizationProposal);
                setOrganizationProposal(null);
              }}
            >
              Aplicar organização
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOrganizationProposal(null)}>
              Cancelar prévia
            </Button>
          </div>
        )}

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

        {pickingParentSlot !== null && (
          <div className="geno-parentage-feedback">
            <span role="status">Selecione o genitor {pickingParentSlot + 1} na árvore.</span>
            <Button
              className="min-h-11"
              size="sm"
              variant="outline"
              onClick={() => {
                setPickingParentSlot(null);
                setReviewCollapsed(false);
              }}
            >
              Cancelar seleção
            </Button>
          </div>
        )}
        {usesInspectorSheet && parentageDraft && reviewCollapsed && pickingParentSlot === null && (
          <div className="geno-parentage-feedback">
            <span>
              Prévia de filiação ·{" "}
              {personName(persons.find((person) => person.id === parentageDraft.childId))}
            </span>
            <Button
              className="min-h-11"
              size="sm"
              variant="outline"
              onClick={() => setReviewCollapsed(false)}
            >
              Voltar à revisão
            </Button>
          </div>
        )}
        {confirmedParentage && !parentageDraft && (
          <div className="geno-parentage-feedback">
            <span role="status">
              {confirmedParentage.parentIds.length ? "Filiação confirmada" : "Filiação atualizada"}{" "}
              · {personName(persons.find((person) => person.id === confirmedParentage.childId))}
              {confirmedParentage.source !== "unverified" && (
                <small className="block font-normal">
                  {parentageSources[confirmedParentage.source]}
                </small>
              )}
            </span>
            <Button
              className="min-h-11"
              size="sm"
              variant="outline"
              disabled={undoParentage.isPending}
              onClick={() => undoParentage.mutate(confirmedParentage.reviewId)}
            >
              <Undo2 className="size-4" aria-hidden />{" "}
              {undoParentage.isPending ? "Restaurando…" : "Desfazer filiação"}
            </Button>
            <Button
              className="size-11 shrink-0"
              variant="ghost"
              aria-label="Fechar confirmação"
              disabled={undoParentage.isPending}
              onClick={() => setConfirmedParentage(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        )}
        {/* ── CANVAS ──────── */}
        <div
          className="atlas-map-stage"
          ref={stageRef}
          role="region"
          tabIndex={view === "2d" ? 0 : -1}
          aria-label="Mapa da família"
          aria-keyshortcuts={view === "2d" ? "ArrowLeft ArrowRight ArrowUp ArrowDown" : undefined}
          onKeyDown={(event) => {
            if (
              view !== "2d" ||
              event.target !== event.currentTarget ||
              event.metaKey ||
              event.ctrlKey
            )
              return;
            const { clientWidth, clientHeight } = event.currentTarget;
            const dx =
              event.key === "ArrowRight"
                ? -clientWidth / 4
                : event.key === "ArrowLeft"
                  ? clientWidth / 4
                  : 0;
            const dy =
              event.key === "ArrowDown"
                ? -clientHeight / 4
                : event.key === "ArrowUp"
                  ? clientHeight / 4
                  : 0;
            if (!dx && !dy) return;
            event.preventDefault();
            pendingPerson2D.current = null;
            mapFrame2D.current = null;
            const current = rfInstance.getViewport();
            void rfInstance.setViewport({ ...current, x: current.x + dx, y: current.y + dy });
          }}
        >
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
            <div className="flex h-full flex-col items-center justify-center gap-3" role="status">
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
                onFocus={(event) => {
                  if (mapReading && event.target instanceof HTMLElement) {
                    const node = event.target.closest<HTMLElement>(".react-flow__node-person");
                    if (node?.dataset.id) setReaderPersonId(node.dataset.id);
                  }
                }}
                onKeyDownCapture={(event) => {
                  const target = event.target;
                  if (
                    !(target instanceof HTMLElement) ||
                    !target.matches(".react-flow__node-person") ||
                    !target.dataset.id ||
                    event.repeat
                  )
                    return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activatePerson(target.dataset.id);
                  }
                }}
              >
                <ReactFlow
                  ref={plane2DRef}
                  className="geno-drafting-plane"
                  data-map-detail="full"
                  nodes={interactiveNodes.map((node) => {
                    if (reviewHighlights.has(node.id))
                      return { ...node, className: cn(node.className, "geno-parentage-highlight") };
                    if (focusedRelationshipId && node.data.relationshipId === focusedRelationshipId)
                      return { ...node, data: { ...node.data, focused: true } };
                    return node;
                  })}
                  edges={colorScopedEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodesChange={onNodesChangeCustom}
                  onEdgesChange={onEdgesChange}
                  onMove={(event, viewport) => {
                    if (event) {
                      pendingPerson2D.current = null;
                      mapFrame2D.current = null;
                    }
                    const plane = plane2DRef.current;
                    if (!plane) return;
                    const detail =
                      viewport.zoom < 0.2 ? "structure" : viewport.zoom < 0.72 ? "compact" : "full";
                    if (plane.dataset.mapDetail !== detail) plane.dataset.mapDetail = detail;
                  }}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onNodeDragStart={() => {
                    dragStartRef.current = positionsRef.current;
                  }}
                  onNodeDragStop={() => {
                    dragStartRef.current = null;
                  }}
                  onNodeClick={(_, node) => node.type === "person" && activatePerson(node.id)}
                  onEdgeClick={(_, edge) => {
                    if (
                      !connection &&
                      !parentageDraft &&
                      typeof edge.data?.relationshipId === "string"
                    )
                      setFocusedRelationshipId(edge.data.relationshipId);
                  }}
                  onEdgeDoubleClick={onEdgeDoubleClick}
                  onConnect={onConnect}
                  isValidConnection={(pair) =>
                    !!connection && !!pair.source && !!pair.target && pair.source !== pair.target
                  }
                  nodesDraggable={canMoveLayout}
                  nodesConnectable={!!connection}
                  elementsSelectable={!connection}
                  edgesFocusable={!largeMap}
                  deleteKeyCode={null}
                  panOnDrag
                  panActivationKeyCode="Space"
                  preventScrolling={isFullscreen}
                  zoomOnScroll={isFullscreen}
                  zoomActivationKeyCode="Control"
                  minZoom={MAP_MIN_ZOOM}
                  maxZoom={MAP_MAX_ZOOM}
                  proOptions={{ hideAttribution: true }}
                  defaultEdgeOptions={{
                    type: "step",
                    style: { strokeWidth: 2, stroke: "var(--color-forest)" },
                  }}
                  ariaLabelConfig={{
                    "node.a11yDescription.default":
                      "Pressione Enter ou Espaço para abrir a ficha. Com a pessoa selecionada, use as setas esquerda e direita para ajustar a posição.",
                  }}
                >
                  <Background
                    color="var(--map-grid)"
                    variant={BackgroundVariant.Dots}
                    gap={22}
                    size={1}
                  />
                  {parentagePreview && (
                    <ParentagePaths preview={parentagePreview} nodes={positionedNodes} />
                  )}
                  <Controls
                    className="geno-editor-map-controls"
                    position="top-left"
                    showInteractive={false}
                    showFitView={false}
                    showZoom={false}
                  >
                    <ControlButton
                      title="Aproximar mapa"
                      aria-label="Aproximar mapa"
                      onClick={() => zoomMap2D(true)}
                    >
                      <Plus aria-hidden />
                    </ControlButton>
                    <ControlButton
                      title="Afastar mapa"
                      aria-label="Afastar mapa"
                      onClick={() => zoomMap2D(false)}
                    >
                      <Minus aria-hidden />
                    </ControlButton>
                    <ControlButton
                      title="Enquadrar mapa"
                      aria-label="Enquadrar mapa"
                      onClick={fitAllPeople}
                    >
                      <Focus aria-hidden />
                    </ControlButton>
                  </Controls>
                </ReactFlow>
              </div>
              {hasOpenedSpatial && (
                <div
                  className={cn("absolute inset-0", view === "2d" && "invisible")}
                  inert={view === "2d"}
                  aria-hidden={view === "2d"}
                >
                  <Suspense
                    fallback={
                      <div className="p-4 text-sm" role="status">
                        Carregando visualização 3D…
                      </div>
                    }
                  >
                    <SpatialView
                      key={clientId}
                      workbench
                      nodes={positionedNodes}
                      edges={visibleEdges}
                      onSelectPerson={activatePerson}
                      connectionOriginId={originId}
                      selectedPersonId={connection ? originId : focusedPerson?.id}
                      focusedRelationshipId={focusedRelationshipId}
                      onDismissRelationship={() => setFocusedRelationshipId(null)}
                      onOpenPerson={openPerson}
                      focusRequest={focusRequest}
                      fitRequest={spatialFitRequest}
                      viewAnchor={spatialAnchor}
                      cameraRef={spatialCameraRef}
                      parentagePreview={parentagePreview}
                      highlightedBranch={mapBranch}
                      onBranchChange={selectBranch}
                      onFocusPerson={(id) => setReaderPersonId(id)}
                      onReviewParentage={(id) => startParentageReview(id)}
                      onEditRelationship={(id) => {
                        const link = data?.rels.find((item) => item.id === id);
                        if (link) editRelationship(link);
                      }}
                      canMovePeople={canMoveLayout}
                      onMovePerson={moveSpatialPerson}
                      getMovePersonDelta={getMovePersonDelta}
                    />
                  </Suspense>
                </div>
              )}
              {view === "2d" && focusedRelationship && !parentageDraft && !connection && (
                <section
                  className="absolute top-2 right-2 z-10 w-64 max-w-[calc(100%-3.75rem)] rounded-md border bg-card px-3 py-2 shadow-sm"
                  aria-label="Vínculo em foco"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 py-1">
                      <strong className="block break-words">
                        {String(
                          focusedUnionLabel ??
                            (focusedRelationship.relationship_type === "parent"
                              ? parentageTrackLabel(
                                  parentKind(focusedRelationship.qualifier),
                                  "explicit",
                                )
                              : relationshipLabel(
                                  focusedRelationship.relationship_type,
                                  focusedRelationship.qualifier,
                                )),
                        )}
                      </strong>
                      <p className="break-words text-sm text-muted-foreground">
                        {[focusedRelationship.from_person_id, focusedRelationship.to_person_id]
                          .map((id) => personName(persons.find((person) => person.id === id)))
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      aria-label="Fechar vínculo em foco"
                      onClick={() => setFocusedRelationshipId(null)}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => editRelationship(focusedRelationship)}
                  >
                    Editar vínculo
                  </Button>
                </section>
              )}
              {mapReading && reader && (
                <div className="geno-map-reader" role="status" aria-label="Leitura do familiar">
                  <div>
                    <strong>{personName(reader)}</strong>
                    <small>
                      {[
                        reader.is_proband ? "Consultante" : reader.relationship_to_proband,
                        reader.birth_date?.slice(0, 4),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar lupa"
                    onClick={() => setMapReading(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
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
                      <Button size="sm" className="min-h-11" onClick={saveLayoutInBackground}>
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
                          rememberLayout(snapshot());
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
        {qualifiedCount > 0 && (
          <div className="geno-editor-base">
            {qualifiedCount > 0 && (
              <div className="geno-editor-meta">
                <span>
                  <UsersRound className="size-4" aria-hidden />
                  {qualifiedCount} {qualifiedCount === 1 ? "familiar" : "familiares"}
                </span>
                {(layoutDirty || lastSavedAt) && (
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
            {qualifiedCount > 0 && !connection && (
              <div className="geno-editor-status">
                {mapWarnings.length > 0 && (
                  <Popover open={warningsOpen} onOpenChange={setWarningsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="geno-editor-review"
                        aria-label={`${mapWarnings.length} para revisar`}
                      >
                        <AlertTriangle className="size-4" aria-hidden />
                        {mapWarnings.length}
                        <span className="geno-editor-warning-copy">para revisar</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(24rem,calc(100vw-2rem))] max-h-96 overflow-y-auto"
                      align="start"
                      onCloseAutoFocus={(event) => {
                        if (parentageDraft) event.preventDefault();
                      }}
                    >
                      <h3 className="mb-2 text-sm font-semibold">Pendências do mapa</h3>
                      <ul className="divide-y divide-border">
                        {mapWarnings.map((warning) => (
                          <li
                            key={warning.personId + warning.message}
                            className="py-2 text-sm leading-snug"
                          >
                            {mappedIds.has(warning.personId) ? (
                              <button
                                type="button"
                                className="min-h-11 text-left hover:underline"
                                onClick={() => {
                                  if (warning.position) {
                                    locatePerson(warning.personId);
                                    setWarningsOpen(false);
                                  } else startParentageReview(warning.personId);
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
                      variant="ghost"
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
                    {legendFlags.falecido && <p>Traço horizontal superior · falecimento</p>}
                    <p>Linha contínua · filiação biológica</p>
                    <p>Linha pontilhada em bronze · filiação sugerida</p>
                    <p>Linha tracejada · confira a natureza do vínculo na ficha</p>
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon"
                  variant={mapReading ? "forest" : "ghost"}
                  aria-label="Lupa de leitura do mapa"
                  title="Lupa de leitura do mapa"
                  aria-pressed={mapReading}
                  onClick={() => {
                    setReaderPersonId(focusedPerson?.id ?? null);
                    setMapReading((active) => !active);
                  }}
                >
                  <ScanText className="size-4" aria-hidden />
                </Button>
              </div>
            )}
          </div>
        )}
        {usesInspectorSheet && !reviewCollapsed && reviewPanel}
      </div>
      {usesInspectorSheet ? (
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Ficha da pessoa selecionada</SheetTitle>
            </SheetHeader>
            <div className="atlas-person-panel atlas-person-panel--sheet geno-editor-dock">
              {personPanel}
            </div>
          </SheetContent>
        </Sheet>
      ) : parentageDraft ? (
        reviewPanel
      ) : (
        <aside
          className="atlas-person-panel geno-editor-dock"
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
        quickLink={
          quickRelative && quickTarget
            ? {
                targetId: quickRelative.personId,
                targetName: personName(quickTarget),
                direction:
                  quickRelative.kind === "Irmã(o)"
                    ? "sibling"
                    : quickRelative.kind === "Filho(a)"
                      ? "child"
                      : "parent",
                parents: quickRelative.parents,
                expected: quickRelative.expected,
              }
            : undefined
        }
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
        onReviewParentage={(childId, seed) => {
          startParentageReview(childId, undefined, seed);
        }}
      />

      {printOpen && (
        <Suspense
          fallback={
            <span className="sr-only" role="status">
              Preparando prévia…
            </span>
          }
        >
          <PrintPreview open onOpenChange={setPrintOpen} nodes={positionedNodes} edges={edges} />
        </Suspense>
      )}

      <AlertDialog
        open={!!removalSelection}
        onOpenChange={(open) => {
          if (!open && !deleteSelected.isPending) setRemovalSelection(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-ink">
              Remover seleção da árvore?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removalImpact.isPending
                ? "Conferindo pessoas, vínculos e histórico afetados…"
                : removalImpact.data
                  ? `Serão removidos ${removalImpact.data.people} pessoa(s), ${removalImpact.data.relationships} vínculo(s) e ${removalImpact.data.reviews} registro(s) do histórico de filiação.`
                  : "Confira o impacto antes de remover."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(removalImpact.error || deleteSelected.error) && (
            <p role="alert" className="text-sm text-destructive">
              {(deleteSelected.error ?? removalImpact.error)?.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSelected.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                removalImpact.isPending ||
                deleteSelected.isPending ||
                !removalImpact.data ||
                Boolean(deleteSelected.error)
              }
              onClick={(event) => {
                event.preventDefault();
                if (removalImpact.data) deleteSelected.mutate(removalImpact.data);
              }}
              className="bg-clinical-critical text-white hover:bg-clinical-critical/90"
            >
              {deleteSelected.isPending ? "Removendo…" : "Remover definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center">
      <div className="flex size-14 items-center justify-center border border-border bg-card">
        <TreePine className="size-7 text-forest" aria-hidden />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ink">Adicione o consultante ao mapa</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Depois, você pode incluir os demais familiares e registrar seus vínculos.
        </p>
      </div>

      <Button onClick={onCreate} size="lg" variant="forest">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
