import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# 1. Remove the previously inserted handleQuickAdd
content = re.sub(r'  const handleQuickAdd = \(personId: string, relativeType: string\) => \{.*?\n  \};\n', '', content, flags=re.DOTALL)

# 2. Insert handleQuickAdd as a regular function right at the beginning of GenogramCanvasInner
handle_quick_add = """
  function handleQuickAdd(personId: string, relativeType: string) {
    const person = query.data?.persons.find((p) => p.id === personId);
    if (!person) return;
    
    let newRel = relativeType;
    if (!person.is_proband && person.relationship_to_proband) {
      newRel = `${relativeType} do ${person.relationship_to_proband}`;
      // Clean up string like "do mae" -> "da mae"
      newRel = newRel.replace(/do mãe/gi, "da mãe").replace(/do tia/gi, "da tia").replace(/do avó/gi, "da avó").replace(/do bisavó/gi, "da bisavó");
    }
    
    setDefaultRelationship(newRel);
    setCreatingPerson(true);
  }
"""
content = content.replace("  const rfInstance = useReactFlow();", "  const rfInstance = useReactFlow();\n" + handle_quick_add)

with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Canvas fixed!")
