import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Trash2, UserPlus } from "lucide-react";
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

  const onNodeDragStop = useCallback<NodeMouseHandler>(
    (_, node) => savePosition(node.id, node.position.x, node.position.y),
    [savePosition],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      // Optimistic edge until user confirms details in the dialog.
      setEdges((eds) => addEdge({ ...conn, style: { stroke: "var(--color-lilac)" } }, eds));
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

  return (
    <div className="relative flex h-[70vh] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-parchment/60 px-3 py-2">
        <p className="mr-2 text-[10px] font-medium uppercase tracking-[0.28em] text-gold">
          Genossociograma
        </p>
        <Button size="sm" variant="outline" onClick={() => setCreatingPerson(true)}>
          <UserPlus className="size-4" /> Pessoa
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRelDialog({ open: true })}
          disabled={persons.length < 2}
        >
          <Link2 className="size-4" /> Vínculo
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteSelected.mutate()}
            disabled={deleteSelected.isPending}
          >
            <Trash2 className="size-4" /> Excluir selecionado
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        {query.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Carregando árvore...
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
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-parchment" />
          </ReactFlow>
        )}
      </div>

      <PersonFormDialog
        open={creatingPerson}
        onOpenChange={setCreatingPerson}
        clientId={clientId}
        defaultPosition={{ x: 120 + persons.length * 40, y: 120 }}
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
    label: relationshipLabel(r.relationship_type, r.qualifier),
    labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
    labelBgStyle: { fill: "var(--color-card)", fillOpacity: 0.9 },
  };
  const stroke = colorFor(r);
  const dashed = r.qualifier === "divorce" || r.qualifier === "separation" || r.qualifier === "rupture";
  const thick = r.qualifier === "fusion";
  return {
    ...base,
    animated: r.qualifier === "conflict",
    style: {
      stroke,
      strokeWidth: thick ? 3 : 1.5,
      strokeDasharray: dashed ? "6 4" : undefined,
    },
  };
}

function colorFor(r: RelRow): string {
  if (r.relationship_type === "parent") return "var(--color-primary)";
  if (r.relationship_type === "sibling") return "var(--color-muted-foreground)";
  if (r.relationship_type === "union") return "var(--color-gold)";
  // emotional
  switch (r.qualifier) {
    case "conflict":
    case "rupture":
      return "var(--color-destructive)";
    case "fusion":
    case "close":
      return "var(--color-lilac)";
    case "grief":
      return "var(--color-primary)";
    default:
      return "var(--color-lilac)";
  }
}

function EmptyCanvas({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <p className="font-serif text-2xl text-primary">A árvore começa por uma pessoa</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Adicione o paciente-índice primeiro. Depois construa em torno dele: pais,
        avós, irmãos, uniões, filhos. As relações contam a história.
      </p>
      <Button onClick={onCreate}>
        <Plus className="size-4" /> Adicionar primeira pessoa
      </Button>
    </div>
  );
}
