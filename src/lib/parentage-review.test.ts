import { describe, expect, it } from "vitest";
import { parentageSnapshot, reviewMatchesCurrent, validateParentagePlan } from "./parentage-review";

const link = (id: string, from: string, to: string, type = "parent") => ({
  id,
  from_person_id: from,
  to_person_id: to,
  relationship_type: type,
  updated_at: "2026-11-20T18:00:00.123456+00:00",
});

describe("revisão de filiação", () => {
  it("captures all explicit relationships and their complete versions for the selected child", () => {
    const first = link("a", "person-a", "child");
    const second = link("b", "person-b", "child");
    const invalidLegacy = link("c", "child", "child");
    expect(
      parentageSnapshot(
        [
          second,
          link("other", "person-d", "another-child"),
          invalidLegacy,
          link("social", "person-e", "child", "emotional"),
          first,
        ],
        "child",
      ),
    ).toEqual(
      [first, second, invalidLegacy].map((row) => ({ id: row.id, updatedAt: row.updated_at })),
    );
  });

  it("can replace one parent and keep the recorded nature of the other", () => {
    const recorded = [link("a", "person-a", "child"), link("b", "person-b", "child")];
    expect(
      validateParentagePlan(
        "child",
        [{ personId: "person-a" }, { personId: "replacement", kind: "foster" }],
        recorded,
      ),
    ).toBeNull();
    expect(validateParentagePlan("child", [], recorded)).toBeNull();
    expect(validateParentagePlan("child", [{ personId: "replacement" }], recorded)).toMatch(
      /natureza/,
    );
  });

  it("rejects cycles, repeated people and more than two parents", () => {
    const child = "child";
    const recorded = [link("a", child, "descendant")];
    expect(
      validateParentagePlan(child, [{ personId: "descendant", kind: "biological" }], recorded),
    ).toMatch(/ciclo/);
    const a = { personId: "new-a", kind: "biological" } as const;
    const b = { personId: "new-b", kind: "adoptive" } as const;
    const c = { personId: "new-c", kind: "unknown" } as const;
    expect(validateParentagePlan(child, [a, a], recorded)).toMatch(/registrada/);
    expect(validateParentagePlan(child, [a, b, c], recorded)).toMatch(/duas filiações/);
  });

  it("recognizes the exact saved review after reload and refuses a later link version", () => {
    const stored = link("registered", "person-a", "child");
    const review = {
      id: "review",
      review_number: 1,
      client_id: "client",
      child_id: "child",
      professional_id: "professional",
      decision: "edit",
      source: "family_report",
      note: null,
      before_links: [],
      after_links: [stored],
      before_reviewed: false,
      after_reviewed: true,
      undone_review_id: null,
      created_at: stored.updated_at,
    };
    expect(reviewMatchesCurrent(review, parentageSnapshot([stored], "child"), true)).toBe(true);
    const later = { ...stored, updated_at: "2026-11-20T18:00:00.123457+00:00" };
    expect(reviewMatchesCurrent(review, parentageSnapshot([later], "child"), true)).toBe(false);
    expect(reviewMatchesCurrent(review, parentageSnapshot([stored], "child"), false)).toBe(false);
  });
});
