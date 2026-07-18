/**
 * DocumentHeader — Cabeçalho de página (base branco/cinza profissional)
 *
 * Cabeçalho limpo em cartão branco com um filete de bronze discreto como
 * único acento de marca. Sem marca-d'água, sem grão de fundo. A genealogia
 * vive nos renders e nos acentos, não numa lavagem de papel.
 *
 * API inalterada — todas as telas herdam o novo visual sem mudança própria.
 */
import React from "react";

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
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-document shadow-surface">
          {/* Filete de bronze — único acento de marca */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-material-bronze via-material-bronze/60 to-material-bronze/20"
          />

          <div className="relative px-6 py-6 sm:px-9 sm:py-7">
            {/* Eyebrow */}
            <p className="mb-3 flex items-center gap-2 font-sans text-[10px] font-bold tracking-[0.22em] text-material-bronze uppercase">
              <span aria-hidden className="inline-block size-1.5 rotate-45 bg-material-bronze/80" />
              Instituto Liz / {breadcrumb}
            </p>

            {/* Título + ações */}
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="min-w-0 space-y-2">
                <div className="font-serif text-[2.1rem] leading-[1.08] font-bold tracking-tight text-balance text-ink sm:text-4xl md:text-[2.9rem]">
                  {title}
                </div>
                {subtitle && (
                  <div className="font-serif text-lg text-ink-soft italic">{subtitle}</div>
                )}
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>
          </div>

          {children && (
            <div className="relative border-t border-border/70 px-6 py-5 sm:px-9">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
