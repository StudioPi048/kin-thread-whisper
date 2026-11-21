// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { consultanteFamily } from "@/lib/geno/fixtures";
import { validateGraph } from "@/lib/geno/build";
import { buildRenderGraph } from "./render-graph";
import { buildSpatialLayout, projectSpatialLayout } from "./genogram-spatial-layout";
import { GenogramPrintPreview } from "./genogram-print-preview";

afterEach(cleanup);

it("inclui a cadeia dos ancestrais compartilhados nas páginas dos dois ramos", () => {
  const { persons, rels, probandId } = consultanteFamily();
  const paternal = persons.find(({ full_name }) => full_name === "Avô paterno")!;
  const maternal = persons.find(({ full_name }) => full_name === "Avô materno")!;
  const child = {
    ...paternal,
    id: "shared-first",
    full_name: "Ancestral Comum Um",
    relationship_to_proband: null,
  };
  const parent = { ...child, id: "shared-second", full_name: "Ancestral Comum Dois" };
  const parentLink = (from: string, to: string) => ({
    ...rels[0],
    id: `shared:${from}:${to}`,
    relationship_type: "parent",
    qualifier: "biological",
    from_person_id: from,
    to_person_id: to,
  });
  const otherLinks = rels.filter(
    ({ relationship_type, to_person_id }) =>
      relationship_type !== "parent" || ![paternal.id, maternal.id].includes(to_person_id),
  );
  const { graph, nodes, edges } = buildRenderGraph(
    [...persons, child, parent],
    [
      ...otherLinks,
      parentLink(child.id, paternal.id),
      parentLink(child.id, maternal.id),
      parentLink(parent.id, child.id),
    ],
    probandId,
  );
  expect(graph.persons.get(child.id)?.branchId).toBe("other");
  expect(graph.persons.get(parent.id)?.branchId).toBe("other");
  render(<GenogramPrintPreview open onOpenChange={vi.fn()} nodes={nodes} edges={edges} />);
  fireEvent.change(screen.getByLabelText("Organização"), { target: { value: "branches" } });
  for (const name of ["Genossociograma", "Ramo paterno", "Ramo materno"]) {
    const page = screen.getByRole("img", { name });
    expect(within(page).getByText(child.full_name, { exact: false })).toBeTruthy();
    expect(within(page).getByText(parent.full_name, { exact: false })).toBeTruthy();
  }
});

it("desenha duas uniões distintas e preserva a filiação confirmada sem escolher um casamento", () => {
  const { persons, rels, probandId } = consultanteFamily();
  const father = persons.find(({ full_name }) => full_name === "Pai")!;
  const mother = persons.find(({ full_name }) => full_name === "Mãe")!;
  const samePair = (from: string, to: string) =>
    [father.id, mother.id].includes(from) && [father.id, mother.id].includes(to);
  const first = rels.find(
    (rel) => rel.relationship_type === "union" && samePair(rel.from_person_id, rel.to_person_id),
  )!;
  const records = [
    { ...first, marriage_order: 1 },
    { ...first, id: "later-union", marriage_order: 2 },
  ];
  const base = buildRenderGraph(persons, rels, probandId);
  const { graph, nodes, edges } = buildRenderGraph(
    persons,
    [...rels.filter(({ id }) => id !== first.id), ...records],
    probandId,
  );
  expect(validateGraph(graph).ok).toBe(true);
  const layout = (items: typeof nodes) =>
    items.filter(({ type }) => type === "person").map(({ id, position }) => [id, position]);
  expect(layout(nodes)).toEqual(layout(base.nodes));
  const represented = [...graph.unions.values()].filter((union) =>
    samePair(union.partners[0], union.partners[1]),
  );
  expect(represented).toHaveLength(3);
  expect(represented.find(({ relationshipId }) => !relationshipId)?.children).toContain(probandId);
  expect(
    represented
      .filter(({ relationshipId }) => relationshipId)
      .every(({ children }) => !children.length),
  ).toBe(true);
  const twoDimensional = nodes.filter(({ data }) =>
    records.some(({ id }) => id === data.relationshipId),
  );
  expect(new Set(twoDimensional.map(({ position }) => position.y)).size).toBe(2);
  const projected = projectSpatialLayout(buildSpatialLayout(nodes, edges), { yaw: 0, pitch: 0 });
  const hubs = projected.unions.filter(({ id }) => records.some((row) => id === `union:${row.id}`));
  expect(new Set(hubs.map(({ y }) => y)).size).toBe(2);
  render(<GenogramPrintPreview open onOpenChange={vi.fn()} nodes={nodes} edges={edges} />);
  const page = screen.getByRole("img", { name: "Genossociograma" });
  expect(within(page).getByText("1º casamento")).toBeTruthy();
  expect(within(page).getByText("2º casamento")).toBeTruthy();
});
