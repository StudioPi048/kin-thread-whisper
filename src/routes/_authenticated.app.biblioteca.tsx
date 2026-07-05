import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Bookmark, BookText, Users, Lightbulb, Quote } from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  component: BibliotecaPage,
});

type Entry = {
  id: string;
  author: string;
  title: string;
  topic: string | null;
  school: string | null;
  summary: string | null;
  content: string | null;
  tags: string[];
};

const ESSENTIAL_BOOKS = [
  {
    title: "A Síndrome dos Ancestrais",
    author: "Anne Ancelin Schützenberger",
    year: "1993",
    desc: "A bíblia da psicogenealogia. Introduz a síndrome de aniversário e a transmissão transgeracional do trauma. Schützenberger prova que adoecemos nas datas dos antepassados.",
    color: "bg-plum",
    textColor: "text-primary-foreground",
    tag: "Fundamento",
  },
  {
    title: "Metagenealogia",
    author: "Alejandro Jodorowsky & Marianne Costa",
    year: "2011",
    desc: "A árvore como arte e cura. A visão psicomágica e os 4 centros do indivíduo (intelectual, emocional, sexual, material) na leitura do sistema familiar.",
    color: "bg-lavender",
    textColor: "text-primary",
    tag: "Psicomagia",
  },
  {
    title: "A Criança de Substituição",
    author: "Nicolas Abraham & Maria Torok",
    year: "1978",
    desc: "A teoria do 'Fantasma' e da 'Cripta'. Segredos de família não ditos que assombram as gerações futuras como sintomas sem nome.",
    color: "bg-gold",
    textColor: "text-primary",
    tag: "Teoria",
  },
  {
    title: "Os Filhos da Sorte",
    author: "Bert Hellinger",
    year: "2002",
    desc: "A constelação familiar e as Ordens do Amor. A pertença, a hierarquia e o equilíbrio de dar e receber como leis invisíveis que regem os clãs.",
    color: "bg-plum/70",
    textColor: "text-primary-foreground",
    tag: "Constelação",
  },
  {
    title: "Minhas Ancestrais Feridas, Minhas Doenças",
    author: "Patrick Estrade",
    year: "2013",
    desc: "Uma leitura prática e clínica da transmissão transgeracional. Como identificar os padrões de doença e ruptura que se repetem ao longo das gerações.",
    color: "bg-lavender/70",
    textColor: "text-primary",
    tag: "Prática Clínica",
  },
  {
    title: "O Dom dos Traumatismos",
    author: "Boris Cyrulnik",
    year: "2004",
    desc: "A resiliência como fenômeno sistêmico. Cyrulnik mostra como o trauma é reescrito pela relação com o entorno afetivo e cultural.",
    color: "bg-gold/70",
    textColor: "text-primary",
    tag: "Resiliência",
  },
];

const KEY_CONCEPTS = [
  {
    term: "Síndrome de Aniversário",
    desc: "Repetição de traumas, adoecimentos ou eventos marcantes na mesma data ou mesma idade de um ancestral. Ex: um neto adoece com 47 anos — a mesma idade em que o avô morreu.",
    icon: "📅",
  },
  {
    term: "Criança de Substituição",
    desc: "Filho concebido após a morte de um irmão ou aborto espontâneo, encarregado inconscientemente de 'substituir' o ausente. Carrega uma identidade emprestada que pode impedir o desenvolvimento da própria.",
    icon: "👶",
  },
  {
    term: "Lealdade Invisível",
    desc: "Obrigação inconsciente de repetir o destino familiar como sinal de fidelidade ao sistema. Elaborada por Ivan Boszormenyi-Nagy: o membro do clã se autoboicota para 'não trair' os ancestrais.",
    icon: "🔗",
  },
  {
    term: "Fantasma Transgeracional",
    desc: "Um segredo inconfessável de uma geração (cripta) que se manifesta como sintoma sem causa aparente na segunda ou terceira geração. O 'não dito' fala mais alto que o dito.",
    icon: "👻",
  },
  {
    term: "Genoesquema / Genograma",
    desc: "Representação gráfica do sistema familiar por pelo menos 3 gerações. Ferramenta diagnóstica central que revela padrões de doença, ruptura, profissão e eventos repetidos.",
    icon: "🌳",
  },
  {
    term: "Missão de Vida",
    desc: "Programa inconsciente definido pela família de origem. A psicogenealogia entende que cada indivíduo carrega uma missão reparadora — conscientizá-la é o primeiro passo para a libertação.",
    icon: "🎯",
  },
  {
    term: "Ordens do Amor (Hellinger)",
    desc: "Três leis sistêmicas que regem os clãs: Pertença (todos têm direito ao seu lugar), Hierarquia (o que vem antes tem precedência) e Equilíbrio (dar e receber em proporção). A violação de qualquer uma gera sintoma.",
    icon: "⚖️",
  },
  {
    term: "Epigenética e Trauma",
    desc: "A ciência confirma: experiências traumáticas alteram a expressão do DNA e são transmitidas às gerações seguintes. Estudos com filhos e netos de sobreviventes do Holocausto e escravidão são os marcos dessa descoberta.",
    icon: "🧬",
  },
];

const CLINICAL_QUOTES = [
  {
    text: "Ninguém escapa do seu clã. Pode-se tentar, mas o sistema sempre encontrará uma forma de ser ouvido — seja pelo corpo, seja pelo destino.",
    author: "Anne Ancelin Schützenberger",
  },
  {
    text: "A árvore genealógica não é apenas um arquivo histórico. É o mapa do tesouro da sua alma.",
    author: "Alejandro Jodorowsky",
  },
  {
    text: "O que não é dito em voz alta, é vivido na carne.",
    author: "Nicolas Abraham",
  },
  {
    text: "Quem ficou excluído do sistema, os outros membros da família carregarão por ele.",
    author: "Bert Hellinger",
  },
];

const CLINICAL_TOOLS = [
  {
    title: "Entrevista Transgeracional",
    desc: "Protocolo de anamnese para coleta de dados sobre 3 gerações. Foco em: datas, nomes, causas de morte, profissões, segredos e crises.",
    steps: [
      "Levantamento de nomes e datas",
      "Identificação de repetições",
      "Perguntas sobre segredos familiares",
      "Análise de padrões de doença",
    ],
  },
  {
    title: "Síndrome de Aniversário: Checklist",
    desc: "Protocolo para verificar se sintomas do cliente coincidem com datas ou idades de ancestrais.",
    steps: [
      "Idade atual do cliente",
      "Idades de morte dos avós",
      "Datas de eventos traumáticos no clã",
      "Coincidências com sintomas atuais",
    ],
  },
  {
    title: "Mapa de Segredos",
    desc: "Técnica para identificar os 'não ditos' do sistema. Segredos mais comuns: abortos, adoções, origens ilegítimas, crimes, falências e suicídios.",
    steps: [
      "O que não é falado?",
      "Quem 'desapareceu' da história?",
      "Por que o cliente não sabe certas coisas?",
      "O que o corpo expressa que a boca cala?",
    ],
  },
];

function BibliotecaPage() {
  const [q, setQ] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["library-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_entries")
        .select("*")
        .order("author", { ascending: true });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => {
      const hay = [e.author, e.title, e.topic, e.school, e.summary, e.content, ...(e.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [entries, q]);

  return (
    <div className="pb-16">
      {/* HERO */}
      <div className="relative bg-gradient-to-br from-plum/10 via-lavender-soft/30 to-gold-soft/20 pt-16 pb-14 overflow-hidden border-b-2 border-border/60">
        <div className="absolute right-0 top-0 w-1/3 h-full hidden lg:block opacity-90 mix-blend-multiply">
          <img
            src="/library_hero.png"
            alt="Ilustração da Biblioteca"
            className="w-full h-full object-cover object-left"
          />
        </div>
        <div className="container-liz relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-plum mb-2">
            Hub de Conhecimento Clínico
          </p>
          <h1 className="font-serif text-5xl font-bold text-primary">Biblioteca</h1>
          <p className="mt-4 text-[15px] max-w-2xl leading-relaxed text-muted-foreground">
            A espinha dorsal teórica da psicogenealogia sistêmica. Autores fundadores, conceitos
            clínicos essenciais, ferramentas práticas e as citações que moldam a abordagem.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              "Psicogenealogia",
              "Constelação Familiar",
              "Epigenética",
              "Trauma Transgeracional",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full border border-lavender/30 bg-lavender-soft/50 px-3 py-1 text-[12px] font-semibold text-plum"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="container-liz mt-14 space-y-20">
        {/* LEITURAS OBRIGATÓRIAS */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft">
              <BookOpen className="size-5 text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">Cânone</p>
              <h2 className="font-serif text-2xl font-bold text-primary">Leituras Fundamentais</h2>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ESSENTIAL_BOOKS.map((book) => (
              <article
                key={book.title}
                className={`relative flex flex-col p-6 rounded-[1rem] shadow-md hover-lift ${book.color} ${book.textColor} overflow-hidden`}
              >
                <div className="absolute top-3 right-3">
                  <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {book.tag}
                  </span>
                </div>
                <div className="mb-6 mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-1.5">
                    {book.author} · {book.year}
                  </p>
                  <h3 className="font-serif text-xl font-bold leading-tight">{book.title}</h3>
                </div>
                <div className="mt-auto">
                  <p className="text-[13px] opacity-85 leading-relaxed">{book.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CITAÇÕES */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender-soft">
              <Quote className="size-5 text-lavender" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lavender">
                Sabedoria Clínica
              </p>
              <h2 className="font-serif text-2xl font-bold text-primary">Citações dos Mestres</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {CLINICAL_QUOTES.map((q, i) => (
              <blockquote
                key={i}
                className="glass-card rounded-[1rem] p-6 hover-lift border-l-[4px] border-l-lavender"
              >
                <p className="font-serif text-[15px] italic leading-relaxed text-foreground/80">
                  "{q.text}"
                </p>
                <footer className="mt-4 text-[12px] font-bold uppercase tracking-[0.15em] text-lavender">
                  — {q.author}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* GLOSSÁRIO CLÍNICO */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft">
              <Bookmark className="size-5 text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                Definições
              </p>
              <h2 className="font-serif text-2xl font-bold text-primary">Glossário Clínico</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {KEY_CONCEPTS.map((concept) => (
              <div
                key={concept.term}
                className="border-l-[4px] border-l-lavender glass-card p-5 rounded-r-[1rem] shadow-sm hover-lift"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{concept.icon}</span>
                  <h4 className="font-bold text-primary text-[15px]">{concept.term}</h4>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{concept.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FERRAMENTAS CLÍNICAS */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-plum/10">
              <Lightbulb className="size-5 text-plum" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-plum">
                Protocolos
              </p>
              <h2 className="font-serif text-2xl font-bold text-primary">Ferramentas de Sessão</h2>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {CLINICAL_TOOLS.map((tool) => (
              <div
                key={tool.title}
                className="glass-card rounded-[1rem] p-6 hover-lift flex flex-col gap-4"
              >
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">{tool.title}</h3>
                  <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
                <div className="mt-auto">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                    Etapas
                  </p>
                  <ol className="space-y-1.5">
                    {tool.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/75">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lavender-soft text-[10px] font-bold text-lavender">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ACERVO COMPLETO (BUSCA) */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pt-8 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-plum/10">
                <BookText className="size-5 text-plum" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-plum">
                  Base de Dados
                </p>
                <h2 className="font-serif text-2xl font-bold text-primary">Acervo e Verbetes</h2>
              </div>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar (ex: lealdade, luto, Hellinger)"
                className="pl-9 h-10"
              />
            </div>
          </div>

          <div className="min-h-[300px]">
            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-32 rounded-[1rem]" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="py-16 text-center text-muted-foreground glass-card rounded-[1rem]">
                <Search className="size-8 mx-auto opacity-20 mb-3" />
                <p>Nenhum verbete encontrado para "{q}"</p>
              </div>
            )}

            <motion.div
              className="grid gap-4 md:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
            >
              {filtered.map((e) => (
                <motion.article
                  key={e.id}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 300, damping: 24 },
                    },
                  }}
                  className="rounded-[1rem] glass-card p-6 hover-lift"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <h3 className="font-serif text-xl font-bold text-primary">{e.author}</h3>
                    {e.school && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
                        {e.school}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] font-bold text-foreground">
                    {e.title}
                    {e.topic && (
                      <span className="text-muted-foreground font-normal"> — {e.topic}</span>
                    )}
                  </p>

                  {e.summary && (
                    <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground/90">
                      {e.summary}
                    </p>
                  )}
                  {e.content && (
                    <div className="mt-3 p-3 bg-lavender-soft/20 border-l-2 border-lavender rounded-r-md text-[13px] leading-relaxed text-foreground">
                      {e.content}
                    </div>
                  )}

                  {e.tags && e.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {e.tags.map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="font-semibold text-[10px] rounded-full bg-muted/50"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.article>
              ))}
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}
