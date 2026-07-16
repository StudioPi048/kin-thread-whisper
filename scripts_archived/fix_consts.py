with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("const HORIZONTAL_STEP = NODE_W + 90;") and "function getLayoutedElements" not in "".join(lines):
        pass # Wait, I will just remove the ones right before type LayoutNode
    
# Let's just do a regex replace
import re
content = "".join(lines)
content = re.sub(r"const HORIZONTAL_STEP = NODE_W \+ 90;\nconst GENERATION_GAP = 300;\n\ntype LayoutNode", "type LayoutNode", content)
with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
