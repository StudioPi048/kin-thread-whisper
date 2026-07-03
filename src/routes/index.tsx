import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Brain, GitBranch, Library, Mic, ScanSearch, Sparkles, ShieldCheck, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LizLogo, LizLogoLockup } from "@/components/liz-logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const modules = [
  {
    icon: GitBranch,
    title: "Genossociograma vivo",
    body: "Árvore interativa onde cada nó é um banco de dados: datas, doenças, profissões, traumas, segredos, mandatos.",
    color: "var(--color-gold)",
  },
  {
    icon: ScanSearch,
    title: "Motor de padrões",
    body: "Detecção automática de repetições transgeracionais: síndrome de aniversário, doenças em linha, rupturas afetivas.",
    color: "var(--color-forest)",
  },
  {
    icon: Mic,
    title: "Prontuário por voz",
    body: "Fale ao final da sessão. A plataforma transcreve, estrutura e gera o registro clínico automaticamente.",
    color: "var(--color-gold)",
  },
  {
    icon: Library,
    title: "Biblioteca sistêmica",
    body: "Schützenberger, Jodorowsky, Hellinger, Dolto — organizados por tema e ligados ao caso em questão.",
    color: "var(--color-forest)",
  },
  {
    icon: Brain,
    title: "Copiloto clínico",
    body: "IA treinada em psicogenealogia. Sugere hipóteses, nunca diagnostica. Postura de supervisor, não de terapeuta.",
    color: "var(--color-gold)",
  },
  {
    icon: Sparkles,
    title: "Memória entre casos",
    body: "\"Já atendi alguém parecido?\". Busca semântica em toda a sua base clínica, em linguagem natural.",
    color: "var(--color-forest)",
  },
];

const comparisons = [
  { before: "Papel e caneta", after: "Memória estruturada e pesquisável" },
  { before: "Árvore desenhada à mão", after: "Banco de dados vivo e interativo" },
  { before: "Memória do terapeuta", after: "IA que lembra, compara e sugere" },
];

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ── TOPBAR ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-md">
        <div className="container-liz flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <LizLogoLockup />
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Solicitar acesso beta
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="container-liz pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.25em] text-gold"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            Acesso beta · Psicogenealogistas
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.07 }}
            className="text-display mt-7 text-5xl text-primary md:text-7xl"
          >
            O segundo cérebro
            <br />
            do <em className="italic text-gold">psicogenealogista</em>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.14 }}
            className="mt-8 text-xl leading-relaxed text-muted-foreground md:text-2xl"
          >
            Não é um CRM. Não é um prontuário eletrônico.
            <br className="hidden md:block" />
            É o sistema operacional onde toda a inteligência clínica{" "}
            <span className="font-semibold text-foreground">vive, cresce e se retroalimenta</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Button asChild size="lg" variant="hero">
              <Link to="/auth" search={{ mode: "signup" }}>
                Solicitar acesso beta
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-6 text-sm text-muted-foreground"
          >
            Acesso restrito a psicogenealogistas formados ou em formação.
          </motion.p>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-16 flex justify-center"
        >
          <ChevronDown className="size-6 animate-bounce text-muted-foreground/50" />
        </motion.div>
      </section>

      {/* ── COMPARATIVO ─────────────────────────────────── */}
      <section className="border-y border-border/50 bg-primary/[0.025]">
        <div className="container-liz py-16">
          <p className="mb-10 text-center text-[12px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            O que a plataforma substitui
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {comparisons.map((item, i) => (
              <motion.div
                key={item.before}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground line-through">
                  {item.before}
                </p>
                <div className="my-3 h-px w-8 bg-gold" />
                <p className="font-serif text-xl text-primary">{item.after}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÓDULOS ─────────────────────────────────────── */}
      <section className="container-liz py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-gold">
            Arquitetura
          </p>
          <h2 className="mt-5 font-serif text-4xl text-primary md:text-5xl">
            Cinco camadas,<br />um só fluxo clínico
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Cada camada resolve uma dor real do atendimento. Juntas, formam
            uma extensão cognitiva do profissional.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <motion.article
              key={m.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-gold hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Linha colorida no topo */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ background: m.color }}
              />
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in oklab, ${m.color} 12%, transparent)` }}
              >
                <m.icon className="size-6" style={{ color: m.color }} />
              </div>
              <h3 className="mt-5 font-serif text-2xl text-primary">{m.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{m.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── ÉTICA & LGPD ────────────────────────────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="container-liz py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-gold">
                <ShieldCheck className="size-4" />
                Ética & LGPD
              </div>
              <h2 className="mt-6 font-serif text-4xl leading-tight md:text-5xl">
                Dados clínicos são{" "}
                <em className="italic text-gold">fundação</em>,
                <br />não feature.
              </h2>
            </div>
            <ul className="space-y-5">
              {[
                "Criptografia em repouso e em trânsito. Isolamento total entre profissionais.",
                "Consentimento explícito. Direito ao esquecimento e portabilidade de dados.",
                "Nenhum dado é usado para treinar IA sem consentimento granular do profissional.",
                "A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor clínico.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-primary-foreground/80">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────── */}
      <section className="container-liz py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-gold">
            Beta fechado · 2026
          </p>
          <h2 className="mt-5 font-serif text-4xl text-primary md:text-5xl">
            Pronta para começar?
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Acesso restrito a psicogenealogistas. Vagas limitadas.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button asChild size="xl" variant="gold">
              <Link to="/auth" search={{ mode: "signup" }}>
                Solicitar acesso beta
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-cream">
        <div className="container-liz flex flex-wrap items-center justify-between gap-4 py-10">
          <Link to="/" className="flex items-center gap-2">
            <LizLogo size={24} />
            <p className="font-serif text-[15px] text-primary">Instituto Liz — Plataforma de Psicogenealogia</p>
          </Link>
          <p className="text-[13px] text-muted-foreground">Beta fechado · 2026</p>
        </div>
      </footer>
    </div>
  );
}
