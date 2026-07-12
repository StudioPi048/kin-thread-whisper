import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BrainCircuit,
  GitBranch,
  LibraryBig,
  Mic,
  ScanSearch,
  Sparkles,
  ShieldCheck,
  Lock,
  EyeOff,
  UserCheck,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LizLogoLockup } from "@/components/liz-logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

/* ─── DADOS ─────────────────────────────────────────────── */
const ETHICS = [
  {
    Icon: Lock,
    n: "01",
    text: "Criptografia em repouso e em trânsito. Isolamento total entre profissionais.",
  },
  {
    Icon: UserCheck,
    n: "02",
    text: "Consentimento explícito. Direito ao esquecimento e portabilidade de dados.",
  },
  {
    Icon: EyeOff,
    n: "03",
    text: "Nenhum dado é usado para treinar IA sem consentimento granular.",
  },
  {
    Icon: Sparkles,
    n: "04",
    text: "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico.",
  },
];

const FEATURES = [
  { Icon: GitBranch, label: "Genossociograma vivo" },
  { Icon: ScanSearch, label: "Motor de padrões" },
  { Icon: Mic, label: "Prontuário por voz" },
  { Icon: LibraryBig, label: "Biblioteca sistêmica" },
  { Icon: BrainCircuit, label: "Copiloto clínico" },
  { Icon: Sparkles, label: "Memória entre casos" },
];

/* ─── ATOMS ──────────────────────────────────────────────── */

/** Fita adesiva CSS pura */
function Tape({ rotate = "0deg", w = "64px" }: { rotate?: string; w?: string }) {
  return (
    <div
      style={{
        width: w,
        height: "20px",
        background: "rgba(210,190,155,0.72)",
        transform: `rotate(${rotate})`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        flexShrink: 0,
      }}
    />
  );
}

export default function LandingPage() {
  return (
    <div
      style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        background: "#FCF9F4",
        color: "#3B2F2F",
        overflowX: "hidden",
      }}
    >
      {/* ═══════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════ */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(252,249,244,0.97)",
          borderBottom: "1px solid #E6DDD0",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          className="container-liz"
          style={{
            display: "flex",
            height: "72px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link to="/" aria-label="Instituto Liz">
            <LizLogoLockup />
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <Link
              to="/auth"
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#3B2F2F",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#846221")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#3B2F2F")}
            >
              Entrar
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#3B2F2F",
                border: "1.5px solid #3B2F2F",
                borderRadius: "999px",
                padding: "10px 24px",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              Acesso beta →
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          HERO — metade esquerda texto / metade direita foto
      ════════════════════════════════════════════════════ */}
      <section
        style={{ display: "flex", minHeight: "100vh", paddingTop: "68px", background: "#1B211A" }}
      >
        {/* Coluna Texto */}
        <div
          style={{
            flex: "0 0 42%",
            display: "flex",
            alignItems: "center",
            padding: "80px 40px 80px 6vw",
          }}
        >
          <div style={{ maxWidth: "440px" }}>
            {/* Label */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}
            >
              <ShieldCheck
                style={{ width: "20px", height: "20px", color: "#D4AF37", flexShrink: 0 }}
                strokeWidth={1}
              />
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#D4AF37",
                }}
              >
                Ética & LGPD
              </span>
            </div>

            {/* H1 */}
            <h1
              style={{
                fontSize: "clamp(2.8rem, 5vw, 4.2rem)",
                fontWeight: 700,
                lineHeight: 1.06,
                letterSpacing: "-0.01em",
                color: "#fff",
                margin: "0 0 28px",
              }}
            >
              Dados clínicos são <em style={{ fontStyle: "italic", color: "#D4AF37" }}>fundação</em>
              , <br />
              não feature.
            </h1>

            {/* Body — mínimo 20px para 40+ */}
            <p
              style={{
                fontSize: "22px",
                lineHeight: 1.8,
                color: "rgba(255,255,255,0.75)",
                marginBottom: "36px",
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              Uma plataforma segura, ética e viva para psicogenealogistas que cuidam de histórias
              humanas reais.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "#D4AF37",
                  color: "#000",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "18px 36px",
                  borderRadius: "2px",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(212,175,55,0.35)",
                  transition: "background 0.2s",
                }}
              >
                Solicitar acesso beta →
              </Link>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.75)",
                  padding: 0,
                }}
              >
                <PlayCircle
                  style={{ width: "24px", height: "24px", color: "#D4AF37" }}
                  strokeWidth={1}
                />
                Ver como funciona
              </button>
            </div>
          </div>
        </div>

        {/* Coluna Foto — composição única full-bleed */}
        <div
          style={{ flex: "0 0 58%", position: "relative", overflow: "hidden", minHeight: "600px" }}
        >
          <img
            src="/assets/hero/hero_composition.jpg"
            alt="Livro de genealogia com fotos vintage e caneta"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
          {/* Gradiente esquerda para fundir com o texto */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, #1B211A 0%, rgba(27,33,26,0.4) 30%, transparent 60%)",
            }}
          />
          {/* Gradiente inferior */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, #1B211A 0%, transparent 40%)",
            }}
          />

          {/* Cartão de papel flutuante — canto superior direito */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              right: "4%",
              background: "#FAF8F5",
              border: "1px solid #E6DDD0",
              padding: "24px 28px",
              width: "220px",
              transform: "rotate(7deg)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
              zIndex: 10,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-12px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <Tape rotate="-1deg" w="72px" />
            </div>
            <p
              style={{
                fontSize: "19px",
                fontStyle: "italic",
                color: "#3B2F2F",
                lineHeight: 1.55,
                textAlign: "center",
                margin: 0,
                fontWeight: 500,
              }}
            >
              Cada história merece ser lembrada.
              <br />
              Cada vida, respeitada. ♡
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          PAINEL PILARES
      ════════════════════════════════════════════════════ */}
      <section
        style={{ position: "relative", zIndex: 20, marginTop: "-120px", padding: "0 24px 0" }}
      >
        <div className="container-liz" style={{ maxWidth: "1120px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              background: "#1A201A",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Esquerda — "03" + título */}
            <div
              style={{
                flex: "0 0 38%",
                background: "#151A15",
                padding: "56px 48px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* Número decorativo GRANDE */}
              <span
                style={{
                  position: "absolute",
                  left: "16px",
                  top: "16px",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "140px",
                  fontWeight: 700,
                  color: "rgba(212,175,55,0.06)",
                  lineHeight: 1,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                03
              </span>
              <p
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#D4AF37",
                  marginBottom: "20px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Pilares da plataforma
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.8rem,2.8vw,2.4rem)",
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1.25,
                  margin: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Ética, segurança e inteligência a{" "}
                <em style={{ fontStyle: "italic", color: "#D4AF37" }}>serviço da vida.</em>
              </h2>
            </div>

            {/* Direita — 4 pilares */}
            <div
              style={{
                flex: 1,
                background: "#1C201B",
                padding: "56px 48px",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "40px",
                alignItems: "start",
              }}
            >
              {ETHICS.map(({ Icon, n, text }) => (
                <div key={n} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <Icon
                    style={{
                      width: "28px",
                      height: "28px",
                      color: "rgba(212,175,55,0.65)",
                      flexShrink: 0,
                    }}
                    strokeWidth={1}
                  />
                  <span
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "15px",
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {n}
                  </span>
                  <p
                    style={{
                      fontSize: "18px",
                      lineHeight: 1.7,
                      color: "rgba(255,255,255,0.85)",
                      margin: 0,
                    }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SEÇÃO 2 — Gestão impecável
          Layout: texto | foto central | card botanicals
      ════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "120px 24px 80px", overflow: "hidden" }}>
        {/* Fundo com botanicals watermark */}
        <div style={{ position: "absolute", inset: 0, background: "#F5F0E8", zIndex: 0 }} />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "55%",
            zIndex: 0,
            opacity: 0.22,
          }}
        >
          <img
            src="/assets/photos/section2_botanicals.jpg"
            alt=""
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "left center",
            }}
          />
        </div>

        <div
          className="container-liz"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: "40px",
          }}
        >
          {/* Coluna Texto */}
          <div style={{ flex: "0 0 26%", minWidth: 0 }}>
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#6B563D",
                marginBottom: "18px",
              }}
            >
              A leveza de uma
            </p>
            <h2
              style={{
                fontSize: "clamp(2.1rem, 3.5vw, 2.9rem)",
                fontWeight: 700,
                color: "#2B2018",
                lineHeight: 1.1,
                marginBottom: "20px",
              }}
            >
              Gestão <br />
              impecável <br />
              para <em style={{ fontStyle: "italic", color: "#846221" }}>histórias</em>
              <br />
              complexas.
            </h2>
            <p
              style={{
                fontSize: "20px",
                lineHeight: 1.8,
                color: "#5A4A3A",
                marginBottom: "32px",
                maxWidth: "260px",
              }}
            >
              Organize seus casos, enxergue padrões e acesse memórias que transformam gerações.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#1B211A",
                color: "#fff",
                fontFamily: "'Outfit', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "16px 32px",
                borderRadius: "2px",
                textDecoration: "none",
              }}
            >
              Começar agora →
            </Link>
          </div>

          {/* Foto Central — terapeuta com laptop */}
          <div style={{ flex: "0 0 30%", position: "relative" }}>
            <div
              style={{
                position: "relative",
                transform: "rotate(-2deg)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <Tape rotate="-1deg" w="72px" />
              </div>
              <img
                src="/assets/photos/section2_woman.jpg"
                alt="Profissional trabalhando"
                style={{
                  width: "100%",
                  aspectRatio: "3/4",
                  objectFit: "cover",
                  objectPosition: "50% 15%",
                  border: "8px solid white",
                  display: "block",
                }}
              />
            </div>
          </div>

          {/* Card de papel — features + botanicals */}
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <div
              style={{
                position: "relative",
                background: "rgba(250,248,245,0.92)",
                border: "1px solid #E0D5C5",
                padding: "28px 28px 24px",
                transform: "rotate(1.5deg)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <Tape rotate="2deg" w="56px" />
              </div>

              {/* Features */}
              <div>
                {FEATURES.map(({ Icon, label }, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "14px 0",
                      borderBottom:
                        i < FEATURES.length - 1 ? "1px solid rgba(224,213,197,0.7)" : "none",
                    }}
                  >
                    <Icon
                      style={{ width: "20px", height: "20px", color: "#846221", flexShrink: 0 }}
                      strokeWidth={1.2}
                    />
                    <span style={{ fontSize: "19px", color: "#3B2F2F", lineHeight: 1.4 }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ornamento de assinatura — selo de cera fotorrealista */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: "14px",
                  marginTop: "12px",
                  borderTop: "1px solid rgba(224,213,197,0.6)",
                }}
              >
                <img
                  src="/assets/objects/wax_seal_tree.jpg"
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: "40px",
                    height: "40px",
                    objectFit: "cover",
                    borderRadius: "50%",
                    opacity: 0.5,
                    filter: "sepia(0.3)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SEÇÃO 3 — O fio invisível (bloco escuro)
      ════════════════════════════════════════════════════ */}
      <section style={{ padding: "40px 24px 60px" }}>
        <div className="container-liz" style={{ maxWidth: "1120px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "48px",
              background: "#1B211A",
              borderRadius: "24px",
              padding: "48px 56px",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
          >
            {/* Foto */}
            <div
              style={{
                flex: "0 0 42%",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <img
                src="/assets/photos/therapy_session.jpg"
                alt="Sessão de psicogenealogia"
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  objectFit: "cover",
                  objectPosition: "50% 35%",
                  display: "block",
                }}
              />
            </div>

            {/* Texto */}
            <div style={{ flex: 1, color: "#fff", minWidth: 0 }}>
              <p
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#D4AF37",
                  marginBottom: "20px",
                }}
              >
                O fio invisível da sessão
              </p>
              <h3
                style={{
                  fontSize: "clamp(1.7rem, 3vw, 2.3rem)",
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1.15,
                  marginBottom: "20px",
                  wordBreak: "break-word",
                }}
              >
                Conecte gerações, com{" "}
                <em style={{ fontStyle: "italic", color: "#D4AF37" }}>profundidade</em> e leveza.
              </h3>
              <p
                style={{
                  fontSize: "20px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.62)",
                  marginBottom: "28px",
                }}
              >
                Mapeie em tempo real o histórico do seu paciente e descubra padrões transgeracionais
                profundos sem perder o foco visual na pessoa à sua frente.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Genograma dinâmico gerado no clique",
                  "Foco absoluto no paciente",
                  "Menos papel, mais insight estruturado",
                ].map((item) => (
                  <p
                    key={item}
                    style={{
                      fontSize: "19px",
                      fontStyle: "italic",
                      color: "rgba(212,175,55,0.8)",
                      margin: 0,
                    }}
                  >
                    ✓ {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          QUOTE SECTION — Fundo com background fotográfico
      ════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          padding: "80px 24px",
          overflow: "hidden",
          minHeight: "360px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Background fotográfico texturizado */}
        <div style={{ position: "absolute", inset: 0 }}>
          <img
            src="/assets/photos/quote_bg.jpg"
            alt=""
            aria-hidden="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          {/* Overlay claro para legibilidade */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(248,244,236,0.82)" }} />
        </div>

        {/* Caneta removida conforme feedback de "Fundo branco feio" */}

        {/* Foto vintage no canto direito inferior */}
        <div
          style={{
            position: "absolute",
            right: "4%",
            bottom: "5%",
            transform: "rotate(5deg)",
            zIndex: 4,
            width: "120px",
          }}
        >
          <img
            src="/assets/photos/old_photo_man.jpg"
            alt=""
            aria-hidden="true"
            style={{
              width: "100%",
              border: "6px solid white",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              display: "block",
            }}
          />
        </div>

        {/* Card de citação */}
        <div style={{ position: "relative", zIndex: 10, maxWidth: "480px", width: "100%" }}>
          <div
            style={{
              background: "rgba(252,249,244,0.94)",
              border: "1px solid #E0D5C5",
              padding: "52px 48px 44px",
              transform: "rotate(1deg)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-10px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <Tape rotate="2deg" w="60px" />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "-10px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <Tape rotate="-2deg" w="60px" />
            </div>

            {/* Aspas tipográficas grandes — estilo editorial */}
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "18px",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "96px",
                lineHeight: 1,
                fontWeight: 700,
                color: "rgba(200,166,64,0.22)",
                userSelect: "none",
                pointerEvents: "none",
                letterSpacing: "-0.05em",
              }}
            >
              ❝
            </div>

            <blockquote style={{ margin: 0 }}>
              <p
                style={{
                  fontSize: "clamp(1.5rem, 2.8vw, 1.9rem)",
                  fontStyle: "italic",
                  fontWeight: 600,
                  color: "#2B2018",
                  lineHeight: 1.5,
                  textAlign: "center",
                  margin: "0 0 20px",
                }}
              >
                "O que não pode ser dito,
                <br />
                não pode ser esquecido —<br />
                apenas repetido."
              </p>
              <footer
                style={{
                  fontSize: "17px",
                  fontStyle: "italic",
                  color: "rgba(59,47,31,0.7)",
                  textAlign: "center",
                }}
              >
                — inspirado em Françoise Dolto
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════ */}
      <footer
        style={{
          background: "#1B211A",
          borderTop: "3px solid #D4AF37",
          paddingTop: "64px",
          paddingBottom: "32px",
        }}
      >
        <div
          className="container-liz"
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "32px",
            flexWrap: "wrap",
          }}
        >
          {/* Esquerda */}
          <div style={{ color: "#fff", maxWidth: "380px" }}>
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#D4AF37",
                marginBottom: "16px",
              }}
            >
              Beta Fechado · 2026
            </p>
            <h2
              style={{
                fontSize: "clamp(2.1rem, 3.5vw, 3rem)",
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1.15,
                marginBottom: "16px",
              }}
            >
              Pronta para <em style={{ fontStyle: "italic", color: "#D4AF37" }}>começar?</em>
            </h2>
            <p style={{ fontSize: "20px", color: "rgba(255,255,255,0.6)", lineHeight: 1.75 }}>
              Acesso restrito a psicogenealogistas. Vagas limitadas.
            </p>
          </div>

          {/* Centro — CTA (Selo e Árvore removidos por legibilidade/distorção) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#D4AF37",
                color: "#000",
                fontFamily: "'Outfit', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "18px 36px",
                borderRadius: "2px",
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(212,175,55,0.3)",
                flexShrink: 0,
              }}
            >
              Solicitar acesso beta →
            </Link>
          </div>
        </div>

        {/* Linha de rodapé */}
        <div
          className="container-liz"
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", opacity: 0.8 }}>
            <LizLogoLockup className="invert scale-75 origin-left" />
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "white",
              }}
            >
              — Plataforma de Psicogenealogia
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.65)",
              textTransform: "uppercase",
            }}
          >
            Beta fechado · 2026
          </span>
        </div>
      </footer>
    </div>
  );
}
