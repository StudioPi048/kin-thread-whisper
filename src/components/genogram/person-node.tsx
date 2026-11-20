import { personSymbol } from "./person-symbol";
import { memo, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, useStore, type NodeProps } from "@xyflow/react";
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
  display_full_name?: boolean;
  gender?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  is_deceased: boolean;
  is_proband: boolean;
  notes?: string | null;
  relationship_to_proband?: string | null;
  connecting?: boolean;
  connectionOrigin?: boolean;
  onChooseConnection?: () => void;
  onQuickAdd?: (relativeType: string) => void;
  [key: string]: unknown;
}

/**
 * Nó do genossociograma — convenção internacional:
 *  □ quadrado   = masculino  (borda ameixa)
 *  ○ círculo    = feminino   (borda lavanda)
 *  △ triângulo  = aborto
 *  ◇ losango    = não-binário / desconhecido (borda dourada)
 *  Traço superior = pessoa falecida (Psicogenealogia Viva)
 *
 * Foco: LEGIBILIDADE. Nome e datas sempre em primeiro plano, com fundo
 * sólido; o símbolo é a moldura, nunca cobre o texto. Cliente destacado
 * por moldura ameixa e badge — sem escala exagerada.
 */
function PersonNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const zoom = useStore((store) => store.transform[2]);
  const overview = zoom < 0.72;
  const updateHandles = useUpdateNodeInternals();
  useEffect(() => updateHandles(id), [d.connecting, id, updateHandles]);
  const gender = personSymbol(d);
  const isMale = gender === "masculino";
  const isFemale = gender === "feminino";
  const isAbortion = gender === "aborto";
  const isDiamond = !isMale && !isFemale && !isAbortion;

  const shapeSize = d.is_proband ? 84 : 76;

  const borderColor = isMale ? "border-forest" : isFemale ? "border-forest" : "border-gold";

  const displayName = (!d.display_full_name && d.preferred_name) || d.full_name || "—";
  // Nome em duas linhas se necessário, sem cortar — o container é largo.
  const dates = personDatesLabel(d.birth_date, d.death_date);

  return (
    <div
      className={cn("relative flex flex-col items-center group", d.is_proband && "z-20")}
      data-connect-source={d.connectionOrigin || undefined}
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
        {d.onQuickAdd && !d.connecting && (
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

        {/* Sinal de falecimento — Manual da Psicogenealogia, p. 164 */}
        {(d.is_deceased || d.death_date) && (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 100 100"
          >
            <line
              x1="14"
              y1="24"
              x2="86"
              y2="24"
              stroke="var(--graphite)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
        {d.connecting && (
          <>
            <Handle
              id="link-out"
              type="source"
              position={Position.Right}
              className="geno-link-handle"
              title="Arraste para conectar"
            />
            <Handle
              id="link-in"
              type="target"
              position={Position.Left}
              className="geno-link-handle"
              title="Solte a conexão aqui"
            />
          </>
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

      <div
        className="atlas-person-info"
        style={overview ? { minHeight: 42, paddingInline: 5 } : undefined}
      >
        {d.connecting && (
          <button
            type="button"
            className="nodrag nopan absolute inset-0 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-forest"
            aria-label={`Escolher ${displayName} para vínculo`}
            aria-pressed={d.connectionOrigin}
            onClick={(event) => {
              event.stopPropagation();
              d.onChooseConnection?.();
            }}
          />
        )}
        <p
          className={cn(
            "font-semibold leading-tight",
            overview ? "w-full truncate" : "break-words",
          )}
          style={{ fontSize: overview ? Math.min(44, 14 / Math.max(zoom, 0.15)) : 16 }}
          title={[d.full_name || displayName, d.relationship_to_proband, dates]
            .filter(Boolean)
            .join(" · ")}
        >
          {displayName}
        </p>
        {!overview && dates && <p className="atlas-person-dates tabular-nums">{dates}</p>}
        {!overview && d.is_proband && <span className="text-xs text-bronze">Consultante</span>}
      </div>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
