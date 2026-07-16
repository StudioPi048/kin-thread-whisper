import re

with open("src/routes/index.tsx", "r") as f:
    content = f.read()

# 1. Header Hover color on 'Entrar'
content = content.replace(
    'e.currentTarget.style.color = "#D4AF37"',
    'e.currentTarget.style.color = "#846221"' # Darker gold
)

# 2. Pilares label opacity
# rgba(255,255,255,0.4) -> rgba(255,255,255,0.65)
content = content.replace(
    'color: "rgba(255,255,255,0.4)"',
    'color: "rgba(255,255,255,0.65)"'
)
# color: "rgba(255,255,255,0.7)" -> rgba(255,255,255,0.85) just in case
content = content.replace(
    'color: "rgba(255,255,255,0.7)"',
    'color: "rgba(255,255,255,0.85)"'
)

# 3. Gestão Subtítulo
# color: "#8B7355" on #F5F0E8
content = content.replace(
    'color: "#8B7355"',
    'color: "#6B563D"' # Darker brown
)

# 4. Gestão Ênfase e Ícones
# color: "#C8A640" on #F5F0E8
content = content.replace(
    'color: "#C8A640"',
    'color: "#846221"' # Darker gold
)

# 5. Quote Autor
# rgba(59,47,31,0.5) on #FCF9F4
content = content.replace(
    'color: "rgba(59,47,31,0.5)"',
    'color: "rgba(59,47,31,0.7)"' # 70% opacity
)

# 6. Footer Sub-rodapé
# rgba(255,255,255,0.35) on #1B211A
content = content.replace(
    'color: "rgba(255,255,255,0.35)"',
    'color: "rgba(255,255,255,0.65)"'
)

with open("src/routes/index.tsx", "w") as f:
    f.write(content)

