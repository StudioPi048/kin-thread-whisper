import re
import os

replacements = {
    r"bg-\[\#151A15\]": "bg-card",
    r"bg-\[\#1B211A\]": "bg-archive-doc",
    r"text-\[\#D4AF37\]": "text-gold",
    r"bg-\[\#D4AF37\]": "bg-gold",
    r"border-\[\#D4AF37\]": "border-gold",
    r"border-l-\[\#D4AF37\]": "border-l-gold",
    r"text-\[\#1B211A\]": "text-archive-doc",
    r"border-white/10": "border-border",
    r"border-black/20": "border-border/60",
    r"container-liz": "container-archive",
    r"text-white/70": "text-muted-foreground",
    r"text-white/60": "text-muted-foreground",
    r"text-white/50": "text-muted-foreground",
    r"text-white/40": "text-muted-foreground",
    r"text-white/30": "text-muted-foreground/50",
    r"text-white/20": "text-muted-foreground/30",
    r"bg-white/5": "bg-muted",
    r"bg-white/10": "bg-muted/70",
    r"text-white": "text-foreground",
}

files_to_process = [
    "src/routes/_authenticated.app.agenda.tsx",
    "src/routes/_authenticated.app.genossociogramas.tsx",
    "src/routes/_authenticated.app.linha-do-tempo.tsx",
]

for file_path in files_to_process:
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            content = f.read()
        
        for old, new in replacements.items():
            content = re.sub(old, new, content)
            
        with open(file_path, "w") as f:
            f.write(content)
        print(f"Processed {file_path}")

print("Done.")
