import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Link2, Trash2, Printer,
  HelpCircle, Users, TreePine,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PersonNode, type PersonNodeData } from "./person-node";
import { PersonFormDialog } from "./person-form-dialog";
import { RelationshipFormDialog } from "./relationship-form-dialog";
import { relationshipLabel } from "@/lib/genogram";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];

const nodeTypes = { person: PersonNode };

interface CanvasProps { clientId: string; }

export function GenogramCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <GenogramCanvasInner {...props} />
    </ReactFlowProvider>
  );
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

  useEffect(() => {
    if (!query.data) return;
    setNodes(
      query.data.persons.map((p) => ({
        id: p.id,
        type: "person",
        position: { x: p.position_x, y: p.position_y },
        data: {
          full_name: p.full_name,
          preferred_name: p.preferred_name,
          gender: p.gender,
          birth_date: p.birth_date,
          death_date: p.death_date,
          is_deceased: p.is_deceased,
          is_proband: p.is_proband,
          notes: p.notes,
        } satisfies PersonNodeData,
      })),
    );
    setEdges(query.data.rels.map(relToEdge));
  }, [query.data, setNodes, setEdges]);

  const positionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savePosition = useCallback((id: string, x: number, y: number) => {
    clearTimeout(positionTimers.current[id]);
    positionTimers.current[id] = setTimeout(async () => {
      const { error } = await supabase
        .from("genogram_persons")
        .update({ position_x: x, position_y: y })
        .eq("id", id);
      if (error) toast.error("Não consegui salvar a posição");
    }, 400);
  }, []);

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_, node) => savePosition(node.id, node.position.x, node.position.y),
    [savePosition],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "var(--color-lavender)" } }, eds));
      setRelDialog({ open: true, seed: { from: conn.source ?? undefined, to: conn.target ?? undefined } });
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
      const nodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["genogram", clientId] }); toast.success("Removido."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const persons = query.data?.persons ?? [];
  const personCount = persons.length;
  const relCount = query.data?.rels.length ?? 0;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-sm border border-border bg-card shadow-sm">

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
            <strong className="text-white">{personCount}</strong> pessoas
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
              ["Arrastar ponto lavanda", "Criar vínculo entre pessoas"],
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
      <div className="relative" style={{ height: "65vh" }}>
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
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
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
            <Controls
              showInteractive={false}
              style={{ bottom: 16, left: 16, top: "auto" }}
            />
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
          setRelDialog((prev) => ({ ...prev, open: o, ...(o ? {} : { seed: undefined, editing: null }) }))
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
  const dashed = r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
  const thick   = r.qualifier === "fusion";
  return {
    id: r.id,
    source: r.from_person_id,
    target: r.to_person_id,
    type: "smoothstep",
    label: relationshipLabel(r.relationship_type, r.qualifier),
    labelStyle: { fontSize: 11, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-sans)" },
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
  if (r.relationship_type === "parent")  return "var(--color-plum)";
  if (r.relationship_type === "sibling") return "var(--color-lavender)";
  if (r.relationship_type === "union")   return "var(--color-gold)";
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
        <p className="font-serif text-2xl font-bold text-primary">
          A árvore começa por uma pessoa
        </p>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Adicione o <strong>paciente-índice</strong> primeiro. Depois construa em torno dele:
          pais, avós, irmãos, uniões, filhos.
        </p>
      </div>

      <div className="w-full max-w-md border-l-[5px] border-l-lavender bg-cream p-5 text-left">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Como construir a árvore
        </p>
        {[
          "1. Adicione o paciente-índice (borda dupla lavanda)",
          "2. Clique em \"Adicionar pessoa\" para cada familiar",
          "3. Arraste o ponto lavanda de uma pessoa para outra para criar vínculos",
          "4. Clique duplo em qualquer elemento para editar",
          "5. Use \"A3\" para exportar a árvore para impressão",
        ].map((step) => (
          <p key={step} className="py-1 text-[14px] text-foreground/75">{step}</p>
        ))}
      </div>

      <Button onClick={onCreate} size="lg" variant="lavender">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
