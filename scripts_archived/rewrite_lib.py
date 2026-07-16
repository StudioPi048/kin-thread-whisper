import re

with open("src/routes/_authenticated.app.biblioteca.tsx", "r") as f:
    content = f.read()

# Replace hardcoded colors with tailwind variables from Design System
replacements = {
    r"bg-\[\#151A15\]": "bg-card",
    r"bg-\[\#1B211A\]": "bg-archive-doc",
    r"text-\[\#D4AF37\]": "text-gold",
    r"bg-\[\#D4AF37\]": "bg-gold",
    r"border-\[\#D4AF37\]": "border-gold",
    r"border-l-\[\#D4AF37\]": "border-l-gold",
    r"text-\[\#1B211A\]": "text-archive-doc",
    r"container-liz": "container-archive",
    r"border-white/10": "border-border",
    r"border-black/20": "border-border/60",
    r"text-white": "text-foreground",
    r"text-white/70": "text-muted-foreground",
    r"text-white/60": "text-muted-foreground",
    r"text-white/50": "text-muted-foreground",
    r"text-white/30": "text-muted-foreground/50",
    r"bg-white/5": "bg-muted",
    r"bg-white/10": "bg-muted/70",
}

for old, new in replacements.items():
    content = re.sub(old, new, content)

with open("src/routes/_authenticated.app.biblioteca.tsx", "w") as f:
    f.write(content)

print("Replaced colors and containers.")
