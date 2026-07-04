import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
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

  let gender = "desconhecido";
  if (rawGender.includes("masculino") || rawGender === "m" || rawGender === "homem" || rel.match(/pai|tio|avô|bisavô|filho|irmão|irmao/)) {
    gender = "masculino";
  } else if (rawGender.includes("feminino") || rawGender === "f" || rawGender === "mulher" || rel.match(/mãe|mae|tia|avó|avo|bisavó|filha|irmã|irma/)) {
    gender = "feminino";
  } else if (rawGender.includes("aborto")) {
    gender = "aborto";
  }

  const isMale = gender === "masculino";
  const isFemale = gender === "feminino";
  const isAbortion = gender === "aborto";
  const isDiamond = !isMale && !isFemale && !isAbortion;

  const shapeSize = d.is_proband ? 84 : 76;

  const borderColor = isMale
    ? "border-plum"
    : isFemale
      ? "border-lavender"
      : "border-gold";

  const displayName = d.preferred_name || d.full_name || "—";
  // Nome em duas linhas se necessário, sem cortar — o container é largo.
  const years = personYears(d.birth_date, d.death_date);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center",
        d.is_proband && "z-20",
      )}
      style={{ userSelect: "none", width: 160 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />

      {/* ── SHAPE ─────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: shapeSize, height: shapeSize }}
      >
        {isAbortion ? (
          <svg viewBox="0 0 100 100" className="size-full" fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth="6" strokeLinejoin="round">
            <polygon points="50,8 92,88 8,88" />
          </svg>
        ) : (
          <div
            className={cn(
              "size-full bg-card transition-all",
              "border-[3.5px]",
              borderColor,
              isMale && "rounded-sm",
              isFemale && "rounded-full",
              isDiamond && "rotate-45 rounded-sm",
              d.is_proband && "shadow-[0_0_0_3px_var(--color-plum)] ring-1 ring-plum/30",
              selected && "ring-2 ring-lavender ring-offset-2 ring-offset-background",
            )}
          />
        )}

        {/* Cruz de falecido — SEMPRE contida no shape, nunca sobre o label */}
        {d.is_deceased && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-red-500 font-black leading-none"
            style={{ fontSize: shapeSize * 0.75 }}
          >
            ✕
          </span>
        )}
      </div>

      {/* ── LABEL — Nome + datas com fundo SÓLIDO para legibilidade ── */}
      <div
        className={cn(
          "mt-2.5 w-full rounded-md border px-2 py-1.5 text-center shadow-sm",
          d.is_proband
            ? "border-plum/40 bg-white"
            : "border-border/60 bg-card",
        )}
      >
        <p
          className={cn(
            "font-sans font-bold text-foreground leading-tight break-words",
            d.is_proband ? "text-[15px]" : "text-[13px]",
          )}
        >
          {displayName}
        </p>
        {years && (
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground leading-snug tabular-nums">
            {years}
          </p>
        )}
        {d.is_proband && (
          <span className="mt-1.5 inline-block rounded bg-plum px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
            Paciente
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!size-2.5 !rounded-sm !border-2 !border-card !bg-lavender opacity-0"
      />

    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
