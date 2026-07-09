import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  BookOpen,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Copy,
  Bookmark,
  StickyNote,
  Play,
  Clock,
  Layers,
  Target,
  Compass,
  Feather,
  Ghost,
  HeartCrack,
  Link2,
  Users,
  Baby,
  Skull,
  Anchor,
  Dna,
  Scale,
  Building2,
  Fingerprint,
  UserMinus,
  Lock,
  X,
  Quote as QuoteIcon,
  BrainCircuit,
  Wand2,
  ScrollText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import leticiaAsset from "@/assets/leticia-baccin.png.asset.json";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  component: BibliotecaPage,
});

// ─────────────────────────────────────────────────────────────
// BIBLIOTECA AUTORAL — LETÍCIA KUCHOCKOWOLEC BACCIN
// ─────────────────────────────────────────────────────────────

const LETICIA = {
  name: "Letícia Kuchockowolec Baccin",
  role: "Fundadora do Instituto Liz · Psicogenealogista clínica",
  bio: "Autora, pesquisadora e formadora em Psicogenealogia. Fundadora da Academia Liz Indica, criadora de metodologias autorais e referência em transmissão clínica no Brasil.",
  photo: leticiaAsset.url,
};

const LETICIA_WORKS: Array<{
  title: string;
  subtitle: string;
  kind: "Livro" | "Manual" | "Almanaque" | "Curso" | "Protocolo";
  badge: "Novo" | "Mais estudado" | "Exclusivo" | "Clássico";
  concepts: number;
  protocols: number;
  citations: number;
  accent: "mahogany" | "forest" | "gold" | "cream";
}> = [
  {
    title: "O Código Sagrado dos Dentes",
    subtitle: "Simbologia oral e memória transgeracional",
    kind: "Livro",
    badge: "Novo",
    concepts: 120,
    protocols: 48,
    citations: 312,
    accent: "mahogany",
  },
  {
    title: "Manual da Psicogenealogia",
    subtitle: "Método clínico Instituto Liz",
    kind: "Manual",
    badge: "Mais estudado",
    concepts: 86,
    protocols: 34,
    citations: 210,
    accent: "gold",
  },
  {
    title: "Raízes do Nome",
    subtitle: "Onomástica e projeto sentido",
    kind: "Livro",
    badge: "Exclusivo",
    concepts: 54,
    protocols: 21,
    citations: 143,
    accent: "forest",
  },
  {
    title: "Fé com Lê, Lê com Fé",
    subtitle: "Espiritualidade e clínica sistêmica",
    kind: "Livro",
    badge: "Clássico",
    concepts: 62,
    protocols: 18,
    citations: 168,
    accent: "cream",
  },
  {
    title: "Almanaque Liz",
    subtitle: "Compêndio de casos e verbetes",
    kind: "Almanaque",
    badge: "Exclusivo",
    concepts: 240,
    protocols: 72,
    citations: 480,
    accent: "mahogany",
  },
  {
    title: "Protocolo do Clã",
    subtitle: "Ferramenta de mapeamento em 4 gerações",
    kind: "Protocolo",
    badge: "Mais estudado",
    concepts: 32,
    protocols: 12,
    citations: 96,
    accent: "forest",
  },
];

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

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  "Lealdade Invisível",
  "Síndrome de Aniversário",
  "Projeto Sentido",
  "Fantasma",
  "Cripta",
  "Aborto",
  "Adoção",
  "Nome",
  "Empresa Familiar",
  "Luto",
  "Missão",
];

const TODAY = {
  concept: {
    label: "Conceito do dia",
    title: "Lealdade Invisível",
    body: "Compromisso inconsciente do descendente com a fidelidade ao sistema familiar de origem. Elaborado por Boszormenyi-Nagy: o membro do clã se autoboicota para 'não trair' os ancestrais.",
    related: ["Boszormenyi-Nagy", "Fantasma", "Missão de Vida"],
  },
  authorOfWeek: {
    name: "Anne Ancelin Schützenberger",
    field: "Pioneira da Psicogenealogia — síndrome de aniversário",
    initials: "AS",
  },
  bookRecommended: {
    title: "Meus Antepassados",
    author: "A. A. Schützenberger",
    tag: "Essencial",
  },
  clinicalQuestion:
    "Que idade tinham seus pais quando você nasceu? Alguém da linhagem morreu com essa idade?",
  historyBite: "1970 — Nasce o termo 'genossociograma' no seminário de Françoise Dolto.",
};

const AUTHORS: Array<{
  name: string;
  field: string;
  works: number;
  concepts: number;
  initials: string;
  photo?: string;
  years?: string;
  nationality?: string;
}> = [
  {
    name: "Anne Ancelin Schützenberger",
    field: "Psicogenealogia",
    works: 12,
    concepts: 48,
    initials: "AS",
    photo:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Anne_Ancelin_Sch%C3%BCtzenberger.jpg?width=400",
    years: "1919–2018",
    nationality: "França",
  },
  {
    name: "Françoise Dolto",
    field: "Psicanálise da infância",
    works: 22,
    concepts: 61,
    initials: "FD",
    photo:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Fran%C3%A7oise_Dolto_1980.jpg?width=400",
    years: "1908–1988",
    nationality: "França",
  },
  {
    name: "Alejandro Jodorowsky",
    field: "Metagenealogia · Psicomagia",
    works: 18,
    concepts: 40,
    initials: "AJ",
    photo:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Alejandro_Jodorowsky_2022.jpg?width=400",
    years: "1929–",
    nationality: "Chile · França",
  },
  {
    name: "Ivan Boszormenyi-Nagy",
    field: "Terapia contextual",
    works: 8,
    concepts: 22,
    initials: "IB",
    years: "1920–2007",
    nationality: "Hungria · EUA",
  },
  {
    name: "Bert Hellinger",
    field: "Constelação familiar",
    works: 30,
    concepts: 55,
    initials: "BH",
    photo:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Bert_Hellinger.jpg?width=400",
    years: "1925–2019",
    nationality: "Alemanha",
  },
  {
    name: "Nicolas Abraham",
    field: "Cripta e Fantasma",
    works: 6,
    concepts: 18,
    initials: "NA",
    years: "1919–1975",
    nationality: "Hungria · França",
  },
  {
    name: "Maria Torok",
    field: "Cripta e Fantasma",
    works: 5,
    concepts: 15,
    initials: "MT",
    years: "1925–1998",
    nationality: "Hungria · França",
  },
  {
    name: "Didier Dumas",
    field: "Não-dito familiar",
    works: 9,
    concepts: 20,
    initials: "DD",
    years: "1943–2010",
    nationality: "França",
  },
  {
    name: "Patrick Estrade",
    field: "Clínica transgeracional",
    works: 14,
    concepts: 26,
    initials: "PE",
    years: "1949–",
    nationality: "França",
  },
  {
    name: "Boris Cyrulnik",
    field: "Resiliência sistêmica",
    works: 20,
    concepts: 34,
    initials: "BC",
    photo:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Boris_Cyrulnik_-_Comedie_du_Livre_2011_-_Montpellier_-_P1150907.jpg?width=400",
    years: "1937–",
    nationality: "França",
  },
];

const THEMES: Array<{ name: string; count: number; icon: typeof Feather; accent: string }> = [
  { name: "Traumas", count: 42, icon: HeartCrack, accent: "bg-card text-foreground border border-border" },
  { name: "Lealdades", count: 28, icon: Link2, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Doenças", count: 31, icon: Dna, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Projeto Sentido", count: 19, icon: Target, accent: "bg-card text-archive-doc border border-[#1B211A]/10" },
  { name: "Nome", count: 12, icon: Fingerprint, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Empresa Familiar", count: 15, icon: Building2, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Abandono", count: 24, icon: UserMinus, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Luto", count: 33, icon: Anchor, accent: "bg-gold text-archive-doc border border-gold/50" },
  { name: "Exclusão", count: 21, icon: Users, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Aborto", count: 18, icon: Baby, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Segredos", count: 26, icon: Lock, accent: "bg-muted text-foreground border-l-4 border-l-gold" },
  { name: "Epigenética", count: 14, icon: Dna, accent: "bg-archive-doc text-foreground border border-border/60" },
  { name: "Ordens do Amor", count: 17, icon: Scale, accent: "bg-archive-doc text-foreground border border-border/60" },
];

const ESSENTIAL_BOOKS: Array<{
  title: string;
  subtitle: string;
  author: string;
  year: number;
  level: string;
  concepts: string[];
  citations: number;
  protocols: number;
  cases: number;
  spine: string;
  cover?: string;
}> = [
  {
    title: "Meus Antepassados",
    subtitle: "A síndrome de aniversário e o romance familiar",
    author: "Anne Ancelin Schützenberger",
    year: 1988,
    level: "Fundamento",
    concepts: ["Síndrome de aniversário", "Genossociograma", "Lealdade invisível"],
    citations: 42,
    protocols: 8,
    cases: 12,
    spine: "bg-mahogany text-foreground",
    cover: "https://covers.openlibrary.org/b/isbn/8532303617-L.jpg?default=false",
  },
  {
    title: "Metagenealogia",
    subtitle: "A árvore como arte, terapia e busca do Eu",
    author: "Alejandro Jodorowsky & Marianne Costa",
    year: 2011,
    level: "Avançado",
    concepts: ["4 centros", "Psicomagia", "Arquétipo materno"],
    citations: 31,
    protocols: 5,
    cases: 9,
    spine: "bg-forest text-foreground",
    cover: "https://covers.openlibrary.org/b/isbn/9782226221315-L.jpg?default=false",
  },
  {
    title: "A Casca e o Núcleo",
    subtitle: "Cripta e fantasma transgeracional",
    author: "Nicolas Abraham & Maria Torok",
    year: 1978,
    level: "Teoria",
    concepts: ["Cripta", "Fantasma", "Segredo"],
    citations: 27,
    protocols: 3,
    cases: 7,
    spine: "bg-mahogany/80 text-foreground",
    cover: "https://covers.openlibrary.org/b/isbn/9782081218918-L.jpg?default=false",
  },
  {
    title: "Ordens do Amor",
    subtitle: "As leis sistêmicas do clã",
    author: "Bert Hellinger",
    year: 2001,
    level: "Prática",
    concepts: ["Pertença", "Hierarquia", "Equilíbrio"],
    citations: 55,
    protocols: 12,
    cases: 18,
    spine: "bg-gold text-mahogany",
    cover: "https://covers.openlibrary.org/b/isbn/8531608872-L.jpg?default=false",
  },
  {
    title: "Minhas Ancestrais Feridas",
    subtitle: "A transmissão transgeracional na clínica",
    author: "Patrick Estrade",
    year: 2013,
    level: "Prática Clínica",
    concepts: ["Padrão de repetição", "Ruptura", "Nomeação"],
    citations: 19,
    protocols: 6,
    cases: 11,
    spine: "bg-mahogany text-foreground",
  },
  {
    title: "O Murmúrio dos Fantasmas",
    subtitle: "Como sair do passado transgeracional",
    author: "Boris Cyrulnik",
    year: 2004,
    level: "Resiliência",
    concepts: ["Tutor de resiliência", "Reescrita narrativa"],
    citations: 22,
    protocols: 4,
    cases: 8,
    spine: "bg-forest/80 text-foreground",
    cover: "https://covers.openlibrary.org/b/isbn/9782738113610-L.jpg?default=false",
  },
];

const QUOTES = [
  {
    text: "Ninguém escapa do seu clã. Pode-se tentar, mas o sistema sempre encontrará uma forma de ser ouvido — seja pelo corpo, seja pelo destino.",
    author: "Anne Ancelin Schützenberger",
    work: "Meus Antepassados",
    year: 1988,
    theme: "Lealdade invisível",
    tone: "cream",
  },
  {
    text: "A árvore genealógica não é apenas um arquivo histórico. É o mapa do tesouro da sua alma.",
    author: "Alejandro Jodorowsky",
    work: "Metagenealogia",
    year: 2011,
    theme: "Sentido",
    tone: "mahogany",
  },
  {
    text: "O que não é dito em voz alta é vivido na carne.",
    author: "Nicolas Abraham",
    work: "A Casca e o Núcleo",
    year: 1978,
    theme: "Segredo",
    tone: "gold",
  },
  {
    text: "Quem ficou excluído do sistema, os outros membros da família carregarão por ele.",
    author: "Bert Hellinger",
    work: "Ordens do Amor",
    year: 2001,
    theme: "Exclusão",
    tone: "cream",
  },
  {
    text: "Aquilo que os pais calam, os filhos dizem com o corpo.",
    author: "Françoise Dolto",
    work: "A Causa das Crianças",
    year: 1985,
    theme: "Não-dito",
    tone: "forest",
  },
  {
    text: "Nenhuma resiliência sem alguém que ofereça um olhar.",
    author: "Boris Cyrulnik",
    work: "O Dom dos Traumatismos",
    year: 2004,
    theme: "Vínculo",
    tone: "cream",
  },
];

const GLOSSARY: Array<{
  term: string;
  short: string;
  icon: typeof Ghost;
  full: string;
  history: string;
  authors: string[];
  related: string[];
  books: string[];
}> = [
  {
    term: "Síndrome de Aniversário",
    short: "Repetição na mesma data ou mesma idade de um ancestral.",
    icon: Clock,
    full: "Fenômeno em que um sintoma, ruptura ou morte se manifesta na mesma data — ou na mesma idade — em que um ancestral viveu evento análogo. Marcador central da transmissão inconsciente.",
    history:
      "Descrita sistematicamente por Anne Ancelin Schützenberger nos anos 1970 a partir de sua clínica com pacientes oncológicos.",
    authors: ["Anne Ancelin Schützenberger", "Josephine Hilgard"],
    related: ["Genossociograma", "Lealdade Invisível", "Missão de Vida"],
    books: ["Meus Antepassados", "Ay, meus ancestrais!"],
  },
  {
    term: "Cripta",
    short: "Segredo inconfessável enterrado no psiquismo de uma geração.",
    icon: Lock,
    full: "Espaço psíquico onde um segredo indizível é encapsulado. A cripta impede a elaboração do luto e prepara o terreno para o fantasma nas gerações seguintes.",
    history: "Conceito formulado por Nicolas Abraham e Maria Torok (1978) a partir da releitura de Freud.",
    authors: ["Nicolas Abraham", "Maria Torok"],
    related: ["Fantasma", "Segredo", "Não-dito"],
    books: ["A Casca e o Núcleo"],
  },
  {
    term: "Fantasma Transgeracional",
    short: "O 'não-dito' que assombra os descendentes como sintoma sem nome.",
    icon: Ghost,
    full: "Retorno, na terceira geração, de um segredo cifrado na cripta da primeira. Manifesta-se como sintoma inexplicável, fobia ou destino repetido.",
    history: "Elaborado por Abraham & Torok em complemento à cripta.",
    authors: ["Nicolas Abraham", "Maria Torok", "Didier Dumas"],
    related: ["Cripta", "Segredo", "Lealdade Invisível"],
    books: ["A Casca e o Núcleo", "O Anjo e o Fantasma"],
  },
  {
    term: "Lealdade Invisível",
    short: "Obrigação inconsciente de repetir o destino do clã.",
    icon: Link2,
    full: "Compromisso implícito com a fidelidade ao sistema familiar. Faz o sujeito reproduzir sintomas, fracassos ou trajetórias para 'não trair' os ancestrais.",
    history: "Central na terapia contextual de Boszormenyi-Nagy (1973).",
    authors: ["Ivan Boszormenyi-Nagy", "Geraldine Spark"],
    related: ["Missão de Vida", "Livro-razão familiar", "Justiça sistêmica"],
    books: ["Lealdades Invisíveis"],
  },
  {
    term: "Projeto Sentido",
    short: "Programa inconsciente da concepção — o que se esperava da criança.",
    icon: Target,
    full: "Conjunto de expectativas, medos e desejos ativos entre pais no momento da concepção e gestação. Molda a identidade e a missão do sujeito.",
    history: "Elaborado por Marc Fréchet e retomado por Salomon Sellam.",
    authors: ["Marc Fréchet", "Salomon Sellam"],
    related: ["Nome", "Missão de Vida", "Ciclos biológicos memorizados"],
    books: ["A Descodificação Biológica"],
  },
  {
    term: "Criança de Substituição",
    short: "Filho concebido para 'substituir' um ausente — irmão morto, aborto.",
    icon: Baby,
    full: "Sujeito investido, muitas vezes inconscientemente, do papel de reparar uma perda anterior. Sua identidade fica emprestada ao ausente.",
    history: "Descrita por Abraham & Torok e retomada por Schützenberger.",
    authors: ["Nicolas Abraham", "Maria Torok", "A. A. Schützenberger"],
    related: ["Nome", "Fantasma", "Luto congelado"],
    books: ["A Casca e o Núcleo"],
  },
  {
    term: "Ordens do Amor",
    short: "Três leis sistêmicas: pertença, hierarquia, equilíbrio.",
    icon: Scale,
    full: "Leis invisíveis que regem os clãs. Toda violação — exclusão, inversão de hierarquia, desequilíbrio de dar e receber — gera sintoma no sistema.",
    history: "Formuladas por Bert Hellinger a partir da constelação familiar (1980s).",
    authors: ["Bert Hellinger"],
    related: ["Exclusão", "Pertença", "Constelação"],
    books: ["Ordens do Amor", "A Fonte Não Precisa Perguntar pelo Caminho"],
  },
  {
    term: "Epigenética Transgeracional",
    short: "Trauma altera a expressão do DNA — e atravessa gerações.",
    icon: Dna,
    full: "Modificações químicas herdáveis que regulam a expressão genética sem alterar a sequência do DNA. Estudos com filhos de sobreviventes do Holocausto e da fome holandesa confirmam transmissão de marcadores de estresse.",
    history: "Rachel Yehuda (2000s) sistematiza a evidência biológica do transgeracional.",
    authors: ["Rachel Yehuda", "Michael Meaney"],
    related: ["Trauma", "Herança biológica", "Memória celular"],
    books: ["Trauma and the Body", "It Didn't Start With You"],
  },
];

const PROTOCOLS = [
  {
    title: "Entrevista Transgeracional",
    goal: "Coletar 3 gerações de dados vitais e relacionais.",
    indication: "Primeira sessão · anamnese sistêmica",
    duration: "45–60 min",
    complexity: 1,
    steps: ["Nomes e datas por linhagem", "Causas de morte", "Rupturas e uniões", "Segredos e não-ditos"],
    accent: "border-l-gold",
  },
  {
    title: "Checklist: Síndrome de Aniversário",
    goal: "Cruzar idade do paciente com eventos críticos do clã.",
    indication: "Sintoma sem causa aparente · idade-gatilho",
    duration: "30 min",
    complexity: 2,
    steps: ["Idade atual do paciente", "Idades de morte dos avós", "Datas traumáticas do clã", "Coincidências ativas"],
    accent: "border-l-forest",
  },
  {
    title: "Mapa de Segredos",
    goal: "Identificar não-ditos que sustentam o sintoma.",
    indication: "Sensação de vazio · repetições inexplicadas",
    duration: "60 min",
    complexity: 3,
    steps: ["O que não é falado?", "Quem desapareceu da história?", "O que o corpo expressa?", "Ritual de nomeação"],
    accent: "border-l-mahogany",
  },
];

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

function BibliotecaPage() {
  const [q, setQ] = useState("");
  const [openTerm, setOpenTerm] = useState<(typeof GLOSSARY)[number] | null>(null);
  const [aiOpen, setAiOpen] = useState(true);

  const { data: entries = [] } = useQuery({
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

  const filteredEntries = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries.slice(0, 6);
    return entries
      .filter((e) => {
        const hay = [e.author, e.title, e.topic, e.school, e.summary, e.content, ...(e.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 12);
  }, [entries, q]);

  return (
    <div className="relative pb-20">
      <div className="container-archive mt-6 flex gap-8 items-start">
        {/* MAIN */}
        <main className="flex-1 min-w-0 space-y-24">
          {/* ── HERO ───────────────────────────────────────── */}
          <section className="relative pt-6">
            <div className="relative z-10 flex items-start gap-4 md:gap-6">
              <span
                aria-hidden
                className="hidden md:block font-serif text-6xl lg:text-7xl italic font-bold text-foreground/5 leading-none select-none shrink-0 pt-2"
              >
                01
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="font-sans text-[16px] font-bold uppercase tracking-[0.2em] text-gold">
                  Hub de Inteligência Clínica
                </p>
                <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] text-foreground">
                  Biblioteca <span className="italic font-medium text-gold">Clínica</span>
                </h1>
                <p className="max-w-2xl font-serif text-[18px] italic leading-relaxed text-foreground/70">
                  Todo o conhecimento da Psicogenealogia conectado em um único lugar. Autores,
                  conceitos, protocolos e casos que conversam entre si.
                </p>
              </div>
            </div>
            <div className="relative z-10 space-y-6 mt-8">

              <div className="group relative max-w-3xl">
                <div className="absolute inset-0 bg-gold/5 blur-xl opacity-60 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center gap-3 bg-card border border-border shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] p-2 pl-5">
                  <Search className="size-5 text-gold shrink-0" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Pesquise autores, conceitos, doenças, traumas, sobrenomes, sintomas ou protocolos..."
                    className="flex-1 min-w-0 border-none bg-transparent py-4 font-serif text-[17px] text-foreground placeholder:text-foreground/30 italic focus:outline-none"
                  />
                  <kbd className="hidden md:inline-flex items-center gap-1 border border-white/20 bg-muted px-2 py-1 font-sans text-[16px] font-bold text-foreground/60 uppercase tracking-widest">
                    ⌘K
                  </kbd>
                  <button className="hidden sm:inline-flex items-center gap-2 bg-gold hover:bg-gold/80 px-6 py-4 font-sans text-[16px] font-bold uppercase tracking-widest text-archive-doc transition-colors">
                    Buscar <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/50 mr-2">
                  Sugestões:
                </span>
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQ(s)}
                    className="border border-border bg-muted hover:bg-muted/70 px-4 py-2 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/80 transition-colors shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── BIBLIOTECA AUTORAL — LETÍCIA (PROTAGONISTA) ── */}
          <LeticiaAutoralSection />

          {/* ── HOJE NA BIBLIOTECA (BENTO) ─────────────────── */}
          <section className="space-y-6">
            <SectionHeader number="03" eyebrow="Descoberta diária" title="Hoje na Biblioteca" />


            <div className="grid grid-cols-4 gap-5 auto-rows-[minmax(180px,auto)]">
              {/* Concept of day — big */}
              <div className="col-span-4 md:col-span-2 md:row-span-2 relative overflow-hidden border-l-4 border-l-gold bg-card border border-border shadow-xl p-8 flex flex-col justify-between group">
                <div className="absolute -right-6 -top-2 font-serif text-[180px] italic leading-none text-foreground/5 select-none">
                  {TODAY.concept.title.charAt(0)}
                </div>
                <div className="relative space-y-4">
                  <div className="inline-flex items-center gap-2 bg-muted border border-border px-3 py-1.5 font-sans text-[16px] font-bold uppercase tracking-widest text-gold">
                    <Sparkles className="size-3" /> {TODAY.concept.label}
                  </div>
                  <h3 className="font-serif text-4xl md:text-5xl font-bold italic leading-tight text-foreground">
                    {TODAY.concept.title}
                  </h3>
                  <p className="max-w-md font-serif text-[17px] leading-relaxed text-foreground/70 italic">
                    {TODAY.concept.body}
                  </p>
                </div>
                <div className="relative flex flex-wrap items-center justify-between gap-4 mt-8">
                  <div className="flex flex-wrap gap-2">
                    {TODAY.concept.related.map((r) => (
                      <span
                        key={r}
                        className="bg-muted px-3 py-1.5 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/60"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <button className="inline-flex items-center gap-2 font-sans text-[16px] font-bold uppercase tracking-widest text-gold hover:gap-3 transition-all">
                    Aprofundar <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Author of week */}
              <div className="col-span-4 md:col-span-2 bg-card shadow-[0_16px_40px_rgba(0,0,0,0.4)] p-8 flex items-center gap-6">
                <div className="flex size-24 shrink-0 items-center justify-center bg-card border border-black/10 text-foreground font-serif text-3xl font-bold shadow-xl">
                  {TODAY.authorOfWeek.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-sans text-[16px] font-bold uppercase tracking-[0.2em] text-archive-doc/50">
                    Autor da semana
                  </p>
                  <h4 className="font-serif text-3xl font-bold leading-tight mt-2 text-archive-doc">
                    {TODAY.authorOfWeek.name}
                  </h4>
                  <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-archive-doc/70 mt-2">
                    {TODAY.authorOfWeek.field}
                  </p>
                </div>
              </div>

              {/* Recommended book */}
              <div className="col-span-2 md:col-span-1 bg-card border border-border p-6 flex flex-col justify-between shadow-xl">
                <div>
                  <p className="font-sans text-[16px] font-bold uppercase tracking-[0.2em] text-gold">
                    Livro recomendado
                  </p>
                  <h4 className="mt-3 font-serif text-[22px] font-bold text-foreground italic leading-tight">
                    {TODAY.bookRecommended.title}
                  </h4>
                  <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/50 mt-2">
                    {TODAY.bookRecommended.author}
                  </p>
                </div>
                <span className="mt-4 self-start bg-muted border border-gold/30 px-3 py-1 font-sans text-[16px] font-bold uppercase tracking-widest text-gold">
                  {TODAY.bookRecommended.tag}
                </span>
              </div>

              {/* Clinical question */}
              <div className="col-span-2 md:col-span-1 bg-card border border-black/5 shadow-lg p-6 flex flex-col justify-between">
                <p className="font-sans text-[16px] font-bold uppercase tracking-[0.2em] text-archive-doc/50">
                  Pergunta clínica
                </p>
                <p className="text-[17px] font-serif italic leading-relaxed text-archive-doc mt-4 font-medium">
                  "{TODAY.clinicalQuestion}"
                </p>
              </div>
            </div>
          </section>

          {/* ── EXPLORAR POR AUTOR ─────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              number="04"
              eyebrow="Explorar por autor"
              title="Vozes fundadoras"
              action={{ label: `Ver todos (${AUTHORS.length})`, onClick: () => {} }}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
              {AUTHORS.map((a, i) => (
                <AuthorPortraitCard key={a.name} author={a} featured={i === 0} />
              ))}
            </div>
          </section>


          {/* ── EXPLORAR POR TEMA ──────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader number="05" eyebrow="Explorar por tema" title="Territórios clínicos" />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {THEMES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.name}
                    className={`group rounded-[1rem] p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg ${t.accent}`}
                  >
                    <div className="flex items-start justify-between">
                      <Icon className="size-6 opacity-80 group-hover:opacity-100" />
                      <span className="font-sans text-[16px] font-bold opacity-60 uppercase tracking-widest">{t.count}</span>
                    </div>
                    <h4 className="mt-6 font-serif text-[18px] font-bold leading-tight">{t.name}</h4>
                    <ChevronRight className="mt-2 size-4 opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0 transition-all" />
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── LEITURAS FUNDAMENTAIS ──────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              number="06"
              eyebrow="Cânone"
              title="Leituras fundamentais"
              action={{ label: "Ver acervo completo", onClick: () => {} }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ESSENTIAL_BOOKS.map((b) => (
                <article
                  key={b.title}
                  className="group relative flex gap-5 bg-card border border-border p-5 shadow-sm hover:shadow-xl hover:border-white/20 transition-all duration-500 hover:-translate-y-1"
                >
                  {/* Real cover with typographic fallback */}
                  <BookCoverArt book={b} />


                  {/* Meta */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-[22px] font-bold text-foreground leading-tight">
                          {b.title}
                        </h3>
                        <p className="font-serif text-[16px] italic text-foreground/50 mt-1 leading-snug">
                          {b.subtitle}
                        </p>
                        <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-gold mt-3">
                          {b.author} · {b.year}
                        </p>
                      </div>
                      <span className="shrink-0 bg-muted border border-border px-3 py-1.5 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/70">
                        {b.level}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {b.concepts.map((c) => (
                        <span
                          key={c}
                          className="bg-muted px-2.5 py-1.5 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/60"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-4 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/40">
                        <span>
                          <strong className="text-foreground/80">{b.citations}</strong> citações
                        </span>
                        <span>
                          <strong className="text-foreground/80">{b.protocols}</strong> protocolos
                        </span>
                        <span>
                          <strong className="text-foreground/80">{b.cases}</strong> casos
                        </span>
                      </div>
                      <button className="inline-flex items-center gap-2 bg-muted/70 px-4 py-2 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground hover:bg-gold hover:text-archive-doc transition-colors">
                        Abrir
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── CITAÇÕES (MASONRY) ─────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader number="07" eyebrow="Sabedoria clínica" title="Citações dos mestres" />

            <div className="columns-1 md:columns-2 xl:columns-3 gap-5 [column-fill:_balance]">
              {QUOTES.map((q, i) => {
                const bg =
                  q.tone === "mahogany"
                    ? "bg-card text-archive-doc shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
                    : q.tone === "gold"
                      ? "bg-gold text-archive-doc"
                      : q.tone === "forest"
                        ? "bg-archive-doc text-[#FAFAF8] border border-border"
                        : "bg-card text-[#FAFAF8] border border-border";
                const authorColor =
                  q.tone === "mahogany" ? "text-[#151A15]/60" : q.tone === "gold" ? "text-[#151A15]/60" : "text-gold";
                const iconColor =
                  q.tone === "mahogany" ? "text-[#151A15]/10" : q.tone === "gold" ? "text-[#151A15]/20" : "text-foreground/10";
                return (
                  <figure
                    key={i}
                    className={`mb-5 break-inside-avoid p-8 transition-all hover:-translate-y-1 ${bg}`}
                  >
                    <QuoteIcon className={`size-6 mb-3 ${iconColor}`} />
                    <blockquote
                      className={`font-serif italic leading-relaxed ${
                        i % 3 === 0 ? "text-xl" : "text-lg"
                      }`}
                    >
                      "{q.text}"
                    </blockquote>
                    <figcaption className="mt-4 flex items-center justify-between gap-2">
                      <div>
                        <p className={`font-sans text-[16px] font-bold uppercase tracking-widest ${authorColor}`}>
                          {q.author}
                        </p>
                        <p
                          className={`font-sans text-[16px] uppercase tracking-widest mt-1 ${
                            q.tone === "mahogany" || q.tone === "gold" ? "text-[#151A15]/40" : "text-foreground/40"
                          }`}
                        >
                          {q.work} · {q.year} · {q.theme}
                        </p>
                      </div>
                      <QuoteActions tone={q.tone} text={q.text} author={q.author} />
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>

          {/* ── GLOSSÁRIO COMPACTO ─────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader
              number="08"
              eyebrow="Definições"
              title="Glossário clínico"
              action={{ label: "Ver glossário completo", onClick: () => {} }}
            />

            <div className="rounded-[1.25rem] bg-white border border-mahogany/10 overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                <div className="divide-y divide-border/50">
                  {GLOSSARY.slice(0, Math.ceil(GLOSSARY.length / 2)).map((g) => (
                    <GlossaryRow key={g.term} item={g} onOpen={() => setOpenTerm(g)} />
                  ))}
                </div>
                <div className="divide-y divide-border/50">
                  {GLOSSARY.slice(Math.ceil(GLOSSARY.length / 2)).map((g) => (
                    <GlossaryRow key={g.term} item={g} onOpen={() => setOpenTerm(g)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── PROTOCOLOS ─────────────────────────────────── */}
          <section className="space-y-6">
            <SectionHeader number="09" eyebrow="Ferramentas" title="Protocolos de sessão" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PROTOCOLS.map((p) => (
                <article
                  key={p.title}
                  className={`group bg-card border border-border p-6 shadow-xl transition-all ${p.accent.replace("border-l-gold", "border-l-4 border-l-gold").replace("border-l-forest", "border-l-4 border-l-[#FAFAF8]").replace("border-l-mahogany", "border-l-4 border-l-white/20")}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-2 bg-muted px-3 py-1 font-sans text-[16px] font-bold uppercase tracking-widest text-gold">
                      <Clock className="size-3" /> {p.duration}
                    </span>
                    <div className="flex gap-1" aria-label={`Complexidade ${p.complexity} de 3`}>
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={`size-1.5 rounded-full ${
                            n <= p.complexity ? "bg-gold" : "bg-muted/70"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-serif text-[22px] font-bold text-foreground leading-tight">
                    {p.title}
                  </h3>
                  <p className="mt-3 font-serif text-[16px] italic text-foreground/70 leading-relaxed">{p.goal}</p>

                  <div className="mt-5 border-l border-gold/50 pl-4 py-1">
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gold mb-1">
                      Indicação
                    </p>
                    <p className="font-serif text-[16px] text-foreground/80">{p.indication}</p>
                  </div>

                  <ol className="mt-6 space-y-3">
                    {p.steps.map((s, i) => (
                      <li key={s} className="flex items-start gap-3 text-[16px] text-foreground/80 font-serif">
                        <span className="mt-1 flex size-5 shrink-0 items-center justify-center border border-white/20 font-sans text-[9px] font-bold text-foreground/60">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-8 flex gap-3 border-t border-border pt-5">
                    <button className="flex-1 inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold/80 py-3 font-sans text-[16px] font-bold uppercase tracking-widest text-archive-doc transition-colors">
                      <ScrollText className="size-4" /> Checklist
                    </button>
                    <button className="inline-flex items-center justify-center border border-white/20 bg-muted hover:bg-muted/70 px-4 text-foreground transition-colors">
                      <Play className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── ACERVO INTELIGENTE (BASE DE DADOS) ─────────── */}
          {entries.length > 0 && (
            <section className="space-y-6">
              <SectionHeader
                number="10"
                eyebrow="Acervo inteligente"
                title={q ? `Resultados para "${q}"` : "Verbetes recentes do acervo"}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEntries.map((e) => (
                  <motion.article
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border p-6 hover:border-white/30 transition-all shadow-lg"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="font-serif text-[18px] font-bold text-foreground">{e.author}</h4>
                      {e.school && (
                        <span className="font-sans text-[16px] font-bold uppercase tracking-widest text-gold">
                          {e.school}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-serif text-[16px] italic font-semibold text-foreground/80">
                      {e.title}
                      {e.topic && (
                        <span className="font-normal text-foreground/50"> — {e.topic}</span>
                      )}
                    </p>
                    {e.summary && (
                      <p className="mt-3 font-serif text-[16px] leading-relaxed text-foreground/60 line-clamp-3">
                        {e.summary}
                      </p>
                    )}
                    {e.tags && e.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {e.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="bg-muted px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-widest text-foreground/50 border border-border"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.article>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* ─────────── RIGHT: IA CLÍNICA (COLLAPSIBLE) ─────────── */}
        <ClinicalAiRail open={aiOpen} onToggle={() => setAiOpen(!aiOpen)} />
      </div>

      {/* ─────────── GLOSSARY SIDE PANEL ─────────── */}
      <Sheet open={!!openTerm} onOpenChange={(o) => !o && setOpenTerm(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto p-0">
          {openTerm && <GlossaryDetail item={openTerm} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  number,
  eyebrow,
  title,
  action,
}: {
  number: string;
  eyebrow: string;
  title: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
      <div className="flex items-end gap-5 min-w-0">
        <span className="font-serif text-4xl md:text-5xl italic font-bold text-foreground/10 leading-none select-none shrink-0">
          {number}
        </span>
        <div className="min-w-0">
          <p className="font-sans text-[16px] font-bold uppercase tracking-[0.25em] text-gold">
            {eyebrow}
          </p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-tight mt-1">
            {title}
          </h2>
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 inline-flex items-center gap-1.5 font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground transition-colors"
        >
          {action.label} <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function GlossaryRow({
  item,
  onOpen,
}: {
  item: (typeof GLOSSARY)[number];
  onOpen: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-5 p-5 hover:bg-muted transition-colors border-b border-black/5"
    >
      <div className="flex size-12 shrink-0 items-center justify-center bg-card border border-black/10 text-foreground group-hover:bg-gold group-hover:text-archive-doc transition-colors">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-serif text-[18px] font-bold text-archive-doc leading-tight">{item.term}</h4>
          <ChevronRight className="size-4 text-black/20 group-hover:text-archive-doc group-hover:translate-x-1 transition-all shrink-0" />
        </div>
        <p className="mt-1 font-serif text-[16px] text-archive-doc/60 italic leading-snug line-clamp-1">
          {item.short}
        </p>
      </div>
    </button>
  );
}

function GlossaryDetail({ item }: { item: (typeof GLOSSARY)[number] }) {
  const Icon = item.icon;
  return (
    <div>
      <div className="block-mahogany p-8 relative overflow-hidden">
        <span className="section-number absolute -right-4 -bottom-8 opacity-[0.06] text-foreground select-none">
          {item.term.charAt(0)}
        </span>
        <SheetHeader className="relative z-10 space-y-4 p-0">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted/70 backdrop-blur-sm text-gold">
            <Icon className="size-6" />
          </div>
          <p className="text-[16px] font-bold uppercase tracking-widest text-gold">
            Verbete clínico
          </p>
          <SheetTitle className="font-serif text-3xl font-bold italic text-foreground leading-tight text-left">
            {item.term}
          </SheetTitle>
          <p className="text-[16px] leading-relaxed text-foreground/80 text-left">{item.short}</p>
        </SheetHeader>
      </div>

      <div className="p-8 space-y-8">
        <DetailBlock label="Definição completa">
          <p className="text-[16px] leading-relaxed text-foreground/85">{item.full}</p>
        </DetailBlock>

        <DetailBlock label="História do conceito">
          <p className="text-[16px] leading-relaxed text-foreground/70 italic font-serif">
            {item.history}
          </p>
        </DetailBlock>

        <DetailBlock label="Autores">
          <div className="flex flex-wrap gap-2">
            {item.authors.map((a) => (
              <span
                key={a}
                className="rounded-full bg-forest-soft/60 px-3 py-1 text-[16px] font-semibold text-mahogany"
              >
                {a}
              </span>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock label="Conceitos relacionados">
          <div className="flex flex-wrap gap-2">
            {item.related.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-md border border-mahogany/15 bg-white px-2.5 py-1 text-[16px] font-medium text-mahogany hover:bg-mahogany hover:text-foreground transition-colors cursor-pointer"
              >
                <Link2 className="size-3" /> {r}
              </span>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock label="Bibliografia">
          <ul className="space-y-2">
            {item.books.map((b) => (
              <li
                key={b}
                className="flex items-center gap-2.5 text-[16px] text-foreground/80"
              >
                <BookOpen className="size-3.5 text-gold shrink-0" />
                <span className="font-serif italic">{b}</span>
              </li>
            ))}
          </ul>
        </DetailBlock>

        <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-mahogany py-3 text-[16px] font-bold uppercase tracking-wider text-foreground hover:bg-forest transition-colors">
          <Wand2 className="size-4" /> Usar em sessão
        </button>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[16px] font-bold uppercase tracking-[0.2em] text-forest mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function QuoteActions({
  tone,
  text,
  author,
}: {
  tone: string;
  text: string;
  author: string;
}) {
  const iconClass =
    tone === "mahogany"
      ? "text-foreground/40 hover:text-gold"
      : tone === "gold"
        ? "text-mahogany/40 hover:text-mahogany"
        : "text-muted-foreground/40 hover:text-forest";

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${text}" — ${author}`);
    toast.success("Citação copiada");
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={handleCopy} className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${iconClass}`} title="Copiar" aria-label="Copiar">
        <Copy className="size-3.5" />
      </button>
      <button className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${iconClass}`} title="Salvar" aria-label="Salvar">
        <Bookmark className="size-3.5" />
      </button>
      <button className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${iconClass}`} title="Adicionar às notas" aria-label="Adicionar às notas">
        <StickyNote className="size-3.5" />
      </button>
      <button className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${iconClass}`} title="Usar em sessão" aria-label="Usar em sessão">
        <Play className="size-3.5" />
      </button>
    </div>
  );
}

function ClinicalAiRail({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <aside className="relative shrink-0 hidden xl:block transition-all duration-300">
      <button
        onClick={onToggle}
        className="absolute -left-3 top-16 z-50 flex size-7 items-center justify-center rounded-full border border-mahogany/15 bg-white text-mahogany shadow-md hover:scale-105 transition-transform"
      >
        {open ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
      </button>

      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="open"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-[320px] sticky top-6 space-y-5 overflow-hidden"
          >
            <div className="relative overflow-hidden bg-card border border-white/20 p-6 text-foreground shadow-xl">
              <div className="absolute -right-6 -top-6 size-32 rounded-full bg-gold/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center border border-gold/50 bg-gold/10">
                    <BrainCircuit className="size-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-[18px] font-bold">IA Clínica</h3>
                    <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gold font-bold">
                      Contextual · viva
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <AiBlock label="Conexão sugerida">
                    Você sabia que <strong className="text-gold">Cripta</strong> (Torok) conecta-se
                    ao trauma de <strong className="text-gold">Aborto</strong> na 3ª geração?
                  </AiBlock>

                  <AiList
                    label="Autores relacionados"
                    items={["Nicolas Abraham", "Maria Torok", "Didier Dumas"]}
                  />

                  <AiList
                    label="Perguntas para investigar"
                    items={[
                      "Houve luto não elaborado na linhagem materna?",
                      "Qual o segredo de família mais próximo do nascimento?",
                    ]}
                  />

                  <AiList
                    label="Protocolos aplicáveis"
                    items={["Mapa de Segredos", "Ritual de nomeação"]}
                  />
                </div>
              </div>
            </div>

            {/* Curiosidade histórica */}
            <div className="bg-archive-doc border border-gold/20 p-6 shadow-md">
              <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-gold">
                Curiosidade histórica
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-foreground/80 italic font-serif">
                {TODAY.historyBite}
              </p>
            </div>

            {/* Mini timeline */}
            <div className="bg-card border border-border p-6 shadow-sm">
              <p className="font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/50">
                Linha do tempo
              </p>
              <ol className="mt-4 space-y-4">
                {[
                  { y: "1913", e: "Freud · Totem e Tabu" },
                  { y: "1970", e: "Schützenberger · genossociograma" },
                  { y: "1978", e: "Abraham & Torok · A Casca e o Núcleo" },
                  { y: "1990", e: "Hellinger · Ordens do Amor" },
                  { y: "2005", e: "Yehuda · epigenética do trauma" },
                ].map((t) => (
                  <li key={t.y} className="flex items-start gap-3 text-[16px]">
                    <span className="mt-0.5 border border-gold/30 bg-archive-doc px-2 py-0.5 font-sans font-bold text-gold text-[16px]">
                      {t.y}
                    </span>
                    <span className="text-foreground/70 leading-snug font-serif italic">{t.e}</span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 48, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="w-12 sticky top-6 flex flex-col items-center gap-4 bg-card border border-border py-6 shadow-sm cursor-pointer"
            onClick={onToggle}
          >
            <BrainCircuit className="size-5 text-gold animate-pulse" />
            <p
              className="font-sans text-[16px] font-bold uppercase tracking-widest text-gold/80"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              IA Clínica
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function AiBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted border border-border p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40 mb-1.5">
        {label}
      </p>
      <p className="text-[16px] leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}

function AiList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/40 mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <button
            key={it}
            className="w-full text-left rounded-lg bg-muted border border-border px-3 py-2 text-[11.5px] text-foreground/85 hover:bg-forest hover:border-forest transition-colors flex items-center justify-between group"
          >
            <span className="min-w-0 truncate pr-2">{it}</span>
            <ArrowRight className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PORTRAIT & COVER PRIMITIVES (real image with elegant fallback)
// ─────────────────────────────────────────────────────────────

function SmartImage({
  src,
  alt,
  className,
  filter,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  filter?: string;
  fallback: React.ReactNode;
}) {
  const [ok, setOk] = useState(Boolean(src));
  if (!src || !ok) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setOk(false)}
      className={className}
      style={filter ? { filter } : undefined}
    />
  );
}

function AuthorPortraitCard({
  author,
  featured,
}: {
  author: (typeof AUTHORS)[number];
  featured: boolean;
}) {
  return (
    <button className="group text-left">
      <div className="relative aspect-[4/5] overflow-hidden bg-card">
        {/* Museum paper grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.18] mix-blend-multiply pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.15) 0.5px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.1) 0.5px, transparent 1px)",
            backgroundSize: "3px 3px, 5px 5px",
          }}
        />
        <SmartImage
          src={author.photo}
          alt={author.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-[900ms] group-hover:scale-[1.04]"
          filter="grayscale(1) sepia(0.35) contrast(1.05) brightness(0.98)"
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-serif text-[68px] font-black italic text-archive-doc/20 select-none"
                style={{ letterSpacing: "-0.04em" }}
              >
                {author.initials}
              </span>
            </div>
          }
        />
        {/* Editorial vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#151A15] via-[#151A15]/10 to-transparent" />
        {/* Bottom caption strip */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          {author.years && (
            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
              {author.years}
            </p>
          )}
          <p className="mt-0.5 font-sans text-[16px] text-foreground/50 font-bold uppercase tracking-widest">{author.nationality ?? ""}</p>
        </div>
        {featured && (
          <span className="absolute top-3 right-3 bg-gold px-2 py-0.5 font-sans text-[8px] font-black uppercase tracking-widest text-archive-doc shadow-md">
            Semana
          </span>
        )}
      </div>
      <div>
        <h4 className="font-serif text-[17px] font-bold text-foreground leading-tight">
          {author.name}
        </h4>
        <p className="mt-1 font-sans text-[16px] uppercase tracking-widest text-gold font-bold">
          {author.field}
        </p>
        <p className="mt-1 font-sans text-[16px] text-foreground/40 uppercase tracking-widest font-bold">
          {author.works} obras · {author.concepts} conceitos
        </p>
      </div>
    </button>
  );
}

function BookCoverArt({ book }: { book: (typeof ESSENTIAL_BOOKS)[number] }) {
  return (
    <div className="relative w-28 shrink-0 perspective-[900px]">
      <div
        className="relative h-40 w-full rounded-r-md rounded-l-sm shadow-[6px_10px_25px_-8px_oklch(0.25_0.10_295/0.45)] transition-transform duration-500 group-hover:-rotate-y-6 origin-left overflow-hidden"
        style={{ transformStyle: "preserve-3d" }}
      >
        <SmartImage
          src={book.cover}
          alt={book.title}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <div className={`absolute inset-0 flex flex-col justify-between p-3 ${book.spine}`}>
              <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">
                {book.year}
              </span>
              <div>
                <p className="font-serif text-[16px] font-bold italic leading-tight">
                  {book.title}
                </p>
                <div className="mt-1.5 h-px w-6 bg-current opacity-40" />
              </div>
            </div>
          }
        />
        {/* Spine shadow */}
        <div className="absolute inset-y-0 left-0 w-1 bg-black/25 rounded-l-sm" />
        {/* Subtle sheen */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BIBLIOTECA AUTORAL — SEÇÃO PROTAGONISTA (LETÍCIA)
// ─────────────────────────────────────────────────────────────

function LeticiaAutoralSection() {
  const accentMap = {
    mahogany: "bg-mahogany text-foreground",
    forest: "bg-forest text-foreground",
    gold: "bg-gold text-mahogany",
    cream: "bg-cream text-mahogany border border-mahogany/10",
  } as const;

  return (
    <section className="relative space-y-8">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-8 -bottom-8 -z-10 rounded-[2rem] bg-gradient-to-br from-[#151A15] via-transparent to-transparent blur-2xl"
      />

      <SectionHeader
        number="02"
        eyebrow="Biblioteca Autoral"
        title="Acervo de Letícia Kuchockowolec Baccin"
      />

      {/* Author hero */}
      <div className="relative grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-stretch">
        {/* Portrait */}
        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden border border-black/30 shadow-[0_30px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10 bg-card">
            <img
              src={LETICIA.photo}
              alt={LETICIA.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* Museum paper grain */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.10] mix-blend-multiply pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.2) 0.5px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(0,0,0,0.15) 0.5px, transparent 1px)",
                backgroundSize: "3px 3px, 5px 5px",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#151A15] via-[#151A15]/70 to-transparent p-6">
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.3em] text-gold">
                Fundadora · Instituto Liz
              </p>
              <h3 className="mt-2 font-serif text-[22px] font-bold italic text-foreground leading-tight">
                Letícia Kuchockowolec Baccin
              </h3>
            </div>
            <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-gold px-3 py-1 font-sans text-[9px] font-black uppercase tracking-widest text-archive-doc shadow-md">
              <Sparkles className="size-3 text-archive-doc" /> Coleção autoral
            </span>
          </div>
        </div>

        {/* Bio + counters */}
        <div className="flex flex-col justify-between bg-card border border-border p-8 shadow-xl">
          <div className="space-y-5">
            <p className="font-sans text-[16px] font-bold uppercase tracking-[0.28em] text-gold">
              Biblioteca Autoral
            </p>
            <h3 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-[1.1]">
              Toda a produção científica, clínica e didática da{" "}
              <span className="italic text-gold">fundadora</span> da Academia.
            </h3>
            <p className="font-serif text-[16px] leading-relaxed text-foreground/70 max-w-xl">
              {LETICIA.bio}
            </p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border pt-6">
            {[
              { n: LETICIA_WORKS.length, l: "Obras" },
              {
                n: LETICIA_WORKS.reduce((s, w) => s + w.protocols, 0),
                l: "Protocolos",
              },
              {
                n: LETICIA_WORKS.reduce((s, w) => s + w.citations, 0),
                l: "Citações",
              },
            ].map((s) => (
              <div key={s.l} className="min-w-0">
                <p className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-none">
                  {s.n}
                </p>
                <p className="font-sans text-[16px] font-bold uppercase tracking-[0.1em] text-foreground/40 mt-2">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Works grid — Apple Books / Netflix aesthetic */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {LETICIA_WORKS.map((w) => (
          <article
            key={w.title}
            className="group relative overflow-hidden bg-card border border-border shadow-lg hover:shadow-2xl hover:border-gold/50 hover:-translate-y-1 transition-all duration-500"
          >
            {/* Cover panel */}
            <div
              className={`relative h-44 flex items-center justify-center overflow-hidden bg-archive-doc text-foreground`}
            >
              {/* Letícia portrait medallion */}
              <div className="absolute -bottom-6 -right-6 size-32 rounded-full overflow-hidden border-4 border-border opacity-30 group-hover:opacity-60 transition-opacity">
                <img
                  src={LETICIA.photo}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover"
                  style={{ filter: "grayscale(1) contrast(1.1)" }}
                />
              </div>
              {/* Paper grain */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.25] mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0.5px, transparent 1px)",
                  backgroundSize: "4px 4px",
                }}
              />
              <div className="relative z-10 text-center px-6">
                <p className="font-sans text-[16px] font-bold uppercase tracking-[0.3em] opacity-70 text-gold">
                  {w.kind}
                </p>
                <h4 className="mt-2 font-serif text-2xl font-bold italic leading-tight">
                  {w.title}
                </h4>
                <div className="mt-3 h-px w-12 mx-auto bg-white/20" />
              </div>
              {/* Badge */}
              <span
                className={`absolute top-3 left-3 px-3 py-1 font-sans text-[9px] font-black uppercase tracking-widest shadow border border-gold/30 ${
                  w.badge === "Novo"
                    ? "bg-gold text-archive-doc"
                    : w.badge === "Exclusivo"
                      ? "bg-card text-gold"
                      : w.badge === "Mais estudado"
                        ? "bg-card text-archive-doc"
                        : "bg-muted/70 text-foreground"
                }`}
              >
                {w.badge}
              </span>
            </div>

            {/* Meta */}
            <div className="p-6 space-y-4 bg-archive-doc">
              <p className="font-serif text-[16px] italic text-foreground/70 leading-snug">
                {w.subtitle}
              </p>
              <div className="flex items-center justify-between font-sans text-[16px] font-bold uppercase tracking-widest text-foreground/50 border-t border-border pt-4">
                <span>
                  <strong className="text-foreground">{w.concepts}</strong> conceitos
                </span>
                <span>
                  <strong className="text-foreground">{w.protocols}</strong> protocolos
                </span>
                <span>
                  <strong className="text-foreground">{w.citations}</strong> citações
                </span>
              </div>
              <button className="w-full inline-flex items-center justify-center gap-2 border border-gold py-3 font-sans text-[16px] font-bold uppercase tracking-widest text-gold hover:bg-gold hover:text-archive-doc transition-colors">
                <Play className="size-4" /> Explorar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
