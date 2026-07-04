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
    .replace(/\([^)]*\)/g, "") // remove conteúdo entre parênteses
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
  { tag: "Irmã(o)", keywords: ["irmao", "irma", "irmao mais velho", "irmao mais novo", "irmao biologico", "irma biologica", "sibling", "brother", "sister", "half-brother", "half-sister", "meio irmao", "meio irma"] },

  // ── PAI / MÃE ───────────────────────────────────────────────
  { tag: "Pai", keywords: ["pai", "papa", "papai", "padrasto", "pai biologico", "pai adotivo", "pai de criacao", "genitor", "father", "dad", "stepfather", "stepdad"] },
  { tag: "Mãe", keywords: ["mae", "mama", "mamai", "madrasta", "mae biologica", "mae adotiva", "mae de criacao", "genitora", "mother", "mom", "stepmother", "stepmom"] },

  // ── TIOS PATERNOS ───────────────────────────────────────────
  { tag: "Tio(a) paterno(a)", keywords: ["tio paterno", "tia paterna", "tio do pai", "tia do pai", "uncle father", "paternal uncle", "paternal aunt"] },

  // ── TIOS MATERNOS ───────────────────────────────────────────
  { tag: "Tio(a) materno(a)", keywords: ["tio materno", "tia materna", "tio da mae", "tia da mae", "uncle mother", "maternal uncle", "maternal aunt"] },

  // ── TIOS (GENÉRICO sem lado) ────────────────────────────────
  { tag: "Tio(a) paterno(a)", keywords: ["tio", "tia", "uncle", "aunt"] }, // fallback → paterno

  // ── AVÔS PATERNOS ───────────────────────────────────────────
  { tag: "Avô paterno", keywords: ["avo paterno", "avoh paterno", "avo do pai", "grandfather father", "paternal grandfather", "vovo paterno"] },
  { tag: "Avó paterna", keywords: ["avo paterna", "avoa paterna", "avo do pai feminina", "grandmother father", "paternal grandmother", "vovo paterna", "vovo do pai"] },

  // ── AVÔS MATERNOS ───────────────────────────────────────────
  { tag: "Avô materno", keywords: ["avo materno", "avoh materno", "avo da mae", "grandfather mother", "maternal grandfather", "vovo materno"] },
  { tag: "Avó materna", keywords: ["avo materna", "avoa materna", "avo da mae feminina", "grandmother mother", "maternal grandmother", "vovo materna", "vovo da mae"] },

  // ── AVÔS (GENÉRICO) ─────────────────────────────────────────
  { tag: "Avô paterno", keywords: ["avoh", "avo", "grandfather", "grandpa", "vovoh", "vovo"] },  // fallback masculino
  { tag: "Avó paterna", keywords: ["avoa", "grandmother", "grandma", "vovoa"] }, // fallback feminino

  // ── BISAVÔS PATERNOS (avô) ──────────────────────────────────
  { tag: "Bisavô paterno (pai do avô)", keywords: ["bisavo paterno pai do avo", "bisavo paterno masculino", "bisavo do pai avo", "great-grandfather paternal grandfather"] },
  { tag: "Bisavó paterna (mãe do avô)", keywords: ["bisavo paterna mae do avo", "bisavo paterna feminina", "bisava do pai avo", "great-grandmother paternal grandfather"] },

  // ── BISAVÔS PATERNOS (avó) ──────────────────────────────────
  { tag: "Bisavô paterno (pai da avó)", keywords: ["bisavo paterno pai da avo", "bisavo paterno da avo", "great-grandfather paternal grandmother"] },
  { tag: "Bisavó paterna (mãe da avó)", keywords: ["bisavo paterna mae da avo", "bisava paterna da avo", "great-grandmother paternal grandmother"] },

  // ── BISAVÔS MATERNOS (avô) ──────────────────────────────────
  { tag: "Bisavô materno (pai do avô)", keywords: ["bisavo materno pai do avo", "bisavo materno masculino", "great-grandfather maternal grandfather"] },
  { tag: "Bisavó materna (mãe do avô)", keywords: ["bisavo materna mae do avo", "bisava materna do avo", "great-grandmother maternal grandfather"] },

  // ── BISAVÔS MATERNOS (avó) ──────────────────────────────────
  { tag: "Bisavô materno (pai da avó)", keywords: ["bisavo materno pai da avo", "bisavo materno da avo", "great-grandfather maternal grandmother"] },
  { tag: "Bisavó materna (mãe da avó)", keywords: ["bisavo materna mae da avo", "bisava materna da avo", "great-grandmother maternal grandmother"] },

  // ── BISAVÔS (GENÉRICO) ──────────────────────────────────────
  { tag: "Bisavô paterno (pai do avô)", keywords: ["bisavo", "bisavoh", "bisabobo", "great-grandfather", "great-grandpa"] },
  { tag: "Bisavó paterna (mãe do avô)", keywords: ["bisavoa", "bisaba", "great-grandmother", "great-grandma"] },

  // ── IRMÃOS DOS AVÔS (tios-avós) ────────────────────────────
  { tag: "Irmã(o) do avô paterno", keywords: ["irmao do avo paterno", "irma do avo paterno", "tio avo paterno", "grand-uncle paternal"] },
  { tag: "Irmã(o) da avó paterna", keywords: ["irmao da avo paterna", "irma da avo paterna", "tia avo paterna", "grand-aunt paternal"] },
  { tag: "Irmã(o) do avô materno", keywords: ["irmao do avo materno", "irma do avo materno", "tio avo materno", "grand-uncle maternal"] },
  { tag: "Irmã(o) da avó materna", keywords: ["irmao da avo materna", "irma da avo materna", "tia avo materna", "grand-aunt maternal"] },

  // ── CÔNJUGE / PARCEIRO(A) ───────────────────────────────────
  { tag: "Cônjuge", keywords: ["conjuge", "esposo", "esposa", "marido", "mulher", "parceiro", "parceira", "namorado", "namorada", "companheiro", "companheira", "husband", "wife", "partner", "spouse"] },

  // ── FILHOS ──────────────────────────────────────────────────
  { tag: "Filho(a)", keywords: ["filho", "filha", "child", "son", "daughter", "enteado", "enteada"] },
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
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw) || kw.includes(normalized)) {
        return rule.tag;
      }
    }
  }

  // Sem match: retorna o original (o sistema vai ignorar na árvore mas preserva o dado)
  return input.trim();
}

/**
 * Prioridade de exibição para ordenação genealógica da planilha.
 * Menor número = mais próximo do consulente = aparece primeiro.
 */
export function genealogicalOrder(tag: string | null | undefined): number {
  const t = (tag ?? "").toLowerCase();
  const ORDER: [string, number][] = [
    ["consulente", 0],
    ["paciente", 0],
    ["irmã", 1],
    ["irmao", 1],
    ["filho", 2],
    ["pai", 10],
    ["mãe", 10],
    ["mae", 10],
    ["tio", 20],
    ["tia", 20],
    ["avô paterno", 30],
    ["avó paterna", 31],
    ["avô materno", 32],
    ["avó materna", 33],
    ["irmão do avô", 35],
    ["irmã do avô", 35],
    ["irmão da avó", 36],
    ["irmã da avó", 36],
    ["bisavô", 40],
    ["bisavó", 41],
    ["cônjuge", 50],
  ];
  for (const [key, order] of ORDER) {
    if (t.includes(key)) return order;
  }
  return 99;
}
