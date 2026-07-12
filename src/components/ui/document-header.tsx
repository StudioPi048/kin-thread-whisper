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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-archive-old pb-6">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold font-sans">
              Instituto Liz / {breadcrumb}
            </p>
            <div className="font-serif text-4xl md:text-5xl font-bold text-ink leading-tight tracking-tight">
              {title}
            </div>
            {subtitle && (
              <div className="text-ink/60 text-lg font-serif italic mt-2">{subtitle}</div>
            )}
          </div>

          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
