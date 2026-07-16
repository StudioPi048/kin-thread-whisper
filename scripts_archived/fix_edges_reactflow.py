import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Add ConnectionMode to imports
content = re.sub(
    r"import \{([^}]+)\} from \"@xyflow/react\";",
    lambda m: "import {" + m.group(1) + (", ConnectionMode" if "ConnectionMode" not in m.group(1) else "") + '} from "@xyflow/react";',
    content
)

# Add connectionMode={ConnectionMode.Loose} to ReactFlow
content = content.replace("<ReactFlow\n            nodes={nodes}", "<ReactFlow\n            connectionMode={ConnectionMode.Loose}\n            nodes={nodes}")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
print("Added ConnectionMode.Loose")
