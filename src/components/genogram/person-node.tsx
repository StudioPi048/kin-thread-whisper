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
 *  □ quadrado = masculino
 *  ○ círculo  = feminino
 *  ⬡ losango  = não-binário / outro
 *  ✕ atravessando = falecido
 *  Borda dupla dourada = paciente-índice (proband)
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const gender = d.gender ?? "desconhecido";

  // Formas geométricas por gênero — convenção PSIGENEALOgica
  const shapeClass =
    gender === "masculino"
      ? "rounded-none"          // □ quadrado
      : gender === "feminino"
        ? "rounded-full"        // ○ círculo
        : "rotate-45 rounded-sm"; // ⬡ losango

  const displayName = d.preferred_name || d.full_name;
  const years = personYears(d.birth_date, d.death_date);

  return (
    <div className="relative flex flex-col items-center" style={{ userSelect: "none" }}>
      {/* Handle topo (entrada de pais) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-3 !rounded-sm !border-2 !border-card !bg-gold opacity-0 transition-opacity hover:opacity-100"
      />

      {/* Nó principal */}
      <div
        className={cn(
          // Base: tamanho aumentado para 40+, borda grossa e clara
          "relative flex size-24 items-center justify-center border-[3px] bg-card font-serif text-3xl text-primary transition-all duration-150",
          shapeClass,
          // Paciente-índice: borda dupla dourada
          d.is_proband
            ? "border-gold shadow-[0_0_0_4px_white,0_0_0_7px_var(--color-gold)] shadow-gold/30"
            : "border-primary/80 shadow-sm",
          // Estado selecionado
          selected && "ring-3 ring-gold ring-offset-3 ring-offset-background scale-105",
        )}
      >
        {/* Símbolo de gênero */}
        <span
          className={cn(
            "text-[26px] font-light leading-none",
            (gender === "nao_binario" || gender === "outro") ? "-rotate-45" : "",
            gender === "masculino" ? "text-primary" : gender === "feminino" ? "text-forest" : "text-gold",
          )}
        >
          {genderSymbol(gender)}
        </span>

        {/* Cruz de falecido */}
        {d.is_deceased && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-5xl leading-none text-destructive/75",
              (gender === "nao_binario" || gender === "outro") ? "-rotate-45" : "",
            )}
          >
            ✕
          </span>
        )}
      </div>

      {/* Nome e anos */}
      <div className="mt-2.5 max-w-[160px] text-center">
        <p className="truncate font-sans text-[13px] font-semibold text-foreground leading-tight">
          {displayName}
        </p>
        {years && (
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {years}
          </p>
        )}
        {d.is_proband && (
          <span className="mt-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            Paciente
          </span>
        )}
      </div>

      {/* Handle base (saída de filhos) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-3 !rounded-sm !border-2 !border-card !bg-gold opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle esquerdo (cônjuge esquerdo) */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!size-3 !rounded-sm !border-2 !border-card !bg-gold opacity-0 transition-opacity hover:opacity-100"
      />
      {/* Handle direito (cônjuge direito) */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!size-3 !rounded-sm !border-2 !border-card !bg-gold opacity-0 transition-opacity hover:opacity-100"
      />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
