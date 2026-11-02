/**
 * Importação da planilha do clã: mapeamento de colunas, prévia, erros por
 * linha e duplicidades. Puro (sem rede) — a gravação é feita pela RPC
 * transacional `import_genogram_persons`.
 */
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

export function inferGenderFromRelationship(rel?: string): "male" | "female" | undefined {
  if (!rel) return undefined;
  const r = rel.toLowerCase();
  if (/\b(pai|avô|bisavô|tio\b|irmão)\b/.test(r)) return "male";
  if (/\b(mãe|avó|bisavó|tia\b|irmã)\b/.test(r)) return "female";
  return undefined;
}

export function parseDateString(d?: string): string | null {
  if (!d) return null;
  const val = String(d).trim();
  if (!val) return null;

  // ISO YYYY-MM-DD (já normalizado)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return isValidYMD(val) ? val : null;
  }

  // Aceita separadores /, -, ., ou \ com espaços opcionais
  const parts = val
    .split(/[/\\\-. \t]/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 3) {
    if (!parts.every((p) => /^\d+$/.test(p))) return null;
    const nums = parts.map(Number);

    let dd: string, mm: string, yy: string;

    // Detecta o formato pelo tamanho e range dos valores
    // Se o primeiro número > 31, provavelmente é o ano (YYYY/MM/DD)
    if (nums[0] > 31) {
      [yy, mm, dd] = parts;
    }
    // Se o terceiro número > 31 ou tem 4 dígitos, é DD/MM/YYYY ou MM/DD/YYYY
    else if (nums[2] > 31 || parts[2].length === 4) {
      // Distingue DD/MM/YYYY de MM/DD/YYYY:
      // Se o primeiro número > 12, é dia (não pode ser mês)
      if (nums[0] > 12) {
        [dd, mm, yy] = parts; // DD/MM/YYYY (brasileiro)
      } else if (nums[1] > 12) {
        [mm, dd, yy] = parts; // MM/DD/YYYY (americano)
      } else {
        // Ambíguo: assume brasileiro (DD/MM/YYYY) por ser o padrão local
        [dd, mm, yy] = parts;
      }
    } else {
      // Fallback: assume DD/MM/YY
      [dd, mm, yy] = parts;
    }

    // Ano com 2 dígitos: 00-30 → 2000-2030, 31-99 → 1931-1999
    if (yy.length === 2) {
      const n = parseInt(yy, 10);
      yy = String(n <= 30 ? 2000 + n : 1900 + n);
    }
    if (yy.length !== 4) return null;

    const iso = `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return isValidYMD(iso) ? iso : null;
  }

  // Apenas dia e mês (ex.: "01/03" ou "14\08") → assume o ano 2000 temporariamente para não perder o dado
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    const [p1, p2] = parts;
    let dd = p1,
      mm = p2;
    if (Number(p1) > 12) {
      // P1 não pode ser mês, então é DD/MM
      dd = p1;
      mm = p2;
    } else if (Number(p2) > 12) {
      // P2 não pode ser mês, então é MM/DD
      mm = p1;
      dd = p2;
    }
    const iso = `2000-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    return isValidYMD(iso) ? iso : null;
  }

  // Apenas ano (ex.: "1985") → assume 01/01 para não perder o dado
  if (/^\d{4}$/.test(val)) return `${val}-01-01`;

  return null;
}

export function isValidYMD(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}


export const IMPORT_FIELDS = [
  { key: "full_name", label: "Nome", aliases: ["nome", "nome completo", "name"] },
  { key: "relationship", label: "Parentesco", aliases: ["parentesco", "vinculo", "vínculo", "relação", "relacao"] },
  { key: "birth", label: "Nascimento", aliases: ["nascimento", "data de nascimento", "nasc", "nasceu"] },
  { key: "gestation", label: "Gestação", aliases: ["gestação", "gestacao", "semanas"] },
  { key: "death", label: "Falecimento", aliases: ["morte", "falecimento", "óbito", "obito"] },
  { key: "illnesses", label: "Enfermidades", aliases: ["enfermidades", "doenças", "doencas", "saúde"] },
  { key: "occupation", label: "Profissão", aliases: ["profissão", "profissao", "ocupação", "ocupacao"] },
  { key: "vices", label: "Vícios", aliases: ["vícios", "vicios"] },
  { key: "temperament", label: "Temperamento", aliases: ["temperamento"] },
  { key: "order", label: "Ordem", aliases: ["ordem", "ordem de nascimento"] },
  { key: "notes", label: "Observações", aliases: ["obs", "observações", "observacoes", "notas"] },
] as const;
export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>; // field -> índice da coluna

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/** Mapeia por nome de cabeçalho; sem cabeçalho reconhecido usa a ordem oficial de 11 colunas. */
export function autoMap(header: string[]): Mapping {
  const m: Mapping = {};
  header.forEach((h, i) => {
    const n = norm(h || "");
    const f = IMPORT_FIELDS.find((x) => x.aliases.some((a) => norm(a) === n));
    if (f && m[f.key] === undefined) m[f.key] = i;
  });
  if (Object.keys(m).length < 2) IMPORT_FIELDS.forEach((f, i) => (m[f.key] = i));
  return m;
}

export interface ImportRowResult {
  line: number; // linha no arquivo (1 = cabeçalho)
  status: "ok" | "error" | "duplicate" | "skip";
  messages: string[];
  record: ImportRecord | null;
}
export interface ImportRecord {
  full_name: string;
  relationship_to_proband: string | null;
  gender: string;
  birth_date: string | null;
  gestational_weeks: string | null;
  death_date: string | null;
  is_deceased: boolean;
  health_conditions: string[];
  occupation: string | null;
  vices: string | null;
  temperament: string | null;
  birth_order: number | null;
  notes: string | null;
}

const isApproximate = (raw: string) => {
  const v = raw.trim();
  return /^\d{4}$/.test(v) || /^\d{1,2}[/\\\-. ]\d{1,2}$/.test(v);
};

export function analyzeImport(
  rows: string[][],
  mapping: Mapping,
  existing: { full_name: string; birth_date: string | null }[] = [],
): ImportRowResult[] {
  const get = (r: string[], k: FieldKey) => {
    const i = mapping[k];
    return i === undefined ? "" : String(r[i] ?? "").trim();
  };
  const key = (name: string, birth: string | null) => `${norm(name)}|${birth ?? ""}`;
  const seen = new Set(existing.map((e) => key(e.full_name, e.birth_date)));
  let context = "Consulente";

  return rows.map((r, idx) => {
    const line = idx + 2;
    const messages: string[] = [];
    if (r.every((c) => !String(c ?? "").trim())) return { line, status: "skip", messages: ["Linha vazia"], record: null };

    let rel = get(r, "relationship");
    const lower = rel.toLowerCase();
    if (rel && !lower.includes("irmã") && !lower.includes("irmão")) context = rel;
    else if (["irmãos", "irmãs", "irmão", "irmã", "irmao", "irma", "irmaos"].includes(lower)) {
      if (context !== "Consulente" && context !== "Paciente") {
        const prep = /mãe|avó|bisavó/i.test(context) ? "da" : "do";
        rel = `Irmã(o) ${prep} ${context}`;
      }
    }
    if (/^(consulente|paciente)$/i.test(rel))
      return { line, status: "skip", messages: ["Cliente vem do cadastro — linha ignorada"], record: null };

    const name = get(r, "full_name");
    if (!name) messages.push("Nome obrigatório");

    const birthRaw = get(r, "birth");
    const deathRaw = get(r, "death");
    const birth = parseDateString(birthRaw);
    const death = parseDateString(deathRaw);
    if (birthRaw && !birth) messages.push(`Nascimento inválido: "${birthRaw}"`);
    if (deathRaw && !death && !/^(sim|x|falecid[oa])$/i.test(deathRaw)) messages.push(`Falecimento inválido: "${deathRaw}"`);
    if (birth && death && birth > death) messages.push("Falecimento anterior ao nascimento");
    const orderRaw = get(r, "order");
    if (orderRaw && isNaN(parseInt(orderRaw))) messages.push(`Ordem não numérica: "${orderRaw}"`);

    const warnings: string[] = [];
    if (birthRaw && birth && isApproximate(birthRaw)) warnings.push("Nascimento incompleto: será gravado com dia/mês/ano aproximado");
    if (deathRaw && death && isApproximate(deathRaw)) warnings.push("Falecimento incompleto: será gravado com data aproximada");

    if (messages.length) return { line, status: "error", messages, record: null };

    const k = key(name, birth);
    const dup = seen.has(k);
    seen.add(k);
    const relCanonical = rel ? smartNormalizeRelationship(rel) : null;
    const record: ImportRecord = {
      full_name: name,
      relationship_to_proband: rel || null,
      gender: inferGenderFromRelationship(relCanonical ?? "") || "unknown",
      birth_date: birth,
      gestational_weeks: get(r, "gestation") || null,
      death_date: death,
      is_deceased: !!deathRaw,
      health_conditions: get(r, "illnesses").split(",").map((x) => x.trim()).filter(Boolean),
      occupation: get(r, "occupation") || null,
      vices: get(r, "vices") || null,
      temperament: get(r, "temperament") || null,
      birth_order: orderRaw ? parseInt(orderRaw) : null,
      notes: get(r, "notes") || null,
    };
    if (dup) return { line, status: "duplicate", messages: ["Possível duplicidade (mesmo nome e nascimento)", ...warnings], record };
    return { line, status: "ok", messages: warnings, record };
  });
}
