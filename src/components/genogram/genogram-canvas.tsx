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
  type Connection,
  type Edge,
  type EdgeProps,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Link2, Trash2, Printer, HelpCircle, Users, TreePine } from "lucide-react";
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
    <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
    <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    <Handle type="target" position={Position.Left} className="opacity-0 pointer-events-none" />
    <Handle type="source" position={Position.Right} className="opacity-0 pointer-events-none" />
  </div>
);

const nodeTypes = { person: PersonNode, union: UnionNodeComponent };

function StraightStepEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  ...props
}: EdgeProps) {
  const isStraight = Math.abs(sourceX - targetX) < 1 || Math.abs(sourceY - targetY) < 1;
  const midY = sourceY + (targetY - sourceY) / 2;
  const path = isStraight
    ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;

  return (
    <BaseEdge
      {...props}
      path={path}
      labelX={(sourceX + targetX) / 2}
      labelY={Math.abs(sourceY - targetY) < 1 ? sourceY - 10 : midY - 10}
    />
  );
}

const edgeTypes = { straightStep: StraightStepEdge };

function GenerationRuler() {
  return (
    <div className="w-[188px] overflow-hidden rounded-md border border-plum/40 bg-plum/95 shadow-lg">
      {[
        ["Paciente", "ponto de partida"],
        ["Geração 1", "pais e tios"],
        ["Geração 2", "avós e tios-avós"],
        ["Geração 3", "bisavós"],
      ].map(([label, subtitle]) => (
        <div key={label} className="border-b border-white/15 px-3 py-3 last:border-b-0">
          <p className="font-serif text-[17px] font-bold leading-tight text-white">{label}</p>
          <p className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-[0.12em] text-white/70">
            {subtitle}
          </p>
        </div>
      ))}
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
const NODE_W = 170;   // Largura do nó (shape + label)
const NODE_H = 210;   // Altura total do nó
const GENERATION_GAP = 340;   // Distância vertical entre gerações
const HORIZONTAL_STEP = NODE_W + 90; // Espaço horizontal entre nós de uma geração
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
  if (canonical.includes("avô") || canonical.includes("avó") || canonical.startsWith("avo")) return 2;
  if (
    canonical.includes("pai") ||
    canonical.includes("mãe") ||
    canonical.includes("mae") ||
    canonical.startsWith("tio")
  ) return 1;
  if (canonical.includes("irmã") || canonical.includes("irma")) return 0;
  if (canonical.includes("cônjuge") || canonical.includes("conjuge") || canonical.includes("filho")) return 0;
  return 1;
}

function alternatingCenter(anchor: number, orderIndex: number, gap = COLLATERAL_GAP): number {
  const step = Math.floor(orderIndex / 2) + 1;
  return anchor + (orderIndex % 2 === 0 ? -step : step) * gap;
}

function directBloodCenter(canonical: string, orderIndex: number, isProband: boolean): number | null {
  if (isProband) return 0;
  const c = canonical.toLowerCase();

  const fatherX = -DIRECT_PARENT_X;
  const motherX = DIRECT_PARENT_X;
  const paternalGrandfatherX = fatherX - GRANDPARENT_PAIR_GAP / 2;
  const paternalGrandmotherX = fatherX + GRANDPARENT_PAIR_GAP / 2;
  const maternalGrandfatherX = motherX - GRANDPARENT_PAIR_GAP / 2;
  const maternalGrandmotherX = motherX + GRANDPARENT_PAIR_GAP / 2;

  if (c === "pai") return fatherX - orderIndex * COLLATERAL_GAP;
  if (c === "mãe" || c === "mae") return motherX + orderIndex * COLLATERAL_GAP;
  if (c.startsWith("tio(a) paterno")) return fatherX - (orderIndex + 1) * COLLATERAL_GAP;
  if (c.startsWith("tio(a) materno")) return motherX + (orderIndex + 1) * COLLATERAL_GAP;

  if (c === "avô paterno") return paternalGrandfatherX;
  if (c === "avó paterna") return paternalGrandmotherX;
  if (c === "avô materno") return maternalGrandfatherX;
  if (c === "avó materna") return maternalGrandmotherX;
  if (c.includes("irmã(o) do avô paterno") || c.includes("irmã(o) da avó paterna")) {
    return paternalGrandfatherX - (orderIndex + 1) * COLLATERAL_GAP;
  }
  if (c.includes("irmã(o) do avô materno") || c.includes("irmã(o) da avó materna")) {
    return maternalGrandmotherX + (orderIndex + 1) * COLLATERAL_GAP;
  }

  if (c.includes("bisavô paterno (pai do avô)")) return paternalGrandfatherX - GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavó paterna (mãe do avô)")) return paternalGrandfatherX + GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavô paterno (pai da avó)")) return paternalGrandmotherX - GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavó paterna (mãe da avó)")) return paternalGrandmotherX + GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavô materno (pai do avô)")) return maternalGrandfatherX - GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavó materna (mãe do avô)")) return maternalGrandfatherX + GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavô materno (pai da avó)")) return maternalGrandmotherX - GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("bisavó materna (mãe da avó)")) return maternalGrandmotherX + GREAT_GRANDPARENT_PAIR_GAP / 2;
  if (c.includes("irmã(o) do bisavô paterno")) return paternalGrandfatherX - (orderIndex + 2) * COLLATERAL_GAP;
  if (c.includes("irmã(o) do bisavô materno")) return maternalGrandmotherX + (orderIndex + 2) * COLLATERAL_GAP;

  if ((c.includes("irmã(o)") || c.startsWith("irmã") || c.startsWith("irma")) && !c.includes("av")) {
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
  if ((c.includes("irmã(o)") || c.startsWith("irmã") || c.startsWith("irma")) &&
      !c.includes("av") && !c.includes("bisav")) {
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
function getLayoutedElements(nodes: Node[], edges: Edge[], probandId?: string) {
  // Agrupar por geração — cliente forçado a 0
  const byGeneration = new Map<number, Node[]>();
  for (const n of nodes) {
    const g = n.id === probandId ? 0 : Math.max(0, generationForData(n.data));
    if (!byGeneration.has(g)) byGeneration.set(g, []);
    byGeneration.get(g)!.push(n);
  }

  // Posicionamento clínico: a família de sangue direta fica centralizada.
  // Cada pessoa deve ficar acima do ponto médio dos próprios pais.
  type Placed = { node: Node; centerX: number; canonical: string; generation: number };
  const placedByGen = new Map<number, Placed[]>();

  byGeneration.forEach((generationNodes, generation) => {
    const perCategory = new Map<string, number>();
    let fallbackIndex = 0;
    const placed: Placed[] = generationNodes.map((node) => {
      const d = node.data as PersonNodeData & { relationship_to_proband?: string | null };
      const canonical = node.id === probandId
        ? "consulente"
        : smartNormalizeRelationship(d.relationship_to_proband);
      const category = canonical.toLowerCase();
      const idx = perCategory.get(category) ?? 0;
      perCategory.set(category, idx + 1);
      const directCenter = directBloodCenter(canonical, idx, node.id === probandId);
      const centerX = directCenter ?? alternatingCenter(0, fallbackIndex++, 900);
      return { node, centerX, canonical, generation };
    });
    placedByGen.set(generation, placed);
  });

  const layoutedNodes: Node[] = [];

  placedByGen.forEach((placed, generation) => {
    placed.sort((a, b) => a.centerX - b.centerX || a.node.id.localeCompare(b.node.id));

    // y = geração * gap — cliente (gen 0) no topo, ancestrais descendo
    const y = generation * GENERATION_GAP;

    placed.forEach((p) => {
      layoutedNodes.push({
        ...p.node,
        position: { x: p.centerX - NODE_W / 2, y },
        data: { ...p.node.data, generation },
      });
    });
  });

  // ── Geometric Pedigree Routing (Union Nodes) ──
  //
  // Layout invertido (cliente NO TOPO, gerações descendo):
  //   - Filho está ACIMA (Y menor) e Pai está ABAIXO (Y maior).
  //   - Handles do PersonNode: top=target, bottom=source. Então uma aresta
  //     source=filho → target=pai roteia limpo: filho.bottom desce até pai.top.
  //   - Handles do UnionNode: top=target, bottom=source (+ left/right para casal).
  //
  // Colocamos o nó de união (pivô do casal) NA fileira dos pais e o "bus"
  // dos irmãos ENTRE gerações (logo abaixo dos filhos). As arestas partem
  // do FILHO (source, bottom) para o bus (target, top) e do bus (source,
  // bottom) para o pivô do casal (target, top) — todas orthogonais para baixo.
  const finalNodes = [...layoutedNodes];
  const finalEdges: Edge[] = [];
  const unionNodeMap = new Map<string, string>(); // key: parent1_parent2 -> unionId

  edges.forEach((edge) => {
    if (edge.type === "step" && edge.style?.stroke === "var(--color-gold)") {
      const sourceNode = finalNodes.find((n) => n.id === edge.source);
      const targetNode = finalNodes.find((n) => n.id === edge.target);
      if (sourceNode && targetNode) {
        const unionId = `union_${sourceNode.id}_${targetNode.id}`;
        const centerX1 = sourceNode.position.x + NODE_W / 2;
        const centerX2 = targetNode.position.x + NODE_W / 2;

        // Pivô ao centro do casal, na linha horizontal do casal (meio-altura).
        finalNodes.push({
          id: unionId,
          type: "union",
          position: {
            x: (centerX1 + centerX2) / 2,
            y: sourceNode.position.y + NODE_H / 2,
          },
          data: {},
          draggable: false,
          selectable: false,
          focusable: false,
        });

        unionNodeMap.set(`${sourceNode.id}_${targetNode.id}`, unionId);
        unionNodeMap.set(`${targetNode.id}_${sourceNode.id}`, unionId);
      }
    }
  });

  // ── Sibling Bus: um único ponto de convergência por casal ──
  const parentEdgesByChild = new Map<string, Edge[]>();
  const otherEdges: Edge[] = [];

  edges.forEach((edge) => {
    if (edge.type === "step" && edge.style?.stroke === "var(--color-plum)") {
      if (!parentEdgesByChild.has(edge.source)) parentEdgesByChild.set(edge.source, []);
      parentEdgesByChild.get(edge.source)!.push(edge);
    } else {
      otherEdges.push(edge);
    }
  });

  const childrenByUnion = new Map<string, Set<string>>();
  const orphanParentEdges: Edge[] = [];
  const parentToUnionMap = new Map<string, string>();

  unionNodeMap.forEach((unionId, parentsKey) => {
    const [p1, p2] = parentsKey.split("_");
    parentToUnionMap.set(p1, unionId);
    parentToUnionMap.set(p2, unionId);
  });

  parentEdgesByChild.forEach((pEdges, childId) => {
    let matchedUnionId: string | null = null;
    for (const edge of pEdges) {
      const unionId = parentToUnionMap.get(edge.target);
      if (unionId) { matchedUnionId = unionId; break; }
    }

    if (matchedUnionId) {
      if (!childrenByUnion.has(matchedUnionId)) childrenByUnion.set(matchedUnionId, new Set());
      childrenByUnion.get(matchedUnionId)!.add(childId);
    } else {
      // Filho com um único progenitor conhecido — mantemos a direção
      // filho → pai para preservar o roteamento limpo (bottom→top).
      pEdges.forEach((e) => {
        orphanParentEdges.push({
          ...e,
          id: `direct_${e.id}`,
          type: "step",
          style: { stroke: "var(--color-plum)", strokeWidth: 2 },
        });
      });
    }
  });

  childrenByUnion.forEach((childIdsSet, unionId) => {
    const childNodes = Array.from(childIdsSet)
      .map((id) => finalNodes.find((n) => n.id === id))
      .filter((n): n is Node => Boolean(n));
    if (childNodes.length === 0) return;

    const unionNode = finalNodes.find((n) => n.id === unionId);
    if (!unionNode) return;

    // O ponto de convergência dos filhos deve ser o centro do casal/pais,
    // não a média dos filhos. Isso mantém o tronco vertical padronizado.
    const busX = unionNode.position.x;
    // Bus entre gerações: logo ABAIXO da fileira dos filhos (que está por
    // cima), e ACIMA do pivô do casal (que está na fileira dos pais).
    const childBottomY = Math.max(...childNodes.map((n) => n.position.y)) + NODE_H;
    const busY = Math.min(
      childBottomY + 40,
      unionNode.position.y - 30,
    );
    const busId = `bus_${unionId}`;

    finalNodes.push({
      id: busId,
      type: "union",
      position: { x: busX, y: busY },
      data: {},
      draggable: false,
      selectable: false,
      focusable: false,
    });

    // Tronco vertical: barra dos irmãos (source, bottom) → pivô do casal
    // (target, top). Como pivô está ABAIXO do bus, roteia reto para baixo.
      finalEdges.push(forceRightAngle({
      id: `trunk_${unionId}`,
      source: busId,
      target: unionId,
      type: "step",
      style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      } as Edge));

    // Cada filho conecta na MESMA barra: filho (source, bottom) → bus
    // (target, top). Todos os irmãos convergem no mesmo ponto do bus.
    childNodes.forEach((child) => {
      finalEdges.push(forceRightAngle({
        id: `sib_${busId}_${child.id}`,
        source: child.id,
        target: busId,
        type: "step",
        style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      } as Edge));
    });
  });

  finalEdges.push(...orphanParentEdges);

  return { nodes: finalNodes, edges: [...otherEdges, ...finalEdges].map(forceRightAngle) };
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
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    seed?: { from?: string; to?: string };
    editing?: RelRow | null;
  }>({ open: false });
  const [showGuide, setShowGuide] = useState(false);
  const rfInstance = useReactFlow();

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

    const qualifiedPersons = query.data.persons.filter((p) => {
      if (p.is_proband) return true;
      const hasName = !!p.full_name?.trim();
      const hasRel = !!p.relationship_to_proband?.trim();
      return hasName || hasRel;
    });

    const initialNodes: Node[] = qualifiedPersons.map((p) => ({
      id: p.id,
      type: "person",
      position: { x: 0, y: 0 },
      data: {
        full_name: p.full_name,
        preferred_name: p.preferred_name,
        gender: p.gender,
        birth_date: p.birth_date,
        death_date: p.death_date,
        is_deceased: p.is_deceased,
        is_proband: p.is_proband,
        relationship_to_proband: p.relationship_to_proband,
        notes: p.notes,
      } satisfies PersonNodeData,
    }));

    const manualEdges: Edge[] = query.data.rels.map(relToEdge);
    const structuralEdges: Edge[] = computeStructuralEdges(qualifiedPersons);
    // Descartamos arestas "order" — não são visuais, eram dicas ao Dagre.
    const initialEdges = [...structuralEdges, ...manualEdges].filter(
      (e) => e.type !== "order",
    );

    const proband = qualifiedPersons.find((p) => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      probandId,
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    setTimeout(() => {
      // Enquadramento: cliente próximo ao topo do canvas, gerações descendo.
      // Escolhemos zoom de acordo com a largura da árvore para manter legível
      // em 1080p e 4K sem exigir zoom manual.
      const container = document.querySelector(".react-flow") as HTMLElement | null;
      const canvasW = container?.clientWidth ?? 1200;
      const canvasH = container?.clientHeight ?? 800;

      const xs = layoutedNodes.map((n) => n.position.x);
      const treeW = Math.max(1, Math.max(...xs) - Math.min(...xs) + NODE_W);
      const treeH = Math.max(1, (Math.max(3, ...Array.from({ length: layoutedNodes.length }, (_, i) => (layoutedNodes[i].data as { generation?: number }).generation ?? 0)) + 1) * GENERATION_GAP);

      const zoomX = (canvasW * 0.92) / treeW;
      const zoomY = (canvasH * 0.92) / treeH;
      const zoom = Math.min(1.1, Math.max(0.28, Math.min(zoomX, zoomY)));

      if (probandId) {
        const probandNode = layoutedNodes.find((n) => n.id === probandId);
        if (probandNode) {
          const cx = probandNode.position.x + NODE_W / 2;
          // Desloca o centro para BAIXO para que o cliente apareça no TOPO do canvas.
          // Offset ≈ metade da altura visível em coords do flow, menos margem.
          const halfVisibleY = canvasH / (2 * zoom);
          const cy = probandNode.position.y + halfVisibleY - NODE_H;
          rfInstance.setCenter(cx, cy, { zoom, duration: 600 });
          return;
        }
      }
      rfInstance.fitView({ padding: 0.12, duration: 600, minZoom: 0.28, maxZoom: 1.1 });
    }, 120);

  }, [query.data, setNodes, setEdges, rfInstance]);

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
              ["Clique no nó", "Editar pessoa ou vínculo"],
              ["Selecionar + Remover", "Excluir o selecionado"],
              ["Scroll", "Zoom in/out"],
              ["Ramo paterno", "sempre à esquerda"],
              ["Ramo materno", "sempre à direita"],
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
        <span className="text-muted-foreground/60 mr-1 uppercase tracking-[0.15em] text-[10px]">Legenda:</span>
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
          <svg viewBox="0 0 10 10" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
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
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeDoubleClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.3, maxZoom: 1.2 }}
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
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              style={{ opacity: 0.35 }}
            />
            <Controls
              className="bg-card border-none shadow-md overflow-hidden rounded-md [&>button]:border-b [&>button]:border-sidebar-border [&>button]:hover:bg-lavender-soft [&>button]:text-plum"
              showInteractive={false}
            />
          </ReactFlow>
        )}
        {!query.isLoading && persons.length > 0 && (
          <div className="pointer-events-none absolute left-4 top-4 z-50 hidden md:block">
            <GenerationRuler />
          </div>
        )}
      </div>

      <PersonFormDialog
        open={creatingPerson}
        onOpenChange={setCreatingPerson}
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
  if (r.relationship_type === "union") return "var(--color-gold)";
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
