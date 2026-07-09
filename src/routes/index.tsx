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

/* ─── DESIGN TOKENS (usados hardcoded só aqui — landing page fora do tema) ─── */
const T = {
  /* Cores */
  bgDark:    "#1B211A",   /* Hero e footer */
  bgDarkAlt: "#151A15",   /* Painel Pilares — lado esquerdo */
  bgPanel:   "#1A201A",   /* Painel Pilares — fundo geral */
  bgLight:   "#FCF9F4",   /* Seções claras */
  bgCard:    "#FAF8F5",   /* Cartões de papel */
  gold:      "#D4AF37",   /* Dourado principal */
  goldMuted: "#C8A951",   /* Dourado desaturado */
  border:    "#E6DDD0",   /* Bordas dos cards */
  tape:      "rgba(212,195,163,0.75)", /* Fita adesiva */
  textDark:  "#3D2B1F",   /* Texto sobre fundo claro */

  /* Tipografia — escala modular 1.25 (Major Third) */
  /* Todos os tamanhos derivam de uma base de 16px */
  labelXs:   "text-[9px]  tracking-[0.25em] uppercase font-bold",  /* labels categoria */
  labelSm:   "text-[11px] tracking-[0.2em]  uppercase font-bold",  /* labels seção */
  body:      "text-[15px] leading-[1.7] font-serif",               /* corpo de texto */
  bodySm:    "text-[13px] leading-[1.65] font-serif",              /* texto pequeno */
  bullet:    "text-[13px] leading-[1.6]  font-serif italic",       /* checklist */

  /* Headings — apenas 3 tamanhos no sistema */
  h1:  "font-serif text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight",
  h2:  "font-serif text-[clamp(2rem,4vw,3rem)]     font-bold leading-[1.1]",
  h3:  "font-serif text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-[1.15]",

  /* Espaçamentos de seção padronizados */
  sectionPadY: "py-24 lg:py-32",
  containerPadX: "px-4 md:px-6",
} as const;

/* ─── DADOS ─── */
const ETHICS = [
  { Icon: Lock,     n: "01", text: "Criptografia em repouso e em trânsito. Isolamento total entre profissionais." },
  { Icon: UserCheck, n: "02", text: "Consentimento explícito. Direito ao esquecimento e portabilidade de dados." },
  { Icon: EyeOff,   n: "03", text: "Nenhum dado é usado para treinar IA sem consentimento granular." },
  { Icon: Sparkles, n: "04", text: "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico." },
];

const FEATURES = [
  { Icon: GitBranch,   label: "Genossociograma vivo" },
  { Icon: ScanSearch,  label: "Motor de padrões" },
  { Icon: Mic,         label: "Prontuário por voz" },
  { Icon: LibraryBig,  label: "Biblioteca sistêmica" },
  { Icon: BrainCircuit, label: "Copiloto clínico" },
  { Icon: Sparkles,    label: "Memória entre casos" },
];

/* ─── ATOMS (CSS puro, sem assets externos com fundo problemático) ─── */

/** Caneta-tinteiro SVG — substitui pen.jpg que tinha fundo quadriculado */
function FountainPen({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="32" y="13" width="158" height="18" rx="9" fill="#1a1a1a" />
      <rect x="100" y="13" width="20" height="18" fill="#D4AF37" />
      <rect x="184" y="11" width="50" height="22" rx="10" fill="#111" />
      <rect x="182" y="14" width="5" height="16" rx="2.5" fill="#D4AF37" />
      <rect x="203" y="9" width="4" height="28" rx="2" fill="#D4AF37" />
      <circle cx="205" cy="38" r="3.5" fill="#D4AF37" />
      <path d="M32 22 L7 18 L2 22 L7 26 Z" fill="#1a1a1a" />
      <path d="M14 20 L7 18 L2 22 L7 26 L14 24 Z" fill="#D4AF37" opacity="0.85" />
      <rect x="36" y="15" width="55" height="5" rx="2.5" fill="white" opacity="0.06" />
    </svg>
  );
}

/** Selo de Cera SVG — substitui wax_seal_tree.jpg */
function WaxSeal({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="36" fill="#5C3D2E" />
      <circle cx="40" cy="40" r="29" fill="#6B4535" />
      <line x1="40" y1="57" x2="40" y2="23" stroke="#D4AF37" strokeWidth="1.8" />
      <line x1="40" y1="37" x2="29" y2="28" stroke="#D4AF37" strokeWidth="1.4" />
      <line x1="40" y1="33" x2="51" y2="25" stroke="#D4AF37" strokeWidth="1.4" />
      <line x1="40" y1="44" x2="26" y2="36" stroke="#D4AF37" strokeWidth="1.4" />
      <line x1="40" y1="44" x2="54" y2="37" stroke="#D4AF37" strokeWidth="1.4" />
      <circle cx="40" cy="20" r="4" fill="#D4AF37" opacity="0.9" />
      <circle cx="25" cy="26" r="3" fill="#D4AF37" opacity="0.65" />
      <circle cx="55" cy="23" r="3" fill="#D4AF37" opacity="0.65" />
      <circle cx="40" cy="40" r="34" stroke="#D4AF37" strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

/** Fita Adesiva CSS */
function Tape({ rotate = "0deg", width = "w-16" }: { rotate?: string; width?: string }) {
  return (
    <div
      className={`${width} h-5`}
      style={{ background: "rgba(212,195,163,0.72)", transform: `rotate(${rotate})`, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
    />
  );
}

/** Label de categoria — padronizado para toda a landing */
function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`${T.labelSm} mb-5 ${light ? "text-gold" : "text-[#8B7355]"}`}>
      {children}
    </p>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F4] text-[#3B2F2F] relative overflow-x-hidden">

      {/* ── HEADER ──────────────────────────────────────── */}
      <header className="absolute top-0 w-full z-50 bg-[#FCF9F4]/98 border-b border-[#E6DDD0] backdrop-blur-sm">
        <div className="container-liz flex h-[72px] items-center justify-between">
          <Link to="/" aria-label="Instituto Liz — início">
            <LizLogoLockup />
          </Link>
          <nav className="flex items-center gap-8">
            <Link
              to="/auth"
              className="font-sans text-[12px] font-semibold tracking-[0.12em] uppercase text-[#3B2F2F]/70 hover:text-[#D4AF37] transition-colors duration-200"
            >
              Entrar
            </Link>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[#3B2F2F] text-[#3B2F2F] hover:bg-[#3B2F2F] hover:text-white font-sans text-[11px] font-semibold tracking-[0.1em] uppercase rounded-full px-6 h-10 transition-all duration-200"
            >
              <Link to="/auth" search={{ mode: "signup" }}>Acesso beta →</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════
          HERO — fundo escuro sólido
          Todos os assets flutuam sobre #1B211A — nunca sobre
          transparência ou quadriculado.
      ═══════════════════════════════════════════════════ */}
      <section
        className="relative pt-[7rem] pb-48 text-white overflow-hidden"
        style={{ background: `linear-gradient(170deg, ${T.bgDark} 0%, #22271E 100%)` }}
      >
        <div className="container-liz relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 xl:gap-24">

            {/* ── Coluna Texto ── */}
            <div className="flex-1 lg:max-w-[48%] xl:max-w-[44%] pt-8">
              {/* Label de categoria — padrão T.labelSm */}
              <div className="inline-flex items-center gap-2 mb-7">
                <ShieldCheck className="size-3.5 text-gold shrink-0" strokeWidth={2} />
                <span className={`${T.labelSm} text-gold`}>Ética & LGPD</span>
              </div>

              {/* H1 — único na página, tamanho fluido via clamp */}
              <h1 className={`${T.h1} text-white mb-7`}>
                Dados clínicos são{" "}
                <em className="italic" style={{ color: T.gold }}>fundação</em>,{" "}
                <br className="hidden lg:block" />
                não feature.
              </h1>

              {/* Body — padronizado T.body */}
              <p className={`${T.body} text-white/65 mb-10 max-w-[380px]`}>
                Uma plataforma segura, ética e viva para psicogenealogistas que
                cuidam de histórias humanas reais.
              </p>

              {/* CTAs — alinhados à esquerda, mesma altura */}
              <div className="flex flex-wrap items-center gap-5">
                <Button
                  asChild
                  className="h-12 px-8 rounded-sm font-sans font-semibold text-[13px] tracking-[0.08em] uppercase"
                  style={{ background: T.gold, color: "#000" }}
                >
                  <Link to="/auth" search={{ mode: "signup" }}>Solicitar acesso beta →</Link>
                </Button>
                <button className="inline-flex items-center gap-2.5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70 hover:text-white transition-colors duration-200">
                  <PlayCircle className="size-5" style={{ color: T.gold }} strokeWidth={1.5} />
                  Ver como funciona
                </button>
              </div>
            </div>

            {/* ── Coluna Composição Visual ── */}
            {/* Container com background idêntico ao hero — elimina qualquer borda visível */}
            <div
              className="flex-1 relative w-full h-[480px] lg:h-[560px]"
              style={{ background: T.bgDark }}
            >
              {/* Livro como background com vinhetas */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src="/assets/hero/book.jpg"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover object-center opacity-60 sepia-[0.15]"
                />
                {/* Vinheta esquerda (funde com a coluna de texto) */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${T.bgDark} 0%, transparent 35%)` }} />
                {/* Vinheta inferior */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${T.bgDark} 0%, transparent 50%)` }} />
                {/* Vinheta direita leve */}
                <div className="absolute inset-0" style={{ background: `linear-gradient(to left, ${T.bgDark} 0%, transparent 20%)` }} />
              </div>

              {/* Foto 1 — Mulher, canto esquerdo superior */}
              <div className="absolute left-[4%] top-[10%] w-[32%] z-20 -rotate-[6deg] shadow-2xl hover:-rotate-[2deg] transition-transform duration-700">
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Tape rotate="-2deg" /></div>
                  <img src="/assets/photos/old_photo_woman.jpg" alt="Retrato vintage" className="w-full border-[9px] border-[#F4EFE6] shadow-xl" />
                </div>
              </div>

              {/* Foto 2 — Família, centro inferior */}
              <div className="absolute left-[29%] top-[40%] w-[40%] z-20 rotate-[4deg] shadow-2xl hover:rotate-[7deg] transition-transform duration-700">
                <div className="relative">
                  <div className="absolute -top-3 right-4 z-10"><Tape rotate="14deg" /></div>
                  <img src="/assets/photos/old_photo_family.jpg" alt="Família vintage" className="w-full border-[9px] border-[#F0EBE1] shadow-xl" />
                </div>
              </div>

              {/* Cartão de Papel — canto superior direito */}
              <div
                className="absolute top-[8%] right-[5%] w-[190px] p-5 shadow-2xl rotate-[8deg] border z-30"
                style={{ background: T.bgCard, borderColor: T.border }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Tape rotate="1deg" /></div>
                <p className={`${T.bodySm} italic text-[${T.textDark}] text-center`}>
                  Cada história merece ser lembrada.<br />
                  Cada vida, respeitada. ♡
                </p>
              </div>

              {/* Caneta SVG — canto inferior direito, não cobre texto */}
              <div className="absolute bottom-[10%] right-[3%] w-36 z-30 -rotate-[28deg]">
                <FountainPen className="w-full drop-shadow-lg" />
              </div>

              {/* Selo SVG — canto inferior esquerdo */}
              <div className="absolute bottom-[28%] left-[6%] w-[72px] z-40 -rotate-[14deg]">
                <WaxSeal className="w-full drop-shadow-xl" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PAINEL PILARES — flutua sobre o hero
          -mt calibrado para que o overlap seja exatamente
          metade da altura do painel (~80px).
      ═══════════════════════════════════════════════════ */}
      <section className="relative z-30 -mt-20 px-4">
        <div className="container-liz max-w-6xl">
          <div
            className="rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-[0_32px_64px_rgba(0,0,0,0.45)]"
            style={{ background: T.bgPanel, border: "1px solid rgba(255,255,255,0.04)" }}
          >
            {/* Esquerda — Título */}
            <div
              className="p-10 md:w-[36%] flex flex-col justify-center relative overflow-hidden shrink-0"
              style={{ background: T.bgDarkAlt }}
            >
              {/* "03" sangra pelo fundo — ornamento intencional */}
              <span className="absolute left-3 bottom-[-3.5rem] font-serif font-bold text-white/[0.035] leading-none select-none pointer-events-none" style={{ fontSize: "10rem" }}>
                03
              </span>
              <SectionLabel light>Pilares da plataforma</SectionLabel>
              <h2 className={`${T.h3} text-white relative z-10 leading-snug`}>
                Ética, segurança e inteligência a{" "}
                <em className="italic" style={{ color: T.gold }}>serviço da vida.</em>
              </h2>
            </div>

            {/* Direita — 4 colunas de pilares */}
            <div className="p-10 flex-1 grid grid-cols-2 md:grid-cols-4 gap-8 items-start">
              {ETHICS.map(({ Icon, n, text }) => (
                <div key={n} className="flex flex-col gap-3">
                  <Icon className="size-5 shrink-0" style={{ color: `${T.gold}99` }} strokeWidth={1.5} />
                  <span className={`${T.labelXs} text-white/35`}>{n}</span>
                  <p className={`${T.bodySm} text-white/55`}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SEÇÃO 2 — Gestão impecável
          Layout: texto à esquerda / card-papel à direita
      ═══════════════════════════════════════════════════ */}
      <section className={`${T.sectionPadY} pt-40 bg-[${T.bgLight}] ${T.containerPadX}`}>
        <div className="container-liz flex flex-col lg:flex-row items-center gap-16 xl:gap-24">

          {/* Texto */}
          <div className="flex-1 lg:max-w-[44%]">
            <SectionLabel>A leveza de uma</SectionLabel>
            <h2 className={`${T.h2} text-[#3B2F2F] mb-6`}>
              Gestão <br />
              impecável <br />
              para <em className="italic" style={{ color: T.gold }}>histórias</em> <br />
              complexas.
            </h2>
            <p className={`${T.body} text-[#3B2F2F]/65 mb-10 max-w-[340px]`}>
              Organize seus casos, enxergue padrões e acesse memórias que transformam gerações.
            </p>
            <Button
              asChild
              className="h-12 px-8 rounded-sm font-sans font-semibold text-[13px] tracking-[0.08em] uppercase text-white"
              style={{ background: T.bgDark }}
            >
              <Link to="/auth" search={{ mode: "signup" }}>Começar agora →</Link>
            </Button>
          </div>

          {/* Card-papel com foto + features */}
          <div className="flex-1 w-full flex justify-center lg:justify-end">
            <div
              className="relative pt-8 px-7 pb-6 shadow-2xl w-full max-w-[400px] rotate-[2deg] border"
              style={{ background: T.bgCard, borderColor: T.border }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Tape rotate="-3deg" /></div>

              {/* Foto — object-position alinhado ao rosto (não ao teto) */}
              <div className="mb-5 overflow-hidden border-[7px] border-white shadow-inner">
                <img
                  src="/assets/photos/therapist_office.jpg"
                  alt="Profissional trabalhando"
                  className="w-full h-52 object-cover sepia-[0.08]"
                  style={{ objectPosition: "50% 25%" }}
                />
              </div>

              {/* Lista de features — tipografia bodySm consistente */}
              <div className="space-y-0">
                {FEATURES.map(({ Icon, label }, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-2.5"
                    style={{ borderBottom: i < FEATURES.length - 1 ? `1px solid ${T.border}80` : "none" }}
                  >
                    <Icon className="size-4 shrink-0" style={{ color: T.gold }} strokeWidth={1.5} />
                    <span className={`${T.bodySm} text-[#3B2F2F]/80`}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Rodapé do card — selo como assinatura */}
              <div className="flex justify-center pt-4 mt-3" style={{ borderTop: `1px solid ${T.border}80` }}>
                <WaxSeal className="w-7 h-7 opacity-25" />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SEÇÃO 3 — O fio invisível (bloco escuro arredondado)
      ═══════════════════════════════════════════════════ */}
      <section className={`${T.sectionPadY} ${T.containerPadX} bg-[${T.bgLight}]`}>
        <div className="container-liz max-w-6xl">
          <div
            className="rounded-3xl p-8 md:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
            style={{ background: T.bgDark }}
          >
            {/* Imagem */}
            <div className="flex-1 lg:max-w-[46%] w-full">
              <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <img
                  src="/assets/photos/therapy_session.jpg"
                  alt="Sessão clínica"
                  className="w-full h-full object-cover sepia-[0.12]"
                  style={{ objectPosition: "50% 35%" }}
                />
              </div>
            </div>

            {/* Texto — min-w-0 evita overflow do flex item */}
            <div className="flex-1 text-white min-w-0">
              <SectionLabel light>O fio invisível da sessão</SectionLabel>
              <h3 className={`${T.h3} text-white mb-5`}>
                Conecte gerações, com{" "}
                <em className="italic" style={{ color: T.gold }}>profundidade</em>{" "}
                e leveza.
              </h3>
              <p className={`${T.body} text-white/60 mb-8`}>
                Mapeie em tempo real o histórico do seu paciente e descubra padrões
                transgeracionais profundos sem perder o foco visual na pessoa à sua frente.
              </p>
              <div className="space-y-2.5">
                {["Genograma dinâmico gerado no clique", "Foco absoluto no paciente", "Menos papel, mais insight estruturado"].map((item) => (
                  <p key={item} className={`${T.bullet} text-gold/75`}>✓ {item}</p>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          QUOTE SECTION — Citação editorial
      ═══════════════════════════════════════════════════ */}
      <section className={`${T.sectionPadY} ${T.containerPadX} bg-[${T.bgLight}] flex justify-center`}>
        {/* Pontilhado de fundo muito sutil */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `radial-gradient(${T.textDark}18 1px, transparent 1px)`, backgroundSize: "22px 22px" }}
        />

        <div className="relative z-10 w-full max-w-[480px]">
          {/* Card de papel */}
          <div
            className="px-12 py-11 shadow-xl relative rotate-[1deg] border"
            style={{ background: T.bgCard, borderColor: T.border }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"><Tape rotate="2deg" /></div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10"><Tape rotate="-3deg" /></div>

            {/* Aspas ornamentais (puro CSS, sem asset) */}
            <span
              className="absolute top-5 left-6 font-serif text-6xl leading-none select-none pointer-events-none"
              style={{ color: `${T.gold}25` }}
              aria-hidden="true"
            >
              "
            </span>

            <blockquote>
              <p className={`${T.h3} text-[#3B2F2F] text-center font-serif italic font-semibold`} style={{ fontSize: "1.4rem", lineHeight: 1.55 }}>
                "O que não pode ser dito, <br />
                não pode ser esquecido — <br />
                apenas repetido."
              </p>
              <footer className={`${T.bodySm} italic text-[#3B2F2F]/40 text-center mt-5`}>
                — inspirado em Françoise Dolto
              </footer>
            </blockquote>
          </div>

          {/* Caneta SVG fora do card — abaixo e à direita */}
          <div className="flex justify-end overflow-visible -mt-3 mr-[-1.5rem]">
            <div className="rotate-[22deg]">
              <FountainPen className="w-48 drop-shadow-lg opacity-90" />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER — CTA + Rodapé editorial
      ═══════════════════════════════════════════════════ */}
      <footer
        className="pt-20 pb-10 border-t-[3px]"
        style={{ background: T.bgDark, borderColor: T.gold }}
      >
        <div className="container-liz flex flex-col md:flex-row items-center md:items-end justify-between gap-12">

          {/* Esquerda — CTA textual */}
          <div className="max-w-md text-white">
            <SectionLabel light>Beta Fechado · 2026</SectionLabel>
            <h2 className={`${T.h2} text-white mb-4`}>
              Pronta para{" "}
              <em className="italic" style={{ color: T.gold }}>começar?</em>
            </h2>
            <p className={`${T.body} text-white/50`}>
              Acesso restrito a psicogenealogistas. Vagas limitadas.
            </p>
          </div>

          {/* Direita — Polaroids + CTA */}
          <div className="flex items-center gap-8">
            {/* Minifotos vintage empilhadas */}
            <div className="hidden lg:flex items-end gap-3">
              <img
                src="/assets/photos/old_photo_man.jpg"
                alt=""
                aria-hidden="true"
                className="w-20 h-24 object-cover border-[4px] border-white/80 -rotate-[5deg] shadow-xl grayscale"
              />
              <img
                src="/assets/photos/old_photo_child.jpg"
                alt=""
                aria-hidden="true"
                className="w-24 h-28 object-cover border-[4px] border-white/80 rotate-[3deg] shadow-xl z-10 sepia-[.3]"
              />
              {/* Selo SVG puro — sem blend mode problemático */}
              <div className="w-14 h-14 -ml-3 z-20 opacity-90">
                <WaxSeal className="w-full h-full drop-shadow-xl" />
              </div>
            </div>

            <Button
              asChild
              className="h-12 px-8 rounded-sm font-sans font-semibold text-[13px] tracking-[0.08em] uppercase text-black shrink-0"
              style={{ background: T.gold }}
            >
              <Link to="/auth" search={{ mode: "signup" }}>Solicitar acesso beta →</Link>
            </Button>
          </div>

        </div>

        {/* Linha de rodapé */}
        <div className="container-liz mt-16 pt-8 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 opacity-40">
            <LizLogoLockup className="invert scale-75 origin-left" />
            <span className={`${T.labelXs} text-white`}>— Plataforma de Psicogenealogia</span>
          </div>
          <span className={`${T.labelXs} text-white/40`}>BETA FECHADO · 2026</span>
        </div>
      </footer>

    </div>
  );
}
