/**
 * NarrativeConnector — Passo 2.6: Sistema de Narrativa Visual
 *
 * Costura os espaços entre blocos na Home com elementos que:
 * 1. Adicionam densidade editorial (não vazio)
 * 2. Reforçam a identidade genealógica (não são genéricos)
 * 3. Nunca competem com o conteúdo principal
 *
 * Regras:
 * • Opacidade do GenealogicalMark: 0.08–0.18 (subliminar, não decorativo)
 * • Citações: reais, de autores de Psicogenealogia/constelações
 * • Nunca dois conectores seguidos
 * • Serif italic APENAS na citação, nunca em outros textos do conector
 */

/* ─────────────────────────────────────────────────────────────
   GENEALOGICAL MARK — A Assinatura Invisível
   SVG de ramificação abstrata. Não é uma árvore literal.
   É a abstração visual de conexão entre gerações.
   ───────────────────────────────────────────────────────────── */

export function GenealogicalMark({
  size = 24,
  opacity = 0.12,
  color = "var(--material-bronze, #8A6845)",
}: {
  size?: number;
  opacity?: number;
  color?: string;
}) {
  // Escala proporcional ao size
  const s = size / 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ opacity, flexShrink: 0, pointerEvents: "none", userSelect: "none" }}
    >
      {/* Ramificação abstrata de 3 gerações — não é uma árvore literal */}
      {/* Raiz */}
      <circle cx="12" cy="20" r="1.5" fill={color} />
      {/* Linha central */}
      <line x1="12" y1="18.5" x2="12" y2="14" stroke={color} strokeWidth="0.8" />
      {/* Nós intermediários */}
      <circle cx="7" cy="13" r="1.2" fill={color} />
      <circle cx="17" cy="13" r="1.2" fill={color} />
      {/* Linhas para intermediários */}
      <line x1="12" y1="14" x2="7" y2="13" stroke={color} strokeWidth="0.7" />
      <line x1="12" y1="14" x2="17" y2="13" stroke={color} strokeWidth="0.7" />
      {/* Nós ancestrais */}
      <circle cx="4"  cy="7" r="1" fill={color} />
      <circle cx="10" cy="7" r="1" fill={color} />
      <circle cx="14" cy="7" r="1" fill={color} />
      <circle cx="20" cy="7" r="1" fill={color} />
      {/* Linhas para ancestrais */}
      <line x1="7"  y1="11.8" x2="4"  y2="7.9" stroke={color} strokeWidth="0.6" />
      <line x1="7"  y1="11.8" x2="10" y2="7.9" stroke={color} strokeWidth="0.6" />
      <line x1="17" y1="11.8" x2="14" y2="7.9" stroke={color} strokeWidth="0.6" />
      <line x1="17" y1="11.8" x2="20" y2="7.9" stroke={color} strokeWidth="0.6" />
      {/* Nós de 3ª geração (extremos) */}
      <circle cx="3"  cy="3" r="0.8" fill={color} />
      <circle cx="5"  cy="3" r="0.8" fill={color} />
      <circle cx="19" cy="3" r="0.8" fill={color} />
      <circle cx="21" cy="3" r="0.8" fill={color} />
      <line x1="4" y1="6.1"  x2="3"  y2="3.8" stroke={color} strokeWidth="0.5" />
      <line x1="4" y1="6.1"  x2="5"  y2="3.8" stroke={color} strokeWidth="0.5" />
      <line x1="20" y1="6.1" x2="19" y2="3.8" stroke={color} strokeWidth="0.5" />
      <line x1="20" y1="6.1" x2="21" y2="3.8" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   NARRATIVE CONNECTOR — 3 variantes
   ───────────────────────────────────────────────────────────── */

/** Citações reais de autores de referência em Psicogenealogia */
export const GENEALOGY_QUOTES = [
  {
    text: "Carregamos em nosso corpo a memória de nossos ancestrais.",
    author: "Anne Ancelin Schützenberger",
  },
  {
    text: "As lealdades invisíveis são as mais poderosas de todas.",
    author: "Ivan Böszörményi-Nagy",
  },
  {
    text: "O que não é vivido por um, é sofrido pelo seguinte.",
    author: "Bert Hellinger",
  },
  {
    text: "A família é um sistema no qual cada membro afeta todos os outros.",
    author: "Murray Bowen",
  },
  {
    text: "As raízes não prendem. Elas alimentam.",
    author: "Psicogenealogia clínica",
  },
] as const;

/**
 * `quote` — citação em serif italic + linha fina
 * Para usar entre o header e o primeiro bloco de conteúdo.
 */
export function QuoteConnector({
  quote = GENEALOGY_QUOTES[0],
}: {
  quote?: { text: string; author: string };
}) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        padding: "4px 0",
      }}
    >
      {/* Linha esquerda */}
      <div style={{ flex: 1, height: "1px", background: "var(--material-border, rgba(180,170,155,0.5))" }} />

      {/* Citação */}
      <div
        style={{
          background: "var(--surface-manuscript, #F0EDE5)",
          border: "1px solid var(--material-border, rgba(180,170,155,0.4))",
          borderRadius: "6px",
          padding: "10px 18px",
          maxWidth: "460px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
        }}
      >
        {/* Serif italic — único lugar onde é permitido aqui */}
        <p style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "13px",
          color: "var(--ink-soft, #4A4540)",
          lineHeight: 1.5,
          margin: 0,
        }}>
          "{quote.text}"
        </p>
        <span style={{
          fontSize: "9px",
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--material-olive, #7D8060)",
          fontFamily: "var(--font-sans)",
        }}>
          {quote.author}
        </span>
      </div>

      {/* Linha direita */}
      <div style={{ flex: 1, height: "1px", background: "var(--material-border, rgba(180,170,155,0.5))" }} />
    </div>
  );
}

/**
 * `datemark` — referência histórica discreta com o GenealogicalMark
 * Para usar entre seções de conteúdo operacional.
 */
export function DateMarkConnector({
  label = "Arquivo ativo desde 2024",
}: {
  label?: string;
}) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <div style={{ flex: 1, height: "1px", background: "var(--material-border, rgba(180,170,155,0.3))" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <GenealogicalMark size={18} opacity={0.14} />
        <span style={{
          fontSize: "9px",
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--material-bronze, #8A6845)",
          fontFamily: "var(--font-sans)",
          opacity: 0.7,
        }}>
          {label}
        </span>
        <GenealogicalMark size={18} opacity={0.14} />
      </div>
      <div style={{ flex: 1, height: "1px", background: "var(--material-border, rgba(180,170,155,0.3))" }} />
    </div>
  );
}

/**
 * `divider` — separador puro com GenealogicalMark centrado
 * Para usar no final de seções, antes do rodapé.
 */
export function GenealogyDivider({ opacity = 0.10 }: { opacity?: number }) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        opacity,
      }}
    >
      <div style={{ flex: 1, height: "1px", background: "var(--material-bronze, #8A6845)" }} />
      <GenealogicalMark size={20} opacity={1} color="var(--material-bronze, #8A6845)" />
      <div style={{ flex: 1, height: "1px", background: "var(--material-bronze, #8A6845)" }} />
    </div>
  );
}
