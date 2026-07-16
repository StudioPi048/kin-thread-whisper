import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Replace the block from `// Recreate union nodes` to the end of `getLayoutedElements`
new_block = """
  // Recreate union nodes exactly as before
  const unionNodeMap = new Map<string, string>();
  edges.forEach((edge) => {
    if (edge.style?.stroke === "var(--color-gold)") {
      const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
      const targetNode = layoutedNodes.find((n) => n.id === edge.target);
      if (sourceNode && targetNode) {
        const unionId = `union_${sourceNode.id}_${targetNode.id}`;
        const centerX1 = sourceNode.position.x + NODE_W / 2;
        const centerX2 = targetNode.position.x + NODE_W / 2;
        
        layoutedNodes.push({
          id: unionId,
          type: "union",
          // Position it perfectly halfway down the node
          position: { x: (centerX1 + centerX2) / 2, y: sourceNode.position.y + 40 },
          data: {},
        });
        
        unionNodeMap.set(`${sourceNode.id}_${targetNode.id}`, unionId);
        unionNodeMap.set(`${targetNode.id}_${sourceNode.id}`, unionId);
      }
    }
  });

  const parentToUnionMap = new Map<string, string>();
  unionNodeMap.forEach((unionId, parentsKey) => {
    const [p1, p2] = parentsKey.split("_");
    parentToUnionMap.set(p1, unionId);
    parentToUnionMap.set(p2, unionId);
  });

  const parentEdgesByChild = new Map<string, Edge[]>();
  const otherEdges: Edge[] = [];

  edges.forEach((edge) => {
    if (edge.style?.stroke === "var(--color-plum)") {
      // In structural-tree, source is Child, target is Parent.
      if (!parentEdgesByChild.has(edge.source)) parentEdgesByChild.set(edge.source, []);
      parentEdgesByChild.get(edge.source)!.push(edge);
    } else {
      otherEdges.push({
        ...edge,
        type: edge.style?.stroke === "var(--color-gold)" ? "straightStep" : edge.type,
      });
    }
  });

  const finalEdges: Edge[] = [];

  parentEdgesByChild.forEach((pEdges, childId) => {
    let matchedUnionId: string | null = null;
    for (const edge of pEdges) {
      const unionId = parentToUnionMap.get(edge.target);
      if (unionId) {
        matchedUnionId = unionId;
        break;
      }
    }

    if (matchedUnionId) {
      finalEdges.push({
        id: `descendant_${matchedUnionId}_${childId}`,
        source: matchedUnionId, // Union is at Y=340
        target: childId,        // Child is at Y=0
        type: "straightStep",
        style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      });
    } else {
      pEdges.forEach((e) => {
        finalEdges.push({
          ...e,
          id: `direct_${e.id}`,
          source: e.target, // Parent
          target: e.source, // Child
          type: "straightStep",
          style: { stroke: "var(--color-plum)", strokeWidth: 2 },
        });
      });
    }
  });

  return { nodes: layoutedNodes, edges: [...otherEdges, ...finalEdges] };
}
"""

match = re.search(r"// Recreate union nodes exactly as before.*?^}", content, re.DOTALL | re.MULTILINE)
if not match:
    print("Could not find union block!")
else:
    new_content = content[:match.start()] + new_block.strip() + "\n" + content[match.end():]
    with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
        f.write(new_content)
    print("Fixed edges logic!")
