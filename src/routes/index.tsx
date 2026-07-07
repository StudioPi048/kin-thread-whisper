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
  PlayCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LizLogoLockup } from "@/components/liz-logo";

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
      
      {/* ── HEADER ──────────────────────────────────────── */}
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
        {/* Background gradient instead of solid */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1B211A] to-[#22271E] pointer-events-none" />
        
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

          {/* Direita: Composição Modular do Álbum/Livro */}
          <div className="flex-1 relative w-full h-[600px] flex items-center justify-center perspective-1000">
            
            {/* O Livro Base (Modular Asset) */}
            <div className="absolute right-[-5%] w-[120%] z-10 rotate-[4deg]">
              <img src="/assets/hero/book.jpg" alt="Livro Antigo" className="w-full drop-shadow-2xl mix-blend-luminosity opacity-80" />
            </div>

            {/* Fotografias Antigas Sobrepostas (Modular Assets) */}
            <div className="absolute left-[5%] top-[15%] w-[35%] z-20 rotate-[-6deg] shadow-2xl transition-transform hover:rotate-[-2deg] duration-700">
              <img src="/assets/photos/old_photo_woman.jpg" alt="Retrato Antigo" className="w-full border-[12px] border-[#F4EFE6]" />
              {/* Tape Asset */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-6 bg-[#D4C3A3]/90 mix-blend-multiply rotate-[-2deg]" />
            </div>
            
            <div className="absolute left-[30%] top-[40%] w-[40%] z-25 rotate-[3deg] shadow-2xl transition-transform hover:rotate-[6deg] duration-700">
              <img src="/assets/photos/old_photo_family.jpg" alt="Família" className="w-full border-[14px] border-[#F0EBE1]" />
              {/* Tape Asset */}
              <div className="absolute -top-3 right-4 w-12 h-5 bg-[#D4C3A3]/80 mix-blend-multiply rotate-[15deg]" />
            </div>

            {/* Cartão de Papel com Frase (Modular Asset) */}
            <div className="absolute top-[10%] right-[10%] w-[220px] bg-[#FAF8F5] p-6 shadow-xl rotate-[8deg] border border-[#E6DDD0] z-30 texture-paper">
              <p className="font-serif italic text-lg text-mahogany-mid leading-relaxed text-center">
                Cada história merece ser lembrada.<br/>
                Cada vida, respeitada. ♡
              </p>
              {/* Pen overlayed on the card */}
              <img src="/assets/objects/pen.jpg" alt="Caneta" className="absolute -bottom-10 -right-12 w-48 rotate-[-15deg] drop-shadow-2xl mix-blend-multiply" />
            </div>

            {/* Selo de Cera (Modular Asset) */}
            <div className="absolute bottom-[20%] left-[10%] w-20 z-40 rotate-[-12deg] drop-shadow-xl">
               <img src="/assets/objects/wax_seal_tree.jpg" alt="Selo de Cera" className="w-full mix-blend-multiply" />
            </div>
          </div>

        </div>
      </section>

      {/* ── PAINEL FLUTUANTE (Ética e Segurança) ────────────────────────────── */}
      <section className="relative z-20 -mt-24 px-4">
        <div className="container-liz max-w-6xl">
          <div className="bg-[#1A201A]/95 border border-white/5 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col md:flex-row backdrop-blur-md">
            
            <div className="bg-[#151A15] p-10 md:w-1/3 flex flex-col justify-center relative overflow-hidden">
              <span className="absolute -left-4 -bottom-10 text-[180px] font-serif font-bold text-white/[0.03] leading-none select-none">
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

      {/* ── SEÇÃO 2 (A leveza de uma...) ────────────────────────────── */}
      <section className="relative pt-32 pb-32 bg-[#FCF9F4] texture-paper">
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

          {/* Direita: Colagem no Papel Rasgado (Modular) */}
          <div className="flex-1 relative w-full flex justify-center lg:justify-end">
            
            {/* O Papel Rasgado Base */}
            <div className="relative bg-[#FAF8F5] p-10 shadow-2xl w-full max-w-lg rotate-[2deg] border border-[#E6DDD0] transform-gpu">
              
              {/* Tape Asset */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#D4C3A3]/70 mix-blend-multiply rotate-[-3deg] z-20" />
              
              <div className="aspect-[4/3] w-full mb-8 relative overflow-hidden bg-muted shadow-inner border-[8px] border-white">
                <img src="/assets/photos/therapist_office.jpg" alt="Therapist" className="w-full h-full object-cover sepia-[.1] contrast-[1.1] grayscale-[0.2]" />
              </div>

              {/* Lista de Features estilo impresso */}
              <div className="space-y-4 px-2 pb-4">
                {featuresList.map((f, i) => (
                  <div key={i} className="flex items-center gap-5 border-b border-[#E6DDD0]/60 pb-3 last:border-0">
                    <f.icon className="size-4 text-[#D4AF37]" strokeWidth={1.5} />
                    <span className="font-serif text-[15px] text-primary/80 tracking-wide">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Ornamento SVG (Modular Asset) */}
              <div className="absolute -bottom-8 -left-8 w-24 opacity-80 mix-blend-multiply">
                 <img src="/assets/vectors/botanical_tree.svg" alt="Tree SVG" />
              </div>
            </div>
            
          </div>

        </div>
      </section>

      {/* ── SEÇÃO 3 (O fio invisível) - Bloco Escuro Arredondado ────────────────────────────── */}
      <section className="relative py-16 px-4 bg-[#FCF9F4] texture-paper">
        <div className="container-liz max-w-6xl">
          <div className="bg-[#1B211A] rounded-3xl p-8 md:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative">
            
            {/* SVG Background Divider/Ornament */}
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4 w-[500px]">
              <img src="/assets/vectors/botanical_tree.svg" alt="Botanical Overlay" className="w-full invert" />
            </div>

            <div className="flex-1 w-full z-10">
              <div className="aspect-[4/3] rounded-xl overflow-hidden shadow-2xl relative border border-white/10">
                <img src="/assets/photos/therapy_session.jpg" alt="Sessão" className="w-full h-full object-cover sepia-[.2] grayscale-[0.1]" />
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
              </div>
            </div>

            <div className="flex-1 text-white z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold mb-6">
                O fio invisível da sessão
              </p>
              <h3 className="font-serif text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Conecte gerações, <br />
                com <em className="italic text-gold">profundidade</em> e <br />
                leveza.
              </h3>
              <p className="text-white/70 text-lg leading-relaxed font-serif">
                Mapeie em tempo real o histórico do seu paciente e descubra padrões transgeracionais profundos sem perder o foco visual na pessoa à sua frente.
              </p>

              <div className="mt-8 space-y-3 font-serif italic text-gold/80">
                <p>✓ Genograma dinâmico gerado no clique</p>
                <p>✓ Foco absoluto no paciente</p>
                <p>✓ Menos papel, mais insight estruturado</p>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* ── QUOTE SECTION (Modular Paper & Pen) ────────────────────────────── */}
      <section className="py-24 bg-[#FCF9F4] relative flex justify-center overflow-hidden texture-paper">
        <div className="relative z-10 w-full max-w-2xl px-6">
          <div className="bg-[#FAF8F5] border border-[#E6DDD0] p-16 shadow-xl relative rotate-[1deg]">
            {/* Tape at top */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-[#D4C3A3]/70 mix-blend-multiply rotate-[2deg] z-20" />
            
            {/* Quote SVG */}
            <div className="absolute top-10 left-10 opacity-30 w-12">
               <img src="/assets/vectors/quote.svg" alt="Quote" />
            </div>

            <h3 className="font-serif text-2xl md:text-3xl text-center text-primary leading-relaxed mt-4">
              "O que não pode ser dito, <br />
              não pode ser esquecido — <br />
              apenas repetido."
            </h3>
            <p className="text-center font-serif italic text-primary/50 mt-6 text-sm">
              — inspirado em Françoise Dolto
            </p>

            {/* Fountain Pen (Modular Asset) over the paper */}
            <div className="absolute -bottom-12 -right-8 w-64 z-30 drop-shadow-2xl">
               <img src="/assets/objects/pen.jpg" alt="Fountain Pen" className="w-full mix-blend-multiply rotate-[20deg]" />
            </div>
            
            {/* Tape at bottom */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-14 h-5 bg-[#D4C3A3]/70 mix-blend-multiply rotate-[-4deg] z-20" />
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────── */}
      <footer className="bg-[#1B211A] text-white pt-20 pb-10 border-t-4 border-gold">
        <div className="container-liz flex flex-col md:flex-row items-end justify-between gap-12">
          
          <div className="max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold mb-4">
              Beta Fechado · 2026
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
              Pronta para <em className="italic text-gold">começar?</em>
            </h2>
            <p className="text-white/60 font-serif">
              Acesso restrito a psicogenealogistas. Vagas limitadas.
            </p>
          </div>

          <div className="flex items-center gap-6 relative">
            {/* Mini Polaroids & Seal Composition */}
            <div className="hidden lg:flex items-end gap-2 mr-8">
              <img src="/assets/photos/old_photo_man.jpg" alt="Vintage" className="w-20 h-24 object-cover border-[4px] border-white rotate-[-5deg] shadow-lg grayscale" />
              <img src="/assets/photos/old_photo_child.jpg" alt="Vintage" className="w-24 h-28 object-cover border-[4px] border-white rotate-[3deg] shadow-lg z-10 sepia-[.3]" />
              <img src="/assets/objects/wax_seal_tree.jpg" alt="Seal" className="w-16 h-16 rounded-full -ml-4 z-20 mix-blend-lighten shadow-xl" />
            </div>

            <Button asChild size="lg" className="bg-[#D4AF37] text-black hover:bg-[#C5A028] rounded-sm px-8 font-serif font-bold tracking-wide shrink-0">
              <Link to="/auth" search={{ mode: "signup" }}>
                Solicitar acesso beta →
              </Link>
            </Button>
          </div>

        </div>

        <div className="container-liz mt-20 pt-8 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-3">
            <LizLogoLockup className="invert opacity-40 scale-75 origin-left" />
            <span>— Plataforma de Psicogenealogia</span>
          </div>
          <span>BETA FECHADO · 2026</span>
        </div>
      </footer>

    </div>
  );
}
