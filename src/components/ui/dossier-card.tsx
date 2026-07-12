import { Link } from "@tanstack/react-router";
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
export type PatternItem = { label: string; type?: "sentido" | "lealdade" | "aniversario" | "geral" };

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
  /** Padrões clínicos detectados */
  patterns?: PatternItem[];
  /** Insight mais recente da IA Clínica */
  aiInsight?: string | null;
  /** Porcentagem de completude do genossociograma (0-100) */
  genogramCompletion?: number;
  /** Status de consentimento */
  consentStatus?: ConsentStatus;
  /* Actions */
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/* ─────────────────────────────────────────────────────────────
   STATUS STAMP — SVG INLINE ACESSÍVEL
   Guardrails: 48px, opacidade 0.78, rotação ≤ 4°, texto curto,
   aria-label explícito, pointer-events none (não bloqueia clicks).
   ───────────────────────────────────────────────────────────── */

const STAMP_CONFIG: Record<
  DossierStatus,
  { label: string; ariaLabel: string; color: string; rotation: number }
> = {
  active:   { label: "ATIVO",      ariaLabel: "Em acompanhamento clínico", color: "#1B3D2D", rotation: -3  },
  archived: { label: "ARQUIVADO",  ariaLabel: "Dossiê arquivado",           color: "#8B6914", rotation:  3  },
};

function StatusStamp({ status }: { status: DossierStatus }) {
  const cfg = STAMP_CONFIG[status];
  return (
    <svg
      width="48" height="48"
      viewBox="0 0 48 48"
      aria-label={cfg.ariaLabel}
      role="img"
      style={{
        transform: `rotate(${cfg.rotation}deg)`,
        opacity: 0.72,
        pointerEvents: "none",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" fill="none" stroke={cfg.color} strokeWidth="1.5" />
      {/* Inner ring */}
      <circle cx="24" cy="24" r="18" fill="none" stroke={cfg.color} strokeWidth="0.75" />
      {/* Label text — short, centered */}
      <text
        x="24" y="27"
        textAnchor="middle"
        fontSize="7.5"
        fontFamily="'Outfit', system-ui, sans-serif"
        fontWeight="800"
        letterSpacing="1.5"
        fill={cfg.color}
        style={{ textTransform: "uppercase" }}
      >
        {cfg.label}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   PATTERN TOKEN
   Cores por tipo — nunca apenas cor, sempre ícone + texto
   ───────────────────────────────────────────────────────────── */

const PATTERN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sentido:    { bg: "#EEF4F1", text: "#1B3D2D", border: "#26543E" },
  lealdade:   { bg: "#FDF6E8", text: "#8B6914", border: "#C6A23A" },
  aniversario:{ bg: "#FBF0EC", text: "#A8654D", border: "#A8654D" },
  geral:      { bg: "#F2EFEA", text: "#4A4540", border: "#9A9080" },
};

function PatternToken({ pattern }: { pattern: PatternItem }) {
  const colors = PATTERN_COLORS[pattern.type ?? "geral"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: "4px",
        padding: "2px 7px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        fontFamily: "var(--font-sans)",
        textTransform: "uppercase",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {pattern.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   DOSSIER CARD — COMPONENTE PRINCIPAL
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
  genogramCompletion,
  consentStatus = "none",
  onEdit,
  onArchive,
  onDelete,
}: DossierCardProps) {
  const displayName = preferredName || patientName;
  const visiblePatterns = patterns.slice(0, 3);
  const extraPatterns   = patterns.length > 3 ? patterns.length - 3 : 0;

  const isArchived = status === "archived";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-document, #FAFAF7)",
        border: "1px solid var(--material-border, rgba(180,170,155,0.5))",
        borderLeft: "3px solid var(--material-bronze, #8B6914)",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        transition: "box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease",
        cursor: "default",
        height: "100%",
        // Sombra nível 2 (dossier)
        boxShadow: "0 1px 3px rgba(18,41,31,0.04), 0 6px 16px rgba(18,41,31,0.07), 0 0 0 1px rgba(18,41,31,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 2px 6px rgba(18,41,31,0.06), 0 14px 30px rgba(18,41,31,0.12), 0 0 0 1px rgba(139,105,20,0.15), inset 0 1px 0 rgba(255,255,255,0.95)";
        el.style.borderLeftColor = "var(--material-gold, #C6A23A)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 1px 3px rgba(18,41,31,0.04), 0 6px 16px rgba(18,41,31,0.07), 0 0 0 1px rgba(18,41,31,0.04), inset 0 1px 0 rgba(255,255,255,0.8)";
        el.style.borderLeftColor = "var(--material-bronze, #8B6914)";
      }}
    >
      {/* ── HEADER DO DOSSIÊ ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.4))",
        background: "rgba(244,241,235,0.5)",
        gap: "8px",
      }}>
        {/* Número de registro + label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: "9px",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--material-bronze, #8B6914)",
            fontFamily: "var(--font-sans)",
            margin: 0,
            lineHeight: 1.4,
          }}>
            Dossiê Clínico · Nº {registrationNumber}
          </p>
          {subtitle && (
            <p style={{
              fontSize: "10px",
              color: "var(--warm-gray, #6B6358)",
              fontFamily: "var(--font-sans)",
              margin: "2px 0 0",
              letterSpacing: "0.03em",
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Carimbo + Menu */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <StatusStamp status={status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 opacity-50 hover:opacity-100"
                aria-label={`Ações para ${displayName}`}
              >
                <MoreHorizontal style={{ width: "14px", height: "14px" }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil style={{ width: "13px", height: "13px" }} /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {isArchived
                  ? <><ArchiveRestore style={{ width: "13px", height: "13px" }} /> Reativar</>
                  : <><Archive style={{ width: "13px", height: "13px" }} /> Arquivar</>
                }
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 style={{ width: "13px", height: "13px" }} /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── NOME + META ── */}
      <Link
        to="/app/clientes/$clientId"
        params={{ clientId: id }}
        preload="intent"
        style={{
          display: "block",
          padding: "14px 16px 10px",
          textDecoration: "none",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(1.05rem, 1.8vw, 1.2rem)",
            fontWeight: 700,
            color: "var(--ink, #1A1714)",
            lineHeight: 1.25,
            margin: 0,
            letterSpacing: "-0.01em",
            // Allow wrapping but never break words
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {displayName}
        </h2>
        {(age !== null && age !== undefined) || birthplace ? (
          <p style={{
            fontSize: "12px",
            color: "var(--warm-gray, #6B6358)",
            fontFamily: "var(--font-sans)",
            margin: "5px 0 0",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}>
            {age !== null && age !== undefined && <span>{age} anos</span>}
            {birthplace && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <MapPin style={{ width: "11px", height: "11px", opacity: 0.6 }} />
                {birthplace}
              </span>
            )}
          </p>
        ) : null}
      </Link>

      {/* ── QUEIXA PRINCIPAL ── */}
      {presentingComplaint ? (
        <div style={{ padding: "0 16px 12px", flex: 1 }}>
          <p style={{
            fontSize: "13.5px",
            lineHeight: 1.6,
            color: "var(--ink-soft, #4A4540)",
            fontFamily: "var(--font-sans)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {presentingComplaint}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* ── PADRÕES DETECTADOS ── */}
      {patterns.length > 0 && (
        <div style={{
          padding: "10px 16px",
          borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
        }}>
          <p style={{
            fontSize: "9px",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--warm-gray, #6B6358)",
            fontFamily: "var(--font-sans)",
            margin: "0 0 7px",
          }}>
            Padrões identificados
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
            {visiblePatterns.map((p, i) => (
              <PatternToken key={i} pattern={p} />
            ))}
            {extraPatterns > 0 && (
              <span style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)",
              }}>
                +{extraPatterns}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── INSIGHT DA IA ── */}
      {aiInsight && (
        <div style={{
          padding: "10px 16px",
          borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
          background: "rgba(240,237,229,0.5)",
        }}>
          <p style={{
            fontSize: "9px",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--material-olive, #7D8060)",
            fontFamily: "var(--font-sans)",
            margin: "0 0 5px",
          }}>
            IA Clínica
          </p>
          {/* Apenas a frase curta em serif itálico — não blocos longos */}
          <p style={{
            fontSize: "13px",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "var(--ink-soft, #4A4540)",
            lineHeight: 1.5,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            "{aiInsight}"
          </p>
        </div>
      )}

      {/* ── RODAPÉ — Consentimento + Ação ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderTop: "1px solid var(--material-border, rgba(180,170,155,0.4))",
        background: "rgba(244,241,235,0.6)",
        marginTop: "auto",
      }}>
        {/* Consentimento — texto + ícone, nunca só cor */}
        <span style={{
          fontSize: "11px",
          fontFamily: "var(--font-sans)",
          display: "flex", alignItems: "center", gap: "4px",
          color: consentStatus === "signed" ? "var(--forest-soft, #26543E)" : "var(--terracotta, #A8654D)",
          fontWeight: 600,
        }}>
          {consentStatus === "signed" ? (
            <><FileCheck style={{ width: "12px", height: "12px" }} aria-hidden /> Consentimento</>
          ) : (
            <><AlertTriangle style={{ width: "12px", height: "12px" }} aria-hidden /> Sem consentimento</>
          )}
        </span>

        {/* CTA — toda a linha do card é clicável via Link acima, mas mantemos o link textual explícito */}
        <Link
          to="/app/clientes/$clientId"
          params={{ clientId: id }}
          preload="intent"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--forest, #12291F)",
            textDecoration: "none",
            fontFamily: "var(--font-sans)",
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
   SKELETON — loading state
   ───────────────────────────────────────────────────────────── */
export function DossierCardSkeleton() {
  return (
    <div
      style={{
        height: "260px",
        borderRadius: "12px",
        border: "1px solid rgba(180,170,155,0.4)",
        borderLeft: "3px solid rgba(180,170,155,0.4)",
        overflow: "hidden",
        background: "var(--surface-document, #FAFAF7)",
      }}
      aria-hidden
    >
      {/* Top bar */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(180,170,155,0.3)", background: "rgba(244,241,235,0.5)" }}>
        <div className="skeleton" style={{ height: "9px", width: "60%", borderRadius: "4px" }} />
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="skeleton" style={{ height: "22px", width: "80%", borderRadius: "4px" }} />
        <div className="skeleton" style={{ height: "13px", width: "45%", borderRadius: "4px" }} />
        <div className="skeleton" style={{ height: "13px", width: "95%", borderRadius: "4px", marginTop: "8px" }} />
        <div className="skeleton" style={{ height: "13px", width: "70%", borderRadius: "4px" }} />
      </div>
    </div>
  );
}
