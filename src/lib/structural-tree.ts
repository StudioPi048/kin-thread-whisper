import { type Edge } from "@xyflow/react";
import type { Database } from "@/integrations/supabase/types";
import { smartNormalizeRelationship } from "@/lib/relationship-normalizer";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];
type RelRow = Database["public"]["Tables"]["genogram_relationships"]["Row"];


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
  const isUnion = type === "union";
  return {
    id,
    source,
    target,
    sourceHandle: isUnion ? "right" : undefined,
    targetHandle: isUnion ? "left" : undefined,
    type: "step",
    style: {
      stroke: isUnion ? "var(--color-gold)" : "var(--color-plum)",
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
export function computeStructuralEdges(persons: PersonRow[], rels: RelRow[] = []): Edge[] {
  const edges: Edge[] = [];

  // Pessoas com pais definidos MANUALMENTE (via genogram_relationships type=parent).
  // Nesses casos NÃO inferimos parentesco automaticamente para não sobrescrever a intenção.
  const manualParentOf = new Set<string>();
  for (const r of rels) {
    if (r.relationship_type === "parent" && r.to_person_id) {
      manualParentOf.add(r.to_person_id);
    }
  }

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

  // Helper: liga filho→pai/mãe apenas se não houver override manual
  const linkChild = (childId: string, parentId: string, edgeId: string) => {
    if (manualParentOf.has(childId)) return;
    edges.push(createEdge(edgeId, childId, parentId, "parent"));
  };

  // ── PROBAND ───────────────────────────────────────────────
  const proband =
    first("Consulente") || first("Paciente") || persons.find((p) => p.is_proband) || persons[0];
  if (!proband) return [];


  const pai = first("Pai");
  const mae = first("Mãe");

  // ── NÚCLEO DIRETO: Paciente → Pais ─────────────────────────
  // Mantemos o barramento central só para a linhagem de sangue direta.
  // Irmãos/tios permanecem como nós posicionados, mas sem conexões automáticas
  // para evitar cruzamentos visuais e excesso de linhas no genossociograma.
  // Direção: Filho → Pai (para layout TB com consulente no topo)
  if (pai) {
    linkChild(proband.id, pai.id, "struct_proband_to_pai");
  }
  if (mae) {
    linkChild(proband.id, mae.id, "struct_proband_to_mae");
  }

  // União de pais (linha horizontal visual)
  if (pai && mae) {
    edges.push(createEdge("struct_union_pais", pai.id, mae.id, "union"));
    // Força pai à esquerda da mãe no layout
    edges.push({
      id: "order_pai_mae",
      source: pai.id,
      target: mae.id,
      type: "order",
      hidden: true,
    } as Edge);
  }

  // ── RAMO PATERNO ──────────────────────────────────────────
  const avoPat = first("Avô paterno");
  const avoPatF = first("Avó paterna");
  if (pai && (avoPat || avoPatF)) {
    if (avoPat) linkChild(pai.id, avoPat.id, "struct_pai_to_avopat");
    if (avoPatF) linkChild(pai.id, avoPatF.id, "struct_pai_to_avopatf");
    if (avoPat && avoPatF)
      edges.push(createEdge("struct_union_avos_pat", avoPat.id, avoPatF.id, "union"));

    // Bisavós paternos
    const bp1 = first("Bisavô paterno (pai do avô)");
    const bp2 = first("Bisavó paterna (mãe do avô)");
    if (avoPat && (bp1 || bp2)) {
      if (bp1) linkChild(avoPat.id, bp1.id, "struct_avopat_to_bisavo1");
      if (bp2) linkChild(avoPat.id, bp2.id, "struct_avopat_to_bisavo2");
      if (bp1 && bp2) edges.push(createEdge("struct_union_bisavos_pat1", bp1.id, bp2.id, "union"));
    }
    const bp3 = first("Bisavô paterno (pai da avó)");
    const bp4 = first("Bisavó paterna (mãe da avó)");
    if (avoPatF && (bp3 || bp4)) {
      if (bp3) linkChild(avoPatF.id, bp3.id, "struct_avopatf_to_bisavo3");
      if (bp4) linkChild(avoPatF.id, bp4.id, "struct_avopatf_to_bisavo4");
      if (bp3 && bp4) edges.push(createEdge("struct_union_bisavos_pat2", bp3.id, bp4.id, "union"));
    }
  }

  // ── RAMO MATERNO ──────────────────────────────────────────
  const avoMat = first("Avô materno");
  const avoMatF = first("Avó materna");
  if (mae && (avoMat || avoMatF)) {
    if (avoMat) linkChild(mae.id, avoMat.id, "struct_mae_to_avomat");
    if (avoMatF) linkChild(mae.id, avoMatF.id, "struct_mae_to_avomatf");
    if (avoMat && avoMatF)
      edges.push(createEdge("struct_union_avos_mat", avoMat.id, avoMatF.id, "union"));

    // Bisavós maternos
    const bm1 = first("Bisavô materno (pai do avô)");
    const bm2 = first("Bisavó materna (mãe do avô)");
    if (avoMat && (bm1 || bm2)) {
      if (bm1) linkChild(avoMat.id, bm1.id, "struct_avomat_to_bisavo1");
      if (bm2) linkChild(avoMat.id, bm2.id, "struct_avomat_to_bisavo2");
      if (bm1 && bm2) edges.push(createEdge("struct_union_bisavos_mat1", bm1.id, bm2.id, "union"));
    }
    const bm3 = first("Bisavô materno (pai da avó)");
    const bm4 = first("Bisavó materna (mãe da avó)");
    if (avoMatF && (bm3 || bm4)) {
      if (bm3) linkChild(avoMatF.id, bm3.id, "struct_avomatf_to_bisavo3");
      if (bm4) linkChild(avoMatF.id, bm4.id, "struct_avomatf_to_bisavo4");
      if (bm3 && bm4) edges.push(createEdge("struct_union_bisavos_mat2", bm3.id, bm4.id, "union"));
    }
  }

  // ── INFERÊNCIA AUTOMÁTICA DE COLATERAIS ────────────────────
  // Se o usuário marcou alguém como "Tio paterno", "Irmão do avô materno", "Irmão"
  // etc., o vínculo com os pais correspondentes é ÓBVIO e deve ser feito
  // automaticamente. Sempre respeitando overrides manuais (parent em rels).

  // Irmãos do proband → filhos de Pai + Mãe
  const siblings = get("Irmã(o)");
  siblings.forEach((s, i) => {
    if (pai) linkChild(s.id, pai.id, `auto_sib_${i}_pai`);
    if (mae) linkChild(s.id, mae.id, `auto_sib_${i}_mae`);
  });

  // Tios paternos → filhos de Avô/Avó paternos
  const tiosPat = get("Tio(a) paterno(a)");
  tiosPat.forEach((t, i) => {
    if (avoPat) linkChild(t.id, avoPat.id, `auto_tiopat_${i}_avopat`);
    if (avoPatF) linkChild(t.id, avoPatF.id, `auto_tiopat_${i}_avopatf`);
  });

  // Tios maternos → filhos de Avô/Avó maternos
  const tiosMat = get("Tio(a) materno(a)");
  tiosMat.forEach((t, i) => {
    if (avoMat) linkChild(t.id, avoMat.id, `auto_tiomat_${i}_avomat`);
    if (avoMatF) linkChild(t.id, avoMatF.id, `auto_tiomat_${i}_avomatf`);
  });

  // Tios-avós paternos (irmãos do avô) → filhos dos bisavós paternos (pai/mãe do avô)
  const bp1p = first("Bisavô paterno (pai do avô)");
  const bp2p = first("Bisavó paterna (mãe do avô)");
  get("Irmã(o) do avô paterno").forEach((t, i) => {
    if (bp1p) linkChild(t.id, bp1p.id, `auto_tioavopat_${i}_bp1`);
    if (bp2p) linkChild(t.id, bp2p.id, `auto_tioavopat_${i}_bp2`);
  });

  // Tios-avós paternos (irmãos da avó) → filhos dos bisavós paternos (pai/mãe da avó)
  const bp3p = first("Bisavô paterno (pai da avó)");
  const bp4p = first("Bisavó paterna (mãe da avó)");
  get("Irmã(o) da avó paterna").forEach((t, i) => {
    if (bp3p) linkChild(t.id, bp3p.id, `auto_tiaavopat_${i}_bp3`);
    if (bp4p) linkChild(t.id, bp4p.id, `auto_tiaavopat_${i}_bp4`);
  });

  // Tios-avós maternos (irmãos do avô materno)
  const bm1m = first("Bisavô materno (pai do avô)");
  const bm2m = first("Bisavó materna (mãe do avô)");
  get("Irmã(o) do avô materno").forEach((t, i) => {
    if (bm1m) linkChild(t.id, bm1m.id, `auto_tioavomat_${i}_bm1`);
    if (bm2m) linkChild(t.id, bm2m.id, `auto_tioavomat_${i}_bm2`);
  });

  // Tios-avós maternos (irmãos da avó materna)
  const bm3m = first("Bisavô materno (pai da avó)");
  const bm4m = first("Bisavó materna (mãe da avó)");
  get("Irmã(o) da avó materna").forEach((t, i) => {
    if (bm3m) linkChild(t.id, bm3m.id, `auto_tiaavomat_${i}_bm3`);
    if (bm4m) linkChild(t.id, bm4m.id, `auto_tiaavomat_${i}_bm4`);
  });


  return edges;
}
