/**
 * DocumentHeader — Passo 2.8: Navegação Silenciosa
 *
 * Substitui os headers pesados (com fundos escuros e logos repetidas)
 * por um cabeçalho contextual unificado.
 *
 * Estrutura:
 * Instituto Liz / {breadcrumb}
 * {title}
 * ──────────────────────────────
 * (conteúdo)
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
    <div className="pt-8 pb-10">
      <div className="container-liz">
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
          <div className="space-y-2">
            {/* Eyebrow com marca de arquivamento em bronze */}
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-material-bronze font-sans">
              <span aria-hidden className="inline-block size-1.5 rotate-45 bg-material-bronze/80" />
              Instituto Liz / {breadcrumb}
            </p>
            <div className="font-serif text-4xl md:text-5xl font-bold text-ink leading-tight tracking-tight text-balance">
              {title}
            </div>
            {subtitle && (
              <div className="text-ink/60 text-lg font-serif italic mt-2">{subtitle}</div>
            )}
          </div>

          {actions && <div className="flex-shrink-0">{actions}</div>}

          {/* Filete de arquivo: hairline bronze com selo genealógico no fim */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-material-bronze/35 via-material-border to-transparent" />
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="shrink-0 text-material-bronze/45"
              fill="none"
            >
              <path
                d="M8 1.5v13M8 6.5 4 3.2M8 6.5l4-3.3M8 9.5l-4 3.3M8 9.5l4 3.3"
                stroke="currentColor"
                strokeWidth="0.9"
                strokeLinecap="round"
              />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
