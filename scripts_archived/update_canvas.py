import re

with open("src/components/genogram/genogram-canvas.tsx", "r") as f:
    content = f.read()

# 1. Add defaultRelationship state
state_addition = """  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [defaultRelationship, setDefaultRelationship] = useState<string>("");"""
content = content.replace("  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);", state_addition)

# 2. Add handleQuickAdd function
handle_quick_add = """  const handleQuickAdd = (personId: string, relativeType: string) => {
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
  };
"""
# Insert it after useEffect
content = re.sub(r'  const onNodesChange: OnNodesChange<Node> = \(changes\) => \{', handle_quick_add + '\n  const onNodesChange: OnNodesChange<Node> = (changes) => {', content)

# 3. Add onQuickAdd to initialNodes mapping
mapping_addition = """        relationship_to_proband: p.relationship_to_proband,
        onQuickAdd: (relType: string) => handleQuickAdd(p.id, relType),"""
content = content.replace("        relationship_to_proband: p.relationship_to_proband,", mapping_addition)

# 4. Pass defaultRelationship to PersonFormDialog
form_dialog = """      <PersonFormDialog
        open={creatingPerson || !!editingPerson}
        onOpenChange={(open) => {
          if (!open) {
            setCreatingPerson(false);
            setEditingPerson(null);
            setDefaultRelationship("");
          }
        }}
        clientId={clientId}
        editing={editingPerson}
        defaultRelationship={defaultRelationship}
      />"""
content = re.sub(r'<PersonFormDialog\s+open=\{creatingPerson \|\| !!editingPerson\}\s+onOpenChange=\{\(open\) => \{\s+if \(!open\) \{\s+setCreatingPerson\(false\);\s+setEditingPerson\(null\);\s+\}\s+\}\}\s+clientId=\{clientId\}\s+editing=\{editingPerson\}\s+/>', form_dialog, content)

# 5. Fix EmptyCanvas
content = re.sub(r'onOpenChange=\{setCreatingPerson\}', 'onOpenChange={(open) => { setCreatingPerson(open); if (!open) setDefaultRelationship(""); }}', content)


with open("src/components/genogram/genogram-canvas.tsx", "w") as f:
    f.write(content)

print("Canvas updated")
