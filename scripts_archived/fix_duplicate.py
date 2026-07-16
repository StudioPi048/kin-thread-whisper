import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# Let's find the duplicate block and remove the old one.
match = re.search(r"// Recreate union nodes exactly as before", content)
match2 = re.search(r"// Recreate union nodes exactly as before", content[match.end():])

if match2:
    print("Found duplicate!")
    # The first one is the new block I injected (because I replaced using a specific end bound which might not have been what I thought)
    # Actually, let's just do it manually with sed or a python script that finds `return { nodes: layoutedNodes, edges: [...otherEdges, ...finalEdges] };`
    # Wait, both blocks will end with this return statement!
else:
    print("No duplicate string found, something else went wrong.")
