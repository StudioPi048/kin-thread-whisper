import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  GitBranch,
  Library,
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
    title: "Genossociograma vivo",
    body: "Árvore interativa onde cada nó é um banco de dados: datas, doenças, profissões, traumas, segredos, mandatos.",
    color: "lavender",
  },
  {
    icon: ScanSearch,
    title: "Motor de padrões",
    body: "Detecção automática de repetições transgeracionais: síndrome de aniversário, doenças em linha, rupturas afetivas.",
    color: "gold",
  },
  {
    icon: Mic,
    title: "Prontuário por voz",
    body: "Fale ao final da sessão. A plataforma transcreve, estrutura e gera o registro clínico automaticamente.",
    color: "lavender",
  },
  {
    icon: Library,
    title: "Biblioteca sistêmica",
    body: "Schützenberger, Jodorowsky, Hellinger, Dolto — organizados por tema e ligados ao caso em questão.",
    color: "gold",
  },
  {
    icon: Brain,
    title: "Copiloto clínico",
    body: "IA treinada em psicogenealogia. Sugere hipóteses, nunca diagnostica. Postura de supervisor, não de terapeuta.",
    color: "lavender",
  },
  {
    icon: Sparkles,
    title: "Memória entre casos",
    body: '"Já atendi alguém parecido?". Busca semântica em toda a sua base clínica, em linguagem natural.',
    color: "gold",
  },
];

const comparisons = [
  { before: "Papel e caneta", after: "Memória estruturada e pesquisável", color: "lavender" },
  { before: "Árvore desenhada à mão", after: "Banco de dados vivo e interativo", color: "gold" },
  { before: "Memória do terapeuta", after: "IA que lembra, compara e sugere", color: "lavender" },
  { before: "WhatsApp disperso", after: "Formulário adaptativo pré-sessão", color: "gold" },
  {
    before: "Word e prontuário manual",
    after: "Registro por voz, gerado pela IA",
    color: "lavender",
  },
  { before: "Livros espalhados na mesa", after: "Biblioteca sistêmica contextual", color: "gold" },
];

const ethics = [
  { n: "01", text: "Criptografia em repouso e em trânsito. Isolamento total entre profissionais." },
  { n: "02", text: "Consentimento explícito. Direito ao esquecimento e portabilidade de dados." },
  { n: "03", text: "Nenhum dado é usado para treinar IA sem consentimento granular." },
  { n: "04", text: "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ── HEADER ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b-2 border-primary/10 bg-background/95 backdrop-blur-md">
        <div className="container-liz flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LizLogoLockup />
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild variant="hero" size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Acesso beta →
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO — full-plum ────────────────────────────── */}
      <section className="block-plum relative overflow-hidden">
        <div className="container-liz relative py-20 md:py-32 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 z-10 relative">
            {/* Elemento decorativo — número de fundo */}
            <span
              aria-hidden
              className="section-number pointer-events-none absolute left-0 top-0 select-none -translate-x-12 -translate-y-12 opacity-[0.05]"
            >
              01
            </span>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded border border-lavender/30 bg-lavender/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.3em] text-lavender-mid"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lavender" />
              Beta fechado · Psicogenealogistas
            </motion.div>

            {/* Título editorial — quebra intencional de linhas */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="mt-8 font-serif text-5xl font-bold leading-[0.95] tracking-tight text-white md:text-7xl lg:text-[85px]"
            >
              O segundo
              <br />
              <em className="italic text-gold">cérebro</em>
              <br />
              do psicogene-
              <br />
              alogista.
            </motion.h1>

            {/* Linha dourada decorativa */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 96 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="my-8 h-px bg-gold"
            />

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="max-w-lg text-lg leading-relaxed text-white/65 md:text-xl"
            >
              Não é um CRM. É o sistema operacional onde toda a inteligência clínica{" "}
              <strong className="text-white">vive, cresce e se retroalimenta.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Button asChild size="xl" variant="hero">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Solicitar acesso beta →
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-white/25 text-white hover:bg-white/10 hover:text-white normal-case tracking-normal font-semibold"
              >
                <Link to="/auth">Já tenho conta</Link>
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 relative z-10 w-full max-w-[600px] lg:max-w-none mt-10 lg:mt-0"
          >
            <div className="aspect-[4/3] lg:aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
              {/* Fallback color and image */}
              <div className="absolute inset-0 bg-plum/50" />
              <img
                src={hero1}
                alt="Psicogenealogista utilizando a plataforma"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=1000";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-plum/80 via-plum/20 to-transparent mix-blend-multiply" />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── COMPARATIVOS — fundo branco ─────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="container-liz">
          {/* Header com número decorativo */}
          <div className="relative mb-16 flex items-end gap-6">
            <span aria-hidden className="section-number leading-none select-none">
              01
            </span>
            <div className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-lavender">
                O que substitui
              </p>
              <h2 className="font-serif text-4xl font-bold text-primary md:text-5xl">
                Seu consultório,
                <br />
                reimaginado.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((item, i) => (
              <motion.div
                key={item.before}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={
                  "bg-card p-6 shadow-sm transition-shadow hover:shadow-md " +
                  (item.color === "lavender" ? "accent-bar-lavender" : "accent-bar-gold")
                }
              >
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 line-through">
                  {item.before}
                </p>
                <div className="my-3 h-px w-6 bg-muted" />
                <p className="font-serif text-xl font-semibold text-primary">{item.after}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÓDULOS — lavanda soft ───────────────────────── */}
      <section className="block-lavender py-24 md:py-32">
        <div className="container-liz">
          <div className="relative mb-16 flex items-end gap-6">
            <span aria-hidden className="section-number leading-none select-none">
              02
            </span>
            <div className="pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-lavender">
                Arquitetura
              </p>
              <h2 className="font-serif text-4xl font-bold text-primary md:text-5xl">
                Cinco camadas.
                <br />
                Um fluxo clínico.
              </h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, i) => (
              <motion.article
                key={m.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={
                  "group bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-l-[5px] border-l-transparent " +
                  (m.color === "lavender" ? "hover:border-l-lavender" : "hover:border-l-gold")
                }
              >
                <div
                  className={
                    "mb-5 flex h-11 w-11 items-center justify-center rounded-md " +
                    (m.color === "lavender" ? "bg-lavender-soft" : "bg-gold-soft")
                  }
                >
                  <m.icon
                    className={"size-5 " + (m.color === "lavender" ? "text-lavender" : "text-gold")}
                  />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary">{m.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{m.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEÇÃO VISUAL: A SESSÃO ───────────────────────────── */}
      <section className="bg-white py-24 md:py-32 overflow-hidden">
        <div className="container-liz flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative">
              <img
                src={hero2}
                alt="Conexão com o paciente"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1000";
                }}
              />
            </div>
          </motion.div>
          <div className="flex-1">
            <h2 className="font-serif text-3xl font-bold text-primary md:text-5xl mb-6 leading-tight">
              O fio invisível da <span className="text-gold italic">sessão.</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Mapeie em tempo real o histórico do seu paciente. Conecte gerações e descubra padrões
              transgeracionais profundos sem perder o foco visual na pessoa à sua frente.
            </p>
            <ul className="space-y-4">
              {[
                "Genograma dinâmico gerado no clique.",
                "Foco absoluto na fala do paciente.",
                "Menos papel, mais insight estruturado.",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex-shrink-0 size-1.5 rounded-full bg-lavender" />
                  <span className="text-[15px] font-medium text-primary/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SEÇÃO VISUAL: A VIDA SIMPLIFICADA ───────────────── */}
      <section className="block-lavender py-24 md:py-32 overflow-hidden">
        <div className="container-liz flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex-1 w-full"
          >
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative">
              <img
                src={hero3}
                alt="A vida simplificada"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1000";
                }}
              />
            </div>
          </motion.div>
          <div className="flex-1">
            <h2 className="font-serif text-3xl font-bold text-primary md:text-5xl mb-6 leading-tight">
              A <span className="text-lavender italic">leveza</span> de uma <br />
              gestão impecável.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              O Dossiê Inteligente cuida da organização dos seus casos, permitindo que você retorne
              à sua essência terapêutica. Relaxe sabendo que o sistema operacional faz o trabalho
              pesado.
            </p>
            <div className="flex gap-4 items-center mt-10">
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white rounded-md"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Começar agora
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CITAÇÃO — full-plum ──────────────────────────── */}
      <section className="block-plum py-24 md:py-36">
        <div className="container-liz max-w-4xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-lavender-mid">
            Fundamento clínico
          </p>
          <motion.blockquote
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-8 font-serif text-4xl font-bold italic leading-tight text-white md:text-6xl"
          >
            "O que não pode ser dito,
            <br />
            não pode ser esquecido —
            <br />
            <span className="text-gold">apenas repetido."</span>
          </motion.blockquote>
          <p className="mt-8 text-[15px] text-white/45">— inspirado em Françoise Dolto</p>
        </div>
      </section>

      {/* ── ÉTICA & LGPD — branco ───────────────────────── */}
      <section className="bg-white py-24 md:py-32">
        <div className="container-liz">
          <div className="relative mb-16 flex items-end gap-6">
            <span aria-hidden className="section-number leading-none select-none">
              03
            </span>
            <div className="pb-2">
              <div className="inline-flex items-center gap-2 rounded border border-lavender/30 bg-lavender/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-lavender mb-3">
                <ShieldCheck className="size-3.5" />
                Ética & LGPD
              </div>
              <h2 className="font-serif text-4xl font-bold text-primary md:text-5xl">
                Dados clínicos são
                <br />
                <em className="italic text-lavender">fundação</em>,
                <br />
                não feature.
              </h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {ethics.map((item) => (
              <div key={item.n} className="flex gap-5 border-l-[5px] border-l-lavender pl-5 py-2">
                <span className="font-serif text-4xl font-bold text-lavender/20 leading-none shrink-0">
                  {item.n}
                </span>
                <p className="text-[16px] leading-relaxed text-foreground/80 pt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL — full-plum ───────────────────────── */}
      <section className="block-plum py-28 text-center md:py-40">
        <div className="container-liz">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-lavender-mid">
              Beta fechado · 2026
            </p>
            <h2 className="mt-6 font-serif text-5xl font-bold text-white md:text-7xl">
              Pronta para
              <br />
              <span className="text-gold">começar?</span>
            </h2>
            <p className="mt-6 text-xl text-white/55">
              Acesso restrito a psicogenealogistas. Vagas limitadas.
            </p>
            <div className="mt-12">
              <Button asChild size="xl" variant="hero">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Solicitar acesso beta →
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="block-plum border-t border-sidebar-border">
        <div className="container-liz flex flex-wrap items-center justify-between gap-4 py-8">
          <div className="flex items-center gap-3">
            <LizLogo size={20} />
            <p className="font-serif text-[14px] text-white/55">
              Instituto Liz — Plataforma de Psicogenealogia
            </p>
          </div>
          <p className="text-[12px] text-white/25">Beta fechado · 2026</p>
        </div>
      </footer>
    </div>
  );
}
