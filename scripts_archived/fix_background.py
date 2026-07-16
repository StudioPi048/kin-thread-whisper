with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

content = content.replace(
"""            <Background
              color="#d8d0ec"
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              style={{ opacity: 0.35 }}
            />""",
"""            <Background
              color="#d8d0ec"
              variant={BackgroundVariant.Lines}
              gap={40}
              size={1}
              style={{ opacity: 0.25 }}
            />""")

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
