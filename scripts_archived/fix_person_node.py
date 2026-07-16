import re

with open("src/components/genogram/person-node.tsx", "r") as f:
    content = f.read()

# Replace handles to have explicit ids
content = content.replace(
    '<Handle\n        type="target"\n        position={Position.Top}',
    '<Handle\n        id="top"\n        type="target"\n        position={Position.Top}'
)

content = content.replace(
    '<Handle\n        type="source"\n        position={Position.Bottom}',
    '<Handle\n        id="bottom"\n        type="source"\n        position={Position.Bottom}'
)

with open("src/components/genogram/person-node.tsx", "w") as f:
    f.write(content)

print("PersonNode handles fixed!")
