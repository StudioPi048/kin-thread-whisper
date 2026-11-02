import { invalidateCase } from "@/lib/clinical-intel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
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
  ConnectionMode,
  type NodeProps,
  type NodeChange,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Link2,
  Trash2,
  Printer,
  HelpCircle,
  Users,
  TreePine,
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
import { relationshipLabel } from "@/lib/genogram";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];
type NodePositionRow = Database["public"]["Tables"]["genogram_node_positions"]["Row"];
type LayoutRow = Database["public"]["Tables"]["genogram_layouts"]["Row"];

/**
 * UnionNode — cidadão de primeira classe do grafo.
 * Renderiza um pequeno diamante ameixa no ponto exato da união entre os
 * parceiros. A etiqueta pertence ao nó, nunca ao edge — evita colisões
 * com a linha do casal.
 */
const UNION_SIZE = 12;
const UnionNodeComponent = ({ data }: NodeProps) => {
  const d = (data as { label?: string; kind?: string }) ?? {};
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
      <div
        className="absolute rounded-sm bg-foreground"
        style={{ width: 8, height: 8, left: 2, top: 2, transform: "rotate(45deg)" }}
      />
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
  const edgeData = data as { unionId?: string; childIds?: string[] } | undefined;
  const unionId = edgeData?.unionId;
  const childIds = edgeData?.childIds ?? [];
  const live = useStore((store) => {
    const children = childIds
      .map((id) => store.nodeLookup.get(id) as unknown as Node | undefined)
      .filter((n): n is Node => Boolean(n));
    const union = unionId
      ? (store.nodeLookup.get(unionId) as unknown as Node | undefined)
      : undefined;
    return { children, union };
  });

  if (!live.union || live.children.length === 0) return null;

  const unionX = live.union.position.x;
  const unionY = live.union.position.y;
  const childPoints = live.children.map((n) => ({ x: nodeCenterX(n), y: n.position.y, node: n }));

  const xs = childPoints.map((p) => p.x);
  const barLeft = Math.min(...xs, unionX);
  const barRight = Math.max(...xs, unionX);

  const minChildTop = Math.min(...childPoints.map((p) => p.y));
  // Barra de irmãos posicionada de forma limpa abaixo dos cards dos filhos:
  // minChildTop + shapeSize (76) + 12px (gap) + 72px (card) + 24px (gap to line)
  const shapeSize = 76;
  const cardHeight = 72;
  const siblingBarY =
    unionY < minChildTop ? minChildTop - 30 : minChildTop + shapeSize + 12 + cardHeight + 24;

  let path = "";
  path += `M ${barLeft} ${siblingBarY} L ${barRight} ${siblingBarY} `;
  for (const p of childPoints) {
    const childShapeSize = nodeShapeSize(p.node);
    const safeGap = 20;

    // Conecta na base/topo do símbolo do filho respeitando os 20px de respiro
    const childConnY = p.y < siblingBarY ? p.y + childShapeSize + safeGap : p.y - safeGap;

    path += `M ${p.x} ${childConnY} L ${p.x} ${siblingBarY} `;
  }

  // Conecta na união parental respeitando os 20px de respiro do símbolo
  const safeGap = 20;
  const unionHalfSize = 6; // UNION_SIZE / 2
  const unionConnY =
    unionY < siblingBarY ? unionY + unionHalfSize + safeGap : unionY - unionHalfSize - safeGap;

  path += `M ${unionX} ${siblingBarY} L ${unionX} ${unionConnY}`;

  return (
    <BaseEdge
      path={path}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
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
  const safeGap = 20;

  let path = "";
  if (Math.abs(py - uy) < 1) {
    const startX = px < ux ? px + R + safeGap : px - R - safeGap;
    path = `M ${startX} ${uy} L ${ux} ${uy}`;
  } else {
    const startY = py < uy ? py + R + safeGap : py - R - safeGap;
    path = `M ${px} ${startY} L ${px} ${uy} L ${ux} ${uy}`;
  }

  return <BaseEdge path={path} style={style} interactionWidth={interactionWidth} />;
}

const edgeTypes = { straightStep: StraightStepEdge, pedigree: PedigreeEdge, partner: PartnerEdge };

function isUnionEdge(edge: Edge): boolean {
  return (edge.data as { relationshipType?: string } | undefined)?.relationshipType === "union";
}

function isParentEdge(edge: Edge): boolean {
  return (edge.data as { relationshipType?: string } | undefined)?.relationshipType === "parent";
}

function GenerationRuler() {
  return (
    <div className="w-[154px] overflow-hidden rounded-md border border-forest/25 bg-card/92 shadow-sm backdrop-blur">
      {[
        ["Paciente", "ponto de partida"],
        ["Geração 1", "pais e tios"],
        ["Geração 2", "avós e tios-avós"],
        ["Geração 3", "bisavós"],
      ].map(([label, subtitle]) => (
        <div key={label} className="border-b border-border/60 px-2.5 py-2 last:border-b-0">
          <p className="font-serif text-[14px] font-bold leading-tight text-forest">{label}</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase leading-snug tracking-[0.08em] text-muted-foreground">
            {subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}

function ShortcutsLegend() {
  return (
    <div className="w-[168px] overflow-hidden rounded-lg border border-forest/25 bg-popover/95 shadow-lg backdrop-blur-md ring-1 ring-black/5">
      <div className="bg-forest/5 px-2.5 py-1.5 border-b border-forest/20">
        <p className="font-serif text-[13px] font-bold leading-tight text-forest">Atalhos</p>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 text-[9px] font-mono font-medium rounded border border-border bg-muted text-muted-foreground">
              Espaço
            </kbd>
            <span className="text-[14px] text-muted-foreground leading-none">+</span>
            <span className="text-[14px] font-bold text-foreground leading-none">Arrastar</span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">
            Navegar pelo quadro
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-bold text-foreground leading-none">
              Clique (Node)
            </span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">
            Selecionar e reposicionar
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[14px] font-bold text-foreground leading-none">Clique Duplo</span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">Editar pessoa</p>
        </div>
      </div>
    </div>
  );
}

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
  validateGraph,
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
  for (let g = 0; g <= 3; g++) {
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
      data: { label: union.label, kind: union.kind },
      draggable: false,
      selectable: false,
      zIndex: 4,
    });
  }

  // Edges: partner + child (nunca pessoa↔pessoa)
  const edges: Edge[] = [];
  const seenChildUnion = new Set<string>();
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
      data: { unionId: uid, childIds: union.children },
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
  ];
  return { nodes, edges, warnings: [...extra, ...graph.warnings] };
}

function GenogramCanvasInner({ clientId, focusPersonId }: CanvasProps) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["genogram", clientId],
    queryFn: async () => {
      const [persons, rels, layoutsResp] = await Promise.all([
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
        supabase
          .from("genogram_layouts")
          .select("*")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      if (persons.error) throw persons.error;
      if (rels.error) throw rels.error;
      if (layoutsResp.error) throw layoutsResp.error;

      let positions: NodePositionRow[] = [];
      let layout: LayoutRow | null = null;
      if (layoutsResp.data && layoutsResp.data.length > 0) {
        layout = layoutsResp.data[0] as LayoutRow;
        const posResp = await supabase
          .from("genogram_node_positions")
          .select("*")
          .eq("layout_id", layout.id);
        if (!posResp.error) {
          positions = (posResp.data ?? []) as NodePositionRow[];
        }
      }

      return {
        persons: (persons.data ?? []) as PersonRow[],
        rels: (rels.data ?? []) as RelRow[],
        layout,
        positions,
      };
    },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [warnings, setWarnings] = useState<GenogramWarning[]>([]);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [defaultRelationship, setDefaultRelationship] = useState<string>("");
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    seed?: { from?: string; to?: string; type?: "parent" | "union" };
    editing?: RelRow | null;
  }>({ open: false });
  const [showGuide, setShowGuide] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLayoutFixed, setIsLayoutFixed] = useState(false);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (query.data?.layout) {
      setIsLayoutFixed(query.data.layout.is_fixed);
    }
  }, [query.data?.layout]);
  const rfInstance = useReactFlow();
  const focusedOnceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPersonId || focusedOnceRef.current === focusPersonId) return;
    if (!nodes.some((n) => n.id === focusPersonId)) return;
    focusedOnceRef.current = focusPersonId;
    setFocusedPersonId(focusPersonId);
    setPanelOpen(true);
    const t = window.setTimeout(
      () =>
        rfInstance.fitView({
          nodes: [{ id: focusPersonId }],
          duration: 300,
          maxZoom: 1.2,
          padding: 0.6,
        }),
      120,
    );
    return () => window.clearTimeout(t);
  }, [focusPersonId, nodes, rfInstance]);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportPdf = useCallback(async () => {
    const nodes = rfInstance.getNodes();
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null;
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

  const handleQuickAdd = useCallback(
    (personId: string, relativeType: string) => {
      const person = query.data?.persons.find((p) => p.id === personId);
      if (!person) return;

      let newRel = relativeType;
      if (!person.is_proband && person.relationship_to_proband) {
        newRel = `${relativeType} do ${person.relationship_to_proband}`;
        // Clean up string like "do mae" -> "da mae"
        newRel = newRel
          .replace(/do mãe/gi, "da mãe")
          .replace(/do tia/gi, "da tia")
          .replace(/do avó/gi, "da avó")
          .replace(/do bisavó/gi, "da bisavó");
      }

      setDefaultRelationship(newRel);
      setCreatingPerson(true);
    },
    [query.data?.persons],
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

  useEffect(() => {
    if (!query.data) return;
    let cancelled = false;

    const qualifiedPersons = query.data.persons.filter((p) => {
      if (p.is_proband) return true;
      const hasName = !!p.full_name?.trim();
      const hasRel = !!p.relationship_to_proband?.trim();
      return hasName || hasRel;
    });

    const proband = qualifiedPersons.find((p) => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const {
      nodes: layoutedNodes,
      edges: layoutedEdges,
      warnings: graphWarnings,
    } = buildRenderGraph(qualifiedPersons, query.data.rels, probandId, query.data.positions);
    setWarnings(graphWarnings);

    // Injeta o callback de quick-add nos nós de pessoa (função depende de state
    // do componente e por isso não vive dentro do engine puro).
    const nodesWithHandlers: Node[] = layoutedNodes.map((n) => {
      if (n.type !== "person") return n;
      return {
        ...n,
        data: {
          ...(n.data as PersonNodeData),
          onQuickAdd: (relType: string) => handleQuickAdd(n.id, relType),
        } satisfies PersonNodeData,
      };
    });

    setNodes(nodesWithHandlers);
    setEdges(layoutedEdges);
    setLayoutDirty(false);
    revRef.current.reset();
    historyRef.current.reset();

    const centerTimer = window.setTimeout(() => {
      if (cancelled) return;
      // Fit only people: generation bands span thousands of pixels and must not set the zoom.
      const personNodes = layoutedNodes.filter((n) => n.type === "person");
      if (personNodes.length)
        rfInstance.fitView({
          nodes: personNodes,
          padding: 0.18,
          duration: 0,
          minZoom: 0.15,
          maxZoom: 1.2,
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(centerTimer);
    };
  }, [query.data, setNodes, setEdges, rfInstance, handleQuickAdd]);

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

  useEffect(() => {
    const handleEdgeDelete = async (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const relId = customEvent.detail;
      if (!relId) return;

      const { error } = await supabase.from("genogram_relationships").delete().eq("id", relId);
      if (!error) {
        toast.success("Vínculo removido");
        query.refetch();
      }
    };
    window.addEventListener("delete-edge", handleEdgeDelete);
    return () => window.removeEventListener("delete-edge", handleEdgeDelete);
  }, [query]);

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "var(--color-forest)" } }, eds));
      setRelDialog({
        open: true,
        seed: { from: conn.source ?? undefined, to: conn.target ?? undefined },
      });
    },
    [setEdges],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      const person = query.data?.persons.find((p) => p.id === node.id);
      if (person) setEditingPerson(person);
    },
    [query.data],
  );

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler>(
    (_, edge) => {
      const rel = query.data?.rels.find((r) => r.id === edge.id);
      if (rel) setRelDialog({ open: true, editing: rel });
    },
    [query.data],
  );

  const legendFlags = useMemo(() => {
    const ps = query.data?.persons ?? [];
    const sym = ps.map((p) => personSymbol(p));
    return {
      masculino: sym.includes("masculino"),
      feminino: sym.includes("feminino"),
      aborto: sym.includes("aborto"),
      outro: sym.some((x) => x !== "masculino" && x !== "feminino" && x !== "aborto"),
      falecido: ps.some((p) => p.is_deceased || !!p.death_date),
    };
  }, [query.data]);

  const deleteSelected = useMutation({
    mutationFn: async () => {
      const nodeIds = nodes.filter((n) => n.type === "person" && n.selected).map((n) => n.id);
      const edgeIds = edges.filter((e) => e.selected).map((e) => e.id);
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      if (edgeIds.length > 0) {
        const { error } = await supabase.from("genogram_relationships").delete().in("id", edgeIds);
        if (error) throw error;
      }
      if (nodeIds.length > 0) {
        const { error } = await supabase.from("genogram_persons").delete().in("id", nodeIds);
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
    for (const n of rfInstance.getNodes()) out[n.id] = [n.position.x, n.position.y];
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
    if (!userId || !query.data) return;
    const d = readDraft(userId, clientId);
    const savedAt = query.data.layout?.updated_at
      ? new Date(query.data.layout.updated_at).getTime()
      : 0;
    setPendingDraft(d && d.at > savedAt && Object.keys(d.positions).length ? d.positions : null);
  }, [userId, clientId, query.data]);

  const saveLayout = useMutation({
    mutationFn: async () => {
      const rev = revRef.current.begin();
      const currentNodes = rfInstance.getNodes();
      const personNodes = currentNodes.filter((node) => node.type === "person");
      const unionNodes = currentNodes.filter((node) => node.type === "union");
      const savedAt = new Date().toISOString();

      // Ensure layout exists or create one
      let layoutId = query.data?.layout?.id;
      if (!layoutId) {
        const { data: newLayout, error: layoutErr } = await supabase
          .from("genogram_layouts")
          .insert({ client_id: clientId, name: "Layout Atual", is_fixed: false })
          .select("id")
          .single();
        if (layoutErr) throw layoutErr;
        layoutId = newLayout.id;
      } else {
        // Update updated_at of the layout
        await supabase.from("genogram_layouts").update({ updated_at: savedAt }).eq("id", layoutId);
      }

      // Prepare positions to upsert
      const positionsToUpsert = [
        ...personNodes.map((n) => ({
          layout_id: layoutId,
          node_id: n.id,
          node_type: "person",
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          layout_mode: "MANUAL",
        })),
        ...unionNodes.map((n) => ({
          layout_id: layoutId,
          node_id: n.id,
          node_type: "union",
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          layout_mode: "MANUAL",
        })),
      ];

      // Upsert node positions using the unique constraint
      const { error: upsertErr } = await supabase
        .from("genogram_node_positions")
        .upsert(positionsToUpsert, { onConflict: "layout_id,node_id" });

      if (upsertErr) throw upsertErr;

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
      // Optional: quietly invalidate to keep data in sync, but avoid full remounts
      invalidateCase(qc, clientId);
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
    if (saveLayout.isPending) return;
    const t = setTimeout(() => {
      saveLayout.mutate();
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutDirty, dirtyTick, saveLayout.isPending]);

  const toggleLayoutFixed = useMutation({
    mutationFn: async () => {
      const layoutId = query.data?.layout?.id;
      if (!layoutId) return false;
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

  // Posições ficam salvas por pessoa (arraste manual do clínico). Se uma
  // correção no motor mudar a geração de alguém (ex.: parentesco que antes
  // caía solto e agora ancora certo), a posição salva antiga FICA por cima
  // do cálculo novo — a pessoa parece "presa" no lugar errado até alguém
  // apagar as posições salvas e deixar recalcular do zero.
  const recalcLayout = useMutation({
    mutationFn: async () => {
      const layoutId = query.data?.layout?.id;
      if (!layoutId) return;
      const { error } = await supabase
        .from("genogram_node_positions")
        .delete()
        .eq("layout_id", layoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posições recalculadas a partir das regras do genossociograma.");
      invalidateCase(qc, clientId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao recalcular"),
  });

  const persons = query.data?.persons ?? [];
  const focusedPerson =
    persons.find((p) => p.id === focusedPersonId) ??
    persons.find((p) => p.is_proband) ??
    persons[0];
  const qualifiedCount = nodes.filter((node) => node.type === "person").length;
  const totalCount = persons.length;
  const incompleteCount = totalCount - qualifiedCount;
  const relCount = query.data?.rels.length ?? 0;
  const selectedPersonCount = nodes.filter((n) => n.type === "person" && n.selected).length;
  const selectedEdgeCount = edges.filter((e) => e.selected).length;

  return (
    <div
      ref={rootRef}
      className={`atlas-genogram bg-background ${panelOpen ? "" : "gv-panel-collapsed"}`}
    >
      <div className="atlas-map-workspace">
        {/* ── CONTÊINER SUPERIOR (BARRA DE AÇÕES + LEGENDA) ── */}
        <div className="atlas-map-toolbar">
          {/* BARRA DE AÇÕES — agrupada: Identidade | Editar | Layout | Status | Extras */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 pr-2 border-r border-border">
              <TreePine className="size-4 text-gold" />
              <span className="text-xs font-medium text-foreground">Genossociograma</span>
            </div>

            {/* Grupo: Editar */}
            <div className="flex items-center gap-2 pr-2 border-r border-border">
              <Button
                size="sm"
                variant="gold"
                onClick={() => setCreatingPerson(true)}
                className="gv-add-person h-9 gap-2"
              >
                <UserPlus className="size-4" />
                Adicionar pessoa
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setRelDialog({ open: true })}
                disabled={persons.length < 2}
                className="h-9 gap-2 border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground normal-case tracking-normal font-semibold text-[13px]"
              >
                <Link2 className="size-4" />
                Criar vínculo
              </Button>
            </div>

            {/* Grupo: Layout */}
            <div className="flex items-center gap-2 pr-2 border-r border-border">
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveLayout.mutate()}
                disabled={saveLayout.isPending || !layoutDirty}
                className="h-9 gap-2 border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground normal-case tracking-normal font-semibold text-[13px] disabled:opacity-45"
              >
                <Save className="size-4" />
                {saveLayout.isPending ? "Salvando" : "Salvar layout"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleLayoutFixed.mutate()}
                disabled={!query.data?.layout?.id || toggleLayoutFixed.isPending}
                className={`h-11 gap-2 border-border normal-case tracking-normal font-semibold text-[13px] ${isLayoutFixed ? "bg-forest text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted hover:text-foreground"}`}
                title={
                  !query.data?.layout?.id
                    ? "Salve o layout pelo menos uma vez para poder fixá-lo"
                    : ""
                }
              >
                {isLayoutFixed ? (
                  <Lock className="size-4 text-gold" />
                ) : (
                  <Unlock className="size-4" />
                )}
                {isLayoutFixed ? "Fixo" : "Livre"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmRecalc(true)}
                disabled={!query.data?.layout?.id || recalcLayout.isPending}
                title="Recalcula as posições do zero — use se alguém aparecer preso no lugar errado"
                className="h-9 gap-2 border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground normal-case tracking-normal font-semibold text-[13px] disabled:opacity-45"
              >
                <RotateCcw className="size-4" />
                {recalcLayout.isPending ? "Recalculando" : "Recalcular"}
              </Button>
            </div>

            {/* Grupo: Status — sempre visível (quebra linha em telas estreitas, nunca some) */}
            <div className="flex flex-wrap items-center gap-3 pr-3 border-r border-border">
              <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                <Users className="size-3.5 text-forest" />
                <strong className="text-foreground">{qualifiedCount}</strong>
                <span>no mapa</span>
                {incompleteCount > 0 && (
                  <span className="ml-1 rounded-full bg-gold/20 px-1.5 py-0.5 text-[14px] font-bold text-gold">
                    {incompleteCount} incompletos
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                <Link2 className="size-3.5 text-gold" />
                <strong className="text-foreground">{relCount}</strong> vínculos
              </span>
              {warnings.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-1 text-[14px] font-bold text-foreground hover:bg-gold/30 transition-colors animate-[pulse-gold_2.2s_ease-in-out_infinite]">
                      <AlertTriangle className="size-3.5" />
                      {warnings.length} para revisar
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 max-h-96 overflow-y-auto" align="start">
                    <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                      Para revisar no mapa
                    </p>
                    <ul className="space-y-2.5">
                      {warnings.map((w) => (
                        <li key={w.personId} className="text-[14px] leading-snug">
                          {w.message}
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              {(layoutDirty || lastSavedAt) && (
                <span className="text-[13px] font-semibold text-foreground">
                  {layoutDirty ? "Não salvo" : `Salvo às ${lastSavedAt}`}
                </span>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-[14px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Legenda dos símbolos"
                    aria-label="Legenda dos símbolos"
                  >
                    <Layers className="size-3.5" />
                    <span className="hidden sm:inline">Legenda</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                    Legenda do mapa
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-[15px]">
                    {legendFlags.masculino && (
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-3.5 border-2 border-forest bg-white" />
                        Masculino
                      </span>
                    )}
                    {legendFlags.feminino && (
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-3.5 rounded-full border-2 border-forest bg-white" />
                        Feminino
                      </span>
                    )}
                    {legendFlags.outro && (
                      <span className="flex items-center gap-2">
                        <span className="inline-block size-3.5 rotate-45 border-2 border-gold bg-white" />
                        Não-binário / desconhecido
                      </span>
                    )}
                    {legendFlags.aborto && (
                      <span className="flex items-center gap-2">
                        <svg
                          viewBox="0 0 10 10"
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <polygon points="5,1 9,9 1,9" className="text-foreground/70" />
                        </svg>
                        Aborto
                      </span>
                    )}
                    {legendFlags.falecido && (
                      <span className="flex items-center gap-2">
                        <span className="relative inline-block size-3.5 border-2 border-transparent bg-white">
                          <span className="absolute inset-[-2px] w-[140%] h-[2px] bg-foreground rotate-[45deg] origin-top-left" />
                        </span>
                        Falecido
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-3.5 border-2 border-forest bg-forest/20" />
                      Paciente-índice
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      Mostra só os símbolos presentes neste mapa.
                    </span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGuide(!showGuide)}
                className="min-h-11 gap-1.5 border-transparent bg-transparent text-foreground hover:bg-muted hover:text-foreground normal-case tracking-normal font-semibold text-[13px] shadow-none"
              >
                <HelpCircle className="size-4" />
                <span className="hidden sm:inline">Guia</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportPdf}
                disabled={isExportingPdf}
                title="Exportar PDF (A3) pra imprimir com o cliente"
                className="min-h-11 gap-1.5 border-transparent bg-transparent text-foreground hover:bg-muted hover:text-foreground normal-case tracking-normal font-semibold text-[13px] shadow-none"
              >
                {isExportingPdf ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                <span className="hidden sm:inline">{isExportingPdf ? "Gerando…" : "PDF A3"}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={
                  deleteSelected.isPending || (selectedPersonCount === 0 && selectedEdgeCount === 0)
                }
                className="min-h-11 gap-1.5 border-transparent bg-transparent text-foreground hover:bg-muted hover:text-destructive normal-case tracking-normal font-semibold text-[13px] ml-4 border-l border-border rounded-l-none pl-4 shadow-none"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Remover</span>
              </Button>
            </div>
          </div>
        </div>

        {showGuide && (
          <div className="border-b border-border bg-forest-soft px-4 py-3">
            <div className="flex flex-wrap gap-6 text-[13px] text-foreground/70">
              {[
                ["Espaço + Arrastar", "Navegar pela tela"],
                ["Arrastar Pessoa", "Reposicionar horizontalmente"],
                ["Duplo Clique", "Ver informações completas"],
                ["Selecionar + Remover", "Excluir o selecionado"],
                ["Scroll", "Zoom in/out"],
              ].map(([key, desc]) => (
                <span key={key} className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[14px] font-mono font-semibold">
                    {key}
                  </kbd>
                  {desc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legenda movida para o painel lateral "Copiloto Clínico" */}

        {/* ── CANVAS ──────── */}
        <div className="atlas-map-stage">
          {query.isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-11 w-11 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              <p className="text-[14px] text-muted-foreground">Carregando a árvore...</p>
            </div>
          ) : persons.length === 0 ? (
            <EmptyCanvas onCreate={() => setCreatingPerson(true)} />
          ) : (
            <ReactFlow
              connectionMode={ConnectionMode.Loose}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChangeCustom}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDoubleClick}
              onNodeDragStart={() => {
                historyRef.current.push(snapshot());
                forceHistory((x) => x + 1);
              }}
              onNodeClick={(_, node) => {
                if (node.type === "person") {
                  setFocusedPersonId(node.id);
                  if (isMobile) setMobileSheetOpen(true);
                }
              }}
              onEdgeDoubleClick={onEdgeDoubleClick}
              nodesDraggable={!isLayoutFixed}
              nodesConnectable={false}
              panOnDrag={false}
              panActivationKeyCode="Space"
              minZoom={0.15}
              maxZoom={2.5}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                type: "step",
                style: { strokeWidth: 2, stroke: "var(--color-forest)" },
              }}
              fitView
              fitViewOptions={{ padding: 0.18, nodes: nodes.filter((n) => n.type === "person") }}
            >
              <Background
                color="var(--color-border)"
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                style={{ opacity: 0.25 }}
              />
              <Panel
                position="top-right"
                className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm"
              >
                <label className="sr-only" htmlFor="geno-locate">
                  Localizar familiar
                </label>
                <select
                  id="geno-locate"
                  className="h-11 max-w-[180px] rounded-md border border-input bg-background px-2 text-[14px]"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    setFocusedPersonId(id);
                    setPanelOpen(true);
                    rfInstance.fitView({
                      nodes: [{ id }],
                      duration: 300,
                      maxZoom: 1.2,
                      padding: 0.6,
                    });
                  }}
                >
                  <option value="">Localizar familiar…</option>
                  {persons
                    .filter((p) => nodes.some((n) => n.id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.preferred_name || p.full_name}
                      </option>
                    ))}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label="Localizar o cliente"
                  onClick={() => {
                    const pb = persons.find((p) => p.is_proband);
                    if (pb)
                      rfInstance.fitView({
                        nodes: [{ id: pb.id }],
                        duration: 300,
                        maxZoom: 1.2,
                        padding: 0.6,
                      });
                  }}
                >
                  <Crosshair className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label="Ajustar mapa à tela"
                  onClick={() =>
                    rfInstance.fitView({
                      nodes: nodes.filter((n) => n.type === "person"),
                      padding: 0.18,
                      duration: 300,
                    })
                  }
                >
                  <Layers className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label="Desfazer posição"
                  disabled={!historyRef.current.canUndo || isLayoutFixed}
                  onClick={undoLayout}
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label="Refazer posição"
                  disabled={!historyRef.current.canRedo || isLayoutFixed}
                  onClick={redoLayout}
                >
                  <Redo2 className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label={isFullscreen ? "Sair da tela ampla" : "Tela ampla"}
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else void rootRef.current?.requestFullscreen?.();
                  }}
                >
                  {isFullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="min-h-11 min-w-11"
                  aria-label={
                    isMobile ? "Abrir ficha" : panelOpen ? "Recolher ficha" : "Mostrar ficha"
                  }
                  aria-expanded={isMobile ? mobileSheetOpen : panelOpen}
                  onClick={() => (isMobile ? setMobileSheetOpen(true) : setPanelOpen((v) => !v))}
                >
                  {panelOpen ? (
                    <PanelRightClose className="size-4" />
                  ) : (
                    <PanelRightOpen className="size-4" />
                  )}
                </Button>
              </Panel>
              {(pendingDraft || saveLayout.isError) && (
                <Panel
                  position="bottom-center"
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2 text-[14px] shadow-sm"
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
                </Panel>
              )}
              <Controls
                className="overflow-hidden rounded-md"
                showInteractive={false}
                fitViewOptions={{ nodes: nodes.filter((n) => n.type === "person"), padding: 0.18 }}
              />
            </ReactFlow>
          )}
        </div>
      </div>
      {isMobile ? (
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Ficha da pessoa selecionada</SheetTitle>
            </SheetHeader>
            <div className="atlas-person-panel atlas-person-panel--sheet">
              {focusedPerson ? (
                <>
                  <h2>{focusedPerson.preferred_name || focusedPerson.full_name}</h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {focusedPerson.is_proband
                      ? "Pessoa de referência"
                      : focusedPerson.relationship_to_proband || "Vínculo não informado"}
                  </p>
                  <dl>
                    <div>
                      <dt>Nome completo</dt>
                      <dd>{focusedPerson.full_name || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt>Nascimento</dt>
                      <dd>
                        {focusedPerson.birth_date
                          ? new Date(focusedPerson.birth_date + "T12:00:00").toLocaleDateString(
                              "pt-BR",
                            )
                          : "Não informado"}
                      </dd>
                    </div>
                    {focusedPerson.is_deceased && (
                      <div>
                        <dt>Falecimento</dt>
                        <dd>
                          {focusedPerson.death_date
                            ? new Date(focusedPerson.death_date + "T12:00:00").toLocaleDateString(
                                "pt-BR",
                              )
                            : "Data não informada"}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Gênero registrado</dt>
                      <dd>{focusedPerson.gender || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt>Observações</dt>
                      <dd>{focusedPerson.notes || "Nenhuma observação registrada."}</dd>
                    </div>
                  </dl>
                  <div className="atlas-panel-actions">
                    <Button variant="outline" onClick={() => setEditingPerson(focusedPerson)}>
                      Editar pessoa
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRelDialog({ open: true, seed: { from: focusedPerson.id } })}
                    >
                      Criar vínculo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRelDialog({ open: true, seed: { to: focusedPerson.id, type: "parent" } })
                      }
                    >
                      Definir pai ou mãe
                    </Button>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    Pai/mãe definidos aqui têm precedência sobre o parentesco da planilha — use para
                    meios-irmãos ou familiares soltos.
                  </p>
                  <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                    Selecione uma pessoa no mapa para consultar sua ficha. Dê dois cliques para
                    editar.
                  </p>
                </>
              ) : (
                <>
                  <h2>Pessoas e relações</h2>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Adicione a primeira pessoa para começar o genossociograma. Os dados de cada
                    pessoa aparecem aqui.
                  </p>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <aside
          className="atlas-person-panel"
          aria-label="Ficha da pessoa selecionada"
          hidden={!panelOpen}
        >
          {focusedPerson ? (
            <>
              <h2>{focusedPerson.preferred_name || focusedPerson.full_name}</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {focusedPerson.is_proband
                  ? "Pessoa de referência"
                  : focusedPerson.relationship_to_proband || "Vínculo não informado"}
              </p>
              <dl>
                <div>
                  <dt>Nome completo</dt>
                  <dd>{focusedPerson.full_name || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Nascimento</dt>
                  <dd>
                    {focusedPerson.birth_date
                      ? new Date(focusedPerson.birth_date + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Não informado"}
                  </dd>
                </div>
                {focusedPerson.is_deceased && (
                  <div>
                    <dt>Falecimento</dt>
                    <dd>
                      {focusedPerson.death_date
                        ? new Date(focusedPerson.death_date + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                          )
                        : "Data não informada"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Gênero registrado</dt>
                  <dd>{focusedPerson.gender || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Observações</dt>
                  <dd>{focusedPerson.notes || "Nenhuma observação registrada."}</dd>
                </div>
              </dl>
              <div className="atlas-panel-actions">
                <Button variant="outline" onClick={() => setEditingPerson(focusedPerson)}>
                  Editar pessoa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRelDialog({ open: true, seed: { from: focusedPerson.id } })}
                >
                  Criar vínculo
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setRelDialog({ open: true, seed: { to: focusedPerson.id, type: "parent" } })
                  }
                >
                  Definir pai ou mãe
                </Button>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Pai/mãe definidos aqui têm precedência sobre o parentesco da planilha — use para
                meios-irmãos ou familiares soltos.
              </p>
              <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                Selecione uma pessoa no mapa para consultar sua ficha. Dê dois cliques para editar.
              </p>
            </>
          ) : (
            <>
              <h2>Pessoas e relações</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Adicione a primeira pessoa para começar o genossociograma. Os dados de cada pessoa
                aparecem aqui.
              </p>
            </>
          )}
        </aside>
      )}

      <PersonFormDialog
        open={creatingPerson}
        onOpenChange={(open) => {
          setCreatingPerson(open);
          if (!open) setDefaultRelationship("");
        }}
        clientId={clientId}
        defaultPosition={{ x: 120 + persons.length * 200, y: 120 }}
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

      <AlertDialog open={confirmRecalc} onOpenChange={setConfirmRecalc}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-ink">
              Recalcular posições do zero?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o arranjo manual salvo desta árvore e recalcula a posição de todo mundo a
              partir das regras atuais do genossociograma. Use se alguém aparecer preso no lugar
              errado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => recalcLayout.mutate()}>Recalcular</AlertDialogAction>
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
    r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
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
    animated: r.qualifier === "conflict",
    data: { relationshipType: r.relationship_type, qualifier: r.qualifier, marriageOrder: order },
    style: {
      stroke,
      strokeWidth: (thick ? 3 : 2) + unionExtra,
      strokeDasharray: dashed ? "8 5" : undefined,
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
