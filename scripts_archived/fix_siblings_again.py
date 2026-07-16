import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

injection = """
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

  // Create background bands
"""

content = content.replace("  // Create background bands", injection)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Canvas fixed again!")
