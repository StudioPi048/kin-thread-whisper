import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# find all usages of childSiblings
lines = content.split('\n')
for i, line in enumerate(lines):
    if "childSiblings" in line:
        print(f"{i+1}: {line}")

