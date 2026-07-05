import { useCallback, useEffect, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Link2, Trash2, Printer, HelpCircle, Users, TreePine, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PersonNode, type PersonNodeData } from "./person-node";
import { PersonFormDialog } from "./person-form-dialog";
import { RelationshipFormDialog } from "./relationship-form-dialog";
import { relationshipLabel } from "@/lib/genogram";
import { computeStructuralEdges } from "@/lib/structural-tree";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

const UnionNodeComponent = () => (
  <div style={{ width: 1, height: 1, position: "relative" }}>
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

function GenerationBandNode({ data }: NodeProps) {
  const isEven = (data.generation as number) % 2 === 0;
  return (
    <div
      style={{ width: 15000, height: GENERATION_GAP, pointerEvents: "none" }}
      className={`border-b border-dashed border-plum/20 ${isEven ? "bg-plum/[0.02]" : "bg-transparent"}`}
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
            stroke="var(--color-destructive)"
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
  const measured = (node as Node & { measured?: { width?: number } }).measured?.width ?? node.width ?? NODE_W;
  return node.position.x + measured / 2;
}

function nodeBottomY(node: Node | undefined): number {
  if (!node) return 0;
  const measured = (node as Node & { measured?: { height?: number } }).measured?.height ?? node.height ?? NODE_H;
  return node.position.y + measured;
}

function nodeUnionY(node: Node | undefined): number {
  if (!node) return 0;
  return node.position.y + nodeShapeSize(node) / 2;
}

function PedigreeEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  data,
}: EdgeProps) {
  const edgeData = data as Record<string, unknown> | undefined;
  const childIds = (edgeData?.childIds as string[] | undefined) ?? [];
  const parentIds = (edgeData?.parentIds as string[] | undefined) ?? [];
  const live = useStore((store) => {
    const children = childIds
      .map((id) => store.nodeLookup.get(id) as unknown as Node | undefined)
      .filter((node): node is Node => Boolean(node));
    const parents = parentIds
      .map((id) => store.nodeLookup.get(id) as unknown as Node | undefined)
      .filter((node): node is Node => Boolean(node));
    return { children, parents };
  });

  if (!edgeData) return null;

  const childPoints = live.children.length
    ? live.children.map((node) => ({ x: nodeCenterX(node), y: nodeBottomY(node) }))
    : ((edgeData.childPoints as { x: number; y: number }[] | undefined) ?? [
        { x: sourceX, y: sourceY },
      ]);
  const parentPoints = live.parents.map((node) => ({
    x: nodeCenterX(node),
    topY: node.position.y,
    unionY: nodeUnionY(node),
  }));
  const familyCenterX = parentPoints.length
    ? parentPoints.reduce((sum, p) => sum + p.x, 0) / parentPoints.length
    : ((edgeData.familyCenterX as number | undefined) ?? targetX);
  const parentAnchorY = parentPoints.length > 1
    ? parentPoints.reduce((sum, p) => sum + p.unionY, 0) / parentPoints.length
    : (parentPoints[0]?.topY ?? targetY);

  if (childPoints.length === 0 || familyCenterX === undefined || parentAnchorY === undefined) {
    return null;
  }

  const xs = childPoints.map((p) => p.x);
  const barLeft = Math.min(...xs, familyCenterX);
  const barRight = Math.max(...xs, familyCenterX);

  const maxChildBottom = Math.max(...childPoints.map((p) => p.y));
  const siblingBarY = Math.min(parentAnchorY - 48, maxChildBottom + 34);

  let path = "";
  // Sibling bar spanning children (and trunk anchor)
  path += `M ${barLeft} ${siblingBarY} L ${barRight} ${siblingBarY} `;
  // Vertical stub from each child down to the sibling bar
  for (const p of childPoints) {
    path += `M ${p.x} ${p.y} L ${p.x} ${siblingBarY} `;
  }
  // Trunk from sibling bar to the couple union line midpoint (or single known parent).
  path += `M ${familyCenterX} ${siblingBarY} L ${familyCenterX} ${parentAnchorY}`;

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

const edgeTypes = { straightStep: StraightStepEdge, pedigree: PedigreeEdge };

function isUnionEdge(edge: Edge): boolean {
  return (edge.data as { relationshipType?: string } | undefined)?.relationshipType === "union";
}

function isParentEdge(edge: Edge): boolean {
  return (edge.data as { relationshipType?: string } | undefined)?.relationshipType === "parent";
}

function GenerationRuler() {
  return (
    <div className="w-[154px] overflow-hidden rounded-md border border-plum/25 bg-card/92 shadow-sm backdrop-blur">
      {[
        ["Paciente", "ponto de partida"],
        ["Geração 1", "pais e tios"],
        ["Geração 2", "avós e tios-avós"],
        ["Geração 3", "bisavós"],
      ].map(([label, subtitle]) => (
        <div key={label} className="border-b border-border/60 px-2.5 py-2 last:border-b-0">
          <p className="font-serif text-[14px] font-bold leading-tight text-plum">{label}</p>
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
    <div className="w-[154px] overflow-hidden rounded-md border border-plum/25 bg-card/92 shadow-sm backdrop-blur">
      <div className="bg-plum/5 px-2.5 py-1.5 border-b border-plum/20">
        <p className="font-serif text-[13px] font-bold leading-tight text-plum">Atalhos</p>
      </div>
      <div className="px-2.5 py-2 flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 text-[9px] font-mono font-medium rounded border border-border bg-muted text-muted-foreground">
              Espaço
            </kbd>
            <span className="text-[10px] text-muted-foreground leading-none">+</span>
            <span className="text-[10px] font-bold text-foreground leading-none">Arrastar</span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">
            Navegar pelo quadro
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-foreground leading-none">
              Clique (Node)
            </span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">
            Selecionar e reposicionar
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-foreground leading-none">Clique Duplo</span>
          </div>
          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">Editar pessoa</p>
        </div>
      </div>
    </div>
  );
}

interface CanvasProps {
  clientId: string;
}

export function GenogramCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <GenogramCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ── Tamanhos generosos, otimizados para leitura em 4K ────────
const NODE_W = 160; // Largura do nó (shape + label)
const NODE_H = 210; // Altura total do nó
const PERSON_SHAPE_SIZE = 76;
const PROBAND_SHAPE_SIZE = 84;
const GENERATION_GAP = 250; // Distância vertical entre gerações
const HORIZONTAL_STEP = NODE_W + 70; // Espaço horizontal entre nós de uma geração
const DIRECT_PARENT_X = 450;
const GRANDPARENT_PAIR_GAP = 400;
const GREAT_GRANDPARENT_PAIR_GAP = 200;
const COLLATERAL_GAP = 270;

/**
 * Descobre a geração da pessoa (0 = cliente, 1 = pais, 2 = avós, 3 = bisavós).
 * Baseia-se na tag canônica após normalização.
 */
function generationForData(data: unknown): number {
  const d = data as PersonNodeData & { relationship_to_proband?: string | null };
  if (d.is_proband) return 0;

  const canonical = smartNormalizeRelationship(d.relationship_to_proband).toLowerCase();
  if (!canonical) return 1;
  if (canonical.includes("consulente") || canonical.includes("paciente")) return 0;
  if (canonical.includes("bisav")) return 3;
  if (canonical.includes("avô") || canonical.includes("avó") || canonical.startsWith("avo"))
    return 2;
  if (
    canonical.includes("pai") ||
    canonical.includes("mãe") ||
    canonical.includes("mae") ||
    canonical.startsWith("tio")
  )
    return 1;
  if (canonical.includes("irmã") || canonical.includes("irma")) return 0;
  if (canonical.includes("cônjuge") || canonical.includes("conjuge") || canonical.includes("filho"))
    return 0;
  return 1;
}

function alternatingCenter(anchor: number, orderIndex: number, gap = COLLATERAL_GAP): number {
  const step = Math.floor(orderIndex / 2) + 1;
  return anchor + (orderIndex % 2 === 0 ? -step : step) * gap;
}

function duplicateOffset(
  base: number,
  orderIndex: number,
  side: "left" | "right",
  gap = COLLATERAL_GAP,
): number {
  if (orderIndex === 0) return base;
  return base + (side === "left" ? -1 : 1) * orderIndex * gap;
}

function directBloodCenter(
  canonical: string,
  orderIndex: number,
  isProband: boolean,
): number | null {
  if (isProband) return 0;
  const c = canonical.toLowerCase();

  const fatherX = -DIRECT_PARENT_X;
  const motherX = DIRECT_PARENT_X;
  const paternalGrandfatherX = fatherX - GRANDPARENT_PAIR_GAP / 2;
  const paternalGrandmotherX = fatherX + GRANDPARENT_PAIR_GAP / 2;
  const maternalGrandfatherX = motherX - GRANDPARENT_PAIR_GAP / 2;
  const maternalGrandmotherX = motherX + GRANDPARENT_PAIR_GAP / 2;

  if (c === "pai") return duplicateOffset(fatherX, orderIndex, "left");
  if (c === "mãe" || c === "mae") return duplicateOffset(motherX, orderIndex, "right");
  if (c.startsWith("tio(a) paterno"))
    return fatherX - GRANDPARENT_PAIR_GAP / 2 - (orderIndex + 1) * COLLATERAL_GAP;
  if (c.startsWith("tio(a) materno"))
    return motherX + GRANDPARENT_PAIR_GAP / 2 + (orderIndex + 1) * COLLATERAL_GAP;

  if (c === "avô paterno") return duplicateOffset(paternalGrandfatherX, orderIndex, "left");
  if (c === "avó paterna") return duplicateOffset(paternalGrandmotherX, orderIndex, "right");
  if (c === "avô materno") return duplicateOffset(maternalGrandfatherX, orderIndex, "left");
  if (c === "avó materna") return duplicateOffset(maternalGrandmotherX, orderIndex, "right");
  if (c.includes("irmã(o) do avô paterno") || c.includes("irmã(o) da avó paterna")) {
    return paternalGrandfatherX - GRANDPARENT_PAIR_GAP / 2 - (orderIndex + 1) * COLLATERAL_GAP;
  }
  if (c.includes("irmã(o) do avô materno") || c.includes("irmã(o) da avó materna")) {
    return maternalGrandmotherX + GRANDPARENT_PAIR_GAP / 2 + (orderIndex + 1) * COLLATERAL_GAP;
  }

  if (c.includes("bisavô paterno (pai do avô)"))
    return duplicateOffset(
      paternalGrandfatherX - GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "left",
    );
  if (c.includes("bisavó paterna (mãe do avô)"))
    return duplicateOffset(
      paternalGrandfatherX + GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "right",
    );
  if (c.includes("bisavô paterno (pai da avó)"))
    return duplicateOffset(
      paternalGrandmotherX - GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "left",
    );
  if (c.includes("bisavó paterna (mãe da avó)"))
    return duplicateOffset(
      paternalGrandmotherX + GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "right",
    );
  if (c.includes("bisavô materno (pai do avô)"))
    return duplicateOffset(
      maternalGrandfatherX - GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "left",
    );
  if (c.includes("bisavó materna (mãe do avô)"))
    return duplicateOffset(
      maternalGrandfatherX + GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "right",
    );
  if (c.includes("bisavô materno (pai da avó)"))
    return duplicateOffset(
      maternalGrandmotherX - GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "left",
    );
  if (c.includes("bisavó materna (mãe da avó)"))
    return duplicateOffset(
      maternalGrandmotherX + GREAT_GRANDPARENT_PAIR_GAP / 2,
      orderIndex,
      "right",
    );
  if (c.includes("irmã(o) do bisavô paterno"))
    return paternalGrandfatherX - GRANDPARENT_PAIR_GAP / 2 - (orderIndex + 1) * COLLATERAL_GAP;
  if (c.includes("irmã(o) do bisavô materno"))
    return maternalGrandmotherX + GRANDPARENT_PAIR_GAP / 2 + (orderIndex + 1) * COLLATERAL_GAP;

  if (
    (c.includes("irmã(o)") || c.startsWith("irmã") || c.startsWith("irma")) &&
    !c.includes("av")
  ) {
    return alternatingCenter(0, orderIndex);
  }

  return null;
}

type EdgeWithPathOptions = Edge & { pathOptions?: { borderRadius?: number } };

function forceRightAngle(edge: Edge): Edge {
  const existing = (edge as EdgeWithPathOptions).pathOptions ?? {};
  return {
    ...edge,
    type: "straightStep",
    pathOptions: { ...existing, borderRadius: 0 },
  } as Edge;
}

/**
 * Rank horizontal: número menor = mais à esquerda, maior = mais à direita.
 * Regra clínica: RAMO PATERNO à ESQUERDA · RAMO MATERNO à DIREITA.
 * O cliente é a referência (rank 0).
 */
function rankFor(canonical: string, orderIndex: number): number {
  const c = canonical.toLowerCase();

  // ── Geração 1 ────────────────────────────────────────────
  if (c === "pai") return -10;
  if (c === "mãe" || c === "mae") return 10;
  if (c.startsWith("tio(a) paterno")) return -100 - orderIndex;
  if (c.startsWith("tio(a) materno")) return 100 + orderIndex;
  // Irmãos do cliente: alternam próximos ao centro (não interferem em pai/mãe).
  if (
    (c.includes("irmã(o)") || c.startsWith("irmã") || c.startsWith("irma")) &&
    !c.includes("av") &&
    !c.includes("bisav")
  ) {
    // -1, +1, -2, +2, ...
    const half = Math.floor(orderIndex / 2) + 1;
    return orderIndex % 2 === 0 ? -half : half;
  }

  // ── Geração 2 ────────────────────────────────────────────
  if (c === "avô paterno") return -30;
  if (c === "avó paterna") return -20;
  if (c === "avô materno") return 20;
  if (c === "avó materna") return 30;
  if (c.includes("irmã(o) do avô paterno")) return -200 - orderIndex;
  if (c.includes("irmã(o) da avó paterna")) return -150 - orderIndex;
  if (c.includes("irmã(o) do avô materno")) return 150 + orderIndex;
  if (c.includes("irmã(o) da avó materna")) return 200 + orderIndex;

  // ── Geração 3 ────────────────────────────────────────────
  if (c.includes("bisavô paterno (pai do avô)")) return -40;
  if (c.includes("bisavó paterna (mãe do avô)")) return -30;
  if (c.includes("bisavô paterno (pai da avó)")) return -20;
  if (c.includes("bisavó paterna (mãe da avó)")) return -10;
  if (c.includes("bisavô materno (pai do avô)")) return 10;
  if (c.includes("bisavó materna (mãe do avô)")) return 20;
  if (c.includes("bisavô materno (pai da avó)")) return 30;
  if (c.includes("bisavó materna (mãe da avó)")) return 40;
  if (c.includes("irmã(o) do bisavô paterno")) return -300 - orderIndex;
  if (c.includes("irmã(o) do bisavô materno")) return 300 + orderIndex;

  return 0;
}

/**
 * Layout determinístico baseado em papéis familiares.
 * Não usa dagre para posicionamento: as regras clínicas do genossociograma
 * (pai à esquerda, mãe à direita) precisam de posicionamento controlado.
 *
 * INVARIANTE: cliente SEMPRE em y=0 (topo). Gerações descem em +y.
 */
type LayoutNode = { node: Node; x: number; y: number; gen: number };
type Block = {
  nodes: LayoutNode[];
  width: number;
  center: number;
  childTarget?: Node;
  childTargetX?: number;
};

function getLayoutedElements(nodes: Node[], edges: Edge[], probandId?: string) {
  const byCanonical = new Map<string, Node[]>();
  nodes.forEach((n) => {
    const d = n.data as PersonNodeData;
    const raw = n.id === probandId ? "consulente" : d.relationship_to_proband || "";
    const canonical = smartNormalizeRelationship(raw).toLowerCase();
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
    byCanonical.get(canonical)!.push(n);
  });

  const getNodes = (c: string) => byCanonical.get(c.toLowerCase()) || [];
  const getFirst = (c: string) => getNodes(c)[0];

  function createLeafBlock(
    husband: Node | undefined,
    wife: Node | undefined,
    husbandSiblings: Node[],
    wifeSiblings: Node[],
    child: Node | undefined,
    childSiblings: Node[],
    isHusbandSide: boolean,
    generation: number,
  ): Block {
    const topNodes = [
      ...husbandSiblings,
      ...(husband ? [husband] : []),
      ...(wife ? [wife] : []),
      ...wifeSiblings,
    ];
    const topWidth = topNodes.length * HORIZONTAL_STEP;

    let unionCenter = topWidth > 0 ? topWidth / 2 : 0;
    if (husband && wife) {
      unionCenter =
        (topNodes.indexOf(husband) * HORIZONTAL_STEP +
          topNodes.indexOf(wife) * HORIZONTAL_STEP +
          NODE_W) /
        2;
    } else if (husband) {
      unionCenter = topNodes.indexOf(husband) * HORIZONTAL_STEP + NODE_W / 2;
    } else if (wife) {
      unionCenter = topNodes.indexOf(wife) * HORIZONTAL_STEP + NODE_W / 2;
    }

    const bottomNodes = isHusbandSide
      ? [...childSiblings, ...(child ? [child] : [])]
      : [...(child ? [child] : []), ...childSiblings];

    const bottomWidth = bottomNodes.length * HORIZONTAL_STEP;

    let childLocalCenter = bottomWidth > 0 ? bottomWidth / 2 : 0;
    if (child) {
      childLocalCenter = bottomNodes.indexOf(child) * HORIZONTAL_STEP + NODE_W / 2;
    } else if (bottomNodes.length > 0) {
      childLocalCenter = isHusbandSide ? bottomWidth - HORIZONTAL_STEP + NODE_W / 2 : NODE_W / 2;
    }

    let topOffset = 0,
      bottomOffset = 0;
    if (unionCenter > childLocalCenter) {
      bottomOffset = unionCenter - childLocalCenter;
    } else {
      topOffset = childLocalCenter - unionCenter;
    }

    const resultNodes: LayoutNode[] = [];
    topNodes.forEach((n, i) =>
      resultNodes.push({
        node: n,
        x: topOffset + i * HORIZONTAL_STEP,
        y: (generation + 1) * GENERATION_GAP,
        gen: generation + 1,
      }),
    );
    bottomNodes.forEach((n, i) =>
      resultNodes.push({
        node: n,
        x: bottomOffset + i * HORIZONTAL_STEP,
        y: generation * GENERATION_GAP,
        gen: generation,
      }),
    );

    return {
      nodes: resultNodes,
      width: Math.max(topWidth + topOffset, bottomWidth + bottomOffset),
      center: childLocalCenter + bottomOffset,
      childTarget: child,
    };
  }

  function mergeBlocks(
    leftBlock: Block,
    rightBlock: Block,
    childTarget: Node | undefined,
    childSiblings: Node[],
    isHusbandSide: boolean,
    generation: number,
  ): Block {
    const FAMILY_GAP = 160;
    let rightOffsetX =
      leftBlock.width + (leftBlock.width > 0 && rightBlock.width > 0 ? FAMILY_GAP : 0);
    // TIGHT LAYOUT FIX: If both blocks have a childTarget, we can pull them closer
    // to prevent massive empty gaps, as long as it doesn't cause negative coordinates.
    if (leftBlock.childTargetX !== undefined && rightBlock.childTargetX !== undefined) {
      const desiredOffset =
        leftBlock.childTargetX + HORIZONTAL_STEP + FAMILY_GAP - rightBlock.childTargetX;
      // We use desiredOffset, but ensure we don't overlap the child targets themselves
      rightOffsetX = Math.max(
        desiredOffset,
        leftBlock.childTargetX + HORIZONTAL_STEP - rightBlock.childTargetX,
      );
    }

    const combinedNodes = [
      ...leftBlock.nodes,
      ...rightBlock.nodes.map((n) => ({ ...n, x: n.x + rightOffsetX })),
    ];

    const hCenter =
      leftBlock.childTargetX !== undefined ? leftBlock.childTargetX : leftBlock.center;
    const wCenter =
      rightBlock.childTargetX !== undefined
        ? rightBlock.childTargetX + rightOffsetX
        : rightBlock.center + rightOffsetX;

    let unionCenter = 0;
    if (leftBlock.childTarget && rightBlock.childTarget) unionCenter = (hCenter + wCenter) / 2;
    else if (leftBlock.childTarget) unionCenter = hCenter;
    else if (rightBlock.childTarget) unionCenter = wCenter;
    else unionCenter = (leftBlock.width + rightOffsetX + rightBlock.width) / 2;

    const bottomNodes = isHusbandSide
      ? [...childSiblings, ...(childTarget ? [childTarget] : [])]
      : [...(childTarget ? [childTarget] : []), ...childSiblings];

    const bottomWidth = bottomNodes.length * HORIZONTAL_STEP;
    let childLocalCenter = bottomWidth > 0 ? bottomWidth / 2 : 0;
    if (childTarget) {
      childLocalCenter = bottomNodes.indexOf(childTarget) * HORIZONTAL_STEP + NODE_W / 2;
    } else if (bottomNodes.length > 0) {
      childLocalCenter = isHusbandSide ? bottomWidth - HORIZONTAL_STEP + NODE_W / 2 : NODE_W / 2;
    }

    let topOffset = 0,
      bottomOffset = 0;
    if (unionCenter > childLocalCenter) {
      bottomOffset = unionCenter - childLocalCenter;
    } else {
      topOffset = childLocalCenter - unionCenter;
    }

    const finalNodes = combinedNodes.map((n) => ({ ...n, x: n.x + topOffset }));
    bottomNodes.forEach((n, i) =>
      finalNodes.push({
        node: n,
        x: bottomOffset + i * HORIZONTAL_STEP,
        y: generation * GENERATION_GAP,
        gen: generation,
      }),
    );

    let cTargetX = undefined;
    if (childTarget) {
      cTargetX = bottomOffset + bottomNodes.indexOf(childTarget) * HORIZONTAL_STEP + NODE_W / 2;
    }
    return {
      nodes: finalNodes,
      width: Math.max(rightOffsetX + rightBlock.width + topOffset, bottomWidth + bottomOffset),
      center: childLocalCenter + bottomOffset,
      childTarget: childTarget,
      childTargetX: cTargetX,
    };
  }

  const bp1 = getFirst("bisavô paterno (pai do avô)");
  const bm1 = getFirst("bisavó paterna (mãe do avô)");
  const blockAvosPat = createLeafBlock(
    bp1,
    bm1,
    getNodes("irmã(o) do bisavô paterno"),
    [],
    getFirst("avô paterno"),
    getNodes("irmã(o) do avô paterno"),
    true,
    2,
  );

  const bp2 = getFirst("bisavô paterno (pai da avó)");
  const bm2 = getFirst("bisavó paterna (mãe da avó)");
  const blockAvosPatF = createLeafBlock(
    bp2,
    bm2,
    getNodes("irmã(o) do bisavô paterno_alt"),
    [],
    getFirst("avó paterna"),
    getNodes("irmã(o) da avó paterna"),
    false,
    2,
  );

  const bp3 = getFirst("bisavô materno (pai do avô)");
  const bm3 = getFirst("bisavó materna (mãe do avô)");
  const blockAvosMat = createLeafBlock(
    bp3,
    bm3,
    getNodes("irmã(o) do bisavô materno"),
    [],
    getFirst("avô materno"),
    getNodes("irmã(o) do avô materno"),
    true,
    2,
  );

  const bp4 = getFirst("bisavô materno (pai da avó)");
  const bm4 = getFirst("bisavó materna (mãe da avó)");
  const blockAvosMatF = createLeafBlock(
    bp4,
    bm4,
    getNodes("irmã(o) do bisavô materno_alt"),
    [],
    getFirst("avó materna"),
    getNodes("irmã(o) da avó materna"),
    false,
    2,
  );

  const blockPaisPat = mergeBlocks(
    blockAvosPat,
    blockAvosPatF,
    getFirst("pai"),
    getNodes("tio(a) paterno(a)"),
    true,
    1,
  );

  const blockPaisMat = mergeBlocks(
    blockAvosMat,
    blockAvosMatF,
    getFirst("mãe"),
    getNodes("tio(a) materno(a)"),
    false,
    1,
  );

  const consulente = getFirst("consulente");
  const blockRoot = mergeBlocks(
    blockPaisPat,
    blockPaisMat,
    consulente,
    getNodes("irmã(o)"),
    false,
    0,
  );

  const layoutedNodes: Node[] = [];

  const mappedIds = new Set(blockRoot.nodes.map((n) => n.node.id));
  const rightEdgeByGeneration = new Map<number, number>();
  blockRoot.nodes.forEach((ln) => {
    rightEdgeByGeneration.set(
      ln.gen,
      Math.max(rightEdgeByGeneration.get(ln.gen) ?? Number.NEGATIVE_INFINITY, ln.x),
    );
  });
  nodes.forEach((n) => {
    if (!mappedIds.has(n.id)) {
      const gen = generationForData(n.data);
      const nextX = (rightEdgeByGeneration.get(gen) ?? blockRoot.width) + HORIZONTAL_STEP;
      rightEdgeByGeneration.set(gen, nextX);
      blockRoot.nodes.push({ node: n, x: nextX, y: gen * GENERATION_GAP, gen });
    }
  });

  const dx = consulente
    ? -NODE_W / 2 - blockRoot.nodes.find((n) => n.node.id === consulente.id)!.x
    : 0;

  blockRoot.nodes.forEach((ln) => {
    // A árvore automática precisa prevalecer quando posições antigas salvas
    // ficaram incompatíveis com a inferência atual; caso contrário surgem barras
    // enormes e a leitura clínica fica pior do que sem layout salvo.
    layoutedNodes.push({
      ...ln.node,
      position: { x: ln.x + dx, y: ln.y },
      data: { ...ln.node.data, generation: ln.gen },
    });
  });

  // Filiação é desenhada como barramento pedigree: irmãos no mesmo barramento
  // e tronco sempre convergindo no centro geométrico dos pais/união.

  type ParentLink = { edge: Edge; childId: string; parentId: string };
  const parentLinksByChild = new Map<string, ParentLink[]>();
  const otherEdges: Edge[] = [];
  const finalEdges: Edge[] = [];
  const visibleUnionPairs = new Set<string>();

  edges.forEach((edge) => {
    if (isParentEdge(edge)) {
      const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
      const targetNode = layoutedNodes.find((n) => n.id === edge.target);
      const sourceGen = (sourceNode?.data as { generation?: number } | undefined)?.generation ?? 0;
      const targetGen = (targetNode?.data as { generation?: number } | undefined)?.generation ?? 0;

      let childId = edge.source;
      let parentId = edge.target;

      if (sourceGen > targetGen) {
        childId = edge.target;
        parentId = edge.source;
      } else if (sourceGen === targetGen && !(edge.data as { isStructural?: boolean } | undefined)?.isStructural) {
        childId = edge.target;
        parentId = edge.source;
      }

      parentLinksByChild.set(childId, [
        ...(parentLinksByChild.get(childId) || []),
        { edge, childId, parentId },
      ]);
    } else {
      let finalSourceHandle = edge.sourceHandle;
      let finalTargetHandle = edge.targetHandle;

      if (isUnionEdge(edge)) {
        visibleUnionPairs.add([edge.source, edge.target].sort().join("|"));
        const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
        const targetNode = layoutedNodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          if (sourceNode.position.x > targetNode.position.x) {
            finalSourceHandle = "left";
            finalTargetHandle = "right";
          } else {
            finalSourceHandle = "right";
            finalTargetHandle = "left";
          }
        }
      }

      otherEdges.push({
        ...edge,
        sourceHandle: finalSourceHandle,
        targetHandle: finalTargetHandle,
        type: isUnionEdge(edge) ? "straightStep" : edge.type,
        zIndex: isUnionEdge(edge) ? 3 : edge.zIndex,
      });
    }
  });

  // Group children by shared parent pairs to draw one clean pedigree bus per family.
  const childrenByParentPair = new Map<string, string[]>();
  const parentPairToLinks = new Map<string, ParentLink[]>();

  parentLinksByChild.forEach((pLinks, childId) => {
    const parentIds = Array.from(new Set(pLinks.map((link) => link.parentId))).sort();
    const pairKey = parentIds.join("|");

    if (!childrenByParentPair.has(pairKey)) {
      childrenByParentPair.set(pairKey, []);
      parentPairToLinks.set(pairKey, pLinks);
    }
    childrenByParentPair.get(pairKey)!.push(childId);
  });

  childrenByParentPair.forEach((childrenIds, pairKey) => {
    const refLinks = parentPairToLinks.get(pairKey)!;
    const parentLinks = Array.from(
      new Map(refLinks.map((link) => [link.parentId, link])).values(),
    ).sort((a, b) => {
      const aNode = layoutedNodes.find((n) => n.id === a.parentId);
      const bNode = layoutedNodes.find((n) => n.id === b.parentId);
      return (aNode?.position.x ?? 0) - (bNode?.position.x ?? 0);
    });
    const parents = parentLinks.map((link) => layoutedNodes.find((n) => n.id === link.parentId));
    const visibleParents = parents.filter(Boolean) as Node[];
    if (visibleParents.length === 0) return;

    if (visibleParents.length > 1 && !visibleUnionPairs.has(pairKey)) {
      const sortedParents = [...visibleParents].sort((a, b) => a.position.x - b.position.x);
      visibleUnionPairs.add(pairKey);
      finalEdges.push({
        id: `inferred_union_${pairKey}`,
        source: sortedParents[0].id,
        target: sortedParents[1].id,
        sourceHandle: "right",
        targetHandle: "left",
        type: "straightStep",
        label: "União (casal)",
        labelStyle: {
          fontSize: 12,
          fontWeight: 600,
          fill: "var(--color-plum)",
          fontFamily: "var(--font-sans)",
        },
        labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.98, rx: 3, ry: 3 },
        labelBgPadding: [4, 6] as [number, number],
        style: { stroke: "var(--color-foreground)", strokeWidth: 2 },
        data: { relationshipType: "union", inferredFromChildren: true },
        zIndex: 3,
      });
    }

    const orderedChildrenIds = [...childrenIds].sort((a, b) => {
      const aNode = layoutedNodes.find((n) => n.id === a);
      const bNode = layoutedNodes.find((n) => n.id === b);
      return (aNode?.position.x ?? 0) - (bNode?.position.x ?? 0);
    });
    // Geometric midpoint between the two parents (or single parent center)
    const familyCenterX =
      visibleParents.reduce((sum, parent) => sum + parent.position.x + NODE_W / 2, 0) /
      visibleParents.length;

    const childPoints = orderedChildrenIds
      .map((cid) => {
        const n = layoutedNodes.find((nn) => nn.id === cid);
        if (!n) return null;
        return { x: n.position.x + NODE_W / 2, y: n.position.y + NODE_H - 40 };
      })
      .filter((p): p is { x: number; y: number } => p !== null);

    if (childPoints.length === 0) return;

    const parentMarriageY =
      visibleParents.reduce((sum, parent) => {
        const data = parent.data as PersonNodeData;
        const shapeSize = data.is_proband ? PROBAND_SHAPE_SIZE : PERSON_SHAPE_SIZE;
        return sum + parent.position.y + shapeSize / 2;
      }, 0) / visibleParents.length;
    const maxChildBottom = Math.max(...childPoints.map((p) => p.y));
    // Sibling bar sits between children (above) and the parents' black union line (below).
    const siblingBarY = Math.min(parentMarriageY - 55, maxChildBottom + 40);
    // Trunk terminates exactly on the spouse/union line midpoint.
    const marriageY = parentMarriageY;

    finalEdges.push({
      id: `pedigree_family_${pairKey}`,
      source: orderedChildrenIds[0],
      target: parentLinks[0].parentId,
      sourceHandle: "bottom",
      targetHandle: "top-target",
      type: "pedigree",
      style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      zIndex: 2,
      data: {
        childIds: orderedChildrenIds,
        parentIds: parentLinks.map((link) => link.parentId),
        childPoints,
        familyCenterX,
        siblingBarY,
        marriageY,
      },
    });
  });

  // Create background bands

  for (let g = 0; g <= 3; g++) {
    layoutedNodes.unshift({
      id: `gen_bg_${g}`,
      type: "band",
      position: { x: -7500, y: g * GENERATION_GAP - 20 },
      data: { generation: g },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }

  return { nodes: layoutedNodes, edges: [...otherEdges, ...finalEdges] };
}

function GenogramCanvasInner({ clientId }: CanvasProps) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["genogram", clientId],
    queryFn: async () => {
      const [persons, rels] = await Promise.all([
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
      ]);
      if (persons.error) throw persons.error;
      if (rels.error) throw rels.error;
      return {
        persons: (persons.data ?? []) as PersonRow[],
        rels: (rels.data ?? []) as RelRow[],
      };
    },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [defaultRelationship, setDefaultRelationship] = useState<string>("");
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    seed?: { from?: string; to?: string };
    editing?: RelRow | null;
  }>({ open: false });
  const [showGuide, setShowGuide] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const rfInstance = useReactFlow();

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
        qc.invalidateQueries({ queryKey: ["genogram", clientId] });
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

    const initialNodes: Node[] = qualifiedPersons.map((p) => ({
      id: p.id,
      type: "person",
      position: { x: p.position_x ?? 0, y: p.position_y ?? 0 },
      data: {
        full_name: p.full_name,
        preferred_name: p.preferred_name,
        gender: p.gender,
        birth_date: p.birth_date,
        death_date: p.death_date,
        is_deceased: p.is_deceased,
        is_proband: p.is_proband,
        relationship_to_proband: p.relationship_to_proband,
        onQuickAdd: (relType: string) => handleQuickAdd(p.id, relType),
        notes: p.notes,
      } satisfies PersonNodeData,
    }));

    const manualEdges: Edge[] = query.data.rels.map(relToEdge);
    const structuralEdges: Edge[] = computeStructuralEdges(qualifiedPersons, query.data.rels);
    // Descartamos arestas "order" — não são visuais, eram dicas ao Dagre.
    const initialEdges = [...structuralEdges, ...manualEdges].filter((e) => e.type !== "order");

    const proband = qualifiedPersons.find((p) => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      probandId,
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setLayoutDirty(false);

    const centerTimer = window.setTimeout(() => {
      if (cancelled) return;
      // Enquadramento: cliente próximo ao topo, gerações descendo.
      // IMPORTANTE: só contamos nós de pessoa para calcular a largura real.
      // Os nós "band" (faixas de fundo por geração) têm 15000px e envenenam o cálculo.
      const container = document.querySelector(".react-flow") as HTMLElement | null;
      const canvasW = container?.clientWidth ?? 1200;
      const canvasH = container?.clientHeight ?? 800;

      const personNodes = layoutedNodes.filter((n) => n.type === "person");
      if (personNodes.length === 0) {
        rfInstance.fitView({ padding: 0.15, duration: 600, minZoom: 0.2, maxZoom: 1.4 });
        return;
      }

      const xs = personNodes.map((n) => n.position.x);
      const ys = personNodes.map((n) => n.position.y);
      const treeW = Math.max(1, Math.max(...xs) - Math.min(...xs) + NODE_W);
      const treeH = Math.max(1, Math.max(...ys) - Math.min(...ys) + NODE_H);

      // Usar mais tela: o enquadramento inicial prioriza a leitura do núcleo.
      // Colaterais longos continuam acessíveis com pan/zoom, mas não encolhem toda a árvore.
      const focusW = Math.min(treeW, 1800);
      const zoomX = (canvasW * 0.96) / focusW;
      const zoomY = (canvasH * 0.96) / treeH;
      const zoom = Math.min(1.4, Math.max(0.48, Math.min(zoomX, zoomY)));

      if (probandId) {
        const probandNode = personNodes.find((n) => n.id === probandId);
        if (probandNode) {
          // Centrar horizontalmente no proband; verticalmente centrar a árvore inteira.
          const cx = probandNode.position.x + NODE_W / 2;
          const midY = (Math.min(...ys) + Math.max(...ys) + NODE_H) / 2;
          rfInstance.setCenter(cx, midY, { zoom, duration: 600 });
          return;
        }
      }
      rfInstance.fitView({ padding: 0.08, duration: 600, minZoom: 0.2, maxZoom: 1.4 });
    }, 120);


    return () => {
      cancelled = true;
      window.clearTimeout(centerTimer);
    };
  }, [query.data, setNodes, setEdges, rfInstance, handleQuickAdd]);

  // Lock dragging strictly to X axis
  const onNodesChangeCustom = useCallback(
    (changes: NodeChange[]) => {
      const hasPositionChange = changes.some((change) => change.type === "position" && change.position);
      const nextChanges = changes.map((change) => {
        if (change.type === "position" && change.position) {
          const node = rfInstance.getNode(change.id);
          if (node?.type === "person") {
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
      if (hasPositionChange) setLayoutDirty(true);
      onNodesChange(nextChanges);
    },
    [onNodesChange, rfInstance],
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
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "var(--color-lavender)" } }, eds));
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
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
      toast.success("Removido.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveLayout = useMutation({
    mutationFn: async () => {
      const currentNodes = rfInstance.getNodes().filter((node) => node.type === "person");
      const savedAt = new Date().toISOString();
      const results = await Promise.all(
        currentNodes.map((node) =>
          supabase
            .from("genogram_persons")
            .update({
              position_x: Math.round(node.position.x),
              position_y: Math.round(node.position.y),
              updated_at: savedAt,
            })
            .eq("id", node.id)
            .eq("client_id", clientId),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return savedAt;
    },
    onSuccess: (savedAt) => {
      setLayoutDirty(false);
      setLastSavedAt(
        new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
      toast.success("Layout do genossociograma salvo.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar layout"),
  });

  const persons = query.data?.persons ?? [];
  const qualifiedCount = nodes.filter((node) => node.type === "person").length;
  const totalCount = persons.length;
  const incompleteCount = totalCount - qualifiedCount;
  const relCount = query.data?.rels.length ?? 0;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[1rem] border border-border glass-card shadow-md">
      {/* ── BARRA DE AÇÕES ─────────────────────────────────── */}
      <div className="block-plum flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-2 mr-3">
          <TreePine className="size-4 text-gold" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            Genossociograma
          </span>
        </div>

        <Button
          size="sm"
          variant="lavender"
          onClick={() => setCreatingPerson(true)}
          className="h-9 gap-2"
        >
          <UserPlus className="size-4" />
          Adicionar pessoa
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setRelDialog({ open: true })}
          disabled={persons.length < 2}
          className="h-9 gap-2 border-white/25 text-white hover:bg-white/10 hover:text-white normal-case tracking-normal font-semibold text-[13px]"
        >
          <Link2 className="size-4" />
          Criar vínculo
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => saveLayout.mutate()}
          disabled={saveLayout.isPending || !layoutDirty}
          className="h-9 gap-2 border-white/25 text-white hover:bg-white/10 hover:text-white normal-case tracking-normal font-semibold text-[13px] disabled:opacity-45"
        >
          <Save className="size-4" />
          {saveLayout.isPending ? "Salvando" : "Salvar layout"}
        </Button>

        <div className="hidden items-center gap-4 md:flex ml-3">
          <span className="flex items-center gap-1.5 text-[13px] text-white/55">
            <Users className="size-3.5 text-lavender" />
            <strong className="text-white">{qualifiedCount}</strong>
            <span>no mapa</span>
            {incompleteCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                {incompleteCount} incompletos
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/55">
            <Link2 className="size-3.5 text-gold" />
            <strong className="text-white">{relCount}</strong> vínculos
          </span>
          {(layoutDirty || lastSavedAt) && (
            <span className="text-[12px] font-semibold text-white/50">
              {layoutDirty ? "Alterações não salvas" : `Salvo ${lastSavedAt}`}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">Guia</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">A3</span>
          </button>
          <button
            onClick={() => deleteSelected.mutate()}
            disabled={deleteSelected.isPending}
            className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-destructive/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Remover</span>
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="border-b border-border bg-lavender-soft px-4 py-3">
          <div className="flex flex-wrap gap-6 text-[13px] text-foreground/70">
            {[
              ["Espaço + Arrastar", "Navegar pela tela"],
              ["Arrastar Pessoa", "Reposicionar horizontalmente"],
              ["Duplo Clique", "Ver informações completas"],
              ["Selecionar + Remover", "Excluir o selecionado"],
              ["Scroll", "Zoom in/out"],
            ].map(([key, desc]) => (
              <span key={key} className="flex items-center gap-2">
                <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-mono font-semibold">
                  {key}
                </kbd>
                {desc}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── LEGENDA — símbolos internacionais ────────────── */}
      <div className="flex flex-wrap items-center gap-5 border-b border-border/50 bg-background/80 px-4 py-2.5 text-[12px] font-semibold">
        <span className="text-muted-foreground/60 mr-1 uppercase tracking-[0.15em] text-[10px]">
          Legenda:
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 border-[2.5px] border-plum bg-card" />
          <span className="text-foreground/80">Masculino</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-full border-[2.5px] border-lavender bg-card" />
          <span className="text-foreground/80">Feminino</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-4 rotate-45 border-[2.5px] border-gold bg-card" />
          <span className="text-foreground/80">Não-binário / desconhecido</span>
        </span>
        <span className="flex items-center gap-2">
          <svg
            viewBox="0 0 10 10"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <polygon points="5,1 9,9 1,9" className="text-foreground/70" />
          </svg>
          <span className="text-foreground/80">Aborto</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-red-500 text-lg leading-none">✕</span>
          <span className="text-foreground/80">Falecido</span>
        </span>
        <span className="ml-auto text-plum font-bold uppercase tracking-[0.1em] text-[11px]">
          Paciente destacado em ameixa
        </span>
      </div>

      {/* ── CANVAS: altura adaptativa ao viewport ──────── */}
      <div
        className="relative bg-background"
        style={{ height: "calc(100vh - 170px)", minHeight: 700 }}
      >
        {query.isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
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
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodesDraggable
            nodesConnectable={false}
            panOnDrag={false}
            panActivationKeyCode="Space"
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "step",
              style: { strokeWidth: 2, stroke: "var(--color-plum)" },
            }}
          >
            <Background
              color="#d8d0ec"
              variant={BackgroundVariant.Lines}
              gap={40}
              size={1}
              style={{ opacity: 0.25 }}
            />
            <Controls
              className="bg-card border-none shadow-md overflow-hidden rounded-md [&>button]:border-b [&>button]:border-sidebar-border [&>button]:hover:bg-lavender-soft [&>button]:text-plum"
              showInteractive={false}
            />
          </ReactFlow>
        )}
        {!query.isLoading && persons.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-50 hidden md:flex md:flex-col md:gap-4">
            <GenerationRuler />
            <ShortcutsLegend />
          </div>
        )}
      </div>

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
      fill: isUnion ? "var(--color-plum)" : "var(--color-muted-foreground)",
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
  if (r.relationship_type === "parent") return "var(--color-plum)";
  if (r.relationship_type === "sibling") return "var(--color-lavender)";
  if (r.relationship_type === "union") return "var(--color-foreground)";
  switch (r.qualifier) {
    case "conflict":
    case "rupture":
      return "var(--color-destructive)";
    case "fusion":
    case "close":
      return "var(--color-lavender)";
    default:
      return "var(--color-muted-foreground)";
  }
}

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center border-2 border-dashed border-lavender/40 bg-lavender-soft">
        <TreePine className="size-9 text-lavender/60" />
      </div>

      <div>
        <p className="font-serif text-2xl font-bold text-primary">A árvore começa por uma pessoa</p>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Adicione o <strong>paciente-índice</strong> primeiro. Depois construa em torno dele: pais,
          avós, irmãos, uniões, filhos.
        </p>
      </div>

      <Button onClick={onCreate} size="lg" variant="lavender">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
