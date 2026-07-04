import { type Edge } from "@xyflow/react";
import type { Database } from "@/integrations/supabase/types";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];

/** Remove acentos e parênteses, normaliza lowercase */
function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
 * Retorna a chave canônica de um parentesco usando o normalizador inteligente.
 * Baseia-se no TAG do sistema (ex: "Avô paterno") e retorna uma key interna limpa.
 */
function canonicalKey(rel: string | null | undefined): string {
  const normalized = smartNormalizeRelationship(rel);
  return clean(normalized);
}

/**
 * Computa arestas estruturais da árvore a partir dos dados da planilha.
 *
 * DIREÇÃO DAS ARESTAS (IMPORTANTE para o Dagre TB):
 *   → Usamos rankdir: 'TB' (top-to-bottom)
 *   → Para que o Consulente fique no TOPO, as arestas devem ir DE filho PARA pai
 *   → Consulente → Pai/Mãe → Avós → Bisavós
 *   → Com TB, Source (filho) fica acima do Target (pai)
 */
export function computeStructuralEdges(persons: PersonRow[]): Edge[] {
  const edges: Edge[] = [];

  // ── Indexar por chave canônica ─────────────────────────────
  const byKey = new Map<string, PersonRow[]>();
  for (const p of persons) {
    const key = canonicalKey(p.relationship_to_proband) || (p.is_proband ? "consulente" : "");
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }

  const get = (tag: string): PersonRow[] => byKey.get(clean(tag)) ?? [];
  const first = (tag: string): PersonRow | undefined => get(tag)[0];

  // ── PROBAND ───────────────────────────────────────────────
  const proband =
    first("Consulente") ||
    first("Paciente") ||
    persons.find((p) => p.is_proband) ||
    persons[0];
  if (!proband) return [];

  const irmaos = [...get("Irmã(o)"), ...get("Irma(o)")];
  const pai = first("Pai");
  const mae = first("Mãe");

  // ── NÚCLEO: Proband/Irmãos → Pais ─────────────────────────
  // Direção: Filho → Pai (para layout TB com consulente no topo)
  if (pai) {
    edges.push(createEdge("struct_proband_to_pai", proband.id, pai.id, "parent"));
    irmaos.forEach((irm, i) => {
      edges.push(createEdge(`struct_irmao_to_pai_${i}`, irm.id, pai.id, "parent"));
    });
  }
  if (mae) {
    edges.push(createEdge("struct_proband_to_mae", proband.id, mae.id, "parent"));
    irmaos.forEach((irm, i) => {
      edges.push(createEdge(`struct_irmao_to_mae_${i}`, irm.id, mae.id, "parent"));
    });
  }

  // União de pais (linha horizontal visual)
  if (pai && mae) {
    edges.push(createEdge("struct_union_pais", pai.id, mae.id, "union"));
    // Força pai à esquerda da mãe no layout
    edges.push({ id: "order_pai_mae", source: pai.id, target: mae.id, type: "order", hidden: true } as Edge);
  }

  // ── RAMO PATERNO ──────────────────────────────────────────
  const avoPat  = first("Avô paterno");
  const avoPatF = first("Avó paterna");
  const tiosPat = get("Tio(a) paterno(a)");

  if (tiosPat.length > 0 && pai) {
    // Força os tios paternos à esquerda do pai
    tiosPat.forEach((tio, i) => {
      edges.push({ id: `order_tio_pat_${i}`, source: tio.id, target: pai.id, type: "order", hidden: true } as Edge);
    });
  }

  if (pai && (avoPat || avoPatF)) {
    const avoRef = avoPat || avoPatF!;
    if (avoPat) edges.push(createEdge("struct_pai_to_avopat", pai.id, avoPat.id, "parent"));
    if (avoPatF) edges.push(createEdge("struct_pai_to_avopatf", pai.id, avoPatF.id, "parent"));
    if (avoPat && avoPatF) edges.push(createEdge("struct_union_avos_pat", avoPat.id, avoPatF.id, "union"));

    tiosPat.forEach((tio, i) => {
      edges.push(createEdge(`struct_tiopat_to_avo_${i}`, tio.id, avoRef.id, "parent"));
    });

    // Bisavós paternos
    const bp1 = first("Bisavô paterno (pai do avô)");
    const bp2 = first("Bisavó paterna (mãe do avô)");
    if (avoPat && (bp1 || bp2)) {
      if (bp1) edges.push(createEdge("struct_avopat_to_bisavo1", avoPat.id, bp1.id, "parent"));
      if (bp2) edges.push(createEdge("struct_avopat_to_bisavo2", avoPat.id, bp2.id, "parent"));
      if (bp1 && bp2) edges.push(createEdge("struct_union_bisavos_pat1", bp1.id, bp2.id, "union"));
    }
    const bp3 = first("Bisavô paterno (pai da avó)");
    const bp4 = first("Bisavó paterna (mãe da avó)");
    if (avoPatF && (bp3 || bp4)) {
      if (bp3) edges.push(createEdge("struct_avopatf_to_bisavo3", avoPatF.id, bp3.id, "parent"));
      if (bp4) edges.push(createEdge("struct_avopatf_to_bisavo4", avoPatF.id, bp4.id, "parent"));
      if (bp3 && bp4) edges.push(createEdge("struct_union_bisavos_pat2", bp3.id, bp4.id, "union"));
    }

    // Irmãos dos avós paternos
    get("Irmã(o) do avô paterno").forEach((p, i) => {
      if (avoPat) edges.push(createEdge(`struct_irmao_avopat_${i}`, p.id, avoPat.id, "parent"));
    });
    get("Irmã(o) da avó paterna").forEach((p, i) => {
      if (avoPatF) edges.push(createEdge(`struct_irmao_avopatf_${i}`, p.id, avoPatF.id, "parent"));
    });

    // Irmãos dos bisavós paternos
    get("Irmã(o) do bisavô paterno").forEach((p, i) => {
      if (bp1) edges.push(createEdge(`struct_irmao_bisavo_pat_${i}`, p.id, bp1.id, "parent"));
      else if (bp3) edges.push(createEdge(`struct_irmao_bisavo_pat_alt_${i}`, p.id, bp3.id, "parent"));
    });
  }

  // ── RAMO MATERNO ──────────────────────────────────────────
  const avoMat  = first("Avô materno");
  const avoMatF = first("Avó materna");
  const tiosMat = get("Tio(a) materno(a)");

  if (tiosMat.length > 0 && mae) {
    // Força os tios maternos à direita da mãe (mãe aponta para tio = mãe fica à esquerda)
    tiosMat.forEach((tio, i) => {
      edges.push({ id: `order_tio_mat_${i}`, source: mae.id, target: tio.id, type: "order", hidden: true } as Edge);
    });
  }

  if (mae && (avoMat || avoMatF)) {
    const avoRef = avoMat || avoMatF!;
    if (avoMat) edges.push(createEdge("struct_mae_to_avomat", mae.id, avoMat.id, "parent"));
    if (avoMatF) edges.push(createEdge("struct_mae_to_avomatf", mae.id, avoMatF.id, "parent"));
    if (avoMat && avoMatF) edges.push(createEdge("struct_union_avos_mat", avoMat.id, avoMatF.id, "union"));

    tiosMat.forEach((tio, i) => {
      edges.push(createEdge(`struct_tiomat_to_avo_${i}`, tio.id, avoRef.id, "parent"));
    });

    // Bisavós maternos
    const bm1 = first("Bisavô materno (pai do avô)");
    const bm2 = first("Bisavó materna (mãe do avô)");
    if (avoMat && (bm1 || bm2)) {
      if (bm1) edges.push(createEdge("struct_avomat_to_bisavo1", avoMat.id, bm1.id, "parent"));
      if (bm2) edges.push(createEdge("struct_avomat_to_bisavo2", avoMat.id, bm2.id, "parent"));
      if (bm1 && bm2) edges.push(createEdge("struct_union_bisavos_mat1", bm1.id, bm2.id, "union"));
    }
    const bm3 = first("Bisavô materno (pai da avó)");
    const bm4 = first("Bisavó materna (mãe da avó)");
    if (avoMatF && (bm3 || bm4)) {
      if (bm3) edges.push(createEdge("struct_avomatf_to_bisavo3", avoMatF.id, bm3.id, "parent"));
      if (bm4) edges.push(createEdge("struct_avomatf_to_bisavo4", avoMatF.id, bm4.id, "parent"));
      if (bm3 && bm4) edges.push(createEdge("struct_union_bisavos_mat2", bm3.id, bm4.id, "union"));
    }

    // Irmãos dos avós maternos
    get("Irmã(o) do avô materno").forEach((p, i) => {
      if (avoMat) edges.push(createEdge(`struct_irmao_avomat_${i}`, p.id, avoMat.id, "parent"));
    });
    get("Irmã(o) da avó materna").forEach((p, i) => {
      if (avoMatF) edges.push(createEdge(`struct_irmao_avomatf_${i}`, p.id, avoMatF.id, "parent"));
    });

    // Irmãos dos bisavós maternos
    get("Irmã(o) do bisavô materno").forEach((p, i) => {
      if (bm1) edges.push(createEdge(`struct_irmao_bisavo_mat_${i}`, p.id, bm1.id, "parent"));
      else if (bm3) edges.push(createEdge(`struct_irmao_bisavo_mat_alt_${i}`, p.id, bm3.id, "parent"));
    });
  }

  return edges;
}
