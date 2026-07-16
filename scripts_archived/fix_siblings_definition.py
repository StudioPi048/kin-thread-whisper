import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Remove the one defined near unionNodeMap
content = content.replace("  const siblingToChildTarget = new Map<string, string>();\n\n  edges.forEach((edge) => {", "  edges.forEach((edge) => {")

# Add it at the top of getLayoutedElements
content = content.replace("export function getLayoutedElements(nodes: Node[], edges: Edge[], probandId?: string) {", "export function getLayoutedElements(nodes: Node[], edges: Edge[], probandId?: string) {\n  const siblingToChildTarget = new Map<string, string>();")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Canvas fixed!")
