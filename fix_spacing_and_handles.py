import re

with open("src/components/genogram/person-node.tsx", "r") as f:
    content = f.read()

# Fix left/right handles to be exactly at shapeSize / 2
content = content.replace(
"""      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""",
"""      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ top: shapeSize / 2 }}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""")

content = content.replace(
"""      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""",
"""      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ top: shapeSize / 2 }}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />""")

# Remove solid backgrounds from label as requested ("Remover o fundo")
# The user wants "visibilidade maxima" and "nunca sobrepor nada".
# We will make the label background transparent.
content = content.replace(
"""        className={cn(
          "mt-2.5 w-full rounded-md border px-2 py-1.5 text-center shadow-sm",
          d.is_proband
            ? "border-plum/40 bg-white"
            : "border-border/60 bg-card",
        )}""",
"""        className={cn(
          "mt-2.5 w-full rounded-md px-1 py-1 text-center",
          d.is_proband ? "bg-white/50 backdrop-blur-sm border border-plum/20" : ""
        )}""")

with open("src/components/genogram/person-node.tsx", "w") as f:
    f.write(content)

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Increase HORIZONTAL_STEP to give more room for lines
content = content.replace("const HORIZONTAL_STEP = NODE_W + 10;", "const HORIZONTAL_STEP = NODE_W + 70;")

# Increase FAMILY_GAP to separate families clearly
content = content.replace("const FAMILY_GAP = 40;", "const FAMILY_GAP = 160;")

# Fix UnionNode Y coordinate to match shapeSize / 2
content = content.replace(
"""          position: {
            x: (sourceNode.position.x + NODE_W / 2 + targetNode.position.x + NODE_W / 2) / 2,
            y: sourceNode.position.y + 40,
          },""",
"""          position: {
            x: (sourceNode.position.x + NODE_W / 2 + targetNode.position.x + NODE_W / 2) / 2,
            y: sourceNode.position.y + 38,
          },""")

# Fix generation band background to be completely transparent or very subtle grid
content = content.replace(
"""      className={`border-t-2 border-dashed border-border/40 ${isEven ? 'bg-transparent' : 'bg-muted/10'}`}""",
"""      className={`border-t-2 border-dashed border-border/40 bg-transparent`}""")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Applied fixes!")
