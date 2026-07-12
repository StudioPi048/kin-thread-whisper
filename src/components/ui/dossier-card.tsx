import { useNavigate } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  FileCheck,
  AlertTriangle,
  MapPin,
  Clock,
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

export type DossierStatus   = "active" | "archived";
export type ConsentStatus   = "signed" | "pending" | "none";
export type MaterialStability = "stable" | "planned" | "experimental" | "deprecated";

export type PatternItem = {
  label: string;
  type?: "sentido" | "lealdade" | "aniversario" | "geral";
};

export interface DossierCardProps {
  /** Unique ID — routing key */
  id: string;
  /** Número de registro editorial (e.g. "000214") */
  registrationNumber: string;
  /** Nome completo normalizado */
  patientName: string;
  /** Nome preferido, se houver */
  preferredName?: string | null;
  /** Subtítulo — especialidade / tag principal */
  subtitle?: string | null;
  /** Idade calculada */
  age?: number | null;
  /** Cidade de nascimento */
  birthplace?: string | null;
  /** Queixa principal */
  presentingComplaint?: string | null;
  /** Status do dossiê */
  status: DossierStatus;
  /** Padrões clínicos (dados reais — nunca fictícios) */
  patterns?: PatternItem[];
  /** Insight da IA Clínica. null/undefined = não renderiza nada */
  aiInsight?: string | null;
  /** Status de consentimento */
  consentStatus?: ConsentStatus;
  /**
   * Variante visual — altera estrutura, densidade e metadados exibidos:
   *
   * "full"    → Tela de Clientes: dossiê completo, todos os blocos
   * "compact" → Dashboard / Agenda / Busca: versão densa, sem blocos longos
   */
  variant?: "full" | "compact";
  /* Ações de gestão */
  onEdit:    () => void;
  onArchive: () => void;
  onDelete:  () => void;
}

/* ─────────────────────────────────────────────────────────────
   STATUS STAMP — material: stamp (stable)
   ─────────────────────────────────────────────────────────
   Guardrails obrigatórias:
   • Diâmetro: 48px (full) / 36px (compact)
   • Opacidade: max 0.72
   • Rotação: ≤ ±3°
   • pointer-events: none — nunca bloqueia cliques
   • aria-label descritivo obrigatório
   • Texto interno ≤ 8 chars (complementado por texto legível ao lado)
   ───────────────────────────────────────────────────────────── */

const STAMP_CFG: Record<DossierStatus, {
  label: string; ariaLabel: string; color: string; rotation: number;
}> = {
  active:   { label: "ATIVO",   ariaLabel: "Em acompanhamento clínico", color: "var(--material-stamp-fg, #1B3D2D)", rotation: -3 },
  archived: { label: "ARQUIVO", ariaLabel: "Dossiê arquivado",           color: "var(--material-stamp-arc, #8B6914)", rotation:  3 },
};

function StatusStamp({ status, size = 48 }: { status: DossierStatus; size?: number }) {
  const cfg = STAMP_CFG[status];
  const r1  = (size / 2) - 2.5;
  const r2  = (size / 2) - 8;
  const cx  = size / 2;
  const fontSize = size < 44 ? 6 : 7;
  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={cfg.ariaLabel}
      role="img"
      focusable="false"
      style={{
        transform: `rotate(${cfg.rotation}deg)`,
        opacity: 0.72,
        pointerEvents: "none",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <circle cx={cx} cy={cx} r={r1} fill="none" stroke={cfg.color} strokeWidth="1.5" />
      <circle cx={cx} cy={cx} r={r2} fill="none" stroke={cfg.color} strokeWidth="0.6" />
      <text
        x={cx} y={cx + fontSize * 0.55}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="'Outfit', system-ui, sans-serif"
        fontWeight="800"
        letterSpacing="1.6"
        fill={cfg.color}
      >
        {cfg.label}
      </text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   PATTERN TOKEN — material: protocol (stable)
   Cor nunca é o único indicador — texto sempre presente.
   ───────────────────────────────────────────────────────────── */

const PATTERN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sentido:     { bg: "#EEF4F1", text: "#1B3D2D", border: "#26543E" },
  lealdade:    { bg: "#FDF6E8", text: "#8B6914", border: "#C6A23A" },
  aniversario: { bg: "#FBF0EC", text: "#A8654D", border: "#A8654D" },
  geral:       { bg: "#F2EFEA", text: "#4A4540", border: "#9A9080" },
};

function PatternToken({ pattern }: { pattern: PatternItem }) {
  const c = PATTERN_COLORS[pattern.type ?? "geral"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      borderRadius: "4px", padding: "2px 7px",
      fontSize: "9px", fontWeight: 700,
      letterSpacing: "0.07em", textTransform: "uppercase",
      fontFamily: "var(--font-sans)", lineHeight: 1.4,
      whiteSpace: "nowrap",
    }}>
      {pattern.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   STATUS TEXT LABEL — para variante compact e rodapé full
   Texto sempre: nunca apenas cor ou carimbo.
   ───────────────────────────────────────────────────────────── */

const STATUS_TEXT: Record<DossierStatus, { label: string; color: string }> = {
  active:   { label: "Em acompanhamento", color: "var(--forest-soft, #26543E)" },
  archived: { label: "Arquivado",          color: "var(--material-stamp-arc, #8B6914)" },
};

/* ─────────────────────────────────────────────────────────────
   DOSSIER CARD — material: dossier (stable)

   SEMÂNTICA:
   • <article role="link"> — é interativo, navega ao dossiê
   • tabIndex={0} — focável por teclado
   • aria-label — descreve a ação, não apenas o conteúdo
   • Enter e Space navegam (comportamento padrão de link customizado)
   • stopPropagation em todos os controles internos (menu, botões, links)
   • outline-offset: 3px — foco visual não confunde com borda do card

   VARIANTE "full" — tela de Clientes:
   número de registro · nome · meta · queixa · padrões (máx 3) ·
   hipótese IA · consentimento · ação explícita

   VARIANTE "compact" — Dashboard / Agenda / Busca:
   nome · status textual · última atividade · padrões (máx 2) ·
   sem hipótese longa · sem bloco de consentimento · ação = clique no card
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
  const navigate    = useNavigate();
  const displayName = preferredName || patientName;
  const isFull      = variant === "full";
  const maxPatterns = isFull ? 3 : 2;
  const visible     = patterns.slice(0, maxPatterns);
  const extra       = patterns.length > maxPatterns ? patterns.length - maxPatterns : 0;
  const statusCfg   = STATUS_TEXT[status];

  function goToDossier() {
    navigate({ to: "/app/clientes/$clientId", params: { clientId: id } });
  }

  function handleClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("button, [role='menuitem'], [data-radix-collection-item]")) return;
    goToDossier();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDossier();
    }
  }

  return (
    <article
      tabIndex={0}
      role="link"
      aria-label={`Abrir dossiê de ${displayName}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--surface-dossier, #FAFAF4)",
        border: "1px solid var(--material-border, rgba(180,170,155,0.5))",
        borderLeft: "3px solid var(--material-bronze, #8A6845)",
        borderRadius: "12px", overflow: "hidden",
        position: "relative", cursor: "pointer", height: "100%",
        boxShadow: "0 1px 3px rgba(18,41,31,0.04), 0 4px 12px rgba(18,41,31,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
        transition: "box-shadow 0.22s cubic-bezier(0.16,1,0.3,1), transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.18s ease",
        outline: "none",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.transform         = "translateY(-3px)";
        el.style.boxShadow         = "0 2px 8px rgba(18,41,31,0.06), 0 16px 32px rgba(18,41,31,0.11), inset 0 1px 0 rgba(255,255,255,0.95)";
        el.style.borderLeftColor   = "var(--material-gold, #C6A23A)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.transform         = "translateY(0)";
        el.style.boxShadow         = "0 1px 3px rgba(18,41,31,0.04), 0 4px 12px rgba(18,41,31,0.06), inset 0 1px 0 rgba(255,255,255,0.85)";
        el.style.borderLeftColor   = "var(--material-bronze, #8A6845)";
      }}
      onFocus={e => {
        e.currentTarget.style.outline       = "2px solid var(--forest-soft, #26543E)";
        e.currentTarget.style.outlineOffset = "3px";  /* nunca confunde com borda */
      }}
      onBlur={e => {
        e.currentTarget.style.outline       = "none";
        e.currentTarget.style.outlineOffset = "0";
      }}
    >

      {/* ═══════════════════════════════════════════════
          VARIANTE: FULL
          ═══════════════════════════════════════════════ */}
      {isFull && (
        <>
          {/* ── Cabeçalho ── */}
          <div style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: "8px",
            padding: "12px 14px 9px",
            borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.4))",
            background: "rgba(244,241,235,0.55)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: "8px", fontWeight: 800, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "var(--material-bronze, #8A6845)",
                fontFamily: "var(--font-sans)", margin: 0, lineHeight: 1.4,
              }}>
                Dossiê Clínico · Nº {registrationNumber}
              </p>
              {subtitle && (
                <p style={{
                  fontSize: "10px", color: "var(--warm-gray, #6B6358)",
                  fontFamily: "var(--font-sans)", margin: "2px 0 0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {subtitle}
                </p>
              )}
            </div>

            {/* Carimbo + Menu — stopPropagation protege o clique do card */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <StatusStamp status={status} size={48} />
              <CardMenu
                patientName={displayName}
                status={status}
                onEdit={onEdit}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            </div>
          </div>

          {/* ── Nome (elemento dominante) ── */}
          <div style={{ padding: "13px 14px 8px" }}>
            <h2 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.05rem, 1.5vw, 1.2rem)",
              fontWeight: 700, color: "var(--ink, #1A1714)",
              lineHeight: 1.22, margin: 0, letterSpacing: "-0.01em",
              overflowWrap: "break-word", wordBreak: "break-word",
            }}>
              {displayName}
            </h2>
            {((age !== null && age !== undefined) || birthplace) && (
              <p style={{
                fontSize: "11px", color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)", margin: "5px 0 0",
                display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap",
              }}>
                {age !== null && age !== undefined && <span>{age} anos</span>}
                {birthplace && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <MapPin style={{ width: "10px", height: "10px", opacity: 0.5 }} aria-hidden />
                    {birthplace}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* ── Queixa principal ── */}
          {presentingComplaint ? (
            <div style={{ padding: "0 14px 12px", flex: 1 }}>
              <p style={{
                fontSize: "13px", lineHeight: 1.6,
                color: "var(--ink-soft, #4A4540)", fontFamily: "var(--font-sans)", margin: 0,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {presentingComplaint}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          {/* ── Padrões (máx 3) ── */}
          {patterns.length > 0 && (
            <div style={{
              padding: "9px 14px",
              borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
            }}>
              <p style={{
                fontSize: "8px", fontWeight: 800, letterSpacing: "0.16em",
                textTransform: "uppercase", color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)", margin: "0 0 6px",
              }}>
                Padrões identificados
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                {visible.map((p, i) => <PatternToken key={i} pattern={p} />)}
                {extra > 0 && (
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--warm-gray, #6B6358)", fontFamily: "var(--font-sans)" }}>
                    +{extra}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Hipótese IA — só renderiza com dado real ── */}
          {aiInsight && (
            <div style={{
              padding: "9px 14px",
              borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.4))",
              background: "var(--surface-manuscript, rgba(240,237,229,0.45))",
            }}>
              <p style={{
                fontSize: "8px", fontWeight: 800, letterSpacing: "0.16em",
                textTransform: "uppercase", color: "var(--material-olive, #7D8060)",
                fontFamily: "var(--font-sans)", margin: "0 0 4px",
              }}>
                IA Clínica
              </p>
              {/* Serif italic apenas em frase curta — nunca em bloco longo */}
              <p style={{
                fontSize: "13px", fontFamily: "var(--font-serif)", fontStyle: "italic",
                color: "var(--ink-soft, #4A4540)", lineHeight: 1.5, margin: 0,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                "{aiInsight}"
              </p>
            </div>
          )}

          {/* ── Rodapé — consentimento + ação ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 14px",
            borderTop: "1px solid var(--material-border, rgba(180,170,155,0.4))",
            background: "rgba(244,241,235,0.6)",
            marginTop: "auto",
          }}>
            {/* Consentimento: ícone + texto, NUNCA só cor */}
            <span
              aria-label={consentStatus === "signed" ? "Consentimento assinado" : "Consentimento pendente ou ausente"}
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
            {/* CTA textual explícito — stopPropagation para não duplicar navegação */}
            <button
              onClick={e => { e.stopPropagation(); goToDossier(); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", fontFamily: "var(--font-sans)",
                color: "var(--forest, #12291F)", transition: "color 0.15s ease",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--material-gold, #C6A23A)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "var(--forest, #12291F)"}
            >
              Abrir →
            </button>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
          VARIANTE: COMPACT
          Dashboard / Agenda / Busca — densa, sem blocos longos.
          Nome domina. Status textual. Máx 2 padrões. Sem hipótese.
          Ação = clique no card inteiro.
          ═══════════════════════════════════════════════ */}
      {!isFull && (
        <>
          <div style={{
            padding: "11px 12px 8px",
            borderBottom: "1px solid var(--material-border, rgba(180,170,155,0.4))",
            background: "rgba(244,241,235,0.5)",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px",
          }}>
            {/* Status textual — compact não tem carimbo grande */}
            <span style={{
              fontSize: "8px", fontWeight: 800, letterSpacing: "0.18em",
              textTransform: "uppercase", fontFamily: "var(--font-sans)",
              color: statusCfg.color,
            }}>
              {statusCfg.label}
            </span>

            {/* Menu — stopPropagation */}
            <div onClick={e => e.stopPropagation()}>
              <CardMenu
                patientName={displayName}
                status={status}
                onEdit={onEdit}
                onArchive={onArchive}
                onDelete={onDelete}
                compact
              />
            </div>
          </div>

          {/* Nome + meta */}
          <div style={{ padding: "10px 12px 8px", flex: 1 }}>
            <h3 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.05rem",
              fontWeight: 700, color: "var(--ink, #1A1714)",
              lineHeight: 1.22, margin: 0, letterSpacing: "-0.01em",
              overflowWrap: "break-word", wordBreak: "break-word",
            }}>
              {displayName}
            </h3>
            {(age !== null && age !== undefined) && (
              <p style={{
                fontSize: "11px", color: "var(--warm-gray, #6B6358)",
                fontFamily: "var(--font-sans)", margin: "4px 0 0",
              }}>
                {age} anos{subtitle ? ` · ${subtitle}` : ""}
              </p>
            )}
            {presentingComplaint && (
              <p style={{
                fontSize: "12px", color: "var(--ink-soft, #4A4540)",
                fontFamily: "var(--font-sans)", margin: "6px 0 0", lineHeight: 1.5,
                display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {presentingComplaint}
              </p>
            )}
          </div>

          {/* Padrões (máx 2) — sem hipótese IA, sem bloco de consentimento */}
          {patterns.length > 0 && (
            <div style={{
              padding: "6px 12px 10px",
              borderTop: "1px dashed var(--material-border, rgba(180,170,155,0.35))",
              display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center",
            }}>
              {visible.map((p, i) => <PatternToken key={i} pattern={p} />)}
              {extra > 0 && (
                <span style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--warm-gray, #6B6358)", fontFamily: "var(--font-sans)" }}>
                  +{extra}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   CARD MENU — componente interno reutilizado nas duas variantes
   ───────────────────────────────────────────────────────────── */

function CardMenu({
  patientName,
  status,
  onEdit,
  onArchive,
  onDelete,
  compact = false,
}: {
  patientName: string;
  status: DossierStatus;
  onEdit:    () => void;
  onArchive: () => void;
  onDelete:  () => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={compact ? "size-6 opacity-40 hover:opacity-100" : "size-7 opacity-40 hover:opacity-100"}
          aria-label={`Ações para o dossiê de ${patientName}`}
        >
          <MoreHorizontal style={{ width: compact ? "12px" : "13px", height: compact ? "12px" : "13px" }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil style={{ width: "13px", height: "13px" }} /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchive}>
          {status === "archived"
            ? <><ArchiveRestore style={{ width: "13px", height: "13px" }} /> Reativar</>
            : <><Archive        style={{ width: "13px", height: "13px" }} /> Arquivar</>
          }
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 style={{ width: "13px", height: "13px" }} /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─────────────────────────────────────────────────────────────
   SKELETON — estado de loading

   aria-busy="true" no container externo → anuncia carregamento
   aria-hidden="true" no conteúdo visual → formas ignoradas pelo leitor de tela
   As duas responsabilidades são separadas (não no mesmo elemento).
   ───────────────────────────────────────────────────────────── */

export function DossierCardSkeleton({ variant = "full" }: { variant?: "full" | "compact" }) {
  const minH = variant === "compact" ? "145px" : "220px";
  return (
    <div
      aria-busy="true"
      aria-label="Carregando dossiê"
      style={{
        minHeight: minH, borderRadius: "12px",
        border: "1px solid rgba(180,170,155,0.35)",
        borderLeft: "3px solid rgba(180,170,155,0.35)",
        background: "var(--surface-dossier, #FAFAF4)",
        overflow: "hidden",
      }}
    >
      {/* Conteúdo visual do skeleton — ignorado pelo leitor de tela */}
      <div aria-hidden="true">
        <div style={{ padding: "12px 14px 9px", background: "rgba(244,241,235,0.45)", borderBottom: "1px solid rgba(180,170,155,0.25)" }}>
          <div className="skeleton" style={{ height: "8px", width: "52%", borderRadius: "4px" }} />
        </div>
        <div style={{ padding: "13px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton" style={{ height: "20px", width: "76%", borderRadius: "4px" }} />
          <div className="skeleton" style={{ height: "10px", width: "40%", borderRadius: "4px" }} />
          {variant === "full" && (
            <div style={{ marginTop: "8px" }}>
              <div className="skeleton" style={{ height: "12px", width: "100%", borderRadius: "4px", marginBottom: "5px" }} />
              <div className="skeleton" style={{ height: "12px", width: "65%",  borderRadius: "4px" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
