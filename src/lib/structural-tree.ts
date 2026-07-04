import { type Edge } from "@xyflow/react";
import type { Database } from "@/integrations/supabase/types";

type PersonRow = Database["public"]["Tables"]["genogram_persons"]["Row"];

/**
 * Normaliza o nome do parentesco para fazer o match na planilha.
 */
function normalizeRel(rel: string | null | undefined): string {
  if (!rel) return "";
  return rel.toLowerCase().replace(/[\(\)]/g, "").trim();
}

/**
 * Cria uma aresta do React Flow.
 */
function createEdge(id: string, source: string, target: string, type: "union" | "parent"): Edge {
  const isUnion = type === "union";
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: {
      stroke: isUnion ? "var(--color-gold)" : "var(--color-plum)",
      strokeWidth: 2,
    },
    data: { isStructural: true }, // Marcador para não permitir deleção manual
  };
}

/**
 * Computa as arestas estruturais (casamentos implícitos e laços pais-filhos)
 * baseado nas tags de `relationship_to_proband` da planilha.
 */
export function computeStructuralEdges(persons: PersonRow[]): Edge[] {
  const edges: Edge[] = [];
  
  // Agrupar pessoas por sua role normalizada
  const roles = new Map<string, PersonRow[]>();
  for (const p of persons) {
    // Se for proband e não tiver texto, considera "consulente"
    const rel = normalizeRel(p.relationship_to_proband) || (p.is_proband ? "consulente" : "");
    if (!rel) continue;
    
    if (!roles.has(rel)) roles.set(rel, []);
    roles.get(rel)!.push(p);
  }

  // Helpers para buscar pessoas
  const getRole = (r: string) => roles.get(r) || [];
  const getFirst = (r: string) => getRole(r)[0];

  // ── FAMÍLIA NUCLEAR ──────────────────────────────────────────
  const probands = [...getRole("consulente"), ...getRole("paciente")];
  // Se não houver explícito, usa a primeira pessoa cadastrada como fallback
  const proband = probands[0] || persons[0]; 
  
  if (!proband) return [];

  const pai = getFirst("pai");
  const mae = getFirst("mãe") || getFirst("mae");
  const irmaos = [...getRole("irmão"), ...getRole("irmã"), ...getRole("irmao"), ...getRole("irma")];

  if (pai || mae) {
    const unionId = `structural_u_parents`;
    
    if (pai && mae) {
      edges.push(createEdge(unionId, pai.id, mae.id, "union"));
    }

    // Aresta pai/mãe -> consulente
    const parentSourceId = pai?.id || mae?.id;
    if (parentSourceId) {
      edges.push(createEdge(`structural_p_${parentSourceId}_${proband.id}`, parentSourceId, proband.id, "parent"));
      
      // Irmãos do consulente também vêm dos mesmos pais
      irmaos.forEach(irmao => {
        edges.push(createEdge(`structural_p_${parentSourceId}_${irmao.id}`, parentSourceId, irmao.id, "parent"));
      });
    }
  }

  // ── RAMO PATERNO ──────────────────────────────────────────────
  if (pai) {
    const avoPat = getFirst("avô paterno") || getFirst("avo paterno");
    const avoPatFem = getFirst("avó paterna") || getFirst("avo paterna");
    const tiosPat = [...getRole("tio paterno"), ...getRole("tia paterna"), ...getRole("tioa paternoa")];
    
    if (avoPat || avoPatFem) {
      if (avoPat && avoPatFem) {
        edges.push(createEdge(`structural_u_pat_grandparents`, avoPat.id, avoPatFem.id, "union"));
      }
      
      const patSourceId = avoPat?.id || avoPatFem?.id;
      if (patSourceId) {
        edges.push(createEdge(`structural_p_${patSourceId}_${pai.id}`, patSourceId, pai.id, "parent"));
        
        tiosPat.forEach(tio => {
          edges.push(createEdge(`structural_p_${patSourceId}_${tio.id}`, patSourceId, tio.id, "parent"));
        });
      }
    }
    
    // Bisavós paternos (linha do Avô Paterno)
    if (avoPat) {
      const bisavoPatHomem = getFirst("bisavô paterno pai do avô") || getFirst("bisavô paterno");
      const bisavoPatMulher = getFirst("bisavó paterna mãe do avô") || getFirst("bisavó paterna");
      
      if (bisavoPatHomem || bisavoPatMulher) {
        if (bisavoPatHomem && bisavoPatMulher) {
          edges.push(createEdge(`structural_u_pat_greatgrandparents_m`, bisavoPatHomem.id, bisavoPatMulher.id, "union"));
        }
        const srcId = bisavoPatHomem?.id || bisavoPatMulher?.id;
        if (srcId) {
          edges.push(createEdge(`structural_p_${srcId}_${avoPat.id}`, srcId, avoPat.id, "parent"));
        }
      }
    }

    // Bisavós paternos (linha da Avó Paterna)
    if (avoPatFem) {
      const bisavoPatHomemAvo = getFirst("bisavô paterno pai da avó");
      const bisavoPatMulherAvo = getFirst("bisavó paterna mãe da avó");
      
      if (bisavoPatHomemAvo || bisavoPatMulherAvo) {
        if (bisavoPatHomemAvo && bisavoPatMulherAvo) {
          edges.push(createEdge(`structural_u_pat_greatgrandparents_f`, bisavoPatHomemAvo.id, bisavoPatMulherAvo.id, "union"));
        }
        const srcId = bisavoPatHomemAvo?.id || bisavoPatMulherAvo?.id;
        if (srcId) {
          edges.push(createEdge(`structural_p_${srcId}_${avoPatFem.id}`, srcId, avoPatFem.id, "parent"));
        }
      }
    }
  }

  // ── RAMO MATERNO ──────────────────────────────────────────────
  if (mae) {
    const avoMat = getFirst("avô materno") || getFirst("avo materno");
    const avoMatFem = getFirst("avó materna") || getFirst("avo materna");
    const tiosMat = [...getRole("tio materno"), ...getRole("tia materna"), ...getRole("tioa maternoa")];
    
    if (avoMat || avoMatFem) {
      if (avoMat && avoMatFem) {
        edges.push(createEdge(`structural_u_mat_grandparents`, avoMat.id, avoMatFem.id, "union"));
      }
      
      const matSourceId = avoMat?.id || avoMatFem?.id;
      if (matSourceId) {
        edges.push(createEdge(`structural_p_${matSourceId}_${mae.id}`, matSourceId, mae.id, "parent"));
        
        tiosMat.forEach(tio => {
          edges.push(createEdge(`structural_p_${matSourceId}_${tio.id}`, matSourceId, tio.id, "parent"));
        });
      }
    }
    
    // Bisavós maternos (linha do Avô Materno)
    if (avoMat) {
      const bisavoMatHomem = getFirst("bisavô materno pai do avô") || getFirst("bisavô materno");
      const bisavoMatMulher = getFirst("bisavó materna mãe do avô") || getFirst("bisavó materna");
      
      if (bisavoMatHomem || bisavoMatMulher) {
        if (bisavoMatHomem && bisavoMatMulher) {
          edges.push(createEdge(`structural_u_mat_greatgrandparents_m`, bisavoMatHomem.id, bisavoMatMulher.id, "union"));
        }
        const srcId = bisavoMatHomem?.id || bisavoMatMulher?.id;
        if (srcId) {
          edges.push(createEdge(`structural_p_${srcId}_${avoMat.id}`, srcId, avoMat.id, "parent"));
        }
      }
    }

    // Bisavós maternos (linha da Avó Materna)
    if (avoMatFem) {
      const bisavoMatHomemAvo = getFirst("bisavô materno pai da avó");
      const bisavoMatMulherAvo = getFirst("bisavó materna mãe da avó");
      
      if (bisavoMatHomemAvo || bisavoMatMulherAvo) {
        if (bisavoMatHomemAvo && bisavoMatMulherAvo) {
          edges.push(createEdge(`structural_u_mat_greatgrandparents_f`, bisavoMatHomemAvo.id, bisavoMatMulherAvo.id, "union"));
        }
        const srcId = bisavoMatHomemAvo?.id || bisavoMatMulherAvo?.id;
        if (srcId) {
          edges.push(createEdge(`structural_p_${srcId}_${avoMatFem.id}`, srcId, avoMatFem.id, "parent"));
        }
      }
    }
  }

  return edges;
}
