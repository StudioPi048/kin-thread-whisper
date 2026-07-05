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
      stroke: isUnion ? "var(--color-foreground)" : "var(--color-plum)",
      strokeWidth: 2,
    },
    data: { isStructural: true, relationshipType: type },
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
  const manualUnionPairs = new Set<string>();
  const emittedUnionPairs = new Set<string>();
  for (const r of rels) {
    if (r.relationship_type === "parent" && r.to_person_id) {
      manualParentOf.add(r.to_person_id);
    }
    if (r.relationship_type === "union" && r.from_person_id && r.to_person_id) {
      manualUnionPairs.add([r.from_person_id, r.to_person_id].sort().join("|"));
    }
  }

  const linkUnion = (a: PersonRow, b: PersonRow, edgeId: string) => {
    const pairKey = [a.id, b.id].sort().join("|");
    if (manualUnionPairs.has(pairKey) || emittedUnionPairs.has(pairKey)) return;
    emittedUnionPairs.add(pairKey);
    edges.push(createEdge(edgeId, a.id, b.id, "union"));
  };

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
    linkUnion(pai, mae, "struct_union_pais");
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
    if (avoPat && avoPatF) linkUnion(avoPat, avoPatF, "struct_union_avos_pat");

    // Bisavós paternos
    const bp1 = first("Bisavô paterno (pai do avô)");
    const bp2 = first("Bisavó paterna (mãe do avô)");
    if (avoPat && (bp1 || bp2)) {
      if (bp1) linkChild(avoPat.id, bp1.id, "struct_avopat_to_bisavo1");
      if (bp2) linkChild(avoPat.id, bp2.id, "struct_avopat_to_bisavo2");
      if (bp1 && bp2) linkUnion(bp1, bp2, "struct_union_bisavos_pat1");
    }
    const bp3 = first("Bisavô paterno (pai da avó)");
    const bp4 = first("Bisavó paterna (mãe da avó)");
    if (avoPatF && (bp3 || bp4)) {
      if (bp3) linkChild(avoPatF.id, bp3.id, "struct_avopatf_to_bisavo3");
      if (bp4) linkChild(avoPatF.id, bp4.id, "struct_avopatf_to_bisavo4");
      if (bp3 && bp4) linkUnion(bp3, bp4, "struct_union_bisavos_pat2");
    }
  }

  // ── RAMO MATERNO ──────────────────────────────────────────
  const avoMat = first("Avô materno");
  const avoMatF = first("Avó materna");
  if (mae && (avoMat || avoMatF)) {
    if (avoMat) linkChild(mae.id, avoMat.id, "struct_mae_to_avomat");
    if (avoMatF) linkChild(mae.id, avoMatF.id, "struct_mae_to_avomatf");
    if (avoMat && avoMatF) linkUnion(avoMat, avoMatF, "struct_union_avos_mat");

    // Bisavós maternos
    const bm1 = first("Bisavô materno (pai do avô)");
    const bm2 = first("Bisavó materna (mãe do avô)");
    if (avoMat && (bm1 || bm2)) {
      if (bm1) linkChild(avoMat.id, bm1.id, "struct_avomat_to_bisavo1");
      if (bm2) linkChild(avoMat.id, bm2.id, "struct_avomat_to_bisavo2");
      if (bm1 && bm2) linkUnion(bm1, bm2, "struct_union_bisavos_mat1");
    }
    const bm3 = first("Bisavô materno (pai da avó)");
    const bm4 = first("Bisavó materna (mãe da avó)");
    if (avoMatF && (bm3 || bm4)) {
      if (bm3) linkChild(avoMatF.id, bm3.id, "struct_avomatf_to_bisavo3");
      if (bm4) linkChild(avoMatF.id, bm4.id, "struct_avomatf_to_bisavo4");
      if (bm3 && bm4) linkUnion(bm3, bm4, "struct_union_bisavos_mat2");
    }
  }

  // ── INFERÊNCIA AUTOMÁTICA DE COLATERAIS ────────────────────
  // Regra do usuário: se o parentesco JÁ diz de quem é irmão, o vínculo é óbvio
  // e o sistema deve fazê-lo automaticamente — mesmo que só um dos pais exista.
  // A confusão visual de "pai de todos" é resolvida pela barra de irmãos do
  // canvas (converge no meio do casal ou no único genitor conhecido).
  // Sempre respeitamos overrides manuais (rels tipo parent) via linkChild.

  const linkSibling = (
    childRow: PersonRow,
    p1: PersonRow | undefined,
    p2: PersonRow | undefined,
    baseId: string,
  ) => {
    if (p1) linkChild(childRow.id, p1.id, `${baseId}_a`);
    if (p2) linkChild(childRow.id, p2.id, `${baseId}_b`);
  };

  // Irmãos do proband → filhos de Pai e/ou Mãe
  get("Irmã(o)").forEach((s, i) => linkSibling(s, pai, mae, `auto_sib_${i}`));

  // Tios paternos → filhos dos avós paternos
  get("Tio(a) paterno(a)").forEach((t, i) =>
    linkSibling(t, avoPat, avoPatF, `auto_tiopat_${i}`),
  );

  // Tios maternos → filhos dos avós maternos
  get("Tio(a) materno(a)").forEach((t, i) =>
    linkSibling(t, avoMat, avoMatF, `auto_tiomat_${i}`),
  );

  // Tios-avós paternos (irmãos do avô paterno) → filhos dos bisavós que geraram o avô
  const bp1 = first("Bisavô paterno (pai do avô)");
  const bp2 = first("Bisavó paterna (mãe do avô)");
  get("Irmã(o) do avô paterno").forEach((t, i) =>
    linkSibling(t, bp1, bp2, `auto_tioavopat_avo_${i}`),
  );

  // Tios-avós paternos (irmãos da avó paterna) → filhos dos bisavós que geraram a avó
  const bp3 = first("Bisavô paterno (pai da avó)");
  const bp4 = first("Bisavó paterna (mãe da avó)");
  get("Irmã(o) da avó paterna").forEach((t, i) =>
    linkSibling(t, bp3, bp4, `auto_tioavopat_ava_${i}`),
  );

  // Tios-avós maternos (irmãos do avô materno)
  const bm1 = first("Bisavô materno (pai do avô)");
  const bm2 = first("Bisavó materna (mãe do avô)");
  get("Irmã(o) do avô materno").forEach((t, i) =>
    linkSibling(t, bm1, bm2, `auto_tioavomat_avo_${i}`),
  );

  // Tios-avós maternos (irmãos da avó materna)
  const bm3 = first("Bisavô materno (pai da avó)");
  const bm4 = first("Bisavó materna (mãe da avó)");
  get("Irmã(o) da avó materna").forEach((t, i) =>
    linkSibling(t, bm3, bm4, `auto_tioavomat_ava_${i}`),
  );

  return edges;
}
