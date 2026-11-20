/**
 * Revisão/contestação de hipóteses — persistida no backend (tabela
 * hypothesis_reviews, só inserção, RLS por profissional + cliente).
 * Cada revisão guarda a "impressão digital" das evidências usadas: se os dados
 * do caso mudarem, a revisão aparece como desatualizada em vez de valer para
 * evidências que ela nunca viu.
 */
import type { Json } from "@/integrations/supabase/types";
import type { DetectedPattern, EvidenceFact } from "@/lib/patterns";

export type ReviewDecision = "accepted" | "contested" | "needs_data";

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  accepted: "Faz sentido para o caso",
  contested: "Contestada",
  needs_data: "Faltam dados",
};

export type ReviewRow = {
  id: string;
  hypothesis_key: string;
  decision: string;
  note: string | null;
  version: number;
  evidence_fingerprint: string;
  created_at: string;
  hypothesis_title?: string;
  evidence_snapshot?: Json;
};

function canonicalFacts(facts: EvidenceFact[]) {
  const encoded = new Map<string, EvidenceFact>();
  for (const fact of facts) {
    const key = JSON.stringify([
      fact.source,
      fact.recordId,
      fact.field,
      fact.value,
      fact.precision ?? null,
      fact.personIds ?? null,
    ]);
    encoded.set(key, fact);
  }
  return [...encoded.keys()].sort().map((key) => [key, encoded.get(key)!] as const);
}

const sortedPeople = (ids: string[]) => [...new Set(ids)].sort();

/** FNV-1a de 64 bits sobre os fatos registrados, sem depender da ordem de leitura. */
export function evidenceFingerprint(
  p: Pick<DetectedPattern, "type" | "personIds" | "facts">,
): string {
  const content = JSON.stringify([
    p.type,
    sortedPeople(p.personIds),
    canonicalFacts(p.facts).map(([key]) => key),
  ]);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(content)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return `v2-${hash.toString(16).padStart(16, "0")}`;
}

/** Origem, tipo e valor de cada fato que a revisão realmente considerou. */
export function evidenceSnapshot(p: DetectedPattern) {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    personIds: sortedPeople(p.personIds),
    facts: canonicalFacts(p.facts).map(([, fact]) => fact),
  };
}

/** A chave antiga de uma coincidência pode usar a ordem inversa dos familiares. */
export function reviewsForPattern(rows: ReviewRow[], key: string, pattern: DetectedPattern) {
  const legacy = new Set(pattern.legacyIds?.map((id) => `h-${id}`));
  const expectedPeople = JSON.stringify(sortedPeople(pattern.personIds));
  return rows
    .filter((row) => {
      if (row.hypothesis_key === key) return true;
      if (!legacy.has(row.hypothesis_key)) return false;
      if (pattern.type === "anniversary_syndrome") return true;
      const stored = Array.isArray(row.evidence_snapshot) ? row.evidence_snapshot : [];
      // Uma chave antiga por idade pode ter sido usada para outro grupo.
      return stored.some((snapshot) => {
        if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== "object") return false;
        const ids = snapshot.personIds;
        return (
          Array.isArray(ids) &&
          ids.every((id) => typeof id === "string") &&
          JSON.stringify(sortedPeople(ids)) === expectedPeople
        );
      });
    })
    .sort((a, b) => {
      if (a.hypothesis_key === b.hypothesis_key) return b.version - a.version;
      return Date.parse(b.created_at) - Date.parse(a.created_at) || b.version - a.version;
    });
}

export function latestReview(rows: ReviewRow[], key: string): ReviewRow | null {
  return (
    rows.filter((r) => r.hypothesis_key === key).sort((a, b) => b.version - a.version)[0] ?? null
  );
}

export function isStale(review: ReviewRow | null, currentFingerprint: string): boolean {
  return !!review && review.evidence_fingerprint !== currentFingerprint;
}
