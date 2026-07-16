import re

with open("src/routes/_authenticated.app.biblioteca.tsx", "r") as f:
    content = f.read()

# The data starts at "// BIBLIOTECA AUTORAL" and ends at "// COMPONENT"
start_marker = "// ─────────────────────────────────────────────────────────────\n// BIBLIOTECA AUTORAL"
end_marker = "// ─────────────────────────────────────────────────────────────\n// COMPONENT"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    data_content = content[start_idx:end_idx]
    
    # Also get imports
    imports = """import { Feather, Ghost, HeartCrack, Link2, Target, Fingerprint, Building2, UserMinus, Anchor, Users, Baby, Lock, Dna, Scale, Clock } from "lucide-react";
import leticiaAsset from "@/assets/leticia-baccin.png.asset.json";
"""
    
    with open("src/lib/biblioteca-data.ts", "w") as out:
        out.write(imports + "\n" + data_content)
        
    print("Data extracted.")
else:
    print("Markers not found.")
