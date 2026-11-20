/**
 * Normalizador inteligente de parentesco.
 * Reconhece rótulos canônicos e sinônimos inequívocos. Preserva textos que
 * não identificam com segurança o ramo, a geração ou o tipo do vínculo.
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

// Sinônimos que identificam precisamente os mesmos rótulos do seletor.
const RULES: TagRule[] = [
  // ── CONSULENTE ──────────────────────────────────────────────
  { tag: "Consulente", keywords: ["consulente", "paciente", "proband", "cliente", "eu", "self"] },

  // ── IRMÃOS ──────────────────────────────────────────────────
  {
    tag: "Irmã(o)",
    keywords: [
      "irma do consulente",
      "irmao do consulente",
      "irma do paciente",
      "irmao do paciente",
    ],
  },

  // ── PAI / MÃE ───────────────────────────────────────────────
  {
    tag: "Pai",
    keywords: ["pai", "papa", "papai", "pai biologico", "genitor", "father", "dad"],
  },
  {
    tag: "Mãe",
    keywords: ["mae", "mama", "mamai", "mae biologica", "genitora", "mother", "mom"],
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

  // ── AVÔS PATERNOS ───────────────────────────────────────────
  {
    tag: "Avô paterno",
    keywords: [
      "avo paterno",
      "avoh paterno",
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
    ],
  },

  // ── AVÔS MATERNOS ───────────────────────────────────────────
  {
    tag: "Avô materno",
    keywords: [
      "avo materno",
      "avoh materno",
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
    ],
  },

  // ── BISAVÔS PATERNOS (avô) ──────────────────────────────────
  {
    tag: "Bisavô paterno (pai do avô)",
    keywords: [
      "bisavo paterno pai do avo",
      "bisavo do pai avo",
      "pai do avo paterno",
      "great-grandfather paternal grandfather",
    ],
  },
  {
    tag: "Bisavó paterna (mãe do avô)",
    keywords: [
      "bisavo paterna mae do avo",
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

// Aceita também a ordem "bisavô, pai do avô materno". O texto
// precisa fornecer a geração, o membro da dupla e o ramo.
function resolveGreatGrandparentPhrase(raw: string): string | null {
  const match = raw
    .toLowerCase()
    .match(
      /^bisav([oôó])(?:\s+(pat(?:erno|erna)?|mat(?:erno|erna)?))?[ ,]+\(?\s*(pai|m[aã]e)\s+d([oa])\s+(?:av|vov)([oôó])(?:\s+(pat(?:erno|erna)?|mat(?:erno|erna)?))?\s*\)?$/,
    );
  if (!match) return null;
  const [, self, firstSide, parentRole, article, grandparent, secondSide] = match;
  const side = (firstSide ?? secondSide)?.slice(0, 3);
  if (!side || (firstSide && secondSide && firstSide.slice(0, 3) !== secondSide.slice(0, 3))) {
    return null;
  }
  const father = parentRole === "pai";
  if ((self === "ô" && !father) || (self === "ó" && father)) return null;
  if ((grandparent === "ô" && article === "a") || (grandparent === "ó" && article === "o")) {
    return null;
  }
  const branch = side === "pat" ? "patern" : "matern";
  return `Bisav${father ? "ô" : "ó"} ${branch}${father ? "o" : "a"} (${father ? "pai" : "mãe"} ${article === "o" ? "do avô" : "da avó"})`;
}

const TAGS = new Map(
  RULES.flatMap(
    ({ tag, keywords }) =>
      [[clean(tag), tag], ...keywords.map((keyword) => [keyword, tag])] as [string, string][],
  ),
);

function exactAncestor(raw: string): string | undefined {
  const tag = TAGS.get(clean(raw)) ?? resolveGreatGrandparentPhrase(raw);
  if (tag && ANCESTOR_TAGS.has(tag)) return tag;

  // Sem acento no nome do avô/avó e sem indicador de gênero, o ramo
  // inteiro pode apontar para duas pessoas. A preposição identifica o lado.
  const grandparent = raw
    .trim()
    .toLowerCase()
    .match(/^(av[ôó]|vov[ôó]) d[oa] (pai|m[aã]e)$/);
  if (!grandparent) return undefined;
  const female = grandparent[1].endsWith("ó");
  if (grandparent[2] === "pai") return female ? "Avó paterna" : "Avô paterno";
  return female ? "Avó materna" : "Avô materno";
}

/**
 * Retorna a tag canônica para descrições que identificam o vínculo.
 * Rótulos que omitem referência (por exemplo "irmão do bisavô") ou que
 * qualificam o vínculo (por exemplo "meio-irmão") permanecem registrados.
 */
export function smartNormalizeRelationship(input: string | null | undefined): string {
  const raw = input?.trim();
  if (!raw) return "";

  const key = clean(raw);
  if (key === "irma" && !/\(o\)/i.test(raw)) return raw;
  const exact = TAGS.get(key);
  if (exact) return exact;

  const ancestor = exactAncestor(raw);
  if (ancestor) return ancestor;

  const sibling = raw.match(/^irm[ãa](?:o|\(o\))?s?\s+(?:d[oaes]\s+)?(.+)$/i);
  if (!sibling) return raw;
  const anchor = exactAncestor(sibling[1]);
  return anchor ? SIBLING_TAG_OF[anchor] : raw;
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
