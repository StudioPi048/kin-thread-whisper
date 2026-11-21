import { expect, it } from "vitest";
import { practiceFamily } from "@/lib/geno/fixtures";
import { buildOrbitModel } from "./genogram-orbit-model";
import { buildRenderGraph } from "./render-graph";
import { traceOrbitLineage } from "./genogram-orbit-lineage";

it("traces only the recorded route to the selected ancestor through the right unions", () => {
  const family = practiceFamily();
  const { nodes, edges } = buildRenderGraph(family.persons, family.rels, family.probandId);
  const { people, routes } = buildOrbitModel(nodes, edges);
  const relativeId = (role: string) => people.find(({ relationship }) => relationship === role)?.id;
  const grandfather = people.find(({ name }) => name === "Antônio José Nogueira")!.id;
  const father = relativeId("Pai")!;

  const marked = traceOrbitLineage(routes, family.probandId, grandfather);
  expect(
    routes
      .filter(({ id }) => marked.has(id))
      .map(({ personId }) => personId)
      .sort(),
  ).toEqual([grandfather, father, father, family.probandId].sort());
  expect(traceOrbitLineage(routes, family.probandId, relativeId("Meia-irmã"))).toEqual(new Set());

  const withProposedParent = routes.map((route) =>
    route.kind === "pedigree" && route.personId === father ? { ...route, suggested: true } : route,
  );
  expect(traceOrbitLineage(withProposedParent, family.probandId, grandfather)).toEqual(new Set());
});
