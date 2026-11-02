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

export const MIN_YEAR = 1700;
export const maxYear = () => new Date().getFullYear() + 1;

export type ParsedDate =
  | { kind: "empty" }
  | { kind: "exact"; iso: string }
  /** Data incompleta (só ano, DD/MM, MM/AAAA): NUNCA vira data exata. */
  | { kind: "partial"; raw: string; label: string }
  | { kind: "invalid"; raw: string; reason: string };

const yearOk = (y: number) => Number.isInteger(y) && y >= MIN_YEAR && y <= maxYear();

export function parseDateField(d?: string): ParsedDate {
  const val = String(d ?? "").trim();
  if (!val) return { kind: "empty" };
  const bad = (reason: string): ParsedDate => ({ kind: "invalid", raw: val, reason });

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    if (!yearOk(Number(val.slice(0, 4)))) return bad(`ano fora de ${MIN_YEAR}–${maxYear()}`);
    return isValidYMD(val) ? { kind: "exact", iso: val } : bad("dia ou mês inexistente");
  }
  if (/^\d{4}$/.test(val)) {
    return yearOk(Number(val))
      ? { kind: "partial", raw: val, label: "só o ano" }
      : bad(`ano fora de ${MIN_YEAR}–${maxYear()}`);
  }
  const parts = val
    .split(/[/\\\-. \t]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length || !parts.every((p) => /^\d+$/.test(p))) return bad("formato não reconhecido");

  if (parts.length === 2) {
    const [p1, p2] = parts;
    if (p2.length === 4) {
      const m = Number(p1);
      if (m < 1 || m > 12) return bad("mês inexistente");
      return yearOk(Number(p2))
        ? { kind: "partial", raw: val, label: "mês e ano, sem dia" }
        : bad(`ano fora de ${MIN_YEAR}–${maxYear()}`);
    }
    const [dd, mm] = Number(p1) > 12 ? [p1, p2] : Number(p2) > 12 ? [p2, p1] : [p1, p2];
    // Valida dia/mês num ano bissexto qualquer só para checar existência; o ano NÃO é gravado.
    return isValidYMD(`2024-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`)
      ? { kind: "partial", raw: val, label: "dia e mês, sem ano" }
      : bad("dia ou mês inexistente");
  }
  if (parts.length !== 3) return bad("formato não reconhecido");

  let dd: string, mm: string, yy: string;
  const nums = parts.map(Number);
  if (parts[0].length === 4) [yy, mm, dd] = parts;
  else if (nums[0] > 12) [dd, mm, yy] = parts;
  else if (nums[1] > 12) [mm, dd, yy] = parts;
  else [dd, mm, yy] = parts; // ambíguo: padrão brasileiro DD/MM
  if (yy.length !== 4) return bad("ano precisa ter 4 dígitos");
  if (!yearOk(Number(yy))) return bad(`ano fora de ${MIN_YEAR}–${maxYear()}`);
  const iso = `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return isValidYMD(iso) ? { kind: "exact", iso } : bad("dia ou mês inexistente");
}

/** Só datas completas e válidas; datas parciais retornam null (nunca inventa dia/mês/ano). */
export function parseDateString(d?: string): string | null {
  const r = parseDateField(d);
  return r.kind === "exact" ? r.iso : null;
}

export function isValidYMD(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const IMPORT_FIELDS = [
  { key: "full_name", label: "Nome", aliases: ["nome", "nome completo", "name"] },
  {
    key: "relationship",
    label: "Parentesco",
    aliases: ["parentesco", "vinculo", "vínculo", "relação", "relacao"],
  },
  {
    key: "birth",
    label: "Nascimento",
    aliases: ["nascimento", "data de nascimento", "nasc", "nasceu"],
  },
  { key: "gestation", label: "Gestação", aliases: ["gestação", "gestacao", "semanas"] },
  { key: "death", label: "Falecimento", aliases: ["morte", "falecimento", "óbito", "obito"] },
  {
    key: "illnesses",
    label: "Enfermidades",
    aliases: ["enfermidades", "doenças", "doencas", "saúde"],
  },
  {
    key: "occupation",
    label: "Profissão",
    aliases: ["profissão", "profissao", "ocupação", "ocupacao"],
  },
  { key: "vices", label: "Vícios", aliases: ["vícios", "vicios"] },
  { key: "temperament", label: "Temperamento", aliases: ["temperamento"] },
  { key: "order", label: "Ordem", aliases: ["ordem", "ordem de nascimento"] },
  { key: "notes", label: "Observações", aliases: ["obs", "observações", "observacoes", "notas"] },
] as const;
export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>; // field -> índice da coluna

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
    if (r.every((c) => !String(c ?? "").trim()))
      return { line, status: "skip", messages: ["Linha vazia"], record: null };

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
      return {
        line,
        status: "skip",
        messages: ["Cliente vem do cadastro — linha ignorada"],
        record: null,
      };

    const name = get(r, "full_name");
    if (!name) messages.push("Nome obrigatório");

    const birthRaw = get(r, "birth");
    const deathRaw = get(r, "death");
    const deathFlag = /^(sim|x|falecid[oa])$/i.test(deathRaw);
    const birthP = parseDateField(birthRaw);
    const deathP = deathFlag ? ({ kind: "empty" } as ParsedDate) : parseDateField(deathRaw);
    if (birthP.kind === "invalid")
      messages.push(`Nascimento inválido: "${birthRaw}" (${birthP.reason})`);
    if (deathP.kind === "invalid")
      messages.push(`Falecimento inválido: "${deathRaw}" (${deathP.reason})`);
    const birth = birthP.kind === "exact" ? birthP.iso : null;
    const death = deathP.kind === "exact" ? deathP.iso : null;
    if (birth && death && birth > death) messages.push("Falecimento anterior ao nascimento");
    const orderRaw = get(r, "order");
    if (orderRaw && !/^[1-9]\d{0,2}$/.test(orderRaw))
      messages.push(`Ordem deve ser inteiro positivo: "${orderRaw}"`);

    const warnings: string[] = [];
    const partialNotes: string[] = [];
    if (birthP.kind === "partial") {
      warnings.push(
        `Nascimento parcial ("${birthP.raw}", ${birthP.label}): fica nas observações, sem data gravada`,
      );
      partialNotes.push(
        `[Importação] Nascimento informado: "${birthP.raw}" (${birthP.label}; não gravado como data exata)`,
      );
    }
    if (deathP.kind === "partial") {
      warnings.push(
        `Falecimento parcial ("${deathP.raw}", ${deathP.label}): fica nas observações, sem data gravada`,
      );
      partialNotes.push(
        `[Importação] Falecimento informado: "${deathP.raw}" (${deathP.label}; não gravado como data exata)`,
      );
    }

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
      health_conditions: get(r, "illnesses")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      occupation: get(r, "occupation") || null,
      vices: get(r, "vices") || null,
      temperament: get(r, "temperament") || null,
      birth_order: orderRaw ? Number(orderRaw) : null,
      notes: [get(r, "notes"), ...partialNotes].filter(Boolean).join("\n") || null,
    };
    if (dup)
      return {
        line,
        status: "duplicate",
        messages: ["Possível duplicidade (mesmo nome e nascimento)", ...warnings],
        record,
      };
    return { line, status: "ok", messages: warnings, record };
  });
}
