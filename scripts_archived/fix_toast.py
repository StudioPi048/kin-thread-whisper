with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

content = content.replace(
    """toast({ title: "Vínculo removido", description: "O vínculo foi excluído." });""",
    """toast.success("Vínculo removido");"""
)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)
