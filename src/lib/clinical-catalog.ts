// Catálogo determinístico de perguntas clínicas e protocolos por tipo de padrão.
// Zero IA generativa — pura curadoria estática usada pelo briefing do Dossiê.

export type JourneyStage =
  "primeira" | "investigacao" | "hipoteses" | "elaboracao" | "integracao" | "alta";

export const JOURNEY_STAGES: { key: JourneyStage; label: string; description: string }[] = [
  {
    key: "primeira",
    label: "Primeira consulta",
    description: "Escuta inicial e vínculo terapêutico.",
  },
  {
    key: "investigacao",
    label: "Investigação",
    description: "Coleta transgeracional e mapeamento familiar.",
  },
  { key: "hipoteses", label: "Hipóteses", description: "Formulação de padrões e lealdades." },
  {
    key: "elaboracao",
    label: "Elaboração",
    description: "Ressignificação e trabalho com protocolos.",
  },
  { key: "integracao", label: "Integração", description: "Consolidação e novas escolhas." },
  { key: "alta", label: "Alta", description: "Encerramento e continuidade autônoma." },
];

export const stageIndex = (s: JourneyStage) => JOURNEY_STAGES.findIndex((j) => j.key === s);

/** Estágio da jornada clínica, derivado de sinais objetivos (nunca inventado). */
export const deriveStage = (
  sessionCount: number,
  hasGenogram: boolean,
  patternCount: number,
): JourneyStage => {
  if (sessionCount === 0) return "primeira";
  if (sessionCount === 1) return "investigacao";
  if (!hasGenogram) return "investigacao";
  if (patternCount === 0) return "hipoteses";
  if (sessionCount < 6) return "hipoteses";
  if (sessionCount < 12) return "elaboracao";
  return "integracao";
};

// Perguntas sugeridas por tipo de padrão. Chaves são normalizadas em lowercase.
export const QUESTIONS_BY_PATTERN: Record<string, string[]> = {
  lealdade_invisivel: [
    "O que você acredita estar 'protegendo' na família ao repetir esse padrão?",
    "A quem essa fidelidade pertence — a você ou a um ancestral?",
    "O que aconteceria se você abrisse mão dessa lealdade?",
  ],
  sindrome_aniversario: [
    "Há alguma idade específica que assusta você ou marca a família?",
    "O que aconteceu na família quando você tinha essa idade?",
    "Que datas se repetem entre nascimentos, mortes e crises?",
  ],
  projeto_sentido: [
    "Para quem você foi 'esperado' ao nascer?",
    "Que perda ou desejo antecedeu sua chegada à família?",
    "Que missão silenciosa você sente que precisa cumprir?",
  ],
  repeticao_nome: [
    "O que carrega o nome que você recebeu?",
    "Quem escolheu seu nome — e por qual história?",
    "O que muda quando você diz seu nome inteiro em voz alta?",
  ],
  segredo_familiar: [
    "Existe algum tema que nunca se fala na família?",
    "O que os silêncios ensinaram você a esconder?",
    "Que perguntas você nunca fez — e por quê?",
  ],
  exclusao: [
    "Quem está 'fora' na sua família — e por qual motivo?",
    "O que você sente ao pensar em incluir essa pessoa novamente?",
    "Que espaço vazio essa exclusão criou em você?",
  ],
  luto_nao_elaborado: [
    "Quem morreu sem ser adequadamente chorado na família?",
    "Que perda ainda pesa mesmo sem palavras?",
    "Como o corpo da família guarda esse luto?",
  ],
  default: [
    "O que aparece na sua história ao pensar nesse padrão?",
    "Quem, além de você, viveu algo semelhante na família?",
    "Que sentimento se repete quando esse tema surge?",
  ],
};

// Protocolos sugeridos por tipo de padrão.
export const PROTOCOLS_BY_PATTERN: Record<string, string[]> = {
  lealdade_invisivel: ["Lealdade Invisível", "Entrevista Transgeracional", "Restituição Simbólica"],
  sindrome_aniversario: ["Linha do Tempo", "Mapa de Coincidências de Datas", "Ritual de Passagem"],
  projeto_sentido: ["Projeto Sentido", "Escuta do Nascimento", "Carta ao Não-Nascido"],
  repeticao_nome: ["Genealogia dos Nomes", "Restituição Simbólica"],
  segredo_familiar: ["Mapa de Segredos", "Escuta Sistêmica", "Carta ao Ancestral"],
  exclusao: ["Restituição Simbólica", "Constelação de Inclusão"],
  luto_nao_elaborado: ["Ritual de Luto", "Carta ao Ancestral", "Linha do Tempo"],
  default: ["Entrevista Transgeracional", "Mapa Inicial", "Linha do Tempo"],
};

// Palavras-chave para conectar padrões à biblioteca por tags.
export const LIBRARY_TAGS_BY_PATTERN: Record<string, string[]> = {
  lealdade_invisivel: ["lealdade", "transgeracional", "vínculo"],
  sindrome_aniversario: ["aniversário", "datas", "coincidência"],
  projeto_sentido: ["projeto sentido", "concepção", "nascimento"],
  repeticao_nome: ["nome", "identidade"],
  segredo_familiar: ["segredo", "não-dito", "silêncio"],
  exclusao: ["exclusão", "inclusão", "sistêmica"],
  luto_nao_elaborado: ["luto", "morte", "elaboração"],
  default: ["psicogenealogia", "família", "transgeracional"],
};

export const normalizePatternKey = (raw: string | null | undefined): string => {
  if (!raw) return "default";
  const k = raw
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z_]/g, "");
  return k in QUESTIONS_BY_PATTERN ? k : "default";
};

export const questionsFor = (pattern: string) => QUESTIONS_BY_PATTERN[normalizePatternKey(pattern)];
export const protocolsFor = (pattern: string) => PROTOCOLS_BY_PATTERN[normalizePatternKey(pattern)];
export const libraryTagsFor = (pattern: string) =>
  LIBRARY_TAGS_BY_PATTERN[normalizePatternKey(pattern)];
