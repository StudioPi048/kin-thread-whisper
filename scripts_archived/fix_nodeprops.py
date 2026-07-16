import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

content = content.replace("ConnectionMode", "ConnectionMode,\n  type NodeProps")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

