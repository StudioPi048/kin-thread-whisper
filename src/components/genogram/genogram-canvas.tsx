import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  UserPlus,
  Link2,
  Trash2,
  Printer,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Users,
  TreePine,
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

  // Hydrate React Flow state from server data.
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

  // Persist node positions (debounced).
  const positionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savePosition = useCallback(
    (id: string, x: number, y: number) => {
      clearTimeout(positionTimers.current[id]);
      positionTimers.current[id] = setTimeout(async () => {
        const { error } = await supabase
          .from("genogram_persons")
          .update({ position_x: x, position_y: y })
          .eq("id", id);
        if (error) toast.error("Não consegui salvar a posição");
      }, 400);
    },
    [],
  );

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_, node) => savePosition(node.id, node.position.x, node.position.y),
    [savePosition],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      // Optimistic edge until user confirms details in the dialog.
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "var(--color-gold)" } }, eds));
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

  // Delete keyboard shortcut acts on selected nodes/edges.
  const deleteSelected = useMutation({
    mutationFn: async () => {
      const nodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
      const edgeIds = edges.filter((e) => e.selected).map((e) => e.id);
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      if (edgeIds.length > 0) {
        const { error } = await supabase
          .from("genogram_relationships")
          .delete()
          .in("id", edgeIds);
        if (error) throw error;
      }
      if (nodeIds.length > 0) {
        const { error } = await supabase
          .from("genogram_persons")
          .delete()
          .in("id", nodeIds);
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
  const personCount = persons.length;
  const relCount = query.data?.rels.length ?? 0;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* ── BARRA DE AÇÕES ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-cream px-4 py-3">
        {/* Label */}
        <div className="flex items-center gap-2 mr-3">
          <TreePine className="size-4 text-gold" />
          <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Genossociograma
          </span>
        </div>

        {/* Botões principais */}
        <Button
          size="sm"
          variant="default"
          onClick={() => setCreatingPerson(true)}
          className="h-10 gap-2"
        >
          <UserPlus className="size-4" />
          Adicionar pessoa
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setRelDialog({ open: true })}
          disabled={persons.length < 2}
          className="h-10 gap-2"
        >
          <Link2 className="size-4" />
          Criar vínculo
        </Button>

        {/* Stats */}
        <div className="hidden items-center gap-4 md:flex ml-3">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Users className="size-3.5 text-gold" />
            <strong className="text-foreground">{personCount}</strong> pessoas
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Link2 className="size-3.5 text-forest" />
            <strong className="text-foreground">{relCount}</strong> vínculos
          </span>
        </div>

        {/* Ações secundárias */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-10 gap-2 text-muted-foreground"
            onClick={() => setShowGuide(!showGuide)}
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">Guia</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-10 gap-2 text-muted-foreground"
            onClick={handlePrint}
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">Imprimir A3</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-10 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteSelected.mutate()}
            disabled={deleteSelected.isPending}
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Remover</span>
          </Button>
        </div>
      </div>

      {/* ── GUIA RÁPIDO ───────────────────────────────────── */}
      {showGuide && (
        <div className="border-b border-border bg-gold/5 px-4 py-3">
          <div className="flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-mono">Clique duplo</kbd>
              Editar pessoa ou vínculo
            </span>
            <span className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-mono">Arrastar ponto dourado</kbd>
              Criar vínculo entre pessoas
            </span>
            <span className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-mono">Selecionar + Remover</kbd>
              Excluir selecionado
            </span>
            <span className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-mono">Scroll</kbd>
              Zoom in/out
            </span>
          </div>
        </div>
      )}

      {/* ── LEGENDAS DE GERAÇÃO ────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-background/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em]">
        <span className="text-muted-foreground/60">Convenção:</span>
        {[
          { label: "□ Masculino", color: "var(--color-primary)" },
          { label: "○ Feminino", color: "var(--color-forest)" },
          { label: "⬡ Não-binário", color: "var(--color-gold)" },
          { label: "✕ Falecido", color: "var(--color-destructive)" },
          { label: "Borda dupla = Paciente-índice", color: "var(--color-gold)" },
        ].map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5"
            style={{ color: item.color }}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* ── CANVAS ────────────────────────────────────────── */}
      <div className="relative" style={{ height: "65vh" }}>
        {query.isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
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
            // Linhas retas (orthogonal) — conforme solicitado
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { strokeWidth: 2 },
            }}
            snapToGrid
            snapGrid={[20, 20]}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.2}
              color="oklch(0.80 0.015 245)"
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
  const base: Edge = {
    id: r.id,
    source: r.from_person_id,
    target: r.to_person_id,
    // Forçar linhas retas com tipo smoothstep (ângulos de 90°)
    type: "smoothstep",
    label: relationshipLabel(r.relationship_type, r.qualifier),
    labelStyle: { fontSize: 11, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-sans)" },
    labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.95, rx: 4, ry: 4 },
    labelBgPadding: [4, 6] as [number, number],
  };
  const stroke = colorFor(r);
  const dashed = r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
  const thick = r.qualifier === "fusion";
  return {
    ...base,
    animated: r.qualifier === "conflict",
    style: {
      stroke,
      strokeWidth: thick ? 3 : 2,
      strokeDasharray: dashed ? "8 5" : undefined,
    },
  };
}

function colorFor(r: RelRow): string {
  if (r.relationship_type === "parent")  return "var(--color-primary)";
  if (r.relationship_type === "sibling") return "var(--color-forest)";
  if (r.relationship_type === "union")   return "var(--color-gold)";
  // emotional
  switch (r.qualifier) {
    case "conflict":
    case "rupture":
      return "var(--color-destructive)";
    case "fusion":
    case "close":
      return "var(--color-forest)";
    case "grief":
      return "var(--color-primary)";
    default:
      return "var(--color-muted-foreground)";
  }
}

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center">
      {/* Ícone decorativo */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gold/40 bg-gold/5">
        <TreePine className="size-9 text-gold/60" />
      </div>

      <div>
        <p className="font-serif text-2xl text-primary">A árvore começa por uma pessoa</p>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Adicione o <strong>paciente-índice</strong> primeiro. Depois construa em torno dele:
          pais, avós, irmãos, uniões, filhos. As relações contam a história.
        </p>
      </div>

      {/* Passos guiados */}
      <div className="mt-2 flex flex-col items-start gap-3 rounded-xl border border-border bg-cream p-5 text-left">
        <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Como construir a árvore
        </p>
        {[
          "1. Adicione o paciente-índice (borda dupla dourada)",
          "2. Clique em \"Adicionar pessoa\" para cada familiar",
          "3. Arraste o ponto dourado de uma pessoa para outra para criar vínculos",
          "4. Clique duplo em qualquer elemento para editar",
          "5. Use \"Imprimir A3\" para exportar a árvore completa",
        ].map((step) => (
          <p key={step} className="text-[14px] text-foreground/80">{step}</p>
        ))}
      </div>

      <Button onClick={onCreate} size="lg" variant="gold">
        <UserPlus className="size-5" />
        Adicionar primeira pessoa
      </Button>
    </div>
  );
}
