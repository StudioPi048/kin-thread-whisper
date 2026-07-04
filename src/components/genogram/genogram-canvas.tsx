import { useCallback, useEffect, useState } from "react";
import dagre from "dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
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
import { getGeneration, smartNormalizeRelationship } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

interface GenerationBandData {
  label: string;
  subtitle: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

function GenerationBandNode({ data }: NodeProps) {
  const d = data as unknown as GenerationBandData;

  return (
    <div
      className="pointer-events-none relative border-y border-border/60 bg-lavender-soft/45"
      style={{ width: d.width, height: d.height }}
    >
      <div className="absolute inset-y-0 left-[560px] flex w-[330px] items-center border-x border-border/50 bg-background/90 px-7 shadow-sm">
        <div>
          <p className="font-serif text-[34px] font-bold leading-tight text-primary">{d.label}</p>
          <p className="mt-2 max-w-[260px] text-[16px] font-bold uppercase leading-snug tracking-[0.14em] text-muted-foreground">
            {d.subtitle}
          </p>
        </div>
      </div>
      <div className="absolute inset-x-[920px] top-1/2 h-px -translate-y-1/2 bg-border/70" />
    </div>
  );
}

const nodeTypes = { person: PersonNode, generationBand: GenerationBandNode };

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

// Tamanho real do nó no DOM
const NODE_W = 110;  // largura do shape + padding
const NODE_H = 155;  // shape (72px) + label (nome + datas + badge ≈ 83px)
const GENERATION_GAP = 260;
const GENERATION_BAND_HEIGHT = 210;
const HORIZONTAL_GAP = 78;

const GENERATION_COPY: Record<number, { label: string; subtitle: string }> = {
  0: { label: "Cliente", subtitle: "ponto de partida" },
  1: { label: "Geração 1", subtitle: "pais, irmãos e tios" },
  2: { label: "Geração 2", subtitle: "avós e tios-avós" },
  3: { label: "Geração 3", subtitle: "bisavós e colaterais" },
};

function generationCopy(generation: number) {
  return GENERATION_COPY[generation] ?? {
    label: `Geração ${generation}`,
    subtitle: "ancestrais e colaterais",
  };
}

function generationForData(data: unknown): number {
  const d = data as PersonNodeData & { relationship_to_proband?: string | null };
  if (d.is_proband) return 0;

  const canonical = smartNormalizeRelationship(d.relationship_to_proband);
  const lower = canonical.toLowerCase();

  if (!lower) return 1;
  if (lower.includes("consulente") || lower.includes("paciente")) return 0;

  // O cliente precisa ficar sozinho no topo. Irmãos do cliente descem para a
  // primeira faixa clínica, junto do núcleo familiar imediato.
  if ((lower.includes("irmã") || lower.includes("irma")) && !lower.includes("av") && !lower.includes("bisav")) {
    return 1;
  }

  const generation = getGeneration(canonical);
  return generation <= 0 ? 1 : generation;
}

function spreadGeneration(nodes: Node[]) {
  const ordered = [...nodes].sort((a, b) => a.position.x - b.position.x);
  const originalCenter =
    nodes.reduce((sum, node) => sum + node.position.x + NODE_W / 2, 0) / Math.max(nodes.length, 1);
  let previousRight = Number.NEGATIVE_INFINITY;

  for (const node of ordered) {
    const minX = previousRight + HORIZONTAL_GAP;
    if (node.position.x < minX) node.position.x = minX;
    previousRight = node.position.x + NODE_W;
  }

  const newCenter =
    ordered.reduce((sum, node) => sum + node.position.x + NODE_W / 2, 0) / Math.max(ordered.length, 1);
  const shift = originalCenter - newCenter;
  ordered.forEach((node) => {
    node.position.x += shift;
  });
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], probandId?: string) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // rankdir TB (top-to-bottom):
  // - Source fica ACIMA do Target
  // - Nossas arestas vão DE filho PARA pai: filho.source → pai.target
  // - Logo: filho (source) fica no TOPO, pai (target) fica ABAIXO → correto!
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 55,    // espaço horizontal entre nós do mesmo rank
    ranksep: 90,    // espaço vertical entre gerações
    edgesep: 10,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_W, height: NODE_H });
  });

  // Adiciona ao Dagre apenas arestas de parentesco (cor plum).
  // Arestas de união (gold) são VISUAIS apenas — o Dagre não precisa delas
  // porque os cônjuges já ficam no mesmo rank naturalmente (mesmos filhos apontam para ambos).
  edges.forEach((edge) => {
    const isUnion = edge.style?.stroke === "var(--color-gold)";
    if (isUnion) return; // pula uniões no layout
    dagreGraph.setEdge(edge.source, edge.target, { minlen: 1 });
  });

  const maxGeneration = Math.max(3, ...nodes.map((node) => generationForData(node.data)));
  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    dagreGraph.setNode(`V_GEN${generation}`, { width: 1, height: 1 });
    if (generation > 0) {
      dagreGraph.setEdge(`V_GEN${generation - 1}`, `V_GEN${generation}`, { weight: 100 });
    }
  }

  nodes.forEach((node) => {
    const generation = generationForData(node.data);
    if (generation > 0) {
      dagreGraph.setEdge(`V_GEN${generation - 1}`, node.id, { weight: 2 });
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    if (!pos) return node;
    const generation = generationForData(node.data);
    return {
      ...node,
      position: {
        x: pos.x - NODE_W / 2,
        y: generation * GENERATION_GAP,
      },
      data: { ...node.data, generation },
    };
  });

  const byGeneration = new Map<number, Node[]>();
  layoutedNodes.forEach((node) => {
    const generation = generationForData(node.data);
    if (!byGeneration.has(generation)) byGeneration.set(generation, []);
    byGeneration.get(generation)!.push(node);
  });
  byGeneration.forEach(spreadGeneration);

  const probandNodeBeforeCenter = probandId
    ? layoutedNodes.find((node) => node.id === probandId)
    : undefined;
  if (probandNodeBeforeCenter) {
    const probandCenter = probandNodeBeforeCenter.position.x + NODE_W / 2;
    byGeneration.forEach((generationNodes, generation) => {
      if (generation === 0 || generationNodes.length === 0) return;
      const minGenerationX = Math.min(...generationNodes.map((node) => node.position.x));
      const maxGenerationX = Math.max(...generationNodes.map((node) => node.position.x + NODE_W));
      const generationCenter = (minGenerationX + maxGenerationX) / 2;
      const shift = probandCenter - generationCenter;
      generationNodes.forEach((node) => {
        node.position.x += shift;
      });
    });
  }

  // Centralizar horizontalmente em torno do cliente/proband.
  let probandX = 0;
  if (probandId) {
    const probandNode = layoutedNodes.find((node) => node.id === probandId);
    if (probandNode) probandX = probandNode.position.x + NODE_W / 2;
  }

  const centeredNodes = layoutedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x - probandX,
      y: node.position.y,
    },
  }));

  const minX = Math.min(...centeredNodes.map((node) => node.position.x), -NODE_W / 2);
  const maxX = Math.max(...centeredNodes.map((node) => node.position.x + NODE_W), NODE_W / 2);
  const bandWidth = Math.max(1200, maxX - minX + 300);
  const bandX = minX - 150;

  const generationBands: Node[] = Array.from(byGeneration.keys())
    .filter((generation) => generation >= 0)
    .sort((a, b) => a - b)
    .map((generation) => {
      const copy = generationCopy(generation);
      return {
        id: `generation-band-${generation}`,
        type: "generationBand",
        position: { x: bandX, y: generation * GENERATION_GAP - 28 },
        data: {
          ...copy,
          width: bandWidth,
          height: GENERATION_BAND_HEIGHT,
        } satisfies GenerationBandData,
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        zIndex: -10,
      };
    });

  return { nodes: [...generationBands, ...centeredNodes], edges };
};


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
    
    // ── Filtro de qualidade: entra no mapa quem tem nome OU parentesco ──
    // Após import da planilha muitas pessoas não têm data de nascimento ainda —
    // ainda assim precisam aparecer para receber layout automático via dagre.
    // Exceção: o próprio consulente/proband sempre entra.
    const qualifiedPersons = query.data.persons.filter(p => {
      if (p.is_proband) return true;
      const hasName = !!(p.full_name?.trim());
      const hasRel = !!(p.relationship_to_proband?.trim());
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
    
    // Filtramos os "nodes virtuais de casal" da lista visual (Eles existem no dagre apenas)
    const initialEdges = [...structuralEdges, ...manualEdges];
    
    // Encontrar o proband para centralizar o canvas nele
    const proband = qualifiedPersons.find(p => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges,
      probandId,
    );
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Aguardar o próximo frame para o ReactFlow renderizar antes de calcular fitView
    setTimeout(() => {
      const personNodes = layoutedNodes
        .filter((node) => node.type === "person")
        .map((node) => ({ id: node.id }));

      rfInstance.fitView({
        nodes: personNodes,
        padding: 0.12,
        duration: 800,
        minZoom: 0.42,
        maxZoom: 0.86,
      });

      if (probandId) {
        const probandNode = layoutedNodes.find((node) => node.id === probandId);
        if (probandNode) {
          rfInstance.setCenter(probandNode.position.x + NODE_W / 2, GENERATION_GAP, {
            zoom: 0.58,
            duration: 500,
          });
        }
      }
    }, 50);
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
      {/* ── BARRA DE AÇÕES — fundo ameixa ─────────────────── */}
      <div className="block-plum flex flex-wrap items-center gap-2 px-4 py-3">
        {/* Label */}
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

        {/* Stats */}
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

        {/* Ações secundárias */}
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

      {/* ── GUIA RÁPIDO ─────────────────────────────────────── */}
      {showGuide && (
        <div className="border-b border-border bg-lavender-soft px-4 py-3">
          <div className="flex flex-wrap gap-6 text-[13px] text-foreground/70">
            {[
              ["Clique duplo", "Editar pessoa ou vínculo"],
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

      {/* ── LEGENDA ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 border-b border-border/50 bg-background/60 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em]">
        <span className="text-muted-foreground/50 mr-1">Legenda:</span>
        <span style={{ color: "var(--color-plum)" }}>□ Masculino</span>
        <span style={{ color: "var(--color-lavender)" }}>○ Feminino</span>
        <span style={{ color: "var(--color-gold)" }}>⬡ Não-binário</span>
        <span className="text-destructive">✕ Falecido</span>
        <span className="ml-auto text-lavender">Borda dupla = Paciente-índice</span>
      </div>

      {/* ── CANVAS ──────────────────────────────────────────── */}
      <div className="relative" style={{ height: "80vh" }}>
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep", // Linhas retas em 90°
              style: { strokeWidth: 2 },
            }}
            snapToGrid
            snapGrid={[20, 20]}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.2}
              color="oklch(0.85 0.05 295)"
            />
            <Controls showInteractive={false} style={{ bottom: 16, left: 16, top: "auto" }} />
          </ReactFlow>
        )}
      </div>

      {/* Dialogs */}
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

function relToEdge(r: RelRow): Edge {
  const stroke = colorFor(r);
  const dashed =
    r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
  const thick = r.qualifier === "fusion";
  return {
    id: r.id,
    source: r.from_person_id,
    target: r.to_person_id,
    type: "smoothstep",
    label: relationshipLabel(r.relationship_type, r.qualifier),
    labelStyle: {
      fontSize: 11,
      fill: "var(--color-muted-foreground)",
      fontFamily: "var(--font-sans)",
    },
    labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.95, rx: 3, ry: 3 },
    labelBgPadding: [4, 6] as [number, number],
    animated: r.qualifier === "conflict",
    style: {
      stroke,
      strokeWidth: thick ? 3 : 2,
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

      <div className="w-full max-w-md border-l-[5px] border-l-lavender bg-white/70 backdrop-blur-md p-5 text-left rounded-r-[1rem] shadow-sm">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Como construir a árvore
        </p>
        {[
          "1. Adicione o paciente-índice (borda dupla lavanda)",
          '2. Preencha os dados na aba "Planilha" ou clique em Adicionar pessoa',
          "3. A árvore calculará as posições e hierarquias automaticamente",
          "4. Clique duplo em qualquer elemento para editar",
          '5. Use "A3" para exportar a árvore perfeita',
        ].map((step) => (
          <p key={step} className="py-1 text-[14px] text-foreground/75">
            {step}
          </p>
        ))}
      </div>

      <Button onClick={onCreate} size="lg" variant="lavender">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
