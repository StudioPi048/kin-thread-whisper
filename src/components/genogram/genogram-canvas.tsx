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
import {
  UserPlus,
  Link2,
  Trash2,
  Printer,
  HelpCircle,
  Users,
  TreePine,
  Save,
  Undo,
  Redo,
  Workflow,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
  Grid3X3,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PersonNode, type PersonNodeData } from "./person-node";
import { PersonFormDialog } from "./person-form-dialog";
import { RelationshipFormDialog } from "./relationship-form-dialog";
import { relationshipLabel } from "@/lib/genogram";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";
import { ensureProband } from "@/lib/ensure-proband";
import { buildLogicalGraph, validateGraph, layoutGraph } from "@/lib/geno/build";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

const BUILD_TAG = "2026-07-06-canvas-pro-max";
const GENERATION_GAP = 180;
const NODE_W = 140;

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
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-card/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-plum shadow-sm"
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
          <path
            d="M8 22 L16 4"
            stroke="var(--color-destructive)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <path
            d="M20 22 L28 4"
            stroke="var(--color-destructive)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
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
  const isEven = ((data as { generation?: number }).generation as number) % 2 === 0;
  return (
    <div
      style={{ width: 15000, height: GENERATION_GAP, pointerEvents: "none" }}
      className={`border-b border-dashed border-plum/20 ${isEven ? "bg-plum/[0.02]" : "bg-transparent"}`}
    >
      <div className="absolute left-6 top-3 text-[10px] font-black uppercase tracking-[0.25em] text-plum/35">
        Geração {(data as { generation?: number }).generation}
      </div>
    </div>
  );
}

const nodeTypes = {
  person: PersonNode,
  union: UnionNodeComponent,
  band: GenerationBandNode,
};

const CustomStepEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  markerEnd,
}: EdgeProps) => {
  const midX = (sourceX + targetX) / 2;
  const path = `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;

  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <foreignObject
          width={80}
          height={20}
          x={midX - 40}
          y={(sourceY + targetY) / 2 - 10}
          className="overflow-visible"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span className="rounded bg-card/90 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm">
              {label}
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
};

const edgeTypes = {
  step: CustomStepEdge,
};

// HELPER LOCAL LAYOUT GENERATION
function buildRenderGraph(persons: PersonRow[], rels: RelRow[], probandId: string | undefined) {
  const graph = buildLogicalGraph({ persons, rels, probandId });
  const validation = validateGraph(graph);
  if (!validation.ok) {
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

  // Edges: partner + child
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
      style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      data: { unionId: uid, childIds: union.children },
      zIndex: 2,
    });
  }

  return { nodes, edges };
}

export function GenogramCanvas({ clientId }: { clientId: string }) {
  return (
    <ReactFlowProvider>
      <GenogramCanvasInner clientId={clientId} />
    </ReactFlowProvider>
  );
}

function GenogramCanvasInner({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const rfInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [defaultRelationship, setDefaultRelationship] = useState("");
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonRow | null>(null);
  const [highlightFilter, setHighlightFilter] = useState<string>("none");
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [relDialog, setRelDialog] = useState<{
    open: boolean;
    seed?: { from?: string; to?: string };
    editing: RelRow | null;
  }>({ open: false, editing: null });

  const query = useQuery({
    queryKey: ["genogram", clientId],
    queryFn: async () => {
      // 1. Ensure proband exists in database
      await ensureProband(clientId);

      // 2. Fetch updated persons
      const { data: persons, error: pe } = await supabase
        .from("genogram_persons")
        .select("*")
        .eq("client_id", clientId);
      if (pe) throw pe;

      // 3. Fetch relationships
      const { data: rels, error: re } = await supabase
        .from("genogram_relationships")
        .select("*")
        .eq("client_id", clientId);
      if (re) throw re;

      return { persons: (persons as PersonRow[]) ?? [], rels: (rels as RelRow[]) ?? [] };
    },
  });

  // Re-build render graph when data or highlight filter changes
  useEffect(() => {
    if (!query.data) return;

    const qualifiedPersons = query.data.persons.filter((p: PersonRow) => {
      if (p.is_proband) return true;
      const hasName = !!p.full_name?.trim();
      const hasRel = !!p.relationship_to_proband?.trim();
      return hasName || hasRel;
    });

    const proband = qualifiedPersons.find((p: PersonRow) => p.is_proband) || qualifiedPersons[0];
    const probandId = proband?.id;

    const { nodes: rawNodes, edges: rawEdges } = buildRenderGraph(
      qualifiedPersons,
      query.data.rels,
      probandId,
    );

    const styledNodes = rawNodes.map((node) => {
      const person = query.data.persons.find((p: PersonRow) => p.id === node.id);
      let opacity = 1;
      let shadow = undefined;

      if (highlightFilter !== "none" && person) {
        let matches = false;
        if (highlightFilter === "deceased") {
          matches = !!person.is_deceased;
        } else if (highlightFilter === "professions") {
          matches = !!person.occupation;
        } else if (highlightFilter === "traumas") {
          matches = !!(
            person.notes?.toLowerCase().includes("trauma") ||
            person.notes?.toLowerCase().includes("segredo") ||
            person.notes?.toLowerCase().includes("abuso") ||
            person.notes?.toLowerCase().includes("morte")
          );
        } else if (highlightFilter === "diseases") {
          matches = !!(
            person.notes?.toLowerCase().includes("doença") ||
            person.notes?.toLowerCase().includes("câncer") ||
            person.notes?.toLowerCase().includes("sintoma") ||
            person.notes?.toLowerCase().includes("infarto")
          );
        }

        if (!matches) {
          opacity = 0.25;
        } else {
          shadow = "0 0 0 4px var(--color-gold)";
        }
      }

      return {
        ...node,
        zIndex: 5,
        style: {
          ...node.style,
          opacity,
          boxShadow: shadow,
        },
      };
    });

    setNodes(styledNodes);
    setEdges(rawEdges);
  }, [query.data, highlightFilter, setNodes, setEdges]);

  // Center on proband node on load
  useEffect(() => {
    if (!query.isLoading && nodes.length > 0) {
      const proband = nodes.find((n) => (n.data as PersonNodeData)?.isProband);
      if (proband) {
        setTimeout(() => {
          rfInstance.setCenter(proband.position.x + NODE_W / 2, proband.position.y + 180, {
            zoom: 0.95,
            duration: 800,
          });
        }, 150);
      }
    }
  }, [query.isLoading, rfInstance]);

  const onNodesChangeCustom = useCallback(
    (changes: NodeChange[]) => {
      let hasPositionChange = false;
      const nextChanges = changes.map((change) => {
        if (change.type === "position" && change.position) {
          hasPositionChange = true;
          const node = rfInstance.getNode(change.id);
          if (node) {
            return {
              ...change,
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

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      const selectedNode = selectedNodes.find((n) => n.selected);
      const person = query.data?.persons.find((p) => p.id === selectedNode?.id);
      if (person) {
        setSelectedPerson(person);
      } else {
        setSelectedPerson(null);
      }
    },
    [query.data],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      const person = query.data?.persons.find((p) => p.id === node.id);
      if (person) {
        setSelectedPerson(person);
        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
      }
    },
    [query.data, setNodes],
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
      setSelectedPerson(null);
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

  const resetLayout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("genogram_persons")
        .update({
          position_x: null as unknown as number,
          position_y: null as unknown as number,
        })
        .eq("client_id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      setLayoutDirty(false);
      query.refetch();
      toast.success("Árvore organizada e auto-alinhada com sucesso.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao alinhar"),
  });

  const savePersonDetails = useMutation({
    mutationFn: async (updatedFields: Partial<PersonRow>) => {
      if (!selectedPerson) return;
      const { error } = await supabase
        .from("genogram_persons")
        .update(updatedFields)
        .eq("id", selectedPerson.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["genogram", clientId] });
      toast.success("Dados do familiar salvos.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const persons = query.data?.persons ?? [];
  const qualifiedCount = nodes.filter((node) => node.type === "person").length;
  const totalCount = persons.length;
  const incompleteCount = totalCount - qualifiedCount;
  const relCount = query.data?.rels.length ?? 0;

  return (
    <div className="relative flex flex-row overflow-hidden rounded-[1.5rem] border border-border bg-slate-50/40 shadow-inner h-[800px] min-h-[calc(100vh-200px)] w-full">
      {/* Canvas Area */}
      <div className="flex-1 h-full relative overflow-hidden">
        {/* ── CONTÊINER SUPERIOR (BARRA DE AÇÕES + LEGENDA) ── */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5 pointer-events-none max-w-[calc(100%-32px)]">
          {/* BARRA DE AÇÕES */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-plum shadow-xl border border-white/10">
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
              className="h-9 gap-2 font-bold"
            >
              <UserPlus className="size-4" />
              Adicionar pessoa
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setRelDialog({ open: true, editing: null })}
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

            {/* Undo, Redo, Organizar */}
            <div className="flex items-center border-l border-white/10 pl-2 gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Desfazer alteração")}
                className="h-9 w-9 p-0 border-white/25 text-white hover:bg-white/10 hover:text-white"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Refazer alteração")}
                className="h-9 w-9 p-0 border-white/25 text-white hover:bg-white/10 hover:text-white"
                title="Refazer (Ctrl+Y)"
              >
                <Redo className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetLayout.mutate()}
                disabled={resetLayout.isPending}
                className="h-9 gap-1.5 border-white/25 text-white hover:bg-white/10 hover:text-white normal-case font-semibold text-[13px]"
                title="Auto-alinhar e organizar gerações"
              >
                <Grid3X3 className="size-4" />
                Organizar
              </Button>
            </div>

            <div className="hidden items-center gap-4 lg:flex ml-3">
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
              {(layoutDirty || lastSavedAt) && (
                <span className="text-[12px] font-semibold text-white/50">
                  {layoutDirty ? "Não salvo" : `Salvo às ${lastSavedAt}`}
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/55 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <HelpCircle className="size-4" />
                <span className="hidden sm:inline">Guia</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-white/55 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <Printer className="size-4" />
                <span className="hidden sm:inline">A3</span>
              </button>
              <button
                onClick={() => deleteSelected.mutate()}
                disabled={deleteSelected.isPending}
                className="flex items-center gap-1.5 rounded px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-destructive/70 transition-colors hover:bg-destructive/20 hover:text-destructive cursor-pointer"
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Remover</span>
              </button>
            </div>
          </div>

          {/* Destaques / Filtros */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-white/90 backdrop-blur-sm shadow-md px-3.5 py-1.5 text-[12px] font-semibold w-fit">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em] mr-2 flex items-center gap-1">
              <Sparkles className="size-3.5 text-plum" />
              Destacar Padrão:
            </span>
            {[
              { id: "none", label: "Nenhum" },
              { id: "deceased", label: "Falecidos" },
              { id: "professions", label: "Profissões" },
              { id: "traumas", label: "Segredos/Traumas" },
              { id: "diseases", label: "Doenças/Sintomas" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setHighlightFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  highlightFilter === f.id
                    ? "bg-plum text-white"
                    : "bg-slate-100 text-muted-foreground hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Legenda dos Símbolos */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-5 rounded-xl border border-border/50 bg-white/90 backdrop-blur-sm shadow-md px-4 py-2.5 text-[12px] font-semibold w-fit">
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
              <span className="text-foreground/80">Não-binário</span>
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
          </div>
        </div>

        {/* Guia Rápido */}
        {showGuide && (
          <div className="absolute top-48 left-4 z-10 border border-border/50 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md max-w-sm pointer-events-auto">
            <div className="flex flex-col gap-2.5 text-[13px] text-foreground/75 font-medium">
              {[
                ["Espaço + Arrastar", "Navegar pela tela"],
                ["Arrastar Pessoa", "Reposicionar horizontalmente"],
                ["Clique Único", "Abrir Painel de Edição na direita"],
                ["Remover selecionado", "Selecione e clique em 'Remover'"],
                ["Scroll / Roda", "Aumentar/Diminuir Zoom"],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between gap-4">
                  <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-mono font-bold shrink-0">
                    {key}
                  </kbd>
                  <span className="text-right text-[12px]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas React Flow */}
        <div className="absolute inset-0 z-0 bg-transparent">
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
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onSelectionChange={onSelectionChange}
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
                className="bg-white border-none shadow-xl overflow-hidden rounded-xl [&>button]:border-b [&>button]:border-slate-100 [&>button]:hover:bg-slate-50 [&>button]:text-plum"
                showInteractive={false}
              />
            </ReactFlow>
          )}
        </div>
      </div>

      {/* Selected Person Sidebar Editor */}
      {selectedPerson && (
        <EditSidebar
          person={selectedPerson}
          onClose={() => {
            // Deselect node to close panel
            setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            setSelectedPerson(null);
          }}
          onSave={(fields) => {
            savePersonDetails.mutate(fields);
          }}
        />
      )}

      {/* Creating modal Dialog */}
      <PersonFormDialog
        open={creatingPerson}
        onOpenChange={(open) => {
          setCreatingPerson(open);
          if (!open) setDefaultRelationship("");
        }}
        clientId={clientId}
        defaultPosition={{ x: 120 + persons.length * 200, y: 120 }}
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

// EDIT SIDEBAR COMPONENT
function EditSidebar({
  person,
  onClose,
  onSave,
}: {
  person: PersonRow;
  onClose: () => void;
  onSave: (fields: Partial<PersonRow>) => void;
}) {
  const [fullName, setFullName] = useState(person.full_name);
  const [preferredName, setPreferredName] = useState(person.preferred_name || "");
  const [gender, setGender] = useState(person.gender || "unknown");
  const [birthDate, setBirthDate] = useState(person.birth_date || "");
  const [isDeceased, setIsDeceased] = useState(!!person.is_deceased);
  const [deathDate, setDeathDate] = useState(person.death_date || "");
  const [causeOfDeath, setCauseOfDeath] = useState(person.cause_of_death || "");
  const [occupation, setOccupation] = useState(person.occupation || "");
  const [notes, setNotes] = useState(person.notes || "");

  useEffect(() => {
    setFullName(person.full_name);
    setPreferredName(person.preferred_name || "");
    setGender(person.gender || "unknown");
    setBirthDate(person.birth_date || "");
    setIsDeceased(!!person.is_deceased);
    setDeathDate(person.death_date || "");
    setCauseOfDeath(person.cause_of_death || "");
    setOccupation(person.occupation || "");
    setNotes(person.notes || "");
  }, [person]);

  return (
    <div className="w-[340px] shrink-0 border-l border-border bg-white h-full flex flex-col z-20 shadow-2xl relative">
      <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-plum" />
          <h3 className="font-serif font-bold text-primary text-[15px]">Editar Membro</h3>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-primary font-bold text-sm cursor-pointer p-1"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Nome Completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none focus:border-plum"
          />
        </div>
        {/* Preferred Name */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Nome de Preferência</label>
          <input
            type="text"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none focus:border-plum"
          />
        </div>
        {/* Gender */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Gênero / Símbolo</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none bg-white focus:border-plum"
          >
            <option value="male">Masculino (Quadrado)</option>
            <option value="female">Feminino (Círculo)</option>
            <option value="other">Não-binário (Losango)</option>
            <option value="abortion">Aborto (Triângulo)</option>
          </select>
        </div>
        {/* Dates */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Nascimento</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none focus:border-plum"
          />
        </div>

        {/* Deceased toggle */}
        <div className="flex items-center gap-2 pt-2 pb-1">
          <input
            type="checkbox"
            id="isDeceased"
            checked={isDeceased}
            onChange={(e) => setIsDeceased(e.target.checked)}
            className="rounded border-border text-plum focus:ring-plum size-4"
          />
          <label htmlFor="isDeceased" className="font-bold text-muted-foreground/80 cursor-pointer">
            Esta pessoa é falecida (✕)
          </label>
        </div>

        {isDeceased && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-border rounded-xl">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground/80">Falecimento</label>
              <input
                type="date"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none bg-white focus:border-plum"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground/80">Causa</label>
              <input
                type="text"
                value={causeOfDeath}
                onChange={(e) => setCauseOfDeath(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none bg-white focus:border-plum"
                placeholder="ex: Câncer"
              />
            </div>
          </div>
        )}

        {/* Occupation */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Profissão / Ocupação</label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none focus:border-plum"
            placeholder="ex: Agricultor"
          />
        </div>

        {/* Notes / Clinical secrets */}
        <div className="space-y-1">
          <label className="font-bold text-muted-foreground/80">Segredos / Traumas / Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary focus:outline-none focus:border-plum min-h-[90px]"
            placeholder="Anote dinâmicas sistêmicas, repetições, traumas..."
          />
        </div>
      </div>

      <div className="p-4 border-t border-border bg-slate-50 flex gap-2 shrink-0">
        <Button
          variant="hero"
          className="flex-1"
          onClick={() =>
            onSave({
              full_name: fullName,
              preferred_name: preferredName || null,
              gender,
              birth_date: birthDate || null,
              is_deceased: isDeceased,
              death_date: isDeceased ? deathDate || null : null,
              cause_of_death: isDeceased ? causeOfDeath || null : null,
              occupation: occupation || null,
              notes: notes || null,
            })
          }
        >
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
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
