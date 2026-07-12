import { Link, useNavigate } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  FileCheck,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────── */

export type DossierStatus = "active" | "archived";
export type ConsentStatus = "signed" | "pending" | "none";
export type PatternItem = {
  label: string;
  type?: "sentido" | "lealdade" | "aniversario" | "geral";
};

export interface DossierCardProps {
  /** Unique ID — used for routing */
  id: string;
  /** Número de registro editorial (e.g. "000214") */
  registrationNumber: string;
  /** Nome completo já normalizado */
  patientName: string;
  /** Nome preferido, se houver */
  preferredName?: string | null;
  /** Subtítulo — especialidade ou tag principal */
  subtitle?: string | null;
  /** Idade calculada */
  age?: number | null;
  /** Cidade de nascimento */
  birthplace?: string | null;
  /** Queixa principal */
  presentingComplaint?: string | null;
  /** Status do dossiê */
  status: DossierStatus;
  /** Padrões clínicos detectados (de dados reais — nunca fictícios) */
  patterns?: PatternItem[];
  /** Insight mais recente da IA Clínica (null = sem dados → não exibe) */
  aiInsight?: string | null;
  /** Status de consentimento */
  consentStatus?: ConsentStatus;
  /**
   * Variante visual:
   * - "full"    → grid completo (página de Clientes)
   * - "compact" → versão reduzida (Dashboard, Agenda, busca)
   */
  variant?: "full" | "compact";
  /* Ações de gestão */
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/* ─────────────────────────────────────────────────────────────
   STATUS STAMP — SVG INLINE ACESSÍVEL
   Guardrails:
   • Diâmetro: 48px
   • Opacidade: 0.72 (subliminar, não decorativo)
   • Rotação: ≤ ±3° (discreto, não vintage)
   • Texto interno curto (6-8 chars)
   • aria-label completo para leitores de tela
   • pointer-events: none — nunca bloqueia cliques do card
   ───────────────────────────────────────────────────────────── */

const STAMP_CONFIG: Record<
  DossierStatus,
  { label: string; ariaLabel: string; color: string; rotation: number }
> = {
  active:   { label: "ATIVO",     ariaLabel: "Em acompanhamento clínico", color: "var(--material-stamp-fg, #1B3D2D)", rotation: -3 },
  archived: { label: "ARQUIVO",   ariaLabel: "Dossiê arquivado",           color: "var(--material-stamp-arc, #8B6914)", rotation:  3 },
};

function StatusStamp({ status }: { status: DossierStatus }) {
  const cfg = STAMP_CONFIG[status];
  return (
    <svg
      width="48" height="48"
      viewBox="0 0 48 48"
      aria-label={cfg.ariaLabel}
      role="img"
      focusable="false"
      style={{
        transform: `rotate(${cfg.rotation}deg)`,
        opacity: 0.72,
        pointerEvents: "none",   /* NUNCA bloqueia cliques */
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <circle cx="24" cy="24" r="22" fill="none" stroke={cfg.color} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke={cfg.color} strokeWidth="0.6" />
      <text
        x="24" y="27.5"
        textAnchor="middle"
        fontSize="7"
        fontFamily="'Outfit', system-ui, sans-serif"
        fontWeight="800"
        letterSpacing="1.8"
        fill={cfg.color}
      >
        {cfg.label}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   PATTERN TOKEN — protocol-card
   Cor + ícone nunca é o único indicador (texto sempre presente).
   ───────────────────────────────────────────────────────────── */

const PATTERN_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  sentido:     { bg: "#EEF4F1", text: "#1B3D2D", border: "#26543E" },
  lealdade:    { bg: "#FDF6E8", text: "#8B6914", border: "#C6A23A" },
  aniversario: { bg: "#FBF0EC", text: "#A8654D", border: "#A8654D" },
  geral:       { bg: "#F2EFEA", text: "#4A4540", border: "#9A9080" },
};

function PatternToken({ pattern }: { pattern: PatternItem }) {
  const c = PATTERN_COLORS[pattern.type ?? "geral"];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        background: c.bg, color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: "4px",
        padding: "2px 7px",
        fontSize: "9.5px", fontWeight: 700,
        letterSpacing: "0.07em", textTransform: "uppercase",
        fontFamily: "var(--font-sans)", lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {pattern.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   DOSSIER CARD — COMPONENTE PRINCIPAL
   Toda a superfície do card é clicável (navega para o dossiê).
   Controles internos (menu, botões) param a propagação do clique.
   ───────────────────────────────────────────────────────────── */

export function DossierCard({
  id,
  registrationNumber,
  patientName,
  preferredName,
  subtitle,
  age,
  birthplace,
  presentingComplaint,
  status,
  patterns = [],
  aiInsight,
  consentStatus = "none",
  variant = "full",
  onEdit,
  onArchive,
  onDelete,
}: DossierCardProps) {
  const navigate = useNavigate();
  const displayName = preferredName || patientName;
  const visiblePatterns = patterns.slice(0, 3);
  const extraPatterns = patterns.length > 3 ? patterns.length - 3 : 0;
  const isCompact = variant === "compact";

  function handleCardClick(e: React.MouseEvent) {
    // Navega apenas se o clique não foi em um controle interativo interno
    const target = e.target as HTMLElement;
    if (target.closest("button, a, [role='menuitem'], [data-radix-collection-item]")) return;
    navigate({ to: "/app/clientes/$clientId", params: { clientId: id } });
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate({ to: "/app/clientes/$clientId", params: { clientId: id } });
    }
  }

  return (
    <article
      tabIndex={0}
      role="article"
      aria-label={`Dossiê de ${displayName}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--surface-dossier, #FAFAF4)",
        border: "1px solid var(--material-border, rgba(180,170,155,0.5))",
        borderLeft: "3px solid var(--material-bronze, #8A6845)",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        height: "100%",
        boxShadow: "0 1px 3px rgba(18,41,31,0.04), 0 4px 12px rgba(18,41,31,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
        transition: "box-shadow 0.22s cubic-bezier(0.16,1,0.3,1), transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.18s ease",
        outline: "none",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 2px 8px rgba(18,41,31,0.06), 0 16px 32px rgba(18,41,31,0.11), inset 0 1px 0 rgba(255,255,255,0.95)";
        el.style.borderLeftColor = "var(--material-gold, #C6A23A)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 1px 3px rgba(18,41,31,0.04), 0 4px 12px rgba(18,41,31,0.06), inset 0 1px 0 rgba(255,255,255,0.85)";
        el.style.borderLeftColor = "var(--material-bronze, #8A6845)";
      }}
      onFocus={e => {
        e.currentTarget.style.outline = "2px solid var(--forest-soft, #26543E)";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={e => { e.currentTarget.style.outline = "none"; }}
    >
      {/* ── CABEÇALHO DO DOSSIÊ ───────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: "8px",
          padding: isCompact ? "12px 14px 8px" : "13px 14px 9px",
          borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.4))",
          background: "rgba(244,241,235,0.55)",
        }}
      >
        {/* Eyebrow: tipo + número */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: "8.5px", fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "var(--material-bronze, #8A6845)",
            fontFamily: "var(--font-sans)", margin: 0, lineHeight: 1.4,
          }}>
            Dossiê Clínico · Nº {registrationNumber}
          </p>
          {subtitle && !isCompact && (
            <p style={{
              fontSize: "10px", color: "var(--warm-gray, #6B6358)",
              fontFamily: "var(--font-sans)", margin: "2px 0 0",
              letterSpacing: "0.02em", lineHeight: 1.4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Carimbo + Menu — stopPropagation para não navegar o card */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <StatusStamp status={status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 opacity-40 hover:opacity-100"
                aria-label={`Ações para o dossiê de ${displayName}`}
              >
                <MoreHorizontal style={{ width: "13px", height: "13px" }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil style={{ width: "13px", height: "13px" }} />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {status === "archived"
                  ? <><ArchiveRestore style={{ width: "13px", height: "13px" }} /> Reativar</>
                  : <><Archive style={{ width: "13px", height: "13px" }} /> Arquivar</>
                }
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 style={{ width: "13px", height: "13px" }} />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── NOME + META ────────────────────────────────── */}
      <div style={{ padding: isCompact ? "12px 14px 8px" : "13px 14px 9px" }}>
        {/* Nome: elemento dominante — maior do card */}
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: isCompact ? "1.05rem" : "clamp(1.05rem, 1.5vw, 1.2rem)",
            fontWeight: 700,
            color: "var(--ink, #1A1714)",
            lineHeight: 1.22,
            margin: 0,
            letterSpacing: "-0.01em",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {displayName}
        </h2>

        {/* Meta — secundária, discreta */}
        {((age !== null && age !== undefined) || birthplace) && (
          <p style={{
            fontSize: "11.5px", color: "var(--warm-gray, #6B6358)",
            fontFamily: "var(--font-sans)", margin: "5px 0 0",
            display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap",
          }}>
            {age !== null && age !== undefined && <span>{age} anos</span>}
            {birthplace && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <MapPin style={{ width: "10px", height: "10px", opacity: 0.55 }} aria-hidden />
                {birthplace}
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── QUEIXA PRINCIPAL ───────────────────────────── */}
      {presentingComplaint && (
        <div style={{ padding: "0 14px 12px", flex: isCompact ? 0 : 1 }}>
          <p style={{
            fontSize: "13px", lineHeight: 1.6,
            color: "var(--ink-soft, #4A4540)",
            fontFamily: "var(--font-sans)", margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: isCompact ? 1 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {presentingComplaint}
          </p>
        </div>
      )}

      {/* Spacer quando sem queixa, para manter proporção mínima */}
      {!presentingComplaint && !isCompact && <div style={{ flex: 1 }} />}

      {/* ── PADRÕES DETECTADOS ─────────────────────────── */}
      {patterns.length > 0 && !isCompact && (
        <div style={{
          padding: "9px 14px",
          borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
        }}>
          <p style={{
            fontSize: "8.5px", fontWeight: 800,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--warm-gray, #6B6358)",
            fontFamily: "var(--font-sans)", margin: "0 0 6px",
          }}>
            Padrões identificados
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            {visiblePatterns.map((p, i) => (
              <PatternToken key={i} pattern={p} />
            ))}
            {extraPatterns > 0 && (
              <span style={{
                fontSize: "10px", fontWeight: 700,
                color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)",
              }}>
                +{extraPatterns}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── INSIGHT DA IA ──────────────────────────────── */}
      {/* Só renderiza quando há dado real (aiInsight !== null e !== "") */}
      {aiInsight && !isCompact && (
        <div style={{
          padding: "9px 14px",
          borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
          background: "var(--surface-manuscript, rgba(240,237,229,0.45))",
        }}>
          <p style={{
            fontSize: "8.5px", fontWeight: 800,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--material-olive, #7D8060)",
            fontFamily: "var(--font-sans)", margin: "0 0 4px",
          }}>
            IA Clínica
          </p>
          {/* Apenas frase curta em serif itálico — nunca blocos longos */}
          <p style={{
            fontSize: "13px",
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            color: "var(--ink-soft, #4A4540)", lineHeight: 1.5, margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            "{aiInsight}"
          </p>
        </div>
      )}

      {/* ── RODAPÉ — Consentimento + Ação ──────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isCompact ? "8px 14px" : "9px 14px",
        borderTop: "1px solid var(--material-border, rgba(180,170,155,0.4))",
        background: "rgba(244,241,235,0.6)",
        marginTop: "auto",
      }}>
        {/* Consentimento — NUNCA apenas cor, sempre ícone + texto */}
        <span
          aria-label={consentStatus === "signed" ? "Consentimento assinado" : "Consentimento pendente"}
          style={{
            fontSize: "10.5px", fontFamily: "var(--font-sans)", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "4px",
            color: consentStatus === "signed"
              ? "var(--forest-soft, #26543E)"
              : "var(--material-terracotta, #A8654D)",
          }}
        >
          {consentStatus === "signed"
            ? <><FileCheck style={{ width: "11px", height: "11px" }} aria-hidden /> Consentimento</>
            : <><AlertTriangle style={{ width: "11px", height: "11px" }} aria-hidden /> Sem consentimento</>
          }
        </span>

        {/* CTA explícito — além do clique geral do card */}
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: id }}
          preload="intent"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", textDecoration: "none",
            fontFamily: "var(--font-sans)",
            color: "var(--forest, #12291F)",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = "var(--material-gold, #C6A23A)"}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "var(--forest, #12291F)"}
        >
          Abrir →
        </Link>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   SKELETON — estado de loading
   ───────────────────────────────────────────────────────────── */
export function DossierCardSkeleton() {
  return (
    <div
      aria-hidden
      aria-busy="true"
      style={{
        minHeight: "220px", borderRadius: "12px",
        border: "1px solid rgba(180,170,155,0.35)",
        borderLeft: "3px solid rgba(180,170,155,0.35)",
        background: "var(--surface-dossier, #FAFAF4)",
        overflow: "hidden",
      }}
    >
      {/* Header faixa */}
      <div style={{ padding: "13px 14px 9px", borderBottom: "1px solid rgba(180,170,155,0.25)", background: "rgba(244,241,235,0.45)" }}>
        <div className="skeleton" style={{ height: "9px", width: "55%", borderRadius: "4px" }} />
      </div>
      {/* Corpo */}
      <div style={{ padding: "13px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="skeleton" style={{ height: "20px", width: "78%", borderRadius: "4px" }} />
        <div className="skeleton" style={{ height: "11px", width: "42%", borderRadius: "4px" }} />
        <div style={{ marginTop: "8px" }}>
          <div className="skeleton" style={{ height: "12px", width: "100%", borderRadius: "4px", marginBottom: "5px" }} />
          <div className="skeleton" style={{ height: "12px", width: "68%", borderRadius: "4px" }} />
        </div>
      </div>
    </div>
  );
}
