import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { genderSymbol, personYears } from "@/lib/genogram";
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
  [key: string]: unknown;
}

/**
 * Nó do genossociograma. A forma segue convenção:
 *  - quadrado = masculino, círculo = feminino, losango = não-binário
 *  - contorno duplo = paciente-índice (proband)
 *  - "×" atravessando = falecido
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const gender = d.gender ?? "desconhecido";
  const shapeClass =
    gender === "masculino"
      ? "rounded-none"
      : gender === "feminino"
        ? "rounded-full"
        : "rotate-45";

  const displayName = d.preferred_name || d.full_name;
  const years = personYears(d.birth_date, d.death_date);

  return (
    <div className="relative flex flex-col items-center">
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-none !bg-lilac"
      />
      <div
        className={cn(
          "relative flex size-20 items-center justify-center border-[3px] bg-card font-serif text-3xl text-primary transition-colors",
          shapeClass,
          d.is_proband ? "border-gold shadow-[0_0_0_3px_hsl(var(--card))_inset]" : "border-primary/70",
          selected && "ring-2 ring-lilac ring-offset-2 ring-offset-background",
        )}
        style={
          d.is_proband
            ? { boxShadow: "inset 0 0 0 3px var(--color-card)" }
            : undefined
        }
      >
        <span className={cn(gender === "nao_binario" || gender === "outro" ? "-rotate-45" : "")}>
          {genderSymbol(gender)}
        </span>
        {d.is_deceased && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-5xl leading-none text-destructive/80",
              gender === "nao_binario" || gender === "outro" ? "-rotate-45" : "",
            )}
          >
            ✕
          </span>
        )}
      </div>
      <div className="mt-2 max-w-[140px] text-center">
        <p className="truncate font-serif text-sm text-foreground">{displayName}</p>
        {years && <p className="text-[10px] text-muted-foreground">{years}</p>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-none !bg-lilac"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!size-2 !border-none !bg-lilac"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!size-2 !border-none !bg-lilac"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
