import re

with open("src/components/genogram/person-node.tsx", "r") as f:
    person_content = f.read()

# Add group class to root div
person_content = person_content.replace(
"""      className={cn(
        "relative flex flex-col items-center",
        d.is_proband && "z-20",
      )}""",
"""      className={cn(
        "relative flex flex-col items-center group",
        d.is_proband && "z-20",
      )}""")

# Add visual connect handle
visual_handle = """
      {/* Visual drag handle to connect people */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center pointer-events-auto">
        <Handle
          id="visual-connect"
          type="source"
          position={Position.Bottom}
          className="!w-7 !h-7 !bg-plum !border-2 !border-white flex items-center justify-center cursor-crosshair !rounded-full shadow-lg z-50 !relative !transform-none !left-0 !top-0"
        >
          <Plus className="w-4 h-4 text-white pointer-events-none" />
        </Handle>
      </div>
"""

person_content = person_content.replace(
"""      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ top: shapeSize / 2 }}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""",
"""      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ top: shapeSize / 2 }}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""" + visual_handle)

with open("src/components/genogram/person-node.tsx", "w") as f:
    f.write(person_content)

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    canvas_content = f.read()

# Add EdgeLabelRenderer import if missing
if "EdgeLabelRenderer" not in canvas_content:
    canvas_content = canvas_content.replace(
        "import { BaseEdge, EdgeProps, Handle, Position } from \"@xyflow/react\";",
        "import { BaseEdge, EdgeProps, Handle, Position, EdgeLabelRenderer } from \"@xyflow/react\";"
    )

# Add Delete button to StraightStepEdge
edge_replacement = """
function StraightStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  markerStart,
  data,
  selected,
}: EdgeProps) {
  const isStraight = Math.abs(sourceX - targetX) < 1 || Math.abs(sourceY - targetY) < 1;
  const midY = sourceY + (targetY - sourceY) / 2;
  const path = isStraight
    ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  
  const midXLabel = sourceX + (targetX - sourceX) / 2;
  const midYLabel = isStraight ? sourceY + (targetY - sourceY) / 2 : midY;

  return (
    <>
      <BaseEdge
        path={path}
        style={{ ...style, strokeWidth: selected ? 3 : 2 }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {selected && data?.isRealEdge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midXLabel}px, ${midYLabel}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-50"
          >
            <button
              className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md text-xs font-bold transition-transform hover:scale-110"
              onClick={() => {
                if (data.onDelete) {
                  data.onDelete();
                } else if (data.relationshipId && typeof window !== 'undefined') {
                  // Fallback global event to delete edge
                  window.dispatchEvent(new CustomEvent('delete-edge', { detail: data.relationshipId }));
                }
              }}
              title="Remover Vínculo"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
"""

# Replace the original StraightStepEdge function
canvas_content = re.sub(
    r"function StraightStepEdge\(\{[\s\S]*?\}\s*EdgeProps\) \{[\s\S]*?return \([\s\S]*?<BaseEdge[\s\S]*?/>\s*\);\s*\}",
    edge_replacement.strip(),
    canvas_content
)

# Custom onNodesChange to lock Y axis dragging
custom_on_nodes_change = """
  // Lock dragging strictly to X axis
  const onNodesChangeCustom = useCallback((changes: any[]) => {
    const nextChanges = changes.map(change => {
      if (change.type === 'position' && change.dragging && change.position) {
        const node = nodes.find(n => n.id === change.id);
        if (node) {
          return {
            ...change,
            position: { x: change.position.x, y: node.position.y },
            positionAbsolute: change.positionAbsolute ? { x: change.positionAbsolute.x, y: node.position.y } : undefined
          };
        }
      }
      return change;
    });
    onNodesChange(nextChanges);
  }, [nodes, onNodesChange]);
"""

canvas_content = canvas_content.replace(
    "const onConnect = useCallback(",
    custom_on_nodes_change + "\n  const onConnect = useCallback("
)

canvas_content = canvas_content.replace(
    "onNodesChange={onNodesChange}",
    "onNodesChange={onNodesChangeCustom}"
)

# In getLayoutedElements, mark real edges for deletion
canvas_content = canvas_content.replace(
    """data: { relationshipId: rel.id, isConflict, onHover: undefined },""",
    """data: { relationshipId: rel.id, isConflict, isRealEdge: true, onHover: undefined },"""
)
canvas_content = canvas_content.replace(
    """data: { relationshipId: rel.id, isConflict, label: rel.type_pt },""",
    """data: { relationshipId: rel.id, isConflict, label: rel.type_pt, isRealEdge: true },"""
)


with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(canvas_content)

print("Done")
