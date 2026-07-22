/**
 * Normalizador inteligente de parentesco.
 * Reconhece qualquer texto escrito em português (formal, informal, abreviado)
 * e mapeia para a tag canônica do sistema.
 */

/** Remove acentos e normaliza para lowercase */
function clean(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([oa]\)/g, "") // remove marcadores de gênero de tags: Tio(a), Irmã(o)
    .replace(/[()]/g, " ") // mantém o contexto escrito entre parênteses
    .replace(/s$/g, "") // remove plural 's' at the end of words roughly (irmaos -> irmao)
    .replace(/oes$/g, "ao") // (irmaoes -> irmao)
    .replace(/\s+/g, " ")
    .trim();
}

type TagRule = { tag: string; keywords: string[] };

/**
 * Regras de matching em ordem de especificidade (mais específico primeiro).
 * O primeiro match ganha.
 */
const RULES: TagRule[] = [
  // ── CONSULENTE ──────────────────────────────────────────────
  { tag: "Consulente", keywords: ["consulente", "paciente", "proband", "cliente", "eu", "self"] },

  // ── IRMÃOS ──────────────────────────────────────────────────
  // MUST NOT MATCH "irmao do pai", so it should be exactly siblings
  {
    tag: "Irmã(o)",
    keywords: [
      "irmao",
      "irma",
      "irmao mais velho",
      "irmao mais novo",
      "irmao biologico",
      "irma biologica",
      "sibling",
      "brother",
      "sister",
      "half-brother",
      "half-sister",
      "meio irmao",
      "meio irma",
    ],
  },

  // ── PAI / MÃE ───────────────────────────────────────────────
  {
    tag: "Pai",
    keywords: [
      "pai",
      "papa",
      "papai",
      "padrasto",
      "pai biologico",
      "pai adotivo",
      "pai de criacao",
      "genitor",
      "father",
      "dad",
      "stepfather",
      "stepdad",
    ],
  },
  {
    tag: "Mãe",
    keywords: [
      "mae",
      "mama",
      "mamai",
      "madrasta",
      "mae biologica",
      "mae adotiva",
      "mae de criacao",
      "genitora",
      "mother",
      "mom",
      "stepmother",
      "stepmom",
    ],
  },

  // ── IRMÃOS DO PAI (antigos "tios paternos") ─────────────────
  // Nomenclatura explícita: o nome já diz de quem a pessoa é irmã(o),
  // deixando o vínculo óbvio para quem preenche a planilha.
  {
    tag: "Irmã(o) do Pai",
    keywords: [
      "irmao do pai",
      "irmaos do pai",
      "irma do pai",
      "irmaa do pai",
      "irmas do pai",
      "tio paterno",
      "tia paterna",
      "tio do pai",
      "tia do pai",
      "uncle father",
      "paternal uncle",
      "paternal aunt",
    ],
  },

  // ── IRMÃOS DA MÃE (antigos "tios maternos") ─────────────────
  {
    tag: "Irmã(o) da Mãe",
    keywords: [
      "irmao da mae",
      "irmaos da mae",
      "irma da mae",
      "irmas da mae",
      "tio materno",
      "tia materna",
      "tio da mae",
      "tia da mae",
      "uncle mother",
      "maternal uncle",
      "maternal aunt",
    ],
  },

  // ── TIOS (GENÉRICO sem lado, texto legado) ──────────────────
  { tag: "Irmã(o) do Pai", keywords: ["tio", "tia", "uncle", "aunt"] }, // fallback → lado paterno

  // ── AVÔS PATERNOS ───────────────────────────────────────────
  {
    tag: "Avô paterno",
    keywords: [
      "avo paterno",
      "avoh paterno",
      "avo do pai",
      "pai do pai",
      "grandfather father",
      "paternal grandfather",
      "vovo paterno",
    ],
  },
  {
    tag: "Avó paterna",
    keywords: [
      "avo paterna",
      "avoa paterna",
      "avo do pai feminina",
      "mae do pai",
      "grandmother father",
      "paternal grandmother",
      "vovo paterna",
      "vovo do pai",
    ],
  },

  // ── AVÔS MATERNOS ───────────────────────────────────────────
  {
    tag: "Avô materno",
    keywords: [
      "avo materno",
      "avoh materno",
      "avo da mae",
      "pai da mae",
      "grandfather mother",
      "maternal grandfather",
      "vovo materno",
    ],
  },
  {
    tag: "Avó materna",
    keywords: [
      "avo materna",
      "avoa materna",
      "avo da mae feminina",
      "mae da mae",
      "grandmother mother",
      "maternal grandmother",
      "vovo materna",
      "vovo da mae",
    ],
  },

  // ── AVÔS (GENÉRICO) ─────────────────────────────────────────
  { tag: "Avô paterno", keywords: ["avoh", "avo", "grandfather", "grandpa", "vovoh", "vovo"] }, // fallback masculino
  { tag: "Avó paterna", keywords: ["avoa", "grandmother", "grandma", "vovoa"] }, // fallback feminino

  // ── BISAVÔS PATERNOS (avô) ──────────────────────────────────
  {
    tag: "Bisavô paterno (pai do avô)",
    keywords: [
      "bisavo paterno pai do avo",
      "bisavo paterno masculino",
      "bisavo do pai avo",
      "pai do avo paterno",
      "great-grandfather paternal grandfather",
    ],
  },
  {
    tag: "Bisavó paterna (mãe do avô)",
    keywords: [
      "bisavo paterna mae do avo",
      "bisavo paterna feminina",
      "bisava do pai avo",
      "mae do avo paterno",
      "great-grandmother paternal grandfather",
    ],
  },

  // ── BISAVÔS PATERNOS (avó) ──────────────────────────────────
  {
    tag: "Bisavô paterno (pai da avó)",
    keywords: [
      "bisavo paterno pai da avo",
      "bisavo paterno da avo",
      "pai da avo paterna",
      "great-grandfather paternal grandmother",
    ],
  },
  {
    tag: "Bisavó paterna (mãe da avó)",
    keywords: [
      "bisavo paterna mae da avo",
      "bisava paterna da avo",
      "mae da avo paterna",
      "great-grandmother paternal grandmother",
    ],
  },

  // ── BISAVÔS MATERNOS (avô) ──────────────────────────────────
  {
    tag: "Bisavô materno (pai do avô)",
    keywords: [
      "bisavo materno pai do avo",
      "bisavo materno masculino",
      "bisavo pai avo mat",
      "bisavo pai avo materno",
      "pai do avo materno",
      "great-grandfather maternal grandfather",
    ],
  },
  {
    tag: "Bisavó materna (mãe do avô)",
    keywords: [
      "bisavo materna mae do avo",
      "bisava materna do avo",
      "bisavo mae avo mat",
      "bisavo mae avo materno",
      "mae do avo materno",
      "great-grandmother maternal grandfather",
    ],
  },

  // ── BISAVÔS MATERNOS (avó) ──────────────────────────────────
  {
    tag: "Bisavô materno (pai da avó)",
    keywords: [
      "bisavo materno pai da avo",
      "bisavo materno da avo",
      "pai da avo materna",
      "great-grandfather maternal grandmother",
    ],
  },
  {
    tag: "Bisavó materna (mãe da avó)",
    keywords: [
      "bisavo materna mae da avo",
      "bisava materna da avo",
      "mae da avo materna",
      "great-grandmother maternal grandmother",
    ],
  },

  // ── BISAVÔS (GENÉRICO) ──────────────────────────────────────
  {
    tag: "Bisavô paterno (pai do avô)",
    keywords: ["bisavo", "bisavoh", "bisabobo", "great-grandfather", "great-grandpa"],
  },
  {
    tag: "Bisavó paterna (mãe do avô)",
    keywords: ["bisavoa", "bisaba", "great-grandmother", "great-grandma"],
  },

  // ── IRMÃOS DOS AVÔS (tios-avós) ────────────────────────────
  {
    tag: "Irmã(o) do avô paterno",
    keywords: [
      "irmao do avo paterno",
      "irma da avo paterna",
      "irma do avo paterno",
      "tio avo paterno",
      "grand-uncle paternal",
      "irmao do avo",
    ],
  },
  {
    tag: "Irmã(o) da avó paterna",
    keywords: [
      "irmao da avo paterna",
      "irma da avo paterna",
      "tia avo paterna",
      "grand-aunt paternal",
      "irmao da avo",
    ],
  },
  {
    tag: "Irmã(o) do avô materno",
    keywords: [
      "irmao do avo materno",
      "irma do avo materno",
      "tio avo materno",
      "grand-uncle maternal",
      "irmao do avo matern",
    ],
  },
  {
    tag: "Irmã(o) da avó materna",
    keywords: [
      "irmao da avo materna",
      "irmaos da avo materna",
      "irma da avo materna",
      "irmas da avo materna",
      "tia avo materna",
      "grand-aunt maternal",
      "irmao da avo matern",
    ],
  },

  // ── IRMÃOS DOS BISAVÔS (um tag por bisavô/bisavó real) ──────
  // Espelha exatamente a mesma desambiguação "(pai do avô)"/"(mãe do avô)"/
  // "(pai da avó)"/"(mãe da avó)" já usada nos bisavós, para que o vínculo
  // de cada irmão(ã) fique explícito e não ambíguo entre os 4 bisavós do lado.
  {
    tag: "Irmã(o) do Bisavô paterno (pai do avô)",
    keywords: [
      "irmao do bisavo paterno pai do avo",
      "irma do bisavo paterno pai do avo",
      "irmao do bisavo pai do avo",
      "irma do bisavo pai do avo",
    ],
  },
  {
    tag: "Irmã(o) da Bisavó paterna (mãe do avô)",
    keywords: [
      "irmao da bisavo paterna mae do avo",
      "irma da bisavo paterna mae do avo",
      "irmao da bisavo mae do avo",
      "irma da bisavo mae do avo",
    ],
  },
  {
    tag: "Irmã(o) do Bisavô paterno (pai da avó)",
    keywords: [
      "irmao do bisavo paterno pai da avo",
      "irma do bisavo paterno pai da avo",
      "irmao do bisavo pai da avo",
      "irma do bisavo pai da avo",
    ],
  },
  {
    tag: "Irmã(o) da Bisavó paterna (mãe da avó)",
    keywords: [
      "irmao da bisavo paterna mae da avo",
      "irma da bisavo paterna mae da avo",
      "irmao da bisavo mae da avo",
      "irma da bisavo mae da avo",
    ],
  },
  {
    tag: "Irmã(o) do Bisavô materno (pai do avô)",
    keywords: ["irmao do bisavo materno pai do avo", "irma do bisavo materno pai do avo"],
  },
  {
    tag: "Irmã(o) da Bisavó materna (mãe do avô)",
    keywords: ["irmao da bisavo materna mae do avo", "irma da bisavo materna mae do avo"],
  },
  {
    tag: "Irmã(o) do Bisavô materno (pai da avó)",
    keywords: ["irmao do bisavo materno pai da avo", "irma do bisavo materno pai da avo"],
  },
  {
    tag: "Irmã(o) da Bisavó materna (mãe da avó)",
    keywords: ["irmao da bisavo materna mae da avo", "irma da bisavo materna mae da avo"],
  },

  // ── CÔNJUGE / PARCEIRO(A) ───────────────────────────────────
  {
    tag: "Cônjuge",
    keywords: [
      "conjuge",
      "esposo",
      "esposa",
      "marido",
      "mulher",
      "parceiro",
      "parceira",
      "namorado",
      "namorada",
      "companheiro",
      "companheira",
      "husband",
      "wife",
      "partner",
      "spouse",
    ],
  },

  // ── FILHOS ──────────────────────────────────────────────────
  {
    tag: "Filho(a)",
    keywords: ["filho", "filha", "child", "son", "daughter", "enteado", "enteada"],
  },

  // ── ABORTO ──────────────────────────────────────────────────
  {
    tag: "Aborto",
    keywords: ["aborto", "aborto espontaneo", "aborto provocado", "miscarriage", "abortion"],
  },
];

/**
 * Tenta mapear o texto livre de parentesco para a tag canônica do sistema.
 * Retorna o texto original se não conseguir fazer o match com alta confiança.
 */
export function smartNormalizeRelationship(input: string | null | undefined): string {
  if (!input?.trim()) return input ?? "";

  const normalized = clean(input);

  // Busca primeiro match exato
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized === kw) return rule.tag;
    }
  }

  // Busca por inclusão (o texto normalizado CONTÉM a keyword)
  // Prioriza o keyword mais LONGO para evitar que "irmao" dê match em "irmao da bisavo"
  let bestMatch: TagRule | null = null;
  let bestMatchLen = 0;

  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw) || kw.includes(normalized)) {
        if (kw.length > bestMatchLen) {
          bestMatchLen = kw.length;
          bestMatch = rule;
        }
      }
    }
  }

  if (bestMatch) return bestMatch.tag;

  // Sem match: retorna o original (o sistema vai ignorar na árvore mas preserva o dado)
  return input.trim();
}

/**
 * Prioridade de exibição para ordenação genealógica da planilha.
 * Menor número = mais próximo do consulente = aparece primeiro.
 */
export function genealogicalOrder(tag: string | null | undefined): number {
  // Usa clean() (mesmo normalizador de acentos/marcadores do resto do arquivo)
  // para que a ordenação funcione com qualquer grafia (com ou sem "(o)"/"(a)",
  // com ou sem acento) sem precisar listar cada variante manualmente.
  const t = clean(tag ?? "");
  // Ordem das chaves importa: frases compostas ("irma do pai") precisam ser
  // checadas ANTES das genéricas ("irma", "pai"), senão "Irmã(o) do Pai"
  // cairia junto dos irmãos diretos do consulente.
  const ORDER: [string, number][] = [
    ["consulente", 0],
    ["paciente", 0],
    ["filho", 2],
    ["irma do pai", 20],
    ["irma da mae", 20],
    ["tio", 20],
    ["tia", 20],
    ["irma do avo", 35],
    ["irma da avo", 36],
    ["irma do bisavo", 42],
    ["irma da bisavo", 43],
    ["pai", 10],
    ["mae", 10],
    ["avo paterno", 30],
    ["avo paterna", 31],
    ["avo materno", 32],
    ["avo materna", 33],
    ["bisavo paterno", 40],
    ["bisavo paterna", 40],
    ["bisavo materno", 41],
    ["bisavo materna", 41],
    ["irma", 1],
    ["conjuge", 50],
  ];
  for (const [key, order] of ORDER) {
    if (t.includes(key)) return order;
  }
  return 99;
}

/**
 * Retorna a "Geração" (0, 1, 2, 3) de uma tag canônica para ajudar no layout Dagre.
 * Consulente = 0
 * Pais/Tios = 1
 * Avós/Tios-avós = 2
 * Bisavós/Tios-bisavós = 3
 * Filhos = -1 (não usado na árvore estrutural principal por enquanto, mas possível)
 */
export function getGeneration(tag: string): number {
  if (!tag) return 0;
  const lower = tag.toLowerCase();

  if (lower.includes("bisavô") || lower.includes("bisavo")) return 3;
  if (lower.includes("avô") || lower.includes("avo") || lower.includes("avó")) return 2;
  if (
    lower.includes("pai") ||
    lower.includes("mãe") ||
    lower.includes("mae") ||
    lower.includes("tio") ||
    lower.includes("tia")
  )
    return 1;
  if (lower.includes("filho")) return -1;
  if (lower.includes("aborto")) return 0; // abortos geralmente contam na mesma linha dos filhos ou irmãos, dependendo de quem teve. Como costumam ser da mãe da paciente, ficam na linha da paciente (0)

  return 0; // Consulente, Irmãos, Cônjuge
}
