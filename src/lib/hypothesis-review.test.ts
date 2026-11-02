import { describe, expect, it } from "vitest";
import { evidenceFingerprint, isStale, latestReview, type ReviewRow } from "./hypothesis-review";

const base = { id: "cause_x", type: "shared_cause_of_death" as const, personIds: ["a", "b"], details: { cause: "x" } };

describe("versionamento de evidências", () => {
  it("impressão digital não depende da ordem das pessoas", () => {
    expect(evidenceFingerprint(base)).toBe(evidenceFingerprint({ ...base, personIds: ["b", "a"] }));
  });
  it("muda quando a evidência muda (novo familiar)", () => {
    expect(evidenceFingerprint(base)).not.toBe(evidenceFingerprint({ ...base, personIds: ["a", "b", "c"] }));
  });
  const row = (v: number, fp: string): ReviewRow => ({
    id: `r${v}`, hypothesis_key: "h-cause_x", decision: "accepted", note: null, version: v, evidence_fingerprint: fp, created_at: "",
  });
  it("última revisão = maior versão; desatualizada se a evidência mudou", () => {
    const fp = evidenceFingerprint(base);
    const rows = [row(1, "old"), row(2, fp)];
    expect(latestReview(rows, "h-cause_x")!.version).toBe(2);
    expect(isStale(latestReview(rows, "h-cause_x"), fp)).toBe(false);
    expect(isStale(row(1, "old"), fp)).toBe(true);
    expect(isStale(null, fp)).toBe(false);
  });
});
