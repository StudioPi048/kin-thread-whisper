import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

content = re.sub(r"const GENERATION_GAP = \d+;", "const GENERATION_GAP = 250;", content)
content = re.sub(r"const HORIZONTAL_STEP = NODE_W \+ \d+;", "const HORIZONTAL_STEP = NODE_W + 10;", content)
content = re.sub(r"const FAMILY_GAP = \d+;", "const FAMILY_GAP = 40;", content)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Layout compacted!")
