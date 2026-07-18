/**
 * DocumentHeader — Cabeçalho de dossiê (Etapa 4: presença de arquivo)
 *
 * Cada página interna abre com uma "folha de dossiê": painel de papel com
 * grão, lombada de bronze à esquerda, número de registro no alto e o selo
 * genealógico em marca-d'água sangrando pela borda direita. A régua dupla
 * fecha o cabeçalho como um documento carimbado.
 *
 * API inalterada — todas as telas herdam o novo visual sem mudança própria.
 */
import React from "react";
import { GenealogicalMark } from "@/components/ui/narrative-connector";

export interface DocumentHeaderProps {
  breadcrumb: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function DocumentHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  children,
}: DocumentHeaderProps) {
  return (
    <div className="px-4 pt-5 pb-6 sm:px-6 sm:pt-6">
      <div className="container-liz px-0">
        <div className="relative overflow-hidden rounded-[18px] border border-material-border bg-surface-manuscript shadow-dossier">
          {/* Lombada de bronze à esquerda */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-material-bronze via-material-bronze/70 to-material-bronze/30"
          />
          {/* Grão de papel */}
          <span aria-hidden className="texture-paper pointer-events-none absolute inset-0" />
          {/* Selo genealógico — marca-d'água sangrando pela borda direita */}
          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 -right-6 hidden opacity-[0.06] sm:block"
          >
            <GenealogicalMark size={168} opacity={1} color="var(--material-bronze)" />
          </span>

          <div className="relative px-6 pt-5 pb-6 sm:px-9 sm:pt-6 sm:pb-7">
            {/* Linha de registro: eyebrow + assinatura do arquivo */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 font-sans text-[10px] font-bold tracking-[0.22em] text-material-bronze uppercase">
                <span
                  aria-hidden
                  className="inline-block size-1.5 rotate-45 bg-material-bronze/80"
                />
                Instituto Liz / {breadcrumb}
              </p>
              <span className="hidden font-sans text-[9px] font-bold tracking-[0.24em] text-warm-gray uppercase sm:inline">
                Arquivo vivo
              </span>
            </div>

            {/* Título + ações */}
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="min-w-0 space-y-2">
                <div className="font-serif text-4xl leading-[1.05] font-bold tracking-tight text-balance text-ink md:text-[3.25rem]">
                  {title}
                </div>
                {subtitle && (
                  <div className="mt-2 font-serif text-lg text-ink/60 italic">{subtitle}</div>
                )}
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>

            {/* Régua dupla de fechamento — documento carimbado */}
            <div aria-hidden className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-material-bronze/45 via-material-border to-transparent" />
              <GenealogicalMark size={16} opacity={0.5} />
              <span className="h-px w-16 bg-material-border" />
            </div>
          </div>

          {children && <div className="relative px-6 pb-6 sm:px-9">{children}</div>}
        </div>
      </div>
    </div>
  );
}
