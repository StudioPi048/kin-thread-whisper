with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

types_str = """
const HORIZONTAL_STEP = NODE_W + 90;
const GENERATION_GAP = 300;

type LayoutNode = { node: Node; x: number; y: number; gen: number };
type Block = {
  nodes: LayoutNode[];
  width: number;
  center: number;
  childTarget?: Node;
};

function getLayoutedElements
"""

content = content.replace("function getLayoutedElements", types_str.strip())
with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
print("Types fixed")
