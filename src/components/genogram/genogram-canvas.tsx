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
import { UserPlus, Link2, Trash2, Printer, HelpCircle, Users, TreePine, Save, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

const BUILD_TAG = "2026-07-05-spacing-and-styles";

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
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-card/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-mahogany shadow-sm"
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
          <path d="M8 22 L16 4" stroke="#3A3A3A" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M20 22 L28 4" stroke="#3A3A3A" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
      )}
      <Handle id="top" type="source" position={Position.Top} className="opacity-0 pointer-events-none" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
      <Handle id="left" type="source" position={Position.Left} className="opacity-0 pointer-events-none" />
      <Handle id="right" type="source" position={Position.Right} className="opacity-0 pointer-events-none" />
      <Handle id="top-target" type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className="opacity-0 pointer-events-none" />
      <Handle id="left-target" type="target" position={Position.Left} className="opacity-0 pointer-events-none" />
      <Handle id="right-target" type="target" position={Position.Right} className="opacity-0 pointer-events-none" />
    </div>
  );
};

function GenerationBandNode({ data }: NodeProps) {
  const isEven = (data.generation as number) % 2 === 0;
  return (
    <div
      style={{ width: 15000, height: GENERATION_GAP, pointerEvents: "none" }}
      className={`border-b border-dashed border-mahogany/20 ${isEven ? "bg-mahogany/[0.02]" : "bg-transparent"}`}
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
            stroke="#3A3A3A"
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
  const siblingBarY = unionY < minChildTop
    ? minChildTop - 30
    : minChildTop + shapeSize + 12 + cardHeight + 24;

  let path = "";
  path += `M ${barLeft} ${siblingBarY} L ${barRight} ${siblingBarY} `;
  for (const p of childPoints) {
    const childShapeSize = nodeShapeSize(p.node);
    const safeGap = 20;
    
    // Conecta na base/topo do símbolo do filho respeitando os 20px de respiro
    const childConnY = p.y < siblingBarY
      ? p.y + childShapeSize + safeGap
      : p.y - safeGap;
      
    path += `M ${p.x} ${childConnY} L ${p.x} ${siblingBarY} `;
  }
  
  // Conecta na união parental respeitando os 20px de respiro do símbolo
  const safeGap = 20;
  const unionHalfSize = 6; // UNION_SIZE / 2
  const unionConnY = unionY < siblingBarY
    ? unionY + unionHalfSize + safeGap
    : unionY - unionHalfSize - safeGap;
    
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
    <div className="w-[154px] overflow-hidden rounded-md border border-mahogany/25 bg-card/92 shadow-sm backdrop-blur">
      {[
        ["Paciente", "ponto de partida"],
        ["Geração 1", "pais e tios"],
        ["Geração 2", "avós e tios-avós"],
        ["Geração 3", "bisavós"],
      ].map(([label, subtitle]) => (
        <div key={label} className="border-b border-border/60 px-2.5 py-2 last:border-b-0">
          <p className="font-serif text-[14px] font-bold leading-tight text-mahogany">{label}</p>
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
    <div className="w-[168px] overflow-hidden rounded-lg border border-mahogany/25 bg-white/95 shadow-lg backdrop-blur-md ring-1 ring-black/5">

      <div className="bg-mahogany/5 px-2.5 py-1.5 border-b border-mahogany/20">
        <p className="font-serif text-[13px] font-bold leading-tight text-mahogany">Atalhos</p>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-2.5">
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
    // eslint-disable-next-line no-console
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
      style: { stroke: "var(--color-mahogany)", strokeWidth: 2 },
      data: { unionId: uid, childIds: union.children },
      zIndex: 2,
    });
  }


  return { nodes, edges };
}


function GenogramCanvasInner({ clientId }: CanvasProps) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["genogram", clientId],
    queryFn: async () => {
      const [persons, rels, layoutsResp] = await Promise.all([
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
        supabase.from("genogram_layouts").select("*").eq("client_id", clientId).order('updated_at', { ascending: false }).limit(1),
      ]);
      if (persons.error) throw persons.error;
      if (rels.error) throw rels.error;
      if (layoutsResp.error) throw layoutsResp.error;

      let positions: NodePositionRow[] = [];
      let layout: LayoutRow | null = null;
      if (layoutsResp.data && layoutsResp.data.length > 0) {
        layout = layoutsResp.data[0] as LayoutRow;
        const posResp = await supabase.from("genogram_node_positions").select("*").eq("layout_id", layout.id);
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
  const [isLayoutFixed, setIsLayoutFixed] = useState(false);
  
  useEffect(() => {
    if (query.data?.layout) {
      setIsLayoutFixed(query.data.layout.is_fixed);
    }
  }, [query.data?.layout]);
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

    const proband = qualifiedPersons.find((p) => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const { nodes: layoutedNodes, edges: layoutedEdges } = buildRenderGraph(
      qualifiedPersons,
      query.data.rels,
      probandId,
      query.data.positions
    );

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
          // Centrar horizontalmente no proband; verticalmente posicionar o proband
          // 180px abaixo do topo do canvas para dar respiro sob a barra de ações e legenda.
          const cx = probandNode.position.x + NODE_W / 2;
          const targetTopOffset = 180;
          const cy = probandNode.position.y + (canvasH / 2 - targetTopOffset) / zoom;
          rfInstance.setCenter(cx, cy, { zoom, duration: 600 });
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

      return savedAt;
    },
    onSuccess: (savedAt) => {
      setLayoutDirty(false);
      setLastSavedAt(
        new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
      // Optional: quietly invalidate to keep data in sync, but avoid full remounts
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar layout"),
  });

  // Auto-Save Effect (Debounce 2s)
  useEffect(() => {
    if (!layoutDirty) return;
    const t = setTimeout(() => {
      saveLayout.mutate();
    }, 2000);
    return () => clearTimeout(t);
  }, [layoutDirty]);

  const toggleLayoutFixed = useMutation({
    mutationFn: async () => {
      const layoutId = query.data?.layout?.id;
      if (!layoutId) return false;
      const newValue = !isLayoutFixed;
      const { error } = await supabase.from("genogram_layouts").update({ is_fixed: newValue }).eq("id", layoutId);
      if (error) throw error;
      return newValue;
    },
    onSuccess: (newValue) => {
      setIsLayoutFixed(newValue);
      toast.success(newValue ? "Layout fixado" : "Layout destravado");
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
    },
    onError: (e) => toast.error("Erro ao alterar fixação do layout"),
  });

  const persons = query.data?.persons ?? [];
  const qualifiedCount = nodes.filter((node) => node.type === "person").length;
  const totalCount = persons.length;
  const incompleteCount = totalCount - qualifiedCount;
  const relCount = query.data?.rels.length ?? 0;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[1.5rem] border border-border bg-slate-50/40 shadow-inner h-[800px] min-h-[calc(100vh-200px)]">
      {/* ── CONTÊINER SUPERIOR (BARRA DE AÇÕES + LEGENDA) ── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5 pointer-events-none max-w-[calc(100%-32px)]">
        {/* BARRA DE AÇÕES */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-mahogany shadow-xl border border-white/10">
          <div className="flex items-center gap-2 mr-3">
            <TreePine className="size-4 text-gold" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
              Genossociograma
            </span>
          </div>

          <Button
            size="sm"
            variant="forest"
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

          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleLayoutFixed.mutate()}
            disabled={!query.data?.layout?.id || toggleLayoutFixed.isPending}
            className={`h-9 gap-2 border-white/25 normal-case tracking-normal font-semibold text-[13px] ${isLayoutFixed ? "bg-white/20 text-white" : "text-white hover:bg-white/10 hover:text-white"}`}
            title={!query.data?.layout?.id ? "Salve o layout pelo menos uma vez para poder fixá-lo" : ""}
          >
            {isLayoutFixed ? <Lock className="size-4 text-gold" /> : <Unlock className="size-4" />}
            {isLayoutFixed ? "Fixo" : "Livre"}
          </Button>

          <div className="hidden items-center gap-4 md:flex ml-3">
            <span className="flex items-center gap-1.5 text-[13px] text-white/55">
              <Users className="size-3.5 text-forest" />
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
                {layoutDirty ? "Não salvo" : `Salvo às ${lastSavedAt}`}
              </span>
            )}
            <span className="text-[10px] opacity-40 ml-4 text-white font-mono">{BUILD_TAG}</span>
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
              className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/60 transition-colors hover:bg-white/10 hover:text-red-400 ml-4 border-l border-border pl-4"
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Remover</span>
            </button>
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
                <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-mono font-semibold">
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
      <div
        className="absolute inset-0 z-0 bg-transparent shadow-[inset_0_0_120px_rgba(59,47,47,0.1)]"
      >
        {query.isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
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
            nodesDraggable={!isLayoutFixed}
            nodesConnectable={false}
            panOnDrag={false}
            panActivationKeyCode="Space"
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "step",
              style: { strokeWidth: 2, stroke: "var(--color-mahogany)" },
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background
              color="#cbd5e1"
              variant={BackgroundVariant.Lines}
              gap={24}
              size={1}
              style={{ opacity: 0.5 }}
            />
            <Controls
              className="bg-white border-none shadow-xl overflow-hidden rounded-xl [&>button]:border-b [&>button]:border-slate-100 [&>button]:hover:bg-slate-50 [&>button]:text-mahogany"
              showInteractive={false}
            />
          </ReactFlow>
        )}
        {!query.isLoading && persons.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-50 hidden md:flex md:flex-col md:gap-4">
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
      fill: isUnion ? "var(--color-mahogany)" : "var(--color-muted-foreground)",
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
  if (r.relationship_type === "parent") return "var(--color-mahogany)";
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
        <TreePine className="size-9 text-forest/60" />
      </div>

      <div>
        <p className="font-serif text-2xl font-bold text-primary">A árvore começa por uma pessoa</p>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
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
