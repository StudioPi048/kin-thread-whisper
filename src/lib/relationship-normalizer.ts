/**
 * Normalizador inteligente de parentesco.
 * Reconhece qualquer texto escrito em português (formal, informal, abreviado)
 * e mapeia para a tag canônica do sistema.
 */

/** Remove acentos e normaliza para lowercase */
function clean(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\([oa]\)/g, "") // remove marcadores de gênero de tags: Tio(a), Irmã(o)
      .replace(/[()]/g, " ") // mantém o contexto escrito entre parênteses
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      // Remove plural 's' PALAVRA POR PALAVRA (irmãos do avô -> irmao do avo), não só
      // no fim da frase inteira — "irmãos" quase sempre é a PRIMEIRA palavra da frase.
      .map((w) => w.replace(/oes$/, "ao").replace(/s$/, ""))
      .join(" ")
  );
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
  // "...avo mat" abreviado (sem "materno"/"materna" por extenso) foi removido
  // daqui: "avô" e "avó" colapsam pro mesmo "avo" depois de tirar acento, e
  // sem a terminação completa "materno"/"materna" pra desambiguar por
  // concordância de gênero, esse atalho colidia bisavô com bisavó distintos
  // (dois cadastros reais bateram na mesma pessoa por causa disso).
  {
    tag: "Bisavô materno (pai do avô)",
    keywords: [
      "bisavo materno pai do avo",
      "bisavo materno masculino",
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
  // Frases como "irmão do avô paterno" / "irmã da bisavó materna (pai da
  // avó)" são resolvidas dinamicamente por resolveSiblingOfAncestor (abaixo),
  // reaproveitando as tags de ancestral — sem duplicar cada combinação aqui.
  // Só o idioma "tio-avô/tia-avó" fica explícito, porque o resolvedor só
  // reconhece o prefixo "irmã(o)", não "tio".
  { tag: "Irmã(o) do avô paterno", keywords: ["tio avo paterno", "grand-uncle paternal"] },
  { tag: "Irmã(o) da avó paterna", keywords: ["tia avo paterna", "grand-aunt paternal"] },
  { tag: "Irmã(o) do avô materno", keywords: ["tio avo materno", "grand-uncle maternal"] },
  { tag: "Irmã(o) da avó materna", keywords: ["tia avo materna", "grand-aunt maternal"] },

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

// ── Composição "irmã(o) do/da <ancestral>" ──────────────────────
// Em vez de duplicar manualmente cada combinação (irmão do avô paterno,
// irmã da bisavó materna, irmãos do avô paterno...) — o que se mostrou
// frágil contra plural, preposição omitida ou texto truncado — reconhece
// o prefixo colateral (irmã/irmão, já sem plural depois do clean()) e
// resolve o RESTO do texto contra as tags de ancestral diretas, que já
// tratam sinônimo/abreviação/plural. Cobre qualquer geração sem precisar
// listar cada variante à mão.
const ANCESTOR_TAGS = new Set([
  "Pai",
  "Mãe",
  "Avô paterno",
  "Avó paterna",
  "Avô materno",
  "Avó materna",
  "Bisavô paterno (pai do avô)",
  "Bisavó paterna (mãe do avô)",
  "Bisavô paterno (pai da avó)",
  "Bisavó paterna (mãe da avó)",
  "Bisavô materno (pai do avô)",
  "Bisavó materna (mãe do avô)",
  "Bisavô materno (pai da avó)",
  "Bisavó materna (mãe da avó)",
]);

const SIBLING_TAG_OF: Record<string, string> = {
  Pai: "Irmã(o) do Pai",
  Mãe: "Irmã(o) da Mãe",
  "Avô paterno": "Irmã(o) do avô paterno",
  "Avó paterna": "Irmã(o) da avó paterna",
  "Avô materno": "Irmã(o) do avô materno",
  "Avó materna": "Irmã(o) da avó materna",
  "Bisavô paterno (pai do avô)": "Irmã(o) do Bisavô paterno (pai do avô)",
  "Bisavó paterna (mãe do avô)": "Irmã(o) da Bisavó paterna (mãe do avô)",
  "Bisavô paterno (pai da avó)": "Irmã(o) do Bisavô paterno (pai da avó)",
  "Bisavó paterna (mãe da avó)": "Irmã(o) da Bisavó paterna (mãe da avó)",
  "Bisavô materno (pai do avô)": "Irmã(o) do Bisavô materno (pai do avô)",
  "Bisavó materna (mãe do avô)": "Irmã(o) da Bisavó materna (mãe do avô)",
  "Bisavô materno (pai da avó)": "Irmã(o) do Bisavô materno (pai da avó)",
  "Bisavó materna (mãe da avó)": "Irmã(o) da Bisavó materna (mãe da avó)",
};

/**
 * "avó"/"bisavó" e "avô"/"bisavô" colapsam no mesmo texto depois do clean()
 * (o acento que distingue ô de ó é removido). Sem outro qualificador
 * ("paterno"/"materna" já resolvem por si, sem precisar disto), a ÚNICA forma
 * de saber se o texto queria dizer avô ou avó é olhar o acento no ORIGINAL,
 * antes do clean() apagar — usado só como desempate dos fallbacks genéricos.
 */
function detectAncestorGender(raw: string): "m" | "f" | null {
  const low = raw.toLowerCase();
  if (low.includes("avó") || low.includes("vovó")) return "f";
  if (low.includes("avô") || low.includes("vovô")) return "m";
  return null;
}

function matchByInclusion(normalized: string, rules: TagRule[]): TagRule | null {
  let best: TagRule | null = null;
  let bestLen = 0;
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      // normalized mais curto que kw = texto truncado (corta no FIM, nunca no
      // meio) — por isso startsWith aqui, não includes: senão um pedaço curto
      // como "avo pa" bate no meio de uma keyword bem mais longa e diferente
      // (ex.: "...avo paterno" dentro de uma keyword de bisavô).
      if (normalized.includes(kw) || kw.startsWith(normalized)) {
        if (kw.length > bestLen) {
          bestLen = kw.length;
          best = rule;
        }
      }
    }
  }
  return best;
}

/** "irmao do avo materno" / "irmao avo materno" (sem preposição) / "irmao bisavo" -> tag do irmão certo. */
function resolveSiblingOfAncestor(normalized: string, rawInput: string): string | null {
  const m = normalized.match(/^irmao?\s*(?:do|da|de)?\s*(.+)$/);
  if (!m) return null;
  const remainder = m[1].trim();
  if (!remainder) return null; // só "irmão" sozinho — não é caso deste resolvedor

  // "irmão do avô"/"irmã da avó" (bare, sem lado): "avo"/"bisavo" sozinho é
  // ambíguo pós-clean(), mas o acento original ainda diz o gênero certo.
  if (remainder === "avo" || remainder === "bisavo") {
    const gender = detectAncestorGender(rawInput);
    if (remainder === "avo") {
      return SIBLING_TAG_OF[gender === "f" ? "Avó paterna" : "Avô paterno"];
    }
    return SIBLING_TAG_OF[
      gender === "f" ? "Bisavó paterna (mãe do avô)" : "Bisavô paterno (pai do avô)"
    ];
  }

  const ancestorRules = RULES.filter((r) => ANCESTOR_TAGS.has(r.tag));
  for (const rule of ancestorRules) {
    if (rule.keywords.some((kw) => remainder === kw)) return SIBLING_TAG_OF[rule.tag];
  }
  const best = matchByInclusion(remainder, ancestorRules);
  return best ? SIBLING_TAG_OF[best.tag] : null;
}

/**
 * Tenta mapear o texto livre de parentesco para a tag canônica do sistema.
 * Retorna o texto original se não conseguir fazer o match com alta confiança.
 */
export function smartNormalizeRelationship(input: string | null | undefined): string {
  if (!input?.trim()) return input ?? "";

  const normalized = clean(input);

  // "avô"/"avó" e "bisavô"/"bisavó" (bare, sem "paterno/materna" etc.) viram
  // o mesmo texto pós-clean() — sem isto, cairia sempre no masculino por
  // acaso da ordem das regras, mesmo quando o original dizia claramente "avó".
  if (normalized === "avo" || normalized === "bisavo") {
    const gender = detectAncestorGender(input);
    if (normalized === "avo") return gender === "f" ? "Avó paterna" : "Avô paterno";
    return gender === "f" ? "Bisavó paterna (mãe do avô)" : "Bisavô paterno (pai do avô)";
  }

  // Busca primeiro match exato
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized === kw) return rule.tag;
    }
  }

  // "irmã(o) [do/da] <ancestral>" — antes da busca genérica por inclusão,
  // senão um "bisavo" (6 letras) bate antes de qualquer coisa mais específica.
  const siblingTag = resolveSiblingOfAncestor(normalized, input);
  if (siblingTag) return siblingTag;

  // Busca por inclusão (o texto normalizado CONTÉM a keyword)
  // Prioriza o keyword mais LONGO para evitar que "irmao" dê match em "irmao da bisavo"
  const bestMatch = matchByInclusion(normalized, RULES);
  if (bestMatch) return bestMatch.tag;

  // Sem match: retorna o original (o sistema vai ignorar na árvore mas preserva o dado)
  return input.trim();
}

/**
 * Lista completa das tags reconhecidas pelo sistema, agrupada por ramo/geração,
 * pra alimentar um seletor de busca na planilha (em vez de o clínico ter que
 * acertar a grafia exata de texto livre). Espelha RULES/SIBLING_TAG_OF acima —
 * única fonte de verdade, sem duplicar a lista manualmente noutro arquivo.
 */
export const RELATIONSHIP_GROUPS: { label: string; options: string[] }[] = [
  { label: "Consulente", options: ["Consulente", "Irmã(o)", "Cônjuge", "Filho(a)", "Aborto"] },
  { label: "Pais", options: ["Pai", "Mãe"] },
  { label: "Tios (irmãos dos pais)", options: ["Irmã(o) do Pai", "Irmã(o) da Mãe"] },
  {
    label: "Avós paternos",
    options: ["Avô paterno", "Avó paterna", "Irmã(o) do avô paterno", "Irmã(o) da avó paterna"],
  },
  {
    label: "Avós maternos",
    options: ["Avô materno", "Avó materna", "Irmã(o) do avô materno", "Irmã(o) da avó materna"],
  },
  {
    label: "Bisavós paternos (lado do avô)",
    options: [
      "Bisavô paterno (pai do avô)",
      "Bisavó paterna (mãe do avô)",
      "Irmã(o) do Bisavô paterno (pai do avô)",
      "Irmã(o) da Bisavó paterna (mãe do avô)",
    ],
  },
  {
    label: "Bisavós paternos (lado da avó)",
    options: [
      "Bisavô paterno (pai da avó)",
      "Bisavó paterna (mãe da avó)",
      "Irmã(o) do Bisavô paterno (pai da avó)",
      "Irmã(o) da Bisavó paterna (mãe da avó)",
    ],
  },
  {
    label: "Bisavós maternos (lado do avô)",
    options: [
      "Bisavô materno (pai do avô)",
      "Bisavó materna (mãe do avô)",
      "Irmã(o) do Bisavô materno (pai do avô)",
      "Irmã(o) da Bisavó materna (mãe do avô)",
    ],
  },
  {
    label: "Bisavós maternos (lado da avó)",
    options: [
      "Bisavô materno (pai da avó)",
      "Bisavó materna (mãe da avó)",
      "Irmã(o) do Bisavô materno (pai da avó)",
      "Irmã(o) da Bisavó materna (mãe da avó)",
    ],
  },
];

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
