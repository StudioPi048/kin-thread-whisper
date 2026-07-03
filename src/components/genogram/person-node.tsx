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
 * Nó do genossociograma — convenção internacional:
 *  □ quadrado  = masculino (borda ameixa)
 *  ○ círculo   = feminino  (borda lavanda)
 *  ⬡ losango   = não-binário / outro (borda dourada)
 *  ✕ atravessando = falecido
 *  Borda dupla lavanda = paciente-índice (proband)
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const gender = d.gender ?? "desconhecido";

  const shapeClass =
    gender === "masculino"
      ? "rounded-none"
      : gender === "feminino"
        ? "rounded-full"
        : "rotate-45 rounded-sm";

  const borderColor =
    gender === "masculino"
      ? "border-plum"
      : gender === "feminino"
        ? "border-lavender"
        : "border-gold";

  const symbolColor =
    gender === "masculino"
      ? "text-plum"
      : gender === "feminino"
        ? "text-lavender"
        : "text-gold";

  const displayName = d.preferred_name || d.full_name;
  const years = personYears(d.birth_date, d.death_date);

  return (
    <div className="relative flex flex-col items-center" style={{ userSelect: "none" }}>
      {/* Handle topo */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-3 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />

      {/* Nó */}
      <div
        className={cn(
          "relative flex size-24 items-center justify-center border-[3px] bg-card font-serif text-3xl transition-all duration-150",
          shapeClass,
          borderColor,
          d.is_proband
            ? "shadow-[0_0_0_4px_white,0_0_0_7px_var(--color-lavender)]"
            : "shadow-sm",
          selected && "scale-105 ring-3 ring-lavender ring-offset-3 ring-offset-background",
        )}
      >
        {/* Símbolo de gênero */}
        <span
          className={cn(
            "text-[26px] font-light leading-none",
            symbolColor,
            (gender === "nao_binario" || gender === "outro") ? "-rotate-45" : "",
          )}
        >
          {genderSymbol(gender)}
        </span>

        {/* Cruz de falecido */}
        {d.is_deceased && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-5xl leading-none text-destructive/70",
              (gender === "nao_binario" || gender === "outro") ? "-rotate-45" : "",
            )}
          >
            ✕
          </span>
        )}
      </div>

      {/* Nome e anos */}
      <div className="mt-2.5 max-w-[160px] text-center">
        <p className="truncate font-sans text-[13px] font-bold text-foreground leading-tight">
          {displayName}
        </p>
        {years && (
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{years}</p>
        )}
        {d.is_proband && (
          <span className="mt-1 inline-block rounded bg-lavender/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lavender">
            Paciente
          </span>
        )}
      </div>

      {/* Handle base */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-3 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle esquerdo */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!size-3 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle direito */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!size-3 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
