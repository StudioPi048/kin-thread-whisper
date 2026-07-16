import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# find all calls to buildFamilyBlock
lines = content.split('\n')
for i, line in enumerate(lines):
    if "buildFamilyBlock(" in line or "mergeBlocks(" in line:
        print(f"--- Line {i+1} ---")
        for j in range(i-2, i+15):
            if j < len(lines):
                print(lines[j])

