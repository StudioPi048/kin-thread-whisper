import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# 1. Tweak constants
content = re.sub(r"const GENERATION_GAP = \d+;", "const GENERATION_GAP = 280;", content)
content = re.sub(r"const HORIZONTAL_STEP = NODE_W \+ \d+;", "const HORIZONTAL_STEP = NODE_W + 40;", content)

# 2. Add explicit handles to descendant edges
edge_fix = """      finalEdges.push({
        id: `descendant_${matchedUnionId}_${childId}`,
        source: matchedUnionId, 
        target: childId,
        sourceHandle: "top",
        targetHandle: "bottom",
        type: "straightStep",
        style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      });"""
content = re.sub(
    r"finalEdges\.push\(\{\s+id: `descendant_\$\{matchedUnionId\}_\$\{childId\}`,\s+source: matchedUnionId,\s+// Union is at Y=340\s+target: childId,\s+// Child is at Y=0\s+type: \"straightStep\",\s+style: \{ stroke: \"var\(--color-plum\)\", strokeWidth: 2 \},\s+\}\);",
    edge_fix,
    content
)

direct_edge_fix = """        finalEdges.push({
          ...e,
          id: `direct_${e.id}`,
          source: e.target, 
          target: e.source, 
          sourceHandle: "top",
          targetHandle: "bottom",
          type: "straightStep",
          style: { stroke: "var(--color-plum)", strokeWidth: 2 },
        });"""
content = re.sub(
    r"finalEdges\.push\(\{\s+\.\.\.e,\s+id: `direct_\$\{e\.id\}`,\s+source: e\.target,\s+// Parent\s+target: e\.source,\s+// Child\s+type: \"straightStep\",\s+style: \{ stroke: \"var\(--color-plum\)\", strokeWidth: 2 \},\s+\}\);",
    direct_edge_fix,
    content
)

# 3. Add GenerationBandNode component
band_node_code = """function GenerationBandNode({ data }: NodeProps) {
  const isEven = (data.generation as number) % 2 === 0;
  return (
    <div 
      style={{ width: 15000, height: GENERATION_GAP, pointerEvents: 'none' }}
      className={`border-b border-dashed border-plum/20 ${isEven ? 'bg-plum/[0.02]' : 'bg-transparent'}`}
    />
  );
}

const nodeTypes = { person: PersonNode, union: UnionNodeComponent, band: GenerationBandNode };"""
content = re.sub(r"const nodeTypes = \{ person: PersonNode, union: UnionNodeComponent \};", band_node_code, content)

# 4. Inject GenerationBand nodes into getLayoutedElements
band_injection = """
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
"""
content = re.sub(r"return \{ nodes: layoutedNodes, edges: \[\.\.\.otherEdges, \.\.\.finalEdges\] \};", band_injection, content)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Optimized!")
