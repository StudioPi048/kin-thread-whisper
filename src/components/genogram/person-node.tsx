import { personSymbol } from "./person-symbol";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { personDatesLabel } from "@/lib/genogram";
import { cn } from "@/lib/utils";

export interface PersonNodeData {
  full_name: string;
  preferred_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  is_deceased: boolean;
  is_proband: boolean;
  notes?: string | null;
  relationship_to_proband?: string | null;
  onQuickAdd?: (relativeType: string) => void;
  [key: string]: unknown;
}

/**
 * Nó do genossociograma — convenção internacional:
 *  □ quadrado   = masculino  (borda ameixa)
 *  ○ círculo    = feminino   (borda lavanda)
 *  △ triângulo  = aborto
 *  ◇ losango    = não-binário / desconhecido (borda dourada)
 *  ✕ diagonal   = pessoa falecida
 *
 * Foco: LEGIBILIDADE. Nome e datas sempre em primeiro plano, com fundo
 * sólido; o símbolo é a moldura, nunca cobre o texto. Cliente destacado
 * por moldura ameixa e badge — sem escala exagerada.
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const gender = personSymbol(d);
  const isMale = gender === "masculino";
  const isFemale = gender === "feminino";
  const isAbortion = gender === "aborto";
  const isDiamond = !isMale && !isFemale && !isAbortion;

  const shapeSize = d.is_proband ? 84 : 76;

  const borderColor = isMale ? "border-forest" : isFemale ? "border-forest" : "border-gold";

  const displayName = d.preferred_name || d.full_name || "—";
  // Nome em duas linhas se necessário, sem cortar — o container é largo.
  const dates = personDatesLabel(d.birth_date, d.death_date);

  return (
    <div
      className={cn("relative flex flex-col items-center group", d.is_proband && "z-20")}
      style={{ userSelect: "none", width: 140 }}
    >
      {/* ── SHAPE ─────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: shapeSize, height: shapeSize }}
      >
        {isAbortion ? (
          <svg
            viewBox="0 0 100 100"
            className="size-full"
            fill="var(--color-card)"
            stroke="var(--color-foreground)"
            strokeWidth="6"
            strokeLinejoin="round"
          >
            <polygon points="50,8 92,88 8,88" />
          </svg>
        ) : (
          <div
            className={cn(
              "size-full transition-colors",
              "border-2",
              borderColor,
              isFemale ? "bg-gold/40" : "bg-forest/30",
              isMale && "rounded-none",
              isFemale && "rounded-full",
              isDiamond && "rotate-45 rounded-none",
              d.is_proband && "outline-2 outline-offset-4 outline-gold",
              selected && "ring-2 ring-forest ring-offset-2 ring-offset-background",
            )}
          />
        )}

        {/* Adicionar parente rápido — visível ao selecionar (touch) ou passar o mouse (hover) */}
        {d.onQuickAdd && (
          <div
            className={cn(
              "absolute -top-2 -right-2 z-40 transition-opacity",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="forest"
                  className="size-7 rounded-full border-2 border-white shadow-dossier [&_svg]:size-3.5"
                  title="Adicionar parente"
                  aria-label="Adicionar parente"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => d.onQuickAdd?.("Pai")}>
                  Adicionar pai
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => d.onQuickAdd?.("Mãe")}>
                  Adicionar mãe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => d.onQuickAdd?.("Filho(a)")}>
                  Adicionar filho(a)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => d.onQuickAdd?.("Irmã(o)")}>
                  Adicionar irmã(o)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Linha diagonal de falecido — Convenção McGoldrick/Gerson */}
        {d.is_deceased && (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
          >
            <line
              x1="15"
              y1="85"
              x2="85"
              y2="15"
              stroke="var(--graphite)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
        {/* Handles fixados NA FORMA com 6px de respiro (stub) */}
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          style={{ top: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          style={{ top: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="top-target"
          type="target"
          position={Position.Top}
          style={{ top: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          style={{ bottom: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="bottom-target"
          type="target"
          position={Position.Bottom}
          style={{ bottom: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="left"
          type="target"
          position={Position.Left}
          style={{ left: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          style={{ left: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          style={{ right: -6 }}
          className="opacity-0 pointer-events-none"
        />
        <Handle
          id="right"
          type="target"
          position={Position.Right}
          style={{ right: -6 }}
          className="opacity-0 pointer-events-none"
        />
      </div>

      <div className="atlas-person-info">
        <p className="text-sm font-semibold leading-tight break-words">{displayName}</p>
        {dates && <p className="atlas-person-dates tabular-nums">{dates}</p>}
        {d.is_proband && <span className="text-[10px] text-gold">Pessoa de referência</span>}
      </div>

      {/* Visual drag handle to connect people — visível ao selecionar (touch) ou hover (mouse) */}
      <div
        className={cn(
          "absolute -bottom-7 left-1/2 -translate-x-1/2 transition-opacity z-50 flex items-center justify-center pointer-events-auto",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Handle
          id="visual-connect"
          type="source"
          position={Position.Bottom}
          className="!w-7 !h-7 !bg-forest !border-2 !border-white flex items-center justify-center cursor-crosshair !rounded-full shadow-lg z-50 !relative !transform-none !left-0 !top-0"
        >
          <Plus className="w-4 h-4 text-white pointer-events-none" />
        </Handle>
      </div>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
