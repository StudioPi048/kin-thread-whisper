import {
  Feather,
  Ghost,
  HeartCrack,
  Link2,
  Target,
  Fingerprint,
  Building2,
  UserMinus,
  Anchor,
  Users,
  Baby,
  Lock,
  Dna,
  Scale,
  Clock,
} from "lucide-react";
import leticiaAsset from "@/assets/leticia-baccin.png.asset.json";

// ─────────────────────────────────────────────────────────────
// BIBLIOTECA AUTORAL — LETÍCIA KUCHOCKOWOLEC BACCIN
// ─────────────────────────────────────────────────────────────

export const LETICIA = {
  name: "Letícia Kuchockowolec Baccin",
  role: "Fundadora do Instituto Liz · Psicogenealogista clínica",
  bio: "Autora, pesquisadora e formadora em Psicogenealogia. Fundadora da Academia Liz Indica, criadora de metodologias autorais e referência em transmissão clínica no Brasil.",
  photo: leticiaAsset.url,
};

export const LETICIA_WORKS: Array<{
  title: string;
  subtitle: string;
  kind: "Livro" | "Manual" | "Almanaque" | "Curso" | "Protocolo";
  badge: "Novo" | "Mais estudado" | "Exclusivo" | "Clássico";
  concepts: number;
  protocols: number;
  citations: number;
  accent: "forest" | "forest" | "gold" | "cream";
}> = [
  {
    title: "O Código Sagrado dos Dentes",
    subtitle: "Simbologia oral e memória transgeracional",
    kind: "Livro",
    badge: "Novo",
    concepts: 120,
    protocols: 48,
    citations: 312,
    accent: "forest",
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
    accent: "forest",
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

export const QUICK_SUGGESTIONS = [
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

export const TODAY = {
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

export const AUTHORS: Array<{
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
    photo: "https://commons.wikimedia.org/wiki/Special:FilePath/Bert_Hellinger.jpg?width=400",
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

export const THEMES: Array<{ name: string; count: number; icon: typeof Feather; accent: string }> =
  [
    {
      name: "Traumas",
      count: 42,
      icon: HeartCrack,
      accent: "bg-[#151A15] text-white border border-white/10",
    },
    {
      name: "Lealdades",
      count: 28,
      icon: Link2,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Doenças",
      count: 31,
      icon: Dna,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Projeto Sentido",
      count: 19,
      icon: Target,
      accent: "bg-[#151A15] text-[#1B211A] border border-[#1B211A]/10",
    },
    {
      name: "Nome",
      count: 12,
      icon: Fingerprint,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Empresa Familiar",
      count: 15,
      icon: Building2,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Abandono",
      count: 24,
      icon: UserMinus,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Luto",
      count: 33,
      icon: Anchor,
      accent: "bg-[#D4AF37] text-[#1B211A] border border-[#D4AF37]/50",
    },
    {
      name: "Exclusão",
      count: 21,
      icon: Users,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Aborto",
      count: 18,
      icon: Baby,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Segredos",
      count: 26,
      icon: Lock,
      accent: "bg-white/5 text-white border-l-4 border-l-[#D4AF37]",
    },
    {
      name: "Epigenética",
      count: 14,
      icon: Dna,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
    {
      name: "Ordens do Amor",
      count: 17,
      icon: Scale,
      accent: "bg-[#1B211A] text-white border border-black/20",
    },
  ];

export const ESSENTIAL_BOOKS: Array<{
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
    spine: "bg-forest text-white",
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
    spine: "bg-forest text-white",
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
    spine: "bg-forest/80 text-white",
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
    spine: "bg-gold text-forest",
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
    spine: "bg-forest text-white",
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
    spine: "bg-forest/80 text-white",
    cover: "https://covers.openlibrary.org/b/isbn/9782738113610-L.jpg?default=false",
  },
];

export const QUOTES = [
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
    tone: "forest",
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

export const GLOSSARY: Array<{
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
    history:
      "Conceito formulado por Nicolas Abraham e Maria Torok (1978) a partir da releitura de Freud.",
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

export const PROTOCOLS = [
  {
    title: "Entrevista Transgeracional",
    goal: "Coletar 3 gerações de dados vitais e relacionais.",
    indication: "Primeira sessão · anamnese sistêmica",
    duration: "45–60 min",
    complexity: 1,
    steps: [
      "Nomes e datas por linhagem",
      "Causas de morte",
      "Rupturas e uniões",
      "Segredos e não-ditos",
    ],
    accent: "border-l-gold",
  },
  {
    title: "Checklist: Síndrome de Aniversário",
    goal: "Cruzar idade do paciente com eventos críticos do clã.",
    indication: "Sintoma sem causa aparente · idade-gatilho",
    duration: "30 min",
    complexity: 2,
    steps: [
      "Idade atual do paciente",
      "Idades de morte dos avós",
      "Datas traumáticas do clã",
      "Coincidências ativas",
    ],
    accent: "border-l-forest",
  },
  {
    title: "Mapa de Segredos",
    goal: "Identificar não-ditos que sustentam o sintoma.",
    indication: "Sensação de vazio · repetições inexplicadas",
    duration: "60 min",
    complexity: 3,
    steps: [
      "O que não é falado?",
      "Quem desapareceu da história?",
      "O que o corpo expressa?",
      "Ritual de nomeação",
    ],
    accent: "border-l-forest",
  },
];
