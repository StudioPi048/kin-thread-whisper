import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Brain, GitBranch, Library, Mic, ScanSearch, Sparkles } from "lucide-react";

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
  },
  {
    icon: ScanSearch,
    title: "Motor de padrões",
    body: "Detecção automática de repetições transgeracionais: síndrome de aniversário, doenças em linha, rupturas afetivas.",
  },
  {
    icon: Mic,
    title: "Prontuário por voz",
    body: "Fale ao final da sessão. A plataforma transcreve, estrutura e gera o registro clínico automaticamente.",
  },
  {
    icon: Library,
    title: "Biblioteca sistêmica",
    body: "Schützenberger, Jodorowsky, Hellinger, Dolto — organizados por tema e ligados ao caso em questão.",
  },
  {
    icon: Brain,
    title: "Copiloto clínico",
    body: "IA treinada em psicogenealogia. Sugere hipóteses, nunca diagnostica. Postura de supervisor, não de terapeuta.",
  },
  {
    icon: Sparkles,
    title: "Memória entre casos",
    body: "\"Já atendi alguém parecido?\". Busca semântica em toda a sua base clínica, em linguagem natural.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="border-b border-border/50 bg-parchment/60 backdrop-blur">
        <div className="container-liz flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LizLogoLockup />
          </Link>
          <div className="flex items-center gap-2">
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

      {/* Hero */}
      <section className="container-liz pt-24 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-xs uppercase tracking-[0.4em] text-gold"
          >
            Acesso beta · Psicogenealogistas
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-display mt-6 text-5xl md:text-7xl text-primary"
          >
            O segundo cérebro
            <br />
            do <em className="italic text-ink">psicogenealogista</em>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-8 text-lg text-muted-foreground md:text-xl"
          >
            Não é um CRM. Não é um prontuário eletrônico. É o sistema operacional onde toda a
            inteligência clínica do profissional vive, cresce e se retroalimenta.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-wrap justify-center gap-3"
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
        </div>
      </section>

      {/* Manifesto strip */}
      <section className="border-y border-border/60 bg-primary/[0.03]">
        <div className="container-liz grid gap-10 py-16 md:grid-cols-3">
          {[
            { k: "Papel e caneta", v: "Memória estruturada e pesquisável" },
            { k: "Árvore desenhada", v: "Banco de dados vivo e interativo" },
            { k: "Memória do terapeuta", v: "IA que lembra, compara e sugere" },
          ].map((item) => (
            <div key={item.k}>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {item.k}
              </p>
              <p className="mt-3 font-serif text-2xl text-primary">{item.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="container-liz py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Arquitetura</p>
          <h2 className="mt-4 font-serif text-4xl text-primary md:text-5xl">
            Cinco camadas, um só fluxo clínico
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m, i) => (
            <motion.article
              key={m.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-colors hover:border-gold"
            >
              <m.icon className="size-6 text-primary" />
              <h3 className="mt-6 font-serif text-2xl text-primary">{m.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Ethics */}
      <section className="border-t border-border/60 bg-sidebar text-sidebar-foreground">
        <div className="container-liz py-20 md:py-28">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gold">Ética & LGPD</p>
              <h2 className="mt-4 font-serif text-4xl md:text-5xl">
                Dados clínicos são <em className="italic">fundação</em>, não feature.
              </h2>
            </div>
            <ul className="space-y-4 text-sm leading-relaxed text-sidebar-foreground/80">
              <li>· Criptografia em repouso e em trânsito. Isolamento total entre profissionais.</li>
              <li>· Consentimento explícito. Direito ao esquecimento e portabilidade.</li>
              <li>· Nenhum dado é usado para treinar IA sem consentimento granular.</li>
              <li>· A IA sempre hipotetiza. Nunca diagnostica. Postura de supervisor.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-parchment">
        <div className="container-liz flex flex-wrap items-center justify-between gap-4 py-10">
          <p className="font-serif text-sm text-primary">
            Instituto Liz — Plataforma de Psicogenealogia
          </p>
          <p className="text-xs text-muted-foreground">Beta fechado · 2026</p>
        </div>
      </footer>
    </div>
  );
}
