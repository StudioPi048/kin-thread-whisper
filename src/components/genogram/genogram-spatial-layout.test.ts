import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { GEN_GAP, PERSON_SHAPE } from "@/lib/geno/build";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  SPATIAL_CARD_HEIGHT,
  SPATIAL_CARD_WIDTH,
  SPATIAL_MAX_YAW,
} from "./genogram-spatial-layout";

function person(id: string, x: number, generation: number): Node {
  return {
    id,
    type: "person",
    position: { x, y: generation * GEN_GAP },
    data: { full_name: id, is_proband: id === "consultante", is_deceased: false },
  };
}

function union(id: string, x: number, generation: number): Node {
  return {
    id,
    type: "union",
    position: { x, y: generation * GEN_GAP + PERSON_SHAPE / 2 },
    data: {},
  };
}

function pedigree(source: string, childIds: string[]): Edge {
  return { id: source, type: "pedigree", source, target: childIds[0], data: { childIds } };
}

describe("spatial genossociograma", () => {
  it("orbits in depth without changing generation coordinates or saved node positions", () => {
    const nodes = [
      person("consultante", 0, 0),
      person("irmã", 0, 0),
      person("mãe", 0, 1),
      person("avó", 0, 2),
      person("bisavô", 0, 3),
    ];
    const original = structuredClone(nodes);
    const layout = buildSpatialLayout(nodes, []);
    const left = projectSpatialLayout(layout, -SPATIAL_MAX_YAW);
    const right = projectSpatialLayout(layout, SPATIAL_MAX_YAW);

    const expected = [0, 0, GEN_GAP, GEN_GAP * 2, GEN_GAP * 3];
    expect(left.people.map(({ y }) => y)).toEqual(expected);
    expect(right.people.map(({ y }) => y)).toEqual(expected);
    expect(left.people.at(-1)?.x).not.toBe(right.people.at(-1)?.x);
    expect(Math.abs(left.people[1].x - left.people[0].x)).toBeGreaterThan(SPATIAL_CARD_WIDTH);
    expect(nodes).toEqual(original);
  });

  it("draws separate rails for overlapping unions and leaves unrelated people disconnected", () => {
    const nodes = [
      person("avô", -360, 2),
      person("irmão do avô", 360, 2),
      person("avó", -150, 2),
      person("irmã da avó", 150, 2),
      person("sem filiação", 800, 2),
      union("bisavós do avô", 28, 3),
      union("bisavós da avó", 35, 3),
    ];
    const edges = [
      pedigree("bisavós do avô", ["avô", "irmão do avô"]),
      pedigree("bisavós da avó", ["avó", "irmã da avó"]),
    ];
    const result = projectSpatialLayout(buildSpatialLayout(nodes, edges), SPATIAL_MAX_YAW, "avô");
    const [paternal, maternal] = result.routes;
    const personById = new Map(result.people.map((entry) => [entry.id, entry]));
    const endsAt = (id: string) =>
      `L ${personById.get(id)!.x} ${GEN_GAP * 2 + SPATIAL_CARD_HEIGHT}`;
    expect(paternal.path).toContain(endsAt("irmão do avô"));
    expect(paternal.path).not.toContain(endsAt("irmã da avó"));
    expect(maternal.path).toContain(endsAt("irmã da avó"));
    for (const route of result.routes) expect(route.path).not.toContain(endsAt("sem filiação"));
    expect(paternal.highlighted).toBe(true);
    expect(maternal.highlighted).toBe(false);

    // There must be a distinct Y for the horizontal bar of each sibling group.
    const endOfBarY = (path: string) => Number(path.split(" M ")[1].split(" ").at(-1));
    expect(endOfBarY(paternal.path)).not.toBe(endOfBarY(maternal.path));
  });

  it("keeps biological and adoptive children of the same union in distinct rails", () => {
    const nodes = [
      person("biological", -190, 1),
      person("adopted", 190, 1),
      union("parents", 70, 2),
    ];
    const edge = pedigree("parents", ["biological", "adopted"]);
    edge.data = { ...edge.data, childKinds: { biological: "biological", adopted: "adoptive" } };
    const result = projectSpatialLayout(buildSpatialLayout(nodes, [edge]), SPATIAL_MAX_YAW);
    const [biological, adopted] = result.routes;
    expect(biological.parentKind).toBe("biological");
    expect(adopted.parentKind).toBe("adoptive");
    const endOfBarY = (path: string) => Number(path.split(" M ")[1].split(" ").at(-1));
    expect(endOfBarY(biological.path)).not.toBe(endOfBarY(adopted.path));
  });
});
