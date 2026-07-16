import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# 1. Add siblingToChildTarget map
content = re.sub(r'  const unionNodeMap = new Map<string, string>\(\);', '  const unionNodeMap = new Map<string, string>();\n  const siblingToChildTarget = new Map<string, string>();', content)

# 2. Populate it in mergeBlocks
merge_blocks_logic = """    const bottomNodes = isHusbandSide 
      ? [...childSiblings, ...(childTarget ? [childTarget] : [])]
      : [...(childTarget ? [childTarget] : []), ...childSiblings];
      
    if (childTarget) {
      childSiblings.forEach(s => siblingToChildTarget.set(s.id, childTarget.id));
    }
"""
content = re.sub(r'    const bottomNodes = isHusbandSide \n      \? \[\.\.\.childSiblings, \.\.\.\(childTarget \? \[childTarget\] : \[\]\)\]\n      : \[\.\.\.\(childTarget \? \[childTarget\] : \[\]\), \.\.\.childSiblings\];', merge_blocks_logic, content)

# 3. Populate it in buildFamilyBlock
build_family_logic = """    const bottomNodes = isHusbandSide 
      ? [...childSiblings, ...(child ? [child] : [])]
      : [...(child ? [child] : []), ...childSiblings];
      
    if (child) {
      childSiblings.forEach(s => siblingToChildTarget.set(s.id, child.id));
    }
"""
content = re.sub(r'    const bottomNodes = isHusbandSide \n      \? \[\.\.\.childSiblings, \.\.\.\(child \? \[child\] : \[\]\)\]\n      : \[\.\.\.\(child \? \[child\] : \[\]\), \.\.\.childSiblings\];', build_family_logic, content)

# 4. Generate edges for siblings after parentEdgesByChild loop
generate_edges_logic = """
  // Generate edges for siblings
  const childToUnion = new Map<string, string>();
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
      childToUnion.set(childId, matchedUnionId);
      finalEdges.push({
        id: `descendant_${matchedUnionId}_${childId}`,
        source: matchedUnionId, 
        target: childId,
        sourceHandle: "top",
        targetHandle: "bottom",
        type: "straightStep",
        style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      });
    } else {
      pEdges.forEach((e) => {
        finalEdges.push({
          ...e,
          id: `direct_${e.id}`,
          source: e.target, 
          target: e.source, 
          sourceHandle: "bottom",
          targetHandle: "top",
          type: "straightStep",
          style: { stroke: "var(--color-plum)", strokeWidth: 2 },
        });
      });
    }
  });

  siblingToChildTarget.forEach((targetId, siblingId) => {
    const matchedUnionId = childToUnion.get(targetId);
    if (matchedUnionId) {
      finalEdges.push({
        id: `descendant_${matchedUnionId}_${siblingId}`,
        source: matchedUnionId, 
        target: siblingId,
        sourceHandle: "top",
        targetHandle: "bottom",
        type: "straightStep",
        style: { stroke: "var(--color-plum)", strokeWidth: 2 },
      });
    }
  });
"""

# We replace the original parentEdgesByChild loop entirely
content = re.sub(r'  parentEdgesByChild\.forEach\(\(pEdges, childId\) => \{[\s\S]*?  \}\);\n', generate_edges_logic, content)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Canvas fixed!")
