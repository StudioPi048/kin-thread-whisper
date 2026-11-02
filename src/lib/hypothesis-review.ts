/**
 * Revisão/contestação de hipóteses — persistida no backend (tabela
 * hypothesis_reviews, só inserção, RLS por profissional + cliente).
 * Cada revisão guarda a "impressão digital" das evidências usadas: se os dados
 * do caso mudarem, a revisão aparece como desatualizada em vez de valer para
 * evidências que ela nunca viu.
 */
import type { DetectedPattern } from "@/lib/patterns";

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
};

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** Hash determinístico (FNV-1a 32 bits) do conteúdo da evidência. */
export function evidenceFingerprint(
  p: Pick<DetectedPattern, "id" | "type" | "personIds" | "details">,
): string {
  const s = stable({
    id: p.id,
    type: p.type,
    persons: [...p.personIds].sort(),
    details: p.details ?? null,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `v1-${h.toString(16).padStart(8, "0")}`;
}

/** Snapshot mínimo da evidência (IDs, tipo, título) — sem nomes. */
export function evidenceSnapshot(p: DetectedPattern) {
  return { id: p.id, type: p.type, title: p.title, personIds: [...p.personIds].sort() };
}

export function latestReview(rows: ReviewRow[], key: string): ReviewRow | null {
  return (
    rows.filter((r) => r.hypothesis_key === key).sort((a, b) => b.version - a.version)[0] ?? null
  );
}

export function isStale(review: ReviewRow | null, currentFingerprint: string): boolean {
  return !!review && review.evidence_fingerprint !== currentFingerprint;
}
