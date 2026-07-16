import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# 1. Update Block interface
content = content.replace(
"""interface Block {
  nodes: LayoutNode[];
  width: number;
  center: number;
  childTarget?: Node;
}""",
"""interface Block {
  nodes: LayoutNode[];
  width: number;
  center: number;
  childTarget?: Node;
  childTargetX?: number;
}""")

# 2. Update mergeBlocks return
content = content.replace(
"""    return {
      nodes: finalNodes,
      width: Math.max(rightOffsetX + rightBlock.width + topOffset, bottomWidth + bottomOffset),
      center: childLocalCenter + bottomOffset,
      childTarget: childTarget
    };""",
"""    let cTargetX = undefined;
    if (childTarget) {
      cTargetX = bottomOffset + bottomNodes.indexOf(childTarget) * HORIZONTAL_STEP + HORIZONTAL_STEP / 2;
    }
    return {
      nodes: finalNodes,
      width: Math.max(rightOffsetX + rightBlock.width + topOffset, bottomWidth + bottomOffset),
      center: childLocalCenter + bottomOffset,
      childTarget: childTarget,
      childTargetX: cTargetX
    };""")

# 3. Update unionCenter logic to align by childTargetX!
content = content.replace(
"""    const hCenter = leftBlock.childTarget ? leftBlock.center : (leftBlock.width > 0 ? leftBlock.width / 2 : 0);
    const wCenter = rightBlock.childTarget ? rightBlock.center + rightOffsetX : (rightBlock.width > 0 ? rightOffsetX + rightBlock.width / 2 : rightOffsetX);""",
"""    const hCenter = leftBlock.childTargetX !== undefined ? leftBlock.childTargetX : leftBlock.center;
    const wCenter = rightBlock.childTargetX !== undefined ? rightBlock.childTargetX + rightOffsetX : rightBlock.center + rightOffsetX;""")

# 4. Fix UnionNode placement (remove + 50)
content = content.replace(
"""          position: {
            x: (sourceNode.position.x + targetNode.position.x) / 2 + 50,
            y: sourceNode.position.y + 40,
          },""",
"""          position: {
            x: (sourceNode.position.x + NODE_W / 2 + targetNode.position.x + NODE_W / 2) / 2,
            y: sourceNode.position.y + 40,
          },""")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Fixed mergeBlocks!")
