import re

with open("src/components/genogram/person-node.tsx", "r") as f:
    content = f.read()

# Add imports
imports = """import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";"""
content = re.sub(r'import \{ memo \} from "react";\nimport \{ Handle, Position, type NodeProps \} from "@xyflow/react";', imports, content)

# Add onQuickAdd to interface
interface_addition = """  relationship_to_proband?: string | null;
  onQuickAdd?: (relativeType: string) => void;"""
content = content.replace("  relationship_to_proband?: string | null;", interface_addition)

# Add the Dropdown Menu inside the component
# I will put it absolute inside the main container div
# First find the return statement
jsx_start = """    <div
      className={cn(
        "relative flex flex-col items-center justify-start rounded-xl p-2 transition-all group",
        selected ? "ring-2 ring-gold shadow-lg" : "hover:shadow-md",
      )}
      style={{ userSelect: "none", width: 160 }}
    >
      {/* Quick Add Button */}
      {d.onQuickAdd && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-background shadow-md opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100 z-10"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 font-serif">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Pai"); }}>Adicionar Pai</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Mãe"); }}>Adicionar Mãe</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Irmão"); }}>Adicionar Irmão(ã)</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Filho"); }}>Adicionar Filho(a)</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Cônjuge"); }}>Adicionar Cônjuge</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); d.onQuickAdd?.("Aborto"); }}>Adicionar Aborto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
"""
content = content.replace('    <div\n      className={cn(\n        "relative flex flex-col items-center justify-start rounded-xl p-2 transition-all",\n        selected ? "ring-2 ring-gold shadow-lg" : "hover:shadow-md",\n      )}\n      style={{ userSelect: "none", width: 160 }}\n    >', jsx_start)


with open("src/components/genogram/person-node.tsx", "w") as f:
    f.write(content)

print("person-node.tsx updated")
