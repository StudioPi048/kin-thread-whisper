import re

with open('src/components/genogram/genogram-canvas.tsx', 'r') as f:
    content = f.read()

# Fix createLeafBlock unionCenter
content = re.sub(
    r'unionCenter = \(topNodes\.indexOf\(husband\) \* HORIZONTAL_STEP \+ topNodes\.indexOf\(wife\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP\) / 2;',
    r'unionCenter = (topNodes.indexOf(husband) * HORIZONTAL_STEP + topNodes.indexOf(wife) * HORIZONTAL_STEP + NODE_W) / 2;',
    content
)
content = re.sub(
    r'unionCenter = topNodes\.indexOf\(husband\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP / 2;',
    r'unionCenter = topNodes.indexOf(husband) * HORIZONTAL_STEP + NODE_W / 2;',
    content
)
content = re.sub(
    r'unionCenter = topNodes\.indexOf\(wife\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP / 2;',
    r'unionCenter = topNodes.indexOf(wife) * HORIZONTAL_STEP + NODE_W / 2;',
    content
)

# Fix createLeafBlock childLocalCenter
content = re.sub(
    r'childLocalCenter = bottomNodes\.indexOf\(child\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP / 2;',
    r'childLocalCenter = bottomNodes.indexOf(child) * HORIZONTAL_STEP + NODE_W / 2;',
    content
)
content = re.sub(
    r'childLocalCenter = isHusbandSide \? bottomWidth - HORIZONTAL_STEP / 2 : HORIZONTAL_STEP / 2;',
    r'childLocalCenter = isHusbandSide ? bottomWidth - HORIZONTAL_STEP + NODE_W / 2 : NODE_W / 2;',
    content
)

# Fix mergeBlocks childLocalCenter
content = re.sub(
    r'childLocalCenter = bottomNodes\.indexOf\(childTarget\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP / 2;',
    r'childLocalCenter = bottomNodes.indexOf(childTarget) * HORIZONTAL_STEP + NODE_W / 2;',
    content
)
content = re.sub(
    r'childLocalCenter = isHusbandSide \? bottomWidth - HORIZONTAL_STEP / 2 : HORIZONTAL_STEP / 2;',
    r'childLocalCenter = isHusbandSide ? bottomWidth - HORIZONTAL_STEP + NODE_W / 2 : NODE_W / 2;',
    content
)

# Fix mergeBlocks cTargetX
content = re.sub(
    r'cTargetX = bottomOffset \+ bottomNodes\.indexOf\(childTarget\) \* HORIZONTAL_STEP \+ HORIZONTAL_STEP / 2;',
    r'cTargetX = bottomOffset + bottomNodes.indexOf(childTarget) * HORIZONTAL_STEP + NODE_W / 2;',
    content
)

with open('src/components/genogram/genogram-canvas.tsx', 'w') as f:
    f.write(content)

print("Done")
