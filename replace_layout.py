import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

with open("/Users/pietrobaccin/.gemini/antigravity/brain/6248c1b5-1eaa-4f56-96a7-f71e3a080cf1/scratch/tree_layout.tsx", "r") as f:
    scratch = f.read()

# Extract just the getLayoutedElements function from scratch
match = re.search(r"export function getLayoutedElements.*?^}", scratch, re.DOTALL | re.MULTILINE)
if not match:
    print("Could not find function in scratch!")
    exit(1)

new_func = match.group(0).replace("export function getLayoutedElements", "function getLayoutedElements")

# Find the old function in the original file
old_match = re.search(r"function getLayoutedElements\(nodes: Node\[\], edges: Edge\[\], probandId\?: string\) \{.*?^}", content, re.DOTALL | re.MULTILINE)
if not old_match:
    print("Could not find old function in original file!")
    exit(1)

new_content = content[:old_match.start()] + new_func + content[old_match.end():]

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(new_content)

print("Replacement successful!")
