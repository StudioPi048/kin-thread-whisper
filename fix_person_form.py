import re

with open("src/components/genogram/person-form-dialog.tsx", "r") as f:
    content = f.read()

# Add to FormState
content = content.replace("  notes: string;\n}", "  notes: string;\n  relationship_to_proband: string;\n}")

# Add to empty
content = content.replace('  notes: "",\n};', '  notes: "",\n  relationship_to_proband: "",\n};')

# Add to mutation payload
payload_addition = """        life_events:
          form.life_events as unknown as Database["public"]["Tables"]["genogram_persons"]["Insert"]["life_events"],
        notes: form.notes.trim() || null,
        relationship_to_proband: form.relationship_to_proband.trim() || null,"""
content = re.sub(r'        life_events:[\s\S]*?notes: form\.notes\.trim\(\) \|\| null,', payload_addition, content)

with open("src/components/genogram/person-form-dialog.tsx", "w") as f:
    f.write(content)

print("PersonFormDialog fixed!")
