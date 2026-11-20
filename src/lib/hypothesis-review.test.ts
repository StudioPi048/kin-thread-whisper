import { describe, expect, it } from "vitest";
import {
  evidenceFingerprint,
  evidenceSnapshot,
  isStale,
  latestReview,
  reviewsForPattern,
  type ReviewRow,
} from "./hypothesis-review";
import {
  detectPatterns,
  type DetectedPattern,
  type PersonRow,
  type RelationshipRow,
} from "./patterns";

const base: DetectedPattern = {
  id: "cause_x",
  type: "shared_cause_of_death",
  title: "Causa recorrente",
  description: "Duas pessoas.",
  severity: "attention",
  personIds: ["a", "b"],
  facts: [
    {
      source: "genogram_persons",
      recordId: "a",
      field: "death_date",
      precision: "day",
      value: "2000-01-04",
    },
    { source: "genogram_persons", recordId: "b", field: "cause_of_death", value: "x" },
  ],
};

const person = (id: string, fields: Partial<PersonRow> = {}) =>
  ({
    id,
    full_name: id,
    birth_date: null,
    death_date: null,
    health_conditions: [],
    life_events: [],
    ...fields,
  }) as PersonRow;

describe("versionamento de evidências", () => {
  it("não depende da ordem nem de fatos idênticos repetidos", () => {
    const rearranged = { ...base, personIds: ["b", "a"], facts: [...base.facts].reverse() };
    expect(evidenceFingerprint(base)).toBe(evidenceFingerprint(rearranged));
    expect(evidenceSnapshot(base)).toEqual(evidenceSnapshot(rearranged));
    expect(evidenceFingerprint(base)).toBe(
      evidenceFingerprint({ ...base, facts: [...base.facts, base.facts[0]] }),
    );
    expect(evidenceFingerprint(base)).toMatch(/^v2-[a-f0-9]{16}$/);
  });
  it("muda quando a evidência muda (novo familiar)", () => {
    expect(evidenceFingerprint(base)).not.toBe(
      evidenceFingerprint({ ...base, personIds: ["a", "b", "c"] }),
    );
  });
  const row = (v: number, fp: string): ReviewRow => ({
    id: `r${v}`,
    hypothesis_key: "h-cause_x",
    decision: "accepted",
    note: null,
    version: v,
    evidence_fingerprint: fp,
    created_at: "",
  });
  it("última revisão = maior versão; desatualizada se a evidência mudou", () => {
    const fp = evidenceFingerprint(base);
    const rows = [row(1, "old"), row(2, fp)];
    expect(latestReview(rows, "h-cause_x")!.version).toBe(2);
    expect(isStale(latestReview(rows, "h-cause_x"), fp)).toBe(false);
    expect(isStale(row(1, "old"), fp)).toBe(true);
    expect(isStale(null, fp)).toBe(false);
  });

  it.each([
    { source: "genogram_relationships" },
    { recordId: "novo-registro" },
    { field: "birth_date" },
    { value: "1999-01-04" },
    { precision: "month" },
  ] as const)("pede nova revisão quando um fato muda: %o", (changed) => {
    const newFingerprint = evidenceFingerprint({
      ...base,
      facts: [{ ...base.facts[0], ...changed }, base.facts[1]],
    });
    expect(isStale(row(2, evidenceFingerprint(base)), newFingerprint)).toBe(true);
  });

  it("mantém a chave e invalida uma revisão quando a coincidência muda de nascimento para falecimento", () => {
    const a = person("a", { birth_date: "1950-01-04" });
    const b = person("b", { birth_date: "1970-01-04" });
    const changed = { ...b, birth_date: "1970-02-24", death_date: "2001-01-04" };
    const detect = (people: PersonRow[]) =>
      detectPatterns(people, []).find((pattern) => pattern.type === "anniversary_syndrome")!;
    const before = detect([a, b]);
    expect(detect([b, a]).id).toBe(before.id);
    expect(evidenceFingerprint(detect([b, a]))).toBe(evidenceFingerprint(before));
    const after = detect([a, changed]);
    expect(after.id).toBe(before.id);
    expect(after.facts.map(({ field }) => field)).toEqual(["birth_date", "death_date"]);
    expect(isStale(row(2, evidenceFingerprint(before)), evidenceFingerprint(after))).toBe(true);
    expect(after.description).toContain("04/01/2001");
    expect(detect([{ ...a, death_date: "1998-01-04" }, changed]).facts).toHaveLength(3);
    expect(detectPatterns([a, { ...b, birth_date: "1970-01" }], [])).toHaveLength(0);
  });

  it("recupera uma revisão antiga pela chave invertida sem tratá-la como vigente", () => {
    const [pattern] = detectPatterns(
      [person("a", { birth_date: "1950-01-04" }), person("b", { birth_date: "1970-01-04" })],
      [],
    );
    const previous: ReviewRow = {
      ...row(4, "v1-3e555b42"),
      hypothesis_key: "h-anniv_b_a_01-04",
      note: "Justificativa preservada",
      created_at: "2026-11-20T10:00:00Z",
    };
    const currentKey = `h-${pattern.id}`;
    const current: ReviewRow = {
      ...row(1, evidenceFingerprint(pattern)),
      hypothesis_key: currentKey,
      created_at: "2026-11-20T11:00:00Z",
    };
    const oldOnly = reviewsForPattern([previous], currentKey, pattern);
    expect(oldOnly).toEqual([previous]);
    expect(isStale(oldOnly[0], evidenceFingerprint(pattern))).toBe(true);
    expect(reviewsForPattern([previous, current], currentKey, pattern)).toEqual([
      current,
      previous,
    ]);
  });

  it("distingue registros de ruptura e a precisão de suas datas sem depender da ordem", () => {
    const relationship = (id: string, to_person_id: string) =>
      ({
        id,
        from_person_id: "a",
        to_person_id,
        relationship_type: "emotional",
        qualifier: "rupture",
        start_date: "1985",
        end_date: null,
      }) as RelationshipRow;
    const links = [relationship("r1", "b"), relationship("r2", "c")];
    const detect = (rels: RelationshipRow[]) => evidenceFingerprint(detectPatterns([], rels)[0]);
    expect(detect(links)).toBe(detect([...links].reverse()));
    expect(detect(links)).not.toBe(detect([{ ...links[0], id: "r3" }, links[1]]));
    expect(detect(links)).not.toBe(detect([{ ...links[0], start_date: "1985-01" }, links[1]]));
  });

  it("usa a idade civil ao falecer no dia anterior ao aniversário, inclusive em ano bissexto", () => {
    const people = [
      person("a", { birth_date: "1950-03-01", death_date: "2000-02-29" }),
      person("b", { birth_date: "1950-07-15", death_date: "2000-07-14" }),
    ];
    const pattern = detectPatterns(people, []).find((p) => p.type === "shared_death_age");
    expect(pattern?.details?.ages).toEqual([49, 49]);
    expect(detectPatterns(people.reverse(), [])[0]?.id).toBe(pattern?.id);
  });
});
