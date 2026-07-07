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
  Lock,
  EyeOff,
  UserCheck,
  PlayCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LizLogo, LizLogoLockup } from "@/components/liz-logo";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const ethics = [
  { icon: Lock, n: "01", text: "Criptografia em repouso e em trânsito. Isolamento total entre profissionais." },
  { icon: UserCheck, n: "02", text: "Consentimento explícito. Direito ao esquecimento e portabilidade de dados." },
  { icon: EyeOff, n: "03", text: "Nenhum dado é usado para treinar IA sem consentimento granular." },
  { icon: Sparkles, n: "04", text: "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico." },
];

const featuresList = [
  { icon: GitBranch, label: "Genossociograma vivo" },
  { icon: ScanSearch, label: "Motor de padrões" },
  { icon: Mic, label: "Prontuário por voz" },
  { icon: LibraryBig, label: "Biblioteca sistêmica" },
  { icon: BrainCircuit, label: "Copiloto clínico" },
  { icon: Sparkles, label: "Memória entre casos" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FCF9F4] text-primary relative overflow-hidden selection:bg-gold/30">
      
      {/* ── HEADER (Light) ──────────────────────────────────────── */}
      <header className="absolute top-0 w-full z-50 bg-[#FCF9F4] border-b border-[#E6DDD0]">
        <div className="container-liz flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LizLogoLockup />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="font-serif text-[11px] font-bold uppercase tracking-[0.15em] text-primary hover:text-gold transition-colors">
              Entrar
            </Link>
            <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white font-serif rounded-full px-6 transition-colors">
              <Link to="/auth" search={{ mode: "signup" }}>
                Acesso beta →
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO (Dark / Forest) ────────────────────────────── */}
      <section className="relative pt-32 pb-48 bg-[#1B241C] text-white overflow-hidden">
        {/* Folhas de fundo abstratas (CSS) */}
        <div className="absolute top-0 right-1/2 w-[800px] h-[800px] bg-forest-mid/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="container-liz relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Esquerda: Texto */}
          <div className="flex-1 mt-10">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gold mb-6">
              <ShieldCheck className="size-3.5" />
              Ética & LGPD
            </div>

            <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl lg:text-[75px] max-w-2xl">
              Dados clínicos são <br />
              <em className="italic text-[#D4AF37] font-serif">fundação</em>, <br />
              não feature.
            </h1>

            <p className="mt-8 max-w-sm text-lg leading-relaxed text-white/70 font-serif">
              Uma plataforma segura, ética e viva para psicogenealogistas que cuidam de histórias humanas reais.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Button asChild size="lg" className="bg-[#D4AF37] text-black hover:bg-[#C5A028] rounded-sm px-8 font-serif font-bold tracking-wide">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Solicitar acesso beta →
                </Link>
              </Button>
              <button className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-white/80 hover:text-white transition-colors">
                <PlayCircle className="size-5 text-gold" />
                Ver como funciona
              </button>
            </div>
          </div>

          {/* Direita: Composição "Álbum/Livro" */}
          <div className="flex-1 relative w-full h-[500px] lg:h-[600px] flex items-center justify-center">
            {/* O "Livro" Aberto (Páginas CSS) */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[110%] h-[80%] bg-[#EFE9E0] shadow-2xl rounded-sm rotate-[4deg] border border-[#D4C3A3] flex" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              {/* Divisória do livro */}
              <div className="w-1/2 h-full border-r border-[#D4C3A3]/50 shadow-[inset_-10px_0_20px_rgba(0,0,0,0.05)]" />
              <div className="w-1/2 h-full shadow-[inset_10px_0_20px_rgba(0,0,0,0.05)] relative">
                
                {/* Nota com caligrafia */}
                <div className="absolute top-10 right-4 w-[200px] bg-[#FAF8F5] p-6 shadow-md rotate-[-5deg] border border-[#E6DDD0]">
                  <p className="font-serif italic text-lg text-mahogany-mid leading-relaxed text-center">
                    Cada história merece ser lembrada.<br/>
                    Cada vida, respeitada. ♡
                  </p>
                </div>

                {/* Selos de Cera (CSS) */}
                <div className="absolute bottom-16 left-[-20px] size-16 rounded-full bg-[#8B3A3A] shadow-lg flex items-center justify-center border-4 border-[#6E2A2A] z-30">
                  <span className="text-gold/50 font-serif italic text-2xl">L</span>
                </div>
              </div>
            </div>

            {/* Fotografias Antigas Sobrepostas */}
            <div className="absolute left-[10%] top-[15%] w-[45%] aspect-[3/4] bg-white p-2 shadow-xl rotate-[-6deg] z-20">
              <img src={hero1} alt="Família" className="w-full h-full object-cover sepia-[.6] contrast-[1.2]" />
            </div>
            
            <div className="absolute left-[35%] top-[40%] w-[40%] aspect-square bg-[#FAF8F5] p-3 shadow-2xl rotate-[3deg] z-20 border border-[#E6DDD0]">
              <img src={hero2} alt="Retrato" className="w-full h-full object-cover sepia-[.4] contrast-[1.1] grayscale-[0.3]" />
            </div>

            {/* Fita adesiva */}
            <div className="absolute top-[12%] left-[20%] w-12 h-4 bg-[#D4C3A3]/80 mix-blend-multiply rotate-[-15deg] z-30" />
            <div className="absolute top-[38%] left-[45%] w-12 h-4 bg-[#D4C3A3]/80 mix-blend-multiply rotate-[10deg] z-30" />
          </div>

        </div>
      </section>

      {/* ── PAINEL FLUTUANTE (Ética e Segurança) ────────────────────────────── */}
      <section className="relative z-20 -mt-24 px-4">
        <div className="container-liz max-w-6xl">
          <div className="bg-[#1A201A] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-md">
            
            <div className="bg-[#151A15] p-10 md:w-1/3 flex flex-col justify-center relative overflow-hidden">
              <span className="absolute -left-4 -bottom-10 text-[180px] font-serif font-bold text-white/[0.02] leading-none select-none">
                03
              </span>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold mb-3 relative z-10">
                Pilares da plataforma
              </p>
              <h2 className="font-serif text-3xl font-bold text-white relative z-10">
                Ética, segurança e inteligência a <em className="italic text-gold">serviço da vida.</em>
              </h2>
            </div>

            <div className="p-10 md:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-6 text-white/80">
              {ethics.map((item) => (
                <div key={item.n} className="flex flex-col gap-3">
                  <item.icon className="size-5 text-gold/70" strokeWidth={1.5} />
                  <span className="text-[10px] font-bold text-white/40">{item.n}</span>
                  <p className="text-[12px] leading-relaxed text-white/60">{item.text}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── SEÇÃO 2 (A leveza de uma...) - Efeito Papel Rasgado ────────────────────────────── */}
      <section className="relative pt-32 pb-32 bg-[#FCF9F4]">
        <div className="container-liz flex flex-col lg:flex-row items-center gap-16 lg:gap-24 relative">
          
          {/* Esquerda: Texto */}
          <div className="flex-1 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/50 mb-6">
              A leveza de uma
            </p>
            <h2 className="font-serif text-5xl font-bold text-primary md:text-6xl mb-6 leading-[1.1]">
              Gestão <br />
              impecável <br />
              para <em className="italic text-gold">histórias</em> <br />
              complexas.
            </h2>
            <p className="text-lg text-primary/70 mb-10 leading-relaxed max-w-md">
              Organize seus casos, enxergue padrões e acesse memórias que transformam gerações.
            </p>
            <Button asChild size="lg" className="bg-[#1B241C] text-white hover:bg-black rounded-sm px-8 font-serif tracking-wide">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar agora →
              </Link>
            </Button>
          </div>

          {/* Direita: Colagem no Papel */}
          <div className="flex-1 relative w-full flex justify-center lg:justify-end">
            
            {/* Fundo de papel rasgado (Simulação CSS com clip-path ou bordas irregulares) */}
            <div className="relative bg-white p-8 shadow-xl border border-[#E6DDD0] w-full max-w-md rotate-[2deg]">
              {/* Fita adesiva */}
              <div className="absolute -top-3 left-8 w-16 h-6 bg-[#D4C3A3]/70 mix-blend-multiply rotate-[-5deg] z-20" />
              
              <div className="aspect-[4/3] w-full mb-6 relative overflow-hidden bg-muted">
                <img src={hero3} alt="Uso do sistema" className="w-full h-full object-cover sepia-[.2] contrast-[1.1]" />
              </div>

              {/* Lista de Features estilo carimbo/lista */}
              <div className="space-y-4 px-4 pb-4">
                {featuresList.map((f, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-[#E6DDD0]/50 pb-3 last:border-0">
                    <f.icon className="size-4 text-primary/50" strokeWidth={1.5} />
                    <span className="font-serif text-[15px] text-primary/80">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Ornamento (Árvore) */}
              <div className="absolute -bottom-10 -left-10 size-24 bg-gold/20 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 text-gold pointer-events-none">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22v-8"/><path d="M12 14c-2.5-2.5-2-6-2-6s1.5-1 3-1 3 1 3 1 .5 3.5-2 6"/><path d="M10 12c-2.5 1-4 1-4 1s-1-1.5-1-3 2-3 2-3"/><path d="M14 12c2.5 1 4 1 4 1s1-1.5 1-3-2-3-2-3"/><path d="M12 4c-1.5-1-2-2-2-2s1.5-1 2-1 2 1 2 1-.5 1-2 2Z"/>
                </svg>
              </div>
            </div>
            
          </div>

        </div>
      </section>

      {/* ── SEÇÃO 3 (O fio invisível) - Bloco Escuro Arredondado ────────────────────────────── */}
      <section className="relative py-16 px-4">
        <div className="container-liz max-w-6xl">
          <div className="bg-[#2A312B] rounded-3xl p-8 md:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 shadow-2xl overflow-hidden relative">
            
            {/* Elementos botânicos de fundo */}
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <svg width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="0.2">
                <path d="M12 22v-8"/><path d="M12 14c-4-4-3-10-3-10s2-2 5-2 5 2 5 2 1 6-3 10"/>
              </svg>
            </div>

            <div className="flex-1 w-full z-10">
              <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-2xl relative">
                <img src={hero2} alt="Sessão" className="w-full h-full object-cover sepia-[.3]" />
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
              </div>
            </div>

            <div className="flex-1 z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold mb-4">
                O fio invisível da sessão
              </p>
              <h2 className="font-serif text-4xl font-bold text-white md:text-5xl mb-6 leading-[1.1]">
                Conecte gerações, <br />
                com <em className="italic text-gold">profundidade</em> e leveza.
              </h2>
              <p className="text-[15px] text-white/70 mb-8 leading-relaxed max-w-md">
                Mapeie em tempo real o histórico do seu paciente e descubra padrões transgeracionais profundos sem perder o foco visual na pessoa à sua frente.
              </p>
              
              <ul className="space-y-4">
                {[
                  "Genograma dinâmico gerado no clique",
                  "Foco absoluto no paciente",
                  "Menos papel, mais insight estruturado"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/90 font-serif text-[15px]">
                    <span className="text-gold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── CITAÇÃO (Papel Rasgado / Scrapbook) ──────────────────────────── */}
      <section className="relative py-32 bg-[#E6DDD0] border-y border-[#D4C3A3] overflow-hidden">
        {/* Textura de fundo intensa */}
        <div className="absolute inset-0 opacity-20 mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(#8B3A3A 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="container-liz max-w-4xl relative z-10 flex flex-col items-center">
          
          <div className="relative">
            {/* O Pedaço de Papel */}
            <div className="bg-[#FAF8F5] p-12 md:p-16 shadow-2xl border border-white relative rotate-[-1deg] max-w-3xl" style={{ clipPath: 'polygon(2% 0, 98% 2%, 100% 98%, 1% 100%)' }}>
              <p className="font-serif text-5xl text-gold/30 absolute top-8 left-8">“</p>
              
              <blockquote className="font-serif text-3xl md:text-4xl font-bold italic leading-relaxed text-primary text-center px-8 relative z-10">
                "O que não pode ser dito, <br />
                não pode ser esquecido — <br />
                apenas repetido."
              </blockquote>
              
              <p className="mt-8 text-center text-[14px] font-serif text-primary/60">— inspirado em Françoise Dolto</p>
            </div>
            
            {/* Fita segurando */}
            <div className="absolute -top-4 left-1/4 w-20 h-6 bg-[#D4C3A3]/80 mix-blend-multiply rotate-[-8deg] shadow-sm z-20" />
            <div className="absolute -bottom-4 right-1/4 w-20 h-6 bg-[#D4C3A3]/80 mix-blend-multiply rotate-[5deg] shadow-sm z-20" />
            
            {/* Caneta decorativa (CSS puro simulando objeto) */}
            <div className="absolute -right-20 -bottom-10 w-64 h-3 bg-gradient-to-r from-black via-[#2A2A2A] to-gold shadow-2xl rotate-[-25deg] rounded-full z-30" />
          </div>

        </div>
      </section>

      {/* ── CTA FINAL / FOOTER (Dark) ───────────────────────── */}
      <section className="relative bg-[#1B241C] text-white pt-24 pb-12 border-t-[8px] border-[#D4AF37]">
        <div className="container-liz">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 border-b border-white/10 pb-16">
            
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold mb-4">
                Beta fechado · 2026
              </p>
              <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
                Pronta para <em className="italic text-gold">começar?</em>
              </h2>
              <p className="text-white/60 font-serif text-lg">
                Acesso restrito a psicogenealogistas. Vagas limitadas.
              </p>
            </div>

            <Button asChild size="xl" className="bg-[#D4AF37] text-black hover:bg-[#C5A028] rounded-sm px-10 font-serif font-bold tracking-wide">
              <Link to="/auth" search={{ mode: "signup" }}>
                Solicitar acesso beta →
              </Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <LizLogo size={24} className="text-gold" />
              <p className="font-serif text-[14px] text-white/50">
                Instituto Liz — Plataforma de Psicogenealogia
              </p>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest text-white/30">
              Beta fechado · 2026
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
