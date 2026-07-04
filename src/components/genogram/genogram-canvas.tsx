import { useCallback, useEffect, useState } from "react";
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

const nodeTypes = { person: PersonNode };

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
const GENERATION_GAP = 300;   // Distância vertical entre gerações
const HORIZONTAL_STEP = NODE_W + 90; // Espaço horizontal entre nós de uma geração

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
  if (canonical.includes("irmã") || canonical.includes("irma")) return 1;
  return 1;
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
 */
function getLayoutedElements(nodes: Node[], edges: Edge[], probandId?: string) {
  // Agrupar por geração
  const byGeneration = new Map<number, Node[]>();
  for (const n of nodes) {
    const g = generationForData(n.data);
    if (!byGeneration.has(g)) byGeneration.set(g, []);
    byGeneration.get(g)!.push(n);
  }

  const maxGeneration = Math.max(3, ...Array.from(byGeneration.keys()));

  // Calcular rank para cada nó
  type Placed = { node: Node; rank: number; canonical: string };
  const placedByGen = new Map<number, Placed[]>();

  byGeneration.forEach((generationNodes, generation) => {
    // Índice sequencial por CATEGORIA (para múltiplos tios/irmãos ficarem lado a lado)
    const perCategory = new Map<string, number>();
    const placed: Placed[] = generationNodes.map((node) => {
      const d = node.data as PersonNodeData & { relationship_to_proband?: string | null };
      const canonical = d.is_proband
        ? "consulente"
        : smartNormalizeRelationship(d.relationship_to_proband);
      const category = canonical.toLowerCase();
      const idx = perCategory.get(category) ?? 0;
      perCategory.set(category, idx + 1);
      const rank = d.is_proband ? 0 : rankFor(canonical, idx);
      return { node, rank, canonical };
    });
    placedByGen.set(generation, placed);
  });

  // Para cada geração, ordenar por rank e distribuir com HORIZONTAL_STEP.
  // Depois deslocar horizontalmente para alinhar o "núcleo" da geração com x=0.
  const layoutedNodes: Node[] = [];

  placedByGen.forEach((placed, generation) => {
    placed.sort((a, b) => a.rank - b.rank || a.node.id.localeCompare(b.node.id));

    // Posições sequenciais
    const xs = placed.map((_, i) => i * HORIZONTAL_STEP);

    // Deslocamento: alinhar núcleo com 0
    let anchorAvgX = 0;
    const coreCanonicals: string[] = generation === 0
      ? ["consulente"]
      : generation === 1
        ? ["pai", "mãe", "mae"]
        : generation === 2
          ? ["avô paterno", "avó paterna", "avô materno", "avó materna"]
          : ["bisavô paterno (pai do avô)", "bisavó paterna (mãe do avô)",
             "bisavô paterno (pai da avó)", "bisavó paterna (mãe da avó)",
             "bisavô materno (pai do avô)", "bisavó materna (mãe do avô)",
             "bisavô materno (pai da avó)", "bisavó materna (mãe da avó)"];

    const coreIdx = placed
      .map((p, i) => (coreCanonicals.includes(p.canonical.toLowerCase()) ? i : -1))
      .filter((i) => i >= 0);

    if (coreIdx.length > 0) {
      anchorAvgX = coreIdx.reduce((s, i) => s + xs[i], 0) / coreIdx.length;
    } else if (placed.length > 0) {
      anchorAvgX = xs.reduce((s, x) => s + x, 0) / xs.length;
    }

    const y = generation * GENERATION_GAP;

    placed.forEach((p, i) => {
      layoutedNodes.push({
        ...p.node,
        position: { x: xs[i] - anchorAvgX - NODE_W / 2, y },
        data: { ...p.node.data, generation },
      });
    });
  });

  // Garantir que o cliente esteja EXATAMENTE em x = -NODE_W/2 (centro em 0)
  if (probandId) {
    const proband = layoutedNodes.find((n) => n.id === probandId);
    if (proband) {
      const dx = -NODE_W / 2 - proband.position.x;
      if (dx !== 0) {
        layoutedNodes.forEach((n) => {
          n.position = { x: n.position.x + dx, y: n.position.y };
        });
      }
    }
  }

  return { nodes: layoutedNodes, edges };
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
      rfInstance.fitView({
        padding: 0.15,
        duration: 700,
        minZoom: 0.3,
        maxZoom: 1.1,
      });
      if (probandId) {
        const probandNode = layoutedNodes.find((n) => n.id === probandId);
        if (probandNode) {
          const x = probandNode.position.x + NODE_W / 2;
          // Centralizar visualmente com o cliente no topo (offset vertical para baixo)
          const y = probandNode.position.y + NODE_H / 2 + GENERATION_GAP * 0.9;
          rfInstance.setCenter(x, y, { zoom: 0.75, duration: 700 });
        }
      }
    }, 80);
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
              ["Clique duplo", "Editar pessoa ou vínculo"],
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
        style={{ height: "calc(100vh - 260px)", minHeight: 640 }}
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
              type: "smoothstep",
              style: { strokeWidth: 2 },
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

function relToEdge(r: RelRow): Edge {
  const stroke = colorFor(r);
  const dashed =
    r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
  const thick = r.qualifier === "fusion";
  return {
    id: r.id,
    source: r.from_person_id,
    target: r.to_person_id,
    type: "step",
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

      <Button onClick={onCreate} size="lg" variant="lavender">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
