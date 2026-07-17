/**
 * ArchiveEmptyState — Etapa 3: camada imersiva do "arquivo vivo"
 *
 * Substitui os cartões brancos genéricos de estado vazio por uma peça de
 * arquivo: superfície de manuscrito, gravura genealógica em traço fino
 * (desenhada em SVG, animada como tinta que seca) e o selo de cera real
 * do acervo fotográfico, fundido ao papel com mix-blend-darken.
 *
 * Sobriedade Clínica: um único ornamento por peça, opacidades baixas,
 * a teoria emerge da composição — não de efeitos.
 */
import type { ReactNode } from "react";

/** Gravura genealógica — quatro gerações ligadas por fios finos. */
function EngravedLineage({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 220"
      fill="none"
      aria-hidden
      className={className}
      style={{ color: "var(--material-bronze)" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        className="[stroke-dasharray:600] [stroke-dashoffset:600] animate-[ink-draw_2.4s_ease-out_forwards]"
      >
        {/* Fio central — tronco da linhagem */}
        <path d="M120 208 C120 176 118 160 120 138" />
        {/* Geração dos pais */}
        <path d="M120 138 C100 128 84 122 72 104" />
        <path d="M120 138 C140 128 156 122 168 104" />
        {/* Geração dos avós */}
        <path d="M72 104 C60 88 50 78 44 60" />
        <path d="M72 104 C80 86 88 76 92 58" />
        <path d="M168 104 C160 86 152 76 148 58" />
        <path d="M168 104 C180 88 190 78 196 60" />
        {/* Bisavós — fios que se perdem no tempo */}
        <path d="M44 60 C40 46 36 38 30 26" strokeDasharray="3 4" />
        <path d="M92 58 C94 44 96 36 100 24" strokeDasharray="3 4" />
        <path d="M148 58 C146 44 144 36 140 24" strokeDasharray="3 4" />
        <path d="M196 60 C200 46 204 38 210 26" strokeDasharray="3 4" />
      </g>
      <g fill="currentColor">
        {/* Paciente-índice */}
        <circle cx="120" cy="208" r="5" />
        <circle cx="120" cy="208" r="8.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
        {/* Pais */}
        <rect x="66" y="98" width="12" height="12" rx="2" />
        <circle cx="168" cy="104" r="6" />
        {/* Avós */}
        <rect x="39" y="55" width="10" height="10" rx="2" />
        <circle cx="92" cy="58" r="5" />
        <rect x="143" y="53" width="10" height="10" rx="2" />
        <circle cx="196" cy="60" r="5" />
        {/* Bisavós — presenças quase apagadas */}
        <circle cx="30" cy="24" r="3" opacity="0.5" />
        <circle cx="100" cy="22" r="3" opacity="0.5" />
        <circle cx="140" cy="22" r="3" opacity="0.5" />
        <circle cx="210" cy="24" r="3" opacity="0.5" />
      </g>
    </svg>
  );
}

export interface ArchiveEmptyStateProps {
  /** Rótulo pequeno em caixa alta acima do título (ex.: "Arquivo de árvores"). */
  eyebrow: string;
  /** Título em serifa (ex.: "Nenhuma árvore plantada ainda."). */
  title: string;
  /** Texto de apoio, tom humano e delicado. */
  description: string;
  /** Ação principal (botão ou link já montado). */
  action?: ReactNode;
  /** Exibe o selo de cera fotográfico do acervo. */
  withSeal?: boolean;
  /**
   * Render do acervo (public/assets/renders). Fotografado em fundo branco;
   * o mix-blend-darken funde o branco ao pergaminho. Substitui a gravura SVG.
   */
  image?: string;
}

export function ArchiveEmptyState({
  eyebrow,
  title,
  description,
  action,
  withSeal = true,
  image,
}: ArchiveEmptyStateProps) {
  return (
    <section className="relative overflow-hidden rounded-[14px] border border-material-border border-l-[3px] border-l-material-bronze bg-surface-manuscript bg-[radial-gradient(120%_90%_at_100%_110%,rgba(111,78,55,0.08)_0%,transparent_55%)] shadow-surface">
      <div className="grid gap-8 px-7 py-12 sm:px-12 sm:py-16 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div className="max-w-[520px]">
          <p className="m-0 font-sans text-[10px] font-extrabold tracking-[0.22em] text-material-bronze uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-3 mb-0 font-serif text-[1.9rem] leading-tight font-bold text-ink text-balance">
            {title}
          </h2>
          <p className="mt-4 mb-0 font-serif text-[17px] leading-relaxed text-ink/55 italic">
            {description}
          </p>
          {action && <div className="mt-8">{action}</div>}
        </div>

        {/* Relíquia do acervo (render) ou gravura — visível também no mobile, menor */}
        <div className="relative mx-auto w-[190px] md:w-[240px]">
          {image ? (
            <img
              src={image}
              alt=""
              aria-hidden
              loading="lazy"
              className="w-full mix-blend-darken [mask-image:radial-gradient(120%_120%_at_50%_45%,black_62%,transparent_92%)]"
            />
          ) : (
            <EngravedLineage className="w-full opacity-[0.55]" />
          )}
          {withSeal && (
            <img
              src="/assets/objects/wax_seal_tree.jpg"
              alt=""
              aria-hidden
              className="absolute -right-2 -bottom-3 w-[72px] rotate-[8deg] mix-blend-darken [clip-path:circle(46%_at_50%_50%)]"
            />
          )}
        </div>
      </div>
    </section>
  );
}
