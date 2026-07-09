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
import { personYears } from "@/lib/genogram";
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
  const rawGender = (d.gender || "").toLowerCase().trim();
  const rel = (d.relationship_to_proband || "").toLowerCase();

  const rawName = (d.full_name || "").toLowerCase().trim();
  const rawPref = (d.preferred_name || "").toLowerCase().trim();

  let gender = "desconhecido";
  if (
    rawGender.includes("masculino") ||
    rawGender === "m" ||
    rawGender === "homem" ||
    rel.match(/pai|tio|avô|bisavô|filho|irmão|irmao/)
  ) {
    gender = "masculino";
  } else if (
    rawGender.includes("feminino") ||
    rawGender === "f" ||
    rawGender === "mulher" ||
    rel.match(/mãe|mae|tia|avó|avo|bisavó|filha|irmã|irma/)
  ) {
    gender = "feminino";
  }
  
  if (rawGender.includes("aborto") || rawName.includes("aborto") || rawPref.includes("aborto")) {
    gender = "aborto";
  }

  const isMale = gender === "masculino";
  const isFemale = gender === "feminino";
  const isAbortion = gender === "aborto";
  const isDiamond = !isMale && !isFemale && !isAbortion;

  const shapeSize = d.is_proband ? 84 : 76;

  const borderColor = isMale ? "border-mahogany" : isFemale ? "border-forest" : "border-gold";

  const displayName = d.preferred_name || d.full_name || "—";
  // Nome em duas linhas se necessário, sem cortar — o container é largo.
  const years = personYears(d.birth_date, d.death_date);

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
              "size-full bg-[#FAF8F5] transition-all",
              "border-2",
              borderColor,
              isMale && "rounded-2xl",
              isFemale && "rounded-full",
              isDiamond && "rotate-45 rounded-2xl",
              d.is_proband && "shadow-[0_0_0_3px_var(--color-mahogany)] ring-1 ring-mahogany/30",
              selected && "ring-2 ring-forest ring-offset-2 ring-offset-background",
            )}
          />
        )}

        {/* Linha diagonal de falecido — Convenção McGoldrick/Gerson */}
        {d.is_deceased && (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
          >
            <line 
              x1="15" y1="85" x2="85" y2="15" 
              stroke="#3A3A3A" 
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

      {/* ── CARD DE INFORMAÇÃO — Independente e flutuante ── */}
      <div
        className={cn(
          "mt-3 w-[140px] min-h-[72px] h-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-sm px-2 py-1.5 flex flex-col justify-center items-center text-center select-none z-10 transition-all pb-2",
          d.is_proband &&
            "border-mahogany bg-white dark:bg-zinc-900 shadow-[0_0_0_1px_rgba(110,20,60,0.15)]",
          selected && "ring-1 ring-forest border-forest",
        )}
      >
        <p
          className={cn(
            "font-sans font-bold text-foreground leading-[1.2] break-words",
            d.is_proband ? "text-[16px]" : "text-[14px]",
          )}
        >
          {displayName}
        </p>
        {years ? (
          <p className="mt-0.5 text-[10.5px] font-bold text-ink/80 leading-tight tabular-nums">
            {years}
          </p>
        ) : (
          <div className="h-3.5" />
        )}
        {d.is_proband && (
          <span className="mt-0.5 inline-block rounded bg-mahogany px-1.5 py-0.2 text-[8px] font-black uppercase tracking-[0.1em] text-white">
            Paciente
          </span>
        )}
      </div>

      {/* Visual drag handle to connect people */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center pointer-events-auto">
        <Handle
          id="visual-connect"
          type="source"
          position={Position.Bottom}
          className="!w-7 !h-7 !bg-mahogany !border-2 !border-white flex items-center justify-center cursor-crosshair !rounded-full shadow-lg z-50 !relative !transform-none !left-0 !top-0"
        >
          <Plus className="w-4 h-4 text-white pointer-events-none" />
        </Handle>
      </div>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
