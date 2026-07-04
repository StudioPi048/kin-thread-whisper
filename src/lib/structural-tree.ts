import { type Edge } from "@xyflow/react";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];

/**
 * Normaliza uma string de parentesco para comparação:
 * - Minúsculas
 * - Remove parênteses e seu conteúdo (ex: "Tio(a)" -> "tio")
 * - Remove acentos (para matching resiliente)
 * - Remove espaços extras
 */
function normalizeRel(rel: string | null | undefined): string {
  if (!rel) return "";
  return rel
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")   // remove tudo entre parênteses: Tio(a) -> Tio
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tabela canônica de parentescos.
 * Cada chave é o identificador interno; o valor é uma lista de strings normalizadas que o mapeiam.
 */
const REL_MAP: Record<string, string[]> = {
  // Núcleo
  consulente:           ["consulente", "paciente", "paciente-indice", "proband"],
  irmao:                ["irmao", "irma", "sibling"],
  pai:                  ["pai", "father"],
  mae:                  ["mae", "mother"],

  // Paternos
  tio_pat:              ["tio paterno", "tia paterna", "tioa paternoa"],
  avo_pat:              ["avo paterno", "avô paterno"],
  avo_pat_f:            ["avo paterna", "avó paterna"],
  bisavo_pat_m_pelo_avo:["bisavo paterno pai do avo", "bisavô paterno pai do avô"],
  bisavo_pat_f_pelo_avo:["bisavo paterna mae do avo", "bisavó paterna mae do avô", "bisavó paterna mãe do avô"],
  bisavo_pat_m_pela_avo:["bisavo paterno pai da avo", "bisavô paterno pai da avó"],
  bisavo_pat_f_pela_avo:["bisavo paterna mae da avo", "bisavó paterna mae da avó", "bisavó paterna mãe da avó"],
  irmao_avo_pat:        ["irmao do avo paterno", "irma do avo paterno", "irmao do avô paterno"],
  irmao_avo_pat_f:      ["irmao da avo paterna", "irma da avo paterna", "irmao da avó paterna"],

  // Maternos
  tio_mat:              ["tio materno", "tia materna", "tioa maternoa"],
  avo_mat:              ["avo materno", "avô materno"],
  avo_mat_f:            ["avo materna", "avó materna"],
  bisavo_mat_m_pelo_avo:["bisavo materno pai do avo", "bisavô materno pai do avô"],
  bisavo_mat_f_pelo_avo:["bisavo materna mae do avo", "bisavó materna mae do avô", "bisavó materna mãe do avô"],
  bisavo_mat_m_pela_avo:["bisavo materno pai da avo", "bisavô materno pai da avó"],
  bisavo_mat_f_pela_avo:["bisavo materna mae da avo", "bisavó materna mae da avó", "bisavó materna mãe da avó"],
  irmao_avo_mat:        ["irmao do avo materno", "irma do avo materno"],
  irmao_avo_mat_f:      ["irmao da avo materna", "irma da avo materna"],
};

/** Mapeia uma string normalizada para uma chave canônica do REL_MAP. */
function resolveRole(normalized: string): string {
  for (const [canonical, variants] of Object.entries(REL_MAP)) {
    if (variants.some(v => normalized === v || normalized.startsWith(v) || v.startsWith(normalized))) {
      return canonical;
    }
  }
  return normalized; // fallback: usa a própria string normalizada
}

function createEdge(id: string, source: string, target: string, type: "union" | "parent"): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: {
      stroke: type === "union" ? "var(--color-gold)" : "var(--color-plum)",
      strokeWidth: 2,
    },
    data: { isStructural: true },
  };
}

/**
 * Computa as arestas estruturais (uniões e laços pais-filhos)
 * baseado nas tags de `relationship_to_proband` da planilha.
 * Sincronização automática e bidirecional: planilha <-> genossociograma.
 */
export function computeStructuralEdges(persons: PersonRow[]): Edge[] {
  const edges: Edge[] = [];

  // Indexar pessoas por role canônica
  const byRole = new Map<string, PersonRow[]>();
  for (const p of persons) {
    const raw = p.relationship_to_proband || (p.is_proband ? "Consulente" : "");
    const normalized = normalizeRel(raw);
    const canonical = resolveRole(normalized);
    if (!canonical) continue;
    if (!byRole.has(canonical)) byRole.set(canonical, []);
    byRole.get(canonical)!.push(p);
  }

  const getAll = (key: string): PersonRow[] => byRole.get(key) || [];
  const getFirst = (key: string): PersonRow | undefined => getAll(key)[0];

  const proband = getFirst("consulente") || persons.find(p => p.is_proband) || persons[0];
  if (!proband) return [];

  const pai = getFirst("pai");
  const mae = getFirst("mae");
  const irmaos = getAll("irmao");

  // ── FAMÍLIA NUCLEAR ───────────────────────────────────────────
  if (pai && mae) {
    edges.push(createEdge("struct_union_pais", pai.id, mae.id, "union"));
  }
  const parentRef = pai || mae;
  if (parentRef) {
    edges.push(createEdge(`struct_parent_to_proband`, parentRef.id, proband.id, "parent"));
    irmaos.forEach((irm, i) => {
      edges.push(createEdge(`struct_parent_to_irmao_${i}`, parentRef.id, irm.id, "parent"));
    });
  }

  // ── RAMO PATERNO ──────────────────────────────────────────────
  const avoPat  = getFirst("avo_pat");
  const avoPatF = getFirst("avo_pat_f");
  const tiosPat = getAll("tio_pat");

  if (pai && (avoPat || avoPatF)) {
    const avoPatRef = avoPat || avoPatF!;
    if (avoPat && avoPatF) {
      edges.push(createEdge("struct_union_avos_pat", avoPat.id, avoPatF.id, "union"));
    }
    edges.push(createEdge("struct_avopat_to_pai", avoPatRef.id, pai.id, "parent"));
    tiosPat.forEach((tio, i) => {
      edges.push(createEdge(`struct_avopat_to_tio_${i}`, avoPatRef.id, tio.id, "parent"));
    });

    // Bisavós paternos (linha do avô)
    if (avoPat) {
      const bp1 = getFirst("bisavo_pat_m_pelo_avo");
      const bp2 = getFirst("bisavo_pat_f_pelo_avo");
      if (bp1 || bp2) {
        if (bp1 && bp2) edges.push(createEdge("struct_union_bisavos_pat_m", bp1.id, bp2.id, "union"));
        const ref = bp1 || bp2!;
        edges.push(createEdge("struct_bisavopat_to_avopat", ref.id, avoPat.id, "parent"));
      }
    }
    // Bisavós paternos (linha da avó)
    if (avoPatF) {
      const bp3 = getFirst("bisavo_pat_m_pela_avo");
      const bp4 = getFirst("bisavo_pat_f_pela_avo");
      if (bp3 || bp4) {
        if (bp3 && bp4) edges.push(createEdge("struct_union_bisavos_pat_f", bp3.id, bp4.id, "union"));
        const ref = bp3 || bp4!;
        edges.push(createEdge("struct_bisavopat_to_avopatf", ref.id, avoPatF.id, "parent"));
      }
    }
    // Irmãos dos avós paternos
    getAll("irmao_avo_pat").forEach((p, i) => {
      if (avoPat) edges.push(createEdge(`struct_irmao_avopat_${i}`, avoPat.id, p.id, "parent"));
    });
    getAll("irmao_avo_pat_f").forEach((p, i) => {
      if (avoPatF) edges.push(createEdge(`struct_irmao_avopatf_${i}`, avoPatF.id, p.id, "parent"));
    });
  }

  // ── RAMO MATERNO ──────────────────────────────────────────────
  const avoMat  = getFirst("avo_mat");
  const avoMatF = getFirst("avo_mat_f");
  const tiosMat = getAll("tio_mat");

  if (mae && (avoMat || avoMatF)) {
    const avoMatRef = avoMat || avoMatF!;
    if (avoMat && avoMatF) {
      edges.push(createEdge("struct_union_avos_mat", avoMat.id, avoMatF.id, "union"));
    }
    edges.push(createEdge("struct_avomat_to_mae", avoMatRef.id, mae.id, "parent"));
    tiosMat.forEach((tio, i) => {
      edges.push(createEdge(`struct_avomat_to_tio_${i}`, avoMatRef.id, tio.id, "parent"));
    });

    // Bisavós maternos (linha do avô)
    if (avoMat) {
      const bm1 = getFirst("bisavo_mat_m_pelo_avo");
      const bm2 = getFirst("bisavo_mat_f_pelo_avo");
      if (bm1 || bm2) {
        if (bm1 && bm2) edges.push(createEdge("struct_union_bisavos_mat_m", bm1.id, bm2.id, "union"));
        const ref = bm1 || bm2!;
        edges.push(createEdge("struct_bisavomat_to_avomat", ref.id, avoMat.id, "parent"));
      }
    }
    // Bisavós maternos (linha da avó)
    if (avoMatF) {
      const bm3 = getFirst("bisavo_mat_m_pela_avo");
      const bm4 = getFirst("bisavo_mat_f_pela_avo");
      if (bm3 || bm4) {
        if (bm3 && bm4) edges.push(createEdge("struct_union_bisavos_mat_f", bm3.id, bm4.id, "union"));
        const ref = bm3 || bm4!;
        edges.push(createEdge("struct_bisavomat_to_avomatf", ref.id, avoMatF.id, "parent"));
      }
    }
    getAll("irmao_avo_mat").forEach((p, i) => {
      if (avoMat) edges.push(createEdge(`struct_irmao_avomat_${i}`, avoMat.id, p.id, "parent"));
    });
    getAll("irmao_avo_mat_f").forEach((p, i) => {
      if (avoMatF) edges.push(createEdge(`struct_irmao_avomatf_${i}`, avoMatF.id, p.id, "parent"));
    });
  }

  return edges;
}
