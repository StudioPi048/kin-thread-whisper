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
  // Regra visual: só inferimos parentesco quando existir um CASAL de pais
  // completo (avô + avó / pai + mãe / bisavô + bisavó). Sem casal completo,
  // ligar todos os irmãos ao único genitor visível vira uma teia confusa
  // (parece que ele é "pai de todo mundo"). Nesse caso, deixamos o vínculo
  // para o usuário criar manualmente com "Criar vínculo".
  //
  // Sempre respeitamos overrides manuais (rels tipo parent) via linkChild.

  // Irmãos do proband → filhos do casal Pai+Mãe (só se ambos existem)
  if (pai && mae) {
    get("Irmã(o)").forEach((s, i) => {
      linkChild(s.id, pai.id, `auto_sib_${i}_pai`);
      linkChild(s.id, mae.id, `auto_sib_${i}_mae`);
    });
  }

  // Tios paternos → filhos do casal Avô+Avó paternos (só se ambos existem)
  if (avoPat && avoPatF) {
    get("Tio(a) paterno(a)").forEach((t, i) => {
      linkChild(t.id, avoPat.id, `auto_tiopat_${i}_avopat`);
      linkChild(t.id, avoPatF.id, `auto_tiopat_${i}_avopatf`);
    });
  }

  // Tios maternos → filhos do casal Avô+Avó maternos (só se ambos existem)
  if (avoMat && avoMatF) {
    get("Tio(a) materno(a)").forEach((t, i) => {
      linkChild(t.id, avoMat.id, `auto_tiomat_${i}_avomat`);
      linkChild(t.id, avoMatF.id, `auto_tiomat_${i}_avomatf`);
    });
  }

  // Tios-avós: inferência DESATIVADA por padrão.
  // Quando o casal de bisavós está incompleto (comum: só 1 bisavô conhecido),
  // ligar todos os irmãos do avô ao único bisavô cria a impressão errada de
  // que ele é pai de todos. Preferimos silêncio + criação manual explícita.



  return edges;
}
