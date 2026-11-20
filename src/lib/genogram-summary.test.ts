import { describe, expect, it } from "vitest";
import { smallFamily } from "@/lib/geno/fixtures";
import { summarizeCaseGenogram } from "@/lib/genogram-summary";

describe("resumo do genossociograma da Agenda", () => {
  it("conta como avós apenas os pais dos pais ligados ao consulente", () => {
    const family = smallFamily();
    const [client, sibling, father, mother, grandfather, grandmother] = family.persons;
    const grandfatherSibling = {
      ...grandfather,
      id: "tio-avo",
      relationship_to_proband: "Irmã(o) do avô paterno",
    };
    const greatGrandfather = {
      ...grandfather,
      id: "bisavo",
      relationship_to_proband: "Bisavô paterno (pai do avô)",
    };
    const placeholder = {
      ...grandmother,
      id: "avo-materna-vazia",
      full_name: "",
      birth_date: null,
      death_date: null,
      relationship_to_proband: "Avó materna",
    };

    const summary = summarizeCaseGenogram(
      [...family.persons, grandfatherSibling, greatGrandfather, placeholder],
      [
        ...family.rels,
        {
          ...family.rels[0],
          id: "parent_avo",
          from_person_id: greatGrandfather.id,
          to_person_id: grandfather.id,
        },
      ],
    );

    expect(summary.totalPersons).toBe(8);
    expect(summary.generations.proband?.id).toBe(client.id);
    expect(summary.generations.siblings.map(({ id }) => id)).toEqual([sibling.id]);
    expect(new Set(summary.generations.parents.map(({ id }) => id))).toEqual(
      new Set([father.id, mother.id]),
    );
    expect(new Set(summary.generations.grandparents.map(({ id }) => id))).toEqual(
      new Set([grandfather.id, grandmother.id]),
    );
    expect(summary.alerts.some(({ message }) => message.includes("2/4 avós ligados"))).toBe(true);
  });
});
