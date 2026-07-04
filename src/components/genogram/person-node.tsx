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
 *
 * Tamanho compacto: shape 72px + label até 56px = 128px total.
 * Compatível com NODE_H = 160 do layout Dagre (com margem de segurança).
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
    gender === "masculino" ? "text-plum" : gender === "feminino" ? "text-lavender" : "text-gold";

  const displayName = d.preferred_name || d.full_name;
  // Abreviar nomes longos: pega as duas primeiras palavras
  const shortName = displayName
    ? displayName.split(" ").slice(0, 2).join(" ")
    : "—";
  const years = personYears(d.birth_date, d.death_date);

  return (
    <div className="relative flex flex-col items-center" style={{ userSelect: "none", width: 100 }}>
      {/* Handle topo */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />

      {/* Shape principal — 72×72 px */}
      <div
        className={cn(
          "relative flex size-[72px] items-center justify-center border-[3px] bg-card font-serif transition-all duration-150",
          shapeClass,
          borderColor,
          // Proband: destaque visual maior (cliente como centro)
          d.is_proband
            ? "shadow-[0_0_0_4px_white,0_0_0_8px_var(--color-plum)] scale-125 z-10"
            : "shadow-sm",
          selected && "scale-105 ring-2 ring-lavender ring-offset-2 ring-offset-background",
        )}
      >
        {/* Cruz de falecido */}
        {d.is_deceased && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-[44px] font-bold leading-none text-red-500",
              gender === "nao_binario" || gender === "outro" ? "-rotate-45" : "",
            )}
          >
            ✕
          </span>
        )}
      </div>

      {/* Label: nome + datas — área compacta de até 56px */}
      <div className="mt-1.5 max-w-[100px] text-center">
        <p className="truncate font-sans text-[11px] font-bold text-foreground leading-snug">
          {shortName}
        </p>
        {years && (
          <p className="mt-0.5 text-[10px] font-medium text-muted-foreground leading-snug">
            {years}
          </p>
        )}
        {d.is_proband && (
          <span className="mt-1 inline-block rounded bg-plum/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-plum">
            Cliente
          </span>
        )}
      </div>

      {/* Handle base */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle esquerdo */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle direito */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0 transition-opacity hover:opacity-100"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
