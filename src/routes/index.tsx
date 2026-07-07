import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  GitBranch,
  LibraryBig,
  Mic,
  ScanSearch,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LizLogo, LizLogoLockup } from "@/components/liz-logo";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const modules = [
  {
    icon: GitBranch,
    title: "Genossociograma",
    body: "Árvore interativa onde cada nó é um banco de dados: datas, doenças, profissões, traumas, segredos, mandatos.",
  },
  {
    icon: ScanSearch,
    title: "Motor de Padrões",
    body: "Detecção automática de repetições transgeracionais: síndrome de aniversário, doenças em linha, rupturas afetivas.",
  },
  {
    icon: Mic,
    title: "Prontuário por Voz",
    body: "Fale ao final da sessão. A plataforma transcreve, estrutura e gera o registro clínico automaticamente.",
  },
  {
    icon: LibraryBig,
    title: "Biblioteca Sistêmica",
    body: "Schützenberger, Jodorowsky, Hellinger, Dolto — organizados por tema e ligados ao caso em questão.",
  },
  {
    icon: BrainCircuit,
    title: "Copiloto Clínico",
    body: "IA treinada em psicogenealogia. Sugere hipóteses, nunca diagnostica. Postura de supervisor, não de terapeuta.",
  },
  {
    icon: Sparkles,
    title: "Memória entre Casos",
    body: '"Já atendi alguém parecido?". Busca semântica em toda a sua base clínica, em linguagem natural.',
  },
];

const ethics = [
  { n: "I", text: "Criptografia ponta a ponta. Isolamento total entre profissionais." },
  { n: "II", text: "Consentimento explícito. Direito ao esquecimento e portabilidade de dados." },
  { n: "III", text: "Nenhum dado é usado para treinar IA sem consentimento granular." },
  { n: "IV", text: "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F4] text-primary relative overflow-hidden selection:bg-mahogany/20">
      {/* ── TEXTURA DE PAPEL GLOBAL ── */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] mix-blend-multiply" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* ── HEADER ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-mahogany/10 bg-[#FCF9F4]/80 backdrop-blur-xl">
        <div className="container-liz flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LizLogoLockup />
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="font-serif text-primary hover:bg-mahogany/5">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-mahogany text-mahogany hover:bg-mahogany hover:text-white font-serif transition-colors">
              <Link to="/auth" search={{ mode: "signup" }}>
                Acesso beta →
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO — A Mesa do Genealogista ────────────────────────────── */}
      <section className="relative z-10 overflow-hidden pt-20 pb-32 md:pt-32 md:pb-48">
        <div className="container-liz relative flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          
          {/* Esquerda: Texto */}
          <div className="flex-1 relative z-20">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-sm border border-mahogany/20 bg-mahogany/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-mahogany"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-mahogany/60" />
              Gabinete de Pesquisa · 2026
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
              className="mt-8 font-serif text-5xl font-bold leading-[0.9] tracking-tight text-primary md:text-7xl lg:text-[85px]"
            >
              O segundo
              <br />
              <em className="italic text-mahogany/80">cérebro</em>
              <br />
              do psicogene-
              <br />
              alogista.
            </motion.h1>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeInOut" }}
              className="my-10 h-px bg-mahogany/30"
            />

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="max-w-md text-lg leading-relaxed text-primary/70 md:text-xl font-serif"
            >
              Combinando arquivos históricos, inteligência clínica e tecnologia contemporânea em um 
              <strong className="text-primary font-bold"> laboratório vivo da memória familiar.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="mt-12 flex flex-wrap gap-4"
            >
              <Button asChild size="xl" className="bg-mahogany text-white hover:bg-mahogany-mid rounded-sm px-8 font-serif">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Adentrar o arquivo
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Direita: A Cena / Colagem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
            className="flex-1 relative z-10 w-full h-[500px] lg:h-[700px] mt-10 lg:mt-0"
          >
            {/* Foto principal (Fundo) */}
            <div className="absolute right-0 top-10 w-[80%] aspect-[3/4] lg:aspect-square bg-white shadow-2xl p-3 border border-[#E6DDD0] rotate-[3deg] z-10">
              <img
                src={hero1}
                alt="Pesquisa genealógica"
                className="w-full h-full object-cover sepia-[.4] contrast-[1.1] saturate-[0.7]"
              />
            </div>
            
            {/* Polaroid secundária (Frente) */}
            <div className="absolute left-0 bottom-20 w-[55%] aspect-square bg-[#FAF8F5] shadow-xl p-4 pb-12 border border-[#E6DDD0] rotate-[-5deg] z-20">
              <img
                src={hero2}
                alt="Sessão clínica"
                className="w-full h-full object-cover sepia-[.3] contrast-[1.1]"
              />
              <p className="absolute bottom-4 left-0 right-0 text-center font-serif text-sm italic text-ink/50">
                Memória viva.
              </p>
            </div>

            {/* Fio invisível desenhado no papel */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 500 500" fill="none">
              <path d="M 100 400 Q 250 150 450 300" stroke="#8B3A3A" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
              <circle cx="100" cy="400" r="3" fill="#8B3A3A" opacity="0.6" />
              <circle cx="450" cy="300" r="3" fill="#8B3A3A" opacity="0.6" />
            </svg>
          </motion.div>

        </div>
      </section>

      {/* ── MÓDULOS — "Capítulo I: As Fichas do Arquivo" ───────────────────────── */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="container-liz">
          <div className="relative mb-20 flex flex-col md:flex-row items-baseline gap-4 md:gap-10">
            <span aria-hidden className="font-serif text-2xl md:text-3xl text-mahogany/30 italic">
              Capítulo I.
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary max-w-2xl leading-[1.1]">
              A inteligência clínica meticulosamente catalogada.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, i) => (
              <motion.article
                key={m.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                className="group relative bg-white/70 backdrop-blur-sm p-8 shadow-sm transition-all duration-500 hover:shadow-md border border-[#E6DDD0]/70 hover:border-mahogany/30 hover:bg-white"
              >
                {/* Numeração da ficha */}
                <span className="absolute top-6 right-6 font-mono text-[10px] text-primary/30">
                  REF-{String(i + 1).padStart(3, '0')}
                </span>
                
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCF9F4] border border-[#E6DDD0]">
                  <m.icon className="size-5 text-mahogany/70" strokeWidth={1.2} />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary tracking-tight">{m.title}</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-primary/70">{m.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITAÇÃO COM SCRAPBOOK (Fita Adesiva) ──────────────────────────── */}
      <section className="relative z-10 py-32 flex justify-center">
        <div className="container-liz max-w-3xl text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative inline-block"
          >
            {/* Fita adesiva */}
            <div aria-hidden className="absolute -top-5 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#D4C3A3]/60 mix-blend-multiply rotate-[-2deg] shadow-sm rounded-[1px] z-20" />
            
            <div className="bg-[#FAF8F5] p-12 md:p-16 shadow-lg border border-[#E6DDD0] relative z-10 rotate-[1deg]">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-mahogany-mid/50 mb-8">
                Nota de Pesquisa
              </p>
              <blockquote className="font-serif text-3xl font-bold italic leading-relaxed text-primary md:text-4xl">
                "O que não pode ser dito,
                <br />
                não pode ser esquecido —
                <br />
                <span className="text-mahogany/80">apenas repetido."</span>
              </blockquote>
              <div className="mt-8 mx-auto h-px w-16 bg-mahogany/20" />
              <p className="mt-6 text-[14px] font-serif italic text-primary/60">— inspirado em Françoise Dolto</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SEÇÃO VISUAL: Volume II ───────────────────────────── */}
      <section className="relative z-10 py-24 md:py-32">
        <div className="container-liz flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex-1 w-full relative"
          >
            <div className="absolute top-4 -left-4 w-full h-full border border-mahogany/10 rotate-[-2deg]" />
            <div className="aspect-[4/3] bg-white p-3 border border-[#E6DDD0] shadow-xl relative rotate-[1deg]">
              <img
                src={hero3}
                alt="Anotações e sistema"
                className="w-full h-full object-cover sepia-[.2] contrast-[1.05]"
              />
            </div>
          </motion.div>
          
          <div className="flex-1">
            <span aria-hidden className="font-serif text-xl text-mahogany/30 italic block mb-6">
              Volume II.
            </span>
            <h2 className="font-serif text-3xl font-bold text-primary md:text-5xl mb-8 leading-[1.1]">
              A <em className="italic text-mahogany/80">leveza</em> de uma <br />
              gestão impecável.
            </h2>
            <p className="text-lg text-primary/70 mb-10 leading-relaxed font-serif">
              O Dossiê Clínico organiza o labirinto de histórias, datas e padrões, permitindo que o psicogenealogista foque na presença terapêutica e na investigação humana.
            </p>
            <ul className="space-y-5">
              {[
                "Genograma dinâmico desenhado sem esforço.",
                "Menos papel disperso, mais memória estruturada.",
                "Foco absoluto no fio invisível da sessão.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-1.5 flex-shrink-0 size-1.5 rounded-full bg-mahogany/60" />
                  <span className="text-[16px] text-primary/80 font-serif leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── ÉTICA & LGPD — "Documento Confidencial" ───────────────────────── */}
      <section className="relative z-10 py-24 md:py-32 border-t border-mahogany/10 bg-[#FAF8F5]/50">
        <div className="container-liz">
          <div className="relative mb-20 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-mahogany/20 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-mahogany mb-6">
              <ShieldCheck className="size-3.5" strokeWidth={1.5} />
              Termo de Ética
            </div>
            <h2 className="font-serif text-4xl font-bold text-primary md:text-5xl max-w-2xl">
              Dados clínicos são <em className="italic text-mahogany/80">fundação</em>,
              não feature.
            </h2>
          </div>

          <div className="max-w-4xl mx-auto grid gap-x-12 gap-y-8 md:grid-cols-2">
            {ethics.map((item) => (
              <div key={item.n} className="flex gap-6 border-t border-mahogany/10 pt-6">
                <span className="font-serif text-2xl font-bold text-mahogany/30 italic">
                  {item.n}.
                </span>
                <p className="text-[16px] leading-relaxed text-primary/75 font-serif">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────── */}
      <section className="relative z-10 py-32 md:py-48 text-center border-t border-[#E6DDD0]">
        <div className="container-liz max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <ShieldCheck className="size-8 mx-auto text-mahogany/30 mb-8" strokeWidth={1} />
            <h2 className="font-serif text-5xl font-bold text-primary md:text-6xl mb-6">
              Inicie a <em className="italic text-mahogany/80">pesquisa</em>.
            </h2>
            <p className="text-xl text-primary/60 font-serif mb-12">
              Acesso restrito ao laboratório vivo da psicogenealogia.
            </p>
            <Button asChild size="xl" className="bg-mahogany text-white hover:bg-mahogany-mid rounded-sm px-10 font-serif text-lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Adentrar o arquivo →
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-mahogany/10 bg-[#FAF8F5]">
        <div className="container-liz flex flex-col md:flex-row items-center justify-between gap-6 py-12">
          <div className="flex items-center gap-4">
            <LizLogo size={24} className="text-mahogany opacity-80" />
            <p className="font-serif text-[15px] text-primary/60 italic">
              O Gabinete do Genealogista.
            </p>
          </div>
          <p className="text-[12px] uppercase tracking-[0.2em] font-bold text-primary/30">
            Beta fechado · 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
