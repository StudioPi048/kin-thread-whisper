import React from "react";
import { ClinicalState } from "@/types/clinical";
import { cn } from "@/lib/utils";
import { Lock, Repeat, Link as LinkIcon } from "lucide-react";

interface ClinicalDocumentProps extends React.HTMLAttributes<HTMLDivElement> {
  grammar: ClinicalState;
  title?: string;
  children: React.ReactNode;
}

/**
 * Componente Infraestrutural da Gramática Visual (Fase 3.5A)
 * Este componente orquestra a renderização baseada na Máquina de Estados Clínicos.
 * Ainda NÃO possui efeitos visuais complexos ou animações, apenas organização estrutural
 * baseada em dados, garantindo o Princípio da Sobriedade Clínica.
 */
export function ClinicalDocument({
  grammar,
  title,
  children,
  className,
  ...props
}: ClinicalDocumentProps) {
  const { stage, intensities, temporalAnchor } = grammar;

  // Apenas extração de dados brutos para formar classes semânticas.
  // Nenhum CSS de animação é adicionado aqui ainda (Fase 3.5A).

  const isExcluded = intensities.exclusion > 0;
  const isSecret = intensities.secret > 0;

  return (
    <div
      className={cn(
        "relative rounded-sm border p-6 transition-all duration-300",
        // Lógica Estrutural Básica (Sem teatralização)
        isExcluded ? "opacity-40 grayscale" : "bg-white border-[#E5E2DC]",
        stage === "observada" ? "border-dashed" : "border-solid",
        className,
      )}
      {...props}
    >
      {/* 1. Indicadores de Topo (Metadados Estruturais) */}
      <div className="flex items-center justify-between mb-4">
        {/* Título e Estágio */}
        <div className="flex items-center gap-3">
          {title && <h3 className="font-serif font-bold text-lg text-ink">{title}</h3>}

          <span
            className={cn(
              "text-[10px] uppercase font-sans tracking-widest px-2 py-0.5 rounded-sm border",
              stage === "corroborada"
                ? "bg-forest/10 text-forest-mid border-forest/20 font-bold"
                : stage === "observada"
                  ? "bg-archive-old/50 text-ink/60 border-[#E5E2DC]"
                  : "bg-gray-50 text-gray-500 border-gray-200",
            )}
          >
            {stage}
          </span>
        </div>

        {/* Indicadores Clínicos Discretos (Sem animação) */}
        <div className="flex items-center gap-2 text-ink/40">
          {temporalAnchor && (
            <span className="text-xs font-sans border-b border-ink/20 pb-0.5">
              {temporalAnchor}
            </span>
          )}
          {isSecret && <Lock className="size-3" />}
          {intensities.repetition > 0 && <Repeat className="size-3" />}
          {intensities.loyalty > 0 && <LinkIcon className="size-3" />}
        </div>
      </div>

      {/* 2. Conteúdo Principal */}
      <div className="font-serif text-ink/80 text-[15px] leading-relaxed">
        {isSecret && stage !== "investigada" ? (
          <div className="italic text-ink/40 text-sm py-2">
            [Informação preservada. Requer investigação para expandir.]
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
