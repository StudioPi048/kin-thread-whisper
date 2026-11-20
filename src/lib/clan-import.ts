/**
 * Importação da planilha do clã: mapeamento de colunas, prévia, erros por
 * linha e duplicidades. Puro (sem rede) — a gravação é feita pela RPC
 * transacional `import_genogram_persons`.
 */
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

export function inferGenderFromRelationship(
  relationship?: string,
): "masculino" | "feminino" | undefined {
  const role = relationship
    ?.trim()
    .toLowerCase()
    .replace(/^mei[oa][- ]/, "")
    .split(/[\s-]+/)[0];
  if (!role) return undefined;
  if (["pai", "avô", "bisavô", "trisavô", "tio", "irmão", "irmao", "filho"].includes(role))
    return "masculino";
  if (["mãe", "mae", "avó", "bisavó", "trisavó", "tia", "irmã", "irma", "filha"].includes(role))
    return "feminino";
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
  const interval = /^(\d{4})\s*(?:[–—-]|a)\s*(\d{4})$/i.exec(val);
  if (interval) {
    const start = Number(interval[1]);
    const end = Number(interval[2]);
    return yearOk(start) && yearOk(end) && end >= start
      ? { kind: "partial", raw: `${start}–${end}`, label: "intervalo de anos" }
      : bad("intervalo de anos inválido");
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
        ? { kind: "partial", raw: `${p1.padStart(2, "0")}/${p2}`, label: "mês e ano, sem dia" }
        : bad(`ano fora de ${MIN_YEAR}–${maxYear()}`);
    }
    const [dd, mm] = Number(p1) > 12 ? [p1, p2] : Number(p2) > 12 ? [p2, p1] : [p1, p2];
    // Valida dia/mês num ano bissexto qualquer só para checar existência; o ano NÃO é gravado.
    return isValidYMD(`2024-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`)
      ? {
          kind: "partial",
          raw: `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}`,
          label: "dia e mês, sem ano",
        }
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
    aliases: ["nascimento", "data de nascimento", "data nascimento", "nasc", "nasceu"],
  },
  { key: "gestation", label: "Gestação", aliases: ["gestação", "tempo gestacional", "semanas"] },
  { key: "death", label: "Falecimento", aliases: ["morte", "data morte", "falecimento", "óbito"] },
  {
    key: "illnesses",
    label: "Enfermidades",
    aliases: ["enfermidades", "doenças", "doencas", "saúde"],
  },
  {
    key: "occupation",
    label: "Profissão",
    aliases: ["profissão", "profissões", "ocupação", "ocupações"],
  },
  { key: "vices", label: "Vícios", aliases: ["vícios", "vicios"] },
  { key: "temperament", label: "Temperamento", aliases: ["temperamento"] },
  { key: "order", label: "Ordem", aliases: ["ordem", "ordem de nascimento"] },
  { key: "notes", label: "Observações", aliases: ["obs", "observações", "observacoes", "notas"] },
] as const;
export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>; // field -> índice da coluna

function decodeCsv(file: ArrayBuffer): string {
  const bytes = new Uint8Array(file);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(file);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(file);
  } catch {
    return new TextDecoder("windows-1252").decode(file);
  }
}

export type ClanSheet = { name: string; header: string[]; rows: string[][] };

/** Preserva texto e campos vazios no CSV; só datas tipadas do Excel viram ISO. */
export async function readClanWorkbook(file: ArrayBuffer, format: "csv" | "xlsx") {
  const XLSX = await import("xlsx");
  const workbook =
    format === "csv"
      ? XLSX.read(decodeCsv(file), { type: "string", raw: true })
      : XLSX.read(file, { type: "array", raw: true, cellDates: true });
  const sheets = workbook.SheetNames.map((name): ClanSheet => {
    const [header = [], ...rows] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true,
    });
    return {
      name,
      header: header.map((cell) => String(cell ?? "")),
      rows: rows.map((row) =>
        row.map((cell) =>
          cell instanceof Date && !Number.isNaN(cell.getTime())
            ? cell.toISOString().slice(0, 10)
            : String(cell ?? ""),
        ),
      ),
    };
  });
  if (!sheets.some((sheet) => sheet.header.some(Boolean) && sheet.rows.length)) {
    throw new Error("Arquivo vazio ou sem cabeçalho.");
  }
  return sheets;
}

export async function readClanFile(file: ArrayBuffer, format: "csv" | "xlsx") {
  const [sheet] = await readClanWorkbook(file, format);
  if (!sheet?.header.length || !sheet.rows.length)
    throw new Error("Arquivo vazio ou sem cabeçalho.");
  return { header: sheet.header, rows: sheet.rows };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Mapeia por nome de cabeçalho; sem cabeçalho reconhecido usa a ordem oficial de 11 colunas. */
export function autoMap(header: string[], useTemplateOrder = true): Mapping {
  const m: Mapping = {};
  header.forEach((h, i) => {
    const n = norm(h || "");
    const f = IMPORT_FIELDS.find((x) => x.aliases.some((a) => norm(a) === n));
    if (f && m[f.key] === undefined) m[f.key] = i;
  });
  if (useTemplateOrder && Object.keys(m).length < 2)
    IMPORT_FIELDS.forEach((f, i) => (m[f.key] = i));
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
  birth_date_partial?: string | null;
  gestational_weeks: string | null;
  death_date: string | null;
  death_date_partial?: string | null;
  is_deceased: boolean;
  health_conditions: string[];
  occupation: string | null;
  vices: string | null;
  temperament: string | null;
  birth_order: number | null;
  notes: string | null;
}

function needsSiblingReference(relationship: string) {
  return /^(?:irmao|irma|irmaos|irmas)(?: mais (?:velho|velha|novo|nova))?$/.test(
    norm(relationship),
  );
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
  return rows.map((r, idx) => {
    const line = idx + 2;
    const messages: string[] = [];
    if (r.every((c) => !String(c ?? "").trim()))
      return { line, status: "skip", messages: ["Linha vazia"], record: null };

    const rawRelationship = get(r, "relationship");
    const ambiguousSibling = needsSiblingReference(rawRelationship);
    const rel = ambiguousSibling
      ? `${rawRelationship} (referência não informada)`
      : rawRelationship;
    const relCanonical = rel ? smartNormalizeRelationship(rel) : null;
    if (relCanonical === "Consulente")
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
    if (ambiguousSibling)
      warnings.push(
        "Irmão de quem? Indique a pessoa de referência ou registre a filiação no mapa.",
      );
    const partialNotes: string[] = [];
    if (birthP.kind === "partial") {
      warnings.push(
        `Nascimento parcial ("${birthP.raw}", ${birthP.label}): preservado com a precisão informada`,
      );
      partialNotes.push(
        `[Importação] Nascimento informado: "${birthP.raw}" (${birthP.label}; não gravado como data exata)`,
      );
    }
    if (deathP.kind === "partial") {
      warnings.push(
        `Falecimento parcial ("${deathP.raw}", ${deathP.label}): preservado com a precisão informada`,
      );
      partialNotes.push(
        `[Importação] Falecimento informado: "${deathP.raw}" (${deathP.label}; não gravado como data exata)`,
      );
    }

    if (messages.length) return { line, status: "error", messages, record: null };

    const k = key(name, birth);
    const dup = seen.has(k);
    seen.add(k);
    const record: ImportRecord = {
      full_name: name,
      relationship_to_proband: rel || null,
      gender: inferGenderFromRelationship(relCanonical ?? "") || "desconhecido",
      birth_date: birth,
      ...(birthP.kind === "partial" ? { birth_date_partial: birthP.raw } : {}),
      gestational_weeks: get(r, "gestation") || null,
      death_date: death,
      ...(deathP.kind === "partial" ? { death_date_partial: deathP.raw } : {}),
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
