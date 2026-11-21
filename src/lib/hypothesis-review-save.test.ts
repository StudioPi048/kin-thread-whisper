import type { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { evidenceFingerprint, type ReviewRow } from "./hypothesis-review";
import { submitHypothesisReview } from "./hypothesis-review-save";
import { detectPatterns, type PersonRow } from "./patterns";

const database = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: database }));
afterEach(() => database.rpc.mockReset());

const persons = ["A", "B"].map((id) => ({
  id,
  full_name: id,
  occupation: "Profissão fictícia",
  health_conditions: [],
})) as unknown as PersonRow[];
const [pattern] = detectPatterns(persons, []);
const input = {
  key: `h-${pattern.id}`,
  clientId: "ficticio",
  title: pattern.title,
  pattern,
  decision: "contested" as const,
  note: "Meu rascunho",
  fingerprint: evidenceFingerprint(pattern),
  observed: { id: null, canonicalId: null },
};
const newReview: ReviewRow = {
  id: "review-1",
  hypothesis_key: input.key,
  hypothesis_title: input.title,
  version: 1,
  evidence_fingerprint: input.fingerprint,
  evidence_snapshot: [],
  created_at: "2026-11-21T12:00:00Z",
  decision: "accepted",
  note: "Outra decisão",
};

function reads(history: ReviewRow[], current = persons) {
  const fetchQuery = vi
    .fn()
    .mockResolvedValueOnce(history)
    .mockResolvedValueOnce({ persons: current, relationships: [] });
  return { fetchQuery } as unknown as QueryClient;
}

it("avisa sobre a revisão concorrente sem gravar antes da confirmação", async () => {
  const outcome = await submitHypothesisReview(reads([newReview]), input);
  expect(outcome).toEqual({
    kind: "conflict",
    latest: newReview,
    observed: { id: newReview.id, canonicalId: newReview.id },
  });
  expect(database.rpc).not.toHaveBeenCalled();
});

it("relê as evidências e impede que uma hipótese desaparecida seja aprovada", async () => {
  await expect(submitHypothesisReview(reads([], persons.slice(0, 1)), input)).rejects.toThrow(
    "As evidências mudaram",
  );
  expect(database.rpc).not.toHaveBeenCalled();
});

it("trata o conflito detectado dentro do banco e permite enviar a versão explicitamente conferida", async () => {
  database.rpc.mockResolvedValueOnce({
    data: { kind: "conflict", latest: newReview },
    error: null,
  });
  const outcome = await submitHypothesisReview(reads([]), input);
  if (outcome.kind !== "conflict") throw new Error("Esperava conflito");
  expect(outcome.latest).toEqual(newReview);
  database.rpc.mockResolvedValueOnce({
    data: {
      kind: "saved",
      latest: { ...newReview, id: "review-2", decision: "contested", version: 2 },
    },
    error: null,
  });
  const retried = await submitHypothesisReview(reads([newReview]), {
    ...input,
    observed: outcome.observed,
  });
  expect(retried).toMatchObject({ kind: "saved", latest: { version: 2, decision: "contested" } });
  expect(database.rpc).toHaveBeenLastCalledWith(
    "append_hypothesis_review",
    expect.objectContaining({ _expected_review_id: newReview.id, _note: input.note }),
  );
});
