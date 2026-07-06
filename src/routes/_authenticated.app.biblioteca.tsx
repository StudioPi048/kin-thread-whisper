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
  accent: "plum" | "lavender" | "gold" | "cream";
}> = [
  {
    title: "O Código Sagrado dos Dentes",
    subtitle: "Simbologia oral e memória transgeracional",
    kind: "Livro",
    badge: "Novo",
    concepts: 120,
    protocols: 48,
    citations: 312,
    accent: "plum",
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
    accent: "lavender",
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
    accent: "plum",
  },
  {
    title: "Protocolo do Clã",
    subtitle: "Ferramenta de mapeamento em 4 gerações",
    kind: "Protocolo",
    badge: "Mais estudado",
    concepts: 32,
    protocols: 12,
    citations: 96,
    accent: "lavender",
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
  { name: "Traumas", count: 42, icon: HeartCrack, accent: "bg-plum text-white" },
  { name: "Lealdades", count: 28, icon: Link2, accent: "bg-white text-plum border border-plum/10" },
  { name: "Doenças", count: 31, icon: Dna, accent: "bg-white text-plum border border-plum/10" },
  { name: "Projeto Sentido", count: 19, icon: Target, accent: "bg-lavender text-white" },
  { name: "Nome", count: 12, icon: Fingerprint, accent: "bg-white text-plum border border-plum/10" },
  { name: "Empresa Familiar", count: 15, icon: Building2, accent: "bg-white text-plum border border-plum/10" },
  { name: "Abandono", count: 24, icon: UserMinus, accent: "bg-white text-plum border border-plum/10" },
  { name: "Luto", count: 33, icon: Anchor, accent: "bg-gold text-plum" },
  { name: "Exclusão", count: 21, icon: Users, accent: "bg-white text-plum border border-plum/10" },
  { name: "Aborto", count: 18, icon: Baby, accent: "bg-white text-plum border border-plum/10" },
  { name: "Segredos", count: 26, icon: Lock, accent: "bg-plum/90 text-white" },
  { name: "Epigenética", count: 14, icon: Dna, accent: "bg-white text-plum border border-plum/10" },
  { name: "Ordens do Amor", count: 17, icon: Scale, accent: "bg-white text-plum border border-plum/10" },
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
    spine: "bg-plum text-white",
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
    spine: "bg-lavender text-white",
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
    spine: "bg-plum/80 text-white",
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
    spine: "bg-gold text-plum",
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
    spine: "bg-plum text-white",
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
    spine: "bg-lavender/80 text-white",
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
    tone: "plum",
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
    tone: "lavender",
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
    accent: "border-l-lavender",
  },
  {
    title: "Mapa de Segredos",
    goal: "Identificar não-ditos que sustentam o sintoma.",
    indication: "Sensação de vazio · repetições inexplicadas",
    duration: "60 min",
    complexity: 3,
    steps: ["O que não é falado?", "Quem desapareceu da história?", "O que o corpo expressa?", "Ritual de nomeação"],
    accent: "border-l-plum",
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
      <div className="container-liz mt-6 flex gap-8 items-start">
        {/* MAIN */}
        <main className="flex-1 min-w-0 space-y-24">
          {/* ── HERO ───────────────────────────────────────── */}
          <section className="relative pt-6">
            <span className="section-number absolute -left-3 -top-6 select-none">01</span>

            <div className="relative z-10 space-y-6">
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-lavender">
                  Hub de Inteligência Clínica
                </p>
                <h1 className="font-serif text-6xl md:text-7xl font-bold leading-[0.95] text-plum">
                  Biblioteca <span className="italic font-medium text-lavender">Clínica</span>
                </h1>
                <p className="max-w-2xl text-[16px] leading-relaxed text-foreground/70">
                  Todo o conhecimento da Psicogenealogia conectado em um único lugar. Autores,
                  conceitos, protocolos e casos que conversam entre si.
                </p>
              </div>

              <div className="group relative max-w-3xl">
                <div className="absolute inset-0 rounded-[1.25rem] bg-gradient-to-r from-lavender/30 to-gold/20 blur-xl opacity-60 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center gap-3 rounded-[1.25rem] border border-plum/10 bg-white p-2 pl-5 shadow-[0_20px_60px_-30px_oklch(0.25_0.10_295/0.5)]">
                  <Search className="size-5 text-lavender shrink-0" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Pesquise autores, conceitos, doenças, traumas, sobrenomes, sintomas ou protocolos..."
                    className="flex-1 min-w-0 border-none bg-transparent py-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-2 py-1 text-[10px] font-mono font-semibold text-muted-foreground">
                    ⌘K
                  </kbd>
                  <button className="hidden sm:inline-flex items-center gap-2 rounded-[0.85rem] bg-plum px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-lavender">
                    Buscar <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mr-1">
                  Sugestões:
                </span>
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQ(s)}
                    className="rounded-full border border-plum/10 bg-white px-3.5 py-1.5 text-[12px] font-medium text-foreground/80 shadow-sm transition-all hover:-translate-y-0.5 hover:border-lavender hover:bg-lavender hover:text-white hover:shadow-md"
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


            <div className="grid grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
              {/* Concept of day — big */}
              <div className="col-span-4 md:col-span-2 md:row-span-2 relative overflow-hidden rounded-[1.25rem] bg-plum text-white p-8 flex flex-col justify-between group hover-lift">
                <div className="absolute -right-6 -top-2 font-serif text-[180px] italic leading-none text-white/[0.05] select-none">
                  {TODAY.concept.title.charAt(0)}
                </div>
                <div className="relative space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                    <Sparkles className="size-3" /> {TODAY.concept.label}
                  </div>
                  <h3 className="font-serif text-4xl md:text-5xl font-bold italic leading-tight">
                    {TODAY.concept.title}
                  </h3>
                  <p className="max-w-md text-[14px] leading-relaxed text-white/75">
                    {TODAY.concept.body}
                  </p>
                </div>
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {TODAY.concept.related.map((r) => (
                      <span
                        key={r}
                        className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/80"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <button className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-gold hover:gap-3 transition-all">
                    Aprofundar <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Author of week */}
              <div className="col-span-4 md:col-span-2 rounded-[1.25rem] bg-gold p-6 text-plum flex items-center gap-5 hover-lift">
                <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-plum text-white font-serif text-2xl font-bold shadow-lg">
                  {TODAY.authorOfWeek.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                    Autor da semana
                  </p>
                  <h4 className="font-serif text-2xl font-bold leading-tight mt-1">
                    {TODAY.authorOfWeek.name}
                  </h4>
                  <p className="text-[12px] mt-1 opacity-80">{TODAY.authorOfWeek.field}</p>
                </div>
              </div>

              {/* Recommended book */}
              <div className="col-span-2 md:col-span-1 rounded-[1.25rem] bg-white border border-plum/10 p-5 flex flex-col justify-between hover-lift">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-lavender">
                    Livro recomendado
                  </p>
                  <h4 className="mt-2 font-serif text-[18px] font-bold text-plum italic leading-tight">
                    {TODAY.bookRecommended.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {TODAY.bookRecommended.author}
                  </p>
                </div>
                <span className="mt-3 self-start rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-plum">
                  {TODAY.bookRecommended.tag}
                </span>
              </div>

              {/* Clinical question */}
              <div className="col-span-2 md:col-span-1 rounded-[1.25rem] bg-lavender-soft/60 border border-lavender/20 p-5 flex flex-col justify-between hover-lift">
                <p className="text-[10px] font-bold uppercase tracking-widest text-lavender">
                  Pergunta clínica
                </p>
                <p className="text-[13px] font-serif italic leading-relaxed text-plum">
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
                      <span className="text-[10px] font-bold opacity-60">{t.count}</span>
                    </div>
                    <h4 className="mt-6 font-serif text-lg font-bold leading-tight">{t.name}</h4>
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
                  className="group relative flex gap-5 rounded-[1.25rem] bg-white border border-plum/10 p-5 shadow-sm hover:shadow-2xl hover:shadow-plum/10 transition-all duration-500 hover:-translate-y-1"
                >
                  {/* Real cover with typographic fallback */}
                  <BookCoverArt book={b} />


                  {/* Meta */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-bold text-plum leading-tight">
                          {b.title}
                        </h3>
                        <p className="text-[12px] italic text-muted-foreground mt-0.5 leading-snug">
                          {b.subtitle}
                        </p>
                        <p className="text-[12px] font-semibold text-lavender mt-2">
                          {b.author} · {b.year}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-gold/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-plum">
                        {b.level}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {b.concepts.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-cream border border-plum/5 px-2 py-0.5 text-[10px] font-semibold text-plum/70"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span>
                          <strong className="text-plum">{b.citations}</strong> citações
                        </span>
                        <span>
                          <strong className="text-plum">{b.protocols}</strong> protocolos
                        </span>
                        <span>
                          <strong className="text-plum">{b.cases}</strong> casos
                        </span>
                      </div>
                      <button className="inline-flex items-center gap-1.5 rounded-lg bg-plum px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-lavender transition-colors">
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
                  q.tone === "plum"
                    ? "bg-plum text-white"
                    : q.tone === "gold"
                      ? "bg-gold text-plum"
                      : q.tone === "lavender"
                        ? "bg-lavender/15 text-plum border border-lavender/30"
                        : "bg-white text-plum border border-plum/10";
                const authorColor =
                  q.tone === "plum" ? "text-gold" : q.tone === "gold" ? "text-plum" : "text-lavender";
                const iconColor =
                  q.tone === "plum" ? "text-white/20" : q.tone === "gold" ? "text-plum/20" : "text-lavender/40";
                return (
                  <figure
                    key={i}
                    className={`mb-5 break-inside-avoid rounded-[1.25rem] p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 ${bg}`}
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
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${authorColor}`}>
                          {q.author}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${
                            q.tone === "plum" ? "text-white/50" : "text-muted-foreground"
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

            <div className="rounded-[1.25rem] bg-white border border-plum/10 overflow-hidden shadow-sm">
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
                  className={`group rounded-[1.25rem] bg-white p-6 border border-plum/10 border-l-[5px] shadow-sm hover:shadow-xl transition-all ${p.accent}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-cream px-2 py-1 text-[10px] font-bold text-plum/70">
                      <Clock className="size-3" /> {p.duration}
                    </span>
                    <div className="flex gap-0.5" aria-label={`Complexidade ${p.complexity} de 3`}>
                      {[1, 2, 3].map((n) => (
                        <span
                          key={n}
                          className={`size-1.5 rounded-full ${
                            n <= p.complexity ? "bg-plum" : "bg-plum/15"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-plum leading-tight">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[13px] text-foreground/70 leading-relaxed">{p.goal}</p>

                  <div className="mt-4 rounded-lg bg-lavender-soft/40 border border-lavender/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-lavender mb-1">
                      Indicação
                    </p>
                    <p className="text-[12px] text-plum/80">{p.indication}</p>
                  </div>

                  <ol className="mt-4 space-y-2">
                    {p.steps.map((s, i) => (
                      <li key={s} className="flex items-start gap-2.5 text-[13px] text-foreground/80">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-plum text-[10px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-6 flex gap-2">
                    <button className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-plum py-2.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-lavender transition-colors">
                      <ScrollText className="size-3.5" /> Checklist
                    </button>
                    <button className="inline-flex items-center justify-center rounded-lg border border-plum/15 px-3 text-plum hover:bg-plum hover:text-white transition-colors">
                      <Play className="size-3.5" />
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
                    className="rounded-[1.25rem] bg-white border border-plum/10 p-5 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="font-serif text-lg font-bold text-plum">{e.author}</h4>
                      {e.school && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          {e.school}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-foreground/85">
                      {e.title}
                      {e.topic && (
                        <span className="font-normal text-muted-foreground"> — {e.topic}</span>
                      )}
                    </p>
                    {e.summary && (
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground line-clamp-3">
                        {e.summary}
                      </p>
                    )}
                    {e.tags && e.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {e.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-cream border border-plum/5 px-2 py-0.5 text-[10px] font-semibold text-plum/70"
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
    <div className="flex items-end justify-between gap-4">
      <div className="flex items-end gap-4 min-w-0">
        <span className="font-serif text-4xl md:text-5xl italic font-bold text-lavender/25 leading-none select-none shrink-0">
          {number}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-lavender">
            {eyebrow}
          </p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-plum leading-tight mt-1">
            {title}
          </h2>
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-lavender hover:text-plum transition-colors"
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
      className="group w-full text-left flex items-start gap-4 p-5 hover:bg-cream/60 transition-colors"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lavender-soft/60 text-lavender group-hover:bg-lavender group-hover:text-white transition-colors">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-serif text-[16px] font-bold text-plum leading-tight">{item.term}</h4>
          <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-lavender group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
        <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug line-clamp-1">
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
      <div className="block-plum p-8 relative overflow-hidden">
        <span className="section-number absolute -right-4 -bottom-8 opacity-[0.06] text-white select-none">
          {item.term.charAt(0)}
        </span>
        <SheetHeader className="relative z-10 space-y-4 p-0">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm text-gold">
            <Icon className="size-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
            Verbete clínico
          </p>
          <SheetTitle className="font-serif text-3xl font-bold italic text-white leading-tight text-left">
            {item.term}
          </SheetTitle>
          <p className="text-[14px] leading-relaxed text-white/80 text-left">{item.short}</p>
        </SheetHeader>
      </div>

      <div className="p-8 space-y-8">
        <DetailBlock label="Definição completa">
          <p className="text-[14px] leading-relaxed text-foreground/85">{item.full}</p>
        </DetailBlock>

        <DetailBlock label="História do conceito">
          <p className="text-[13px] leading-relaxed text-foreground/70 italic font-serif">
            {item.history}
          </p>
        </DetailBlock>

        <DetailBlock label="Autores">
          <div className="flex flex-wrap gap-2">
            {item.authors.map((a) => (
              <span
                key={a}
                className="rounded-full bg-lavender-soft/60 px-3 py-1 text-[12px] font-semibold text-plum"
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
                className="inline-flex items-center gap-1 rounded-md border border-plum/15 bg-white px-2.5 py-1 text-[12px] font-medium text-plum hover:bg-plum hover:text-white transition-colors cursor-pointer"
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
                className="flex items-center gap-2.5 text-[13px] text-foreground/80"
              >
                <BookOpen className="size-3.5 text-gold shrink-0" />
                <span className="font-serif italic">{b}</span>
              </li>
            ))}
          </ul>
        </DetailBlock>

        <button className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-plum py-3 text-[12px] font-bold uppercase tracking-wider text-white hover:bg-lavender transition-colors">
          <Wand2 className="size-4" /> Usar em sessão
        </button>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lavender mb-2">
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
    tone === "plum"
      ? "text-white/40 hover:text-gold"
      : tone === "gold"
        ? "text-plum/40 hover:text-plum"
        : "text-muted-foreground/40 hover:text-lavender";

  const handleCopy = () => {
    navigator.clipboard.writeText(`"${text}" — ${author}`);
    toast.success("Citação copiada");
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={handleCopy} className={`p-1.5 rounded-md transition-colors ${iconClass}`} title="Copiar">
        <Copy className="size-3.5" />
      </button>
      <button className={`p-1.5 rounded-md transition-colors ${iconClass}`} title="Salvar">
        <Bookmark className="size-3.5" />
      </button>
      <button className={`p-1.5 rounded-md transition-colors ${iconClass}`} title="Adicionar às notas">
        <StickyNote className="size-3.5" />
      </button>
      <button className={`p-1.5 rounded-md transition-colors ${iconClass}`} title="Usar em sessão">
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
        className="absolute -left-3 top-16 z-50 flex size-7 items-center justify-center rounded-full border border-plum/15 bg-white text-plum shadow-md hover:scale-105 transition-transform"
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
            {/* AI card */}
            <div className="relative overflow-hidden rounded-[1.25rem] bg-plum p-6 text-white shadow-xl">
              <div className="absolute -right-6 -top-6 size-32 rounded-full bg-lavender/25 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-lavender">
                    <BrainCircuit className="size-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold">IA Clínica</h3>
                    <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
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
            <div className="rounded-[1.25rem] bg-gold/15 border border-gold/30 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-plum/70">
                Curiosidade histórica
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-plum italic font-serif">
                {TODAY.historyBite}
              </p>
            </div>

            {/* Mini timeline */}
            <div className="rounded-[1.25rem] bg-white border border-plum/10 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-lavender">
                Linha do tempo
              </p>
              <ol className="mt-3 space-y-3">
                {[
                  { y: "1913", e: "Freud · Totem e Tabu" },
                  { y: "1970", e: "Schützenberger · genossociograma" },
                  { y: "1978", e: "Abraham & Torok · A Casca e o Núcleo" },
                  { y: "1990", e: "Hellinger · Ordens do Amor" },
                  { y: "2005", e: "Yehuda · epigenética do trauma" },
                ].map((t) => (
                  <li key={t.y} className="flex items-start gap-3 text-[12px]">
                    <span className="mt-0.5 rounded-md bg-plum px-1.5 py-0.5 font-mono font-bold text-white text-[10px]">
                      {t.y}
                    </span>
                    <span className="text-foreground/75 leading-snug">{t.e}</span>
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
            className="w-12 sticky top-6 flex flex-col items-center gap-4 rounded-[1.25rem] bg-white border border-plum/10 py-6 shadow-sm cursor-pointer"
            onClick={onToggle}
          >
            <BrainCircuit className="size-5 text-plum animate-pulse" />
            <p
              className="text-[10px] font-bold uppercase tracking-widest text-plum/60"
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
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
        {label}
      </p>
      <p className="text-[12px] leading-relaxed text-white/85">{children}</p>
    </div>
  );
}

function AiList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">{label}</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <button
            key={it}
            className="w-full text-left rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11.5px] text-white/85 hover:bg-lavender hover:border-lavender transition-colors flex items-center justify-between group"
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
    <button className="group text-left space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.1rem] border border-plum/10 shadow-[0_10px_30px_-15px_oklch(0.25_0.10_295/0.35)] bg-gradient-to-br from-[#e8dfd0] via-[#d8ccb6] to-[#b89e7f] group-hover:shadow-[0_20px_50px_-15px_oklch(0.25_0.10_295/0.5)] transition-all duration-500">
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
                className="font-serif text-[68px] font-black italic text-plum/25 select-none"
                style={{ letterSpacing: "-0.04em" }}
              >
                {author.initials}
              </span>
            </div>
          }
        />
        {/* Editorial vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-plum/70 via-plum/10 to-transparent" />
        {/* Bottom caption strip */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          {author.years && (
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold/90">
              {author.years}
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-white/70">{author.nationality ?? ""}</p>
        </div>
        {featured && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-gold px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-plum shadow-md">
            Semana
          </span>
        )}
      </div>
      <div>
        <h4 className="font-serif text-[15px] font-bold text-plum leading-tight">
          {author.name}
        </h4>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-lavender font-semibold">
          {author.field}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
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
                <p className="font-serif text-[13px] font-bold italic leading-tight">
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
    plum: "bg-plum text-white",
    lavender: "bg-lavender text-white",
    gold: "bg-gold text-plum",
    cream: "bg-cream text-plum border border-plum/10",
  } as const;

  return (
    <section className="relative space-y-8">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-8 -bottom-8 -z-10 rounded-[2rem] bg-gradient-to-br from-plum/[0.03] via-gold/[0.05] to-lavender/[0.06] blur-2xl"
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
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] shadow-[0_30px_80px_-30px_oklch(0.25_0.10_295/0.55)] ring-1 ring-plum/10">
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-plum via-plum/70 to-transparent p-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold">
                Fundadora · Instituto Liz
              </p>
              <h3 className="mt-2 font-serif text-[22px] font-bold italic text-white leading-tight">
                Letícia Kuchockowolec Baccin
              </h3>
            </div>
            <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1 text-[9px] font-black uppercase tracking-widest text-plum shadow-md">
              <Sparkles className="size-3 text-gold" /> Coleção autoral
            </span>
          </div>
        </div>

        {/* Bio + counters */}
        <div className="flex flex-col justify-between rounded-[1.5rem] bg-white/70 backdrop-blur-sm border border-plum/10 p-8 shadow-sm">
          <div className="space-y-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-lavender">
              Biblioteca Autoral
            </p>
            <h3 className="font-serif text-3xl md:text-4xl font-bold text-plum leading-[1.05]">
              Toda a produção científica, clínica e didática da{" "}
              <span className="italic text-lavender">fundadora</span> da Academia.
            </h3>
            <p className="text-[15px] leading-relaxed text-foreground/75 max-w-xl">
              {LETICIA.bio}
            </p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-plum/10 pt-6">
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
              <div key={s.l}>
                <p className="font-serif text-3xl font-bold text-plum">{s.n}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-lavender/80 mt-0.5">
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
            className="group relative overflow-hidden rounded-[1.25rem] bg-white border border-plum/10 shadow-sm hover:shadow-2xl hover:shadow-plum/10 hover:-translate-y-1 transition-all duration-500"
          >
            {/* Cover panel */}
            <div
              className={`relative h-44 flex items-center justify-center overflow-hidden ${accentMap[w.accent]}`}
            >
              {/* Letícia portrait medallion */}
              <div className="absolute -bottom-6 -right-6 size-32 rounded-full overflow-hidden border-4 border-white/20 opacity-30 group-hover:opacity-60 transition-opacity">
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
                className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, rgba(0,0,0,0.3) 0.5px, transparent 1px)",
                  backgroundSize: "4px 4px",
                }}
              />
              <div className="relative z-10 text-center px-6">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-70">
                  {w.kind}
                </p>
                <h4 className="mt-2 font-serif text-xl font-bold italic leading-tight">
                  {w.title}
                </h4>
                <div className="mt-2 h-px w-8 mx-auto bg-current opacity-40" />
              </div>
              {/* Badge */}
              <span
                className={`absolute top-3 left-3 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest shadow ${
                  w.badge === "Novo"
                    ? "bg-gold text-plum"
                    : w.badge === "Exclusivo"
                      ? "bg-plum text-gold border border-gold/40"
                      : w.badge === "Mais estudado"
                        ? "bg-white text-plum"
                        : "bg-lavender text-white"
                }`}
              >
                {w.badge}
              </span>
            </div>

            {/* Meta */}
            <div className="p-4 space-y-3">
              <p className="text-[12px] italic text-muted-foreground leading-snug">
                {w.subtitle}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-3">
                <span>
                  <strong className="text-plum">{w.concepts}</strong> conceitos
                </span>
                <span>
                  <strong className="text-plum">{w.protocols}</strong> protocolos
                </span>
                <span>
                  <strong className="text-plum">{w.citations}</strong> citações
                </span>
              </div>
              <button className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-plum py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-lavender transition-colors">
                <Play className="size-3 fill-current" /> Explorar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
