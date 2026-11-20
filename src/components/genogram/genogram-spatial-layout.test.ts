import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { GEN_GAP, PERSON_SHAPE } from "@/lib/geno/build";
import { renderSpatialRoutes } from "./genogram-spatial-crossings";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  SPATIAL_CARD_WIDTH,
  SPATIAL_MAX_YAW,
  SPATIAL_ROW_GAP,
  SPATIAL_MAX_PITCH,
  spatialPersonLabel,
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

function partner(personId: string, unionId: string): Edge {
  return {
    id: `${personId}-${unionId}`,
    type: "partner",
    source: personId,
    target: unionId,
    data: { personId, unionId },
  };
}

describe("spatial genossociograma", () => {
  it("orbits the people on a single plane without changing their generations or saved positions", () => {
    const nodes = [
      person("consultante", 0, 0),
      person("irmã", 0, 0),
      person("mãe", 0, 1),
      person("avó", 0, 2),
      person("bisavô", 0, 3),
    ];
    const original = structuredClone(nodes);
    const layout = buildSpatialLayout(nodes, []);
    const left = projectSpatialLayout(layout, { yaw: -SPATIAL_MAX_YAW, pitch: 0 });
    const right = projectSpatialLayout(layout, { yaw: SPATIAL_MAX_YAW, pitch: SPATIAL_MAX_PITCH });

    const expected = [0, 0, SPATIAL_ROW_GAP, SPATIAL_ROW_GAP * 2, SPATIAL_ROW_GAP * 3];
    expect(left.people.map(({ y }) => y)).toEqual(expected);
    expect(right.people.map(({ y }) => y)).toEqual(expected);
    expect(right.people.every(({ z }) => z === 0)).toBe(true);
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
    const result = projectSpatialLayout(
      buildSpatialLayout(nodes, edges),
      { yaw: SPATIAL_MAX_YAW, pitch: 0 },
      "avô",
    );
    const [paternal, maternal] = result.routes;
    const personById = new Map(result.people.map((entry) => [entry.id, entry]));
    const endsAt = (id: string) => {
      const { x, y, height } = personById.get(id)!;
      return `L ${x} ${y + height}`;
    };
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
    const result = projectSpatialLayout(buildSpatialLayout(nodes, [edge]), {
      yaw: SPATIAL_MAX_YAW,
      pitch: 0,
    });
    const [biological, adopted] = result.routes;
    expect(biological.parentKind).toBe("biological");
    expect(adopted.parentKind).toBe("adoptive");
    const endOfBarY = (path: string) => Number(path.split(" M ")[1].split(" ").at(-1));
    expect(endOfBarY(biological.path)).not.toBe(endOfBarY(adopted.path));
  });
  it("keeps tentative sibling links visually separate from a recorded union", () => {
    const nodes = [
      person("confirmed", -200, 1),
      person("tentative", 200, 1),
      union("parents", 70, 2),
    ];
    const edge = pedigree("parents", ["confirmed", "tentative"]);
    edge.data = { ...edge.data, suggestedChildIds: ["tentative"] };
    const { routes } = projectSpatialLayout(buildSpatialLayout(nodes, [edge]), {
      yaw: SPATIAL_MAX_YAW,
      pitch: 0,
    });
    const [confirmed, tentative] = routes;
    expect([confirmed.suggested, tentative.suggested]).toEqual([false, true]);
    expect(confirmed.path).not.toBe(tentative.path);
  });

  it("separates genuinely crossed routes while maintaining the same people and child anchors", () => {
    const nodes = [
      person("filha de A", 340, 0),
      person("filho de B", -340, 0),
      union("A", -326, 1),
      union("B", 326, 1),
    ];
    const edges = [pedigree("A", ["filha de A"]), pedigree("B", ["filho de B"])];
    edges[1].data = { ...edges[1].data, suggestedChildIds: ["filho de B"] };
    const layout = buildSpatialLayout(nodes, edges);
    const flat = projectSpatialLayout(layout, { yaw: 0, pitch: 0 });
    const separated = projectSpatialLayout(layout, { yaw: 0, pitch: 0 }, null, {
      separateLinks: true,
    });
    expect(flat.bridgeCount).toBe(0);
    expect(separated.bridgeCount).toBeGreaterThan(0);
    expect(separated.people).toEqual(flat.people);
    expect(separated.unions).toEqual(flat.unions);
    expect(
      separated.routes.map(({ edge, unionId, childIds, suggested }) => ({
        edge,
        unionId,
        childIds,
        suggested,
      })),
    ).toEqual([
      { edge: edges[0], unionId: "A", childIds: ["filha de A"], suggested: false },
      { edge: edges[1], unionId: "B", childIds: ["filho de B"], suggested: true },
    ]);
    for (const route of separated.routes) {
      const child = separated.people.find(({ id }) => route.childIds?.includes(id))!;
      expect(route.path).toContain(`L ${child.x} ${child.y + child.height}`);
    }
    expect(separated.routes[0].bridgePaths[0]).toContain(" C ");
    expect(separated.routes[1].bridgePaths).toHaveLength(0);
    expect(separated.routes[1].path).toBe(flat.routes[1].path);
  });

  it("expands the same parent’s unions without moving any people or sharing the wrong children", () => {
    const nodes = [
      person("Cecília", -198, 1),
      person("Rita", 198, 1),
      person("Alberto", 0, 2),
      person("Aparecida", 0, 2),
      person("Helena", 0, 2),
      person("José", 460, 2),
      union("Alberto e Aparecida", 0, 2),
      union("Alberto e Helena", 0, 2),
      union("Aparecida e José", 0, 2),
    ];
    const edges = [
      partner("Alberto", "Alberto e Aparecida"),
      partner("Aparecida", "Alberto e Aparecida"),
      partner("Alberto", "Alberto e Helena"),
      partner("Helena", "Alberto e Helena"),
      partner("Aparecida", "Aparecida e José"),
      partner("José", "Aparecida e José"),
      pedigree("Alberto e Aparecida", ["Cecília"]),
      pedigree("Alberto e Helena", ["Rita"]),
    ];
    const inputs = structuredClone({ nodes, edges });
    const layout = buildSpatialLayout(nodes, edges);
    const angles = { yaw: 0, pitch: 0 };
    const original = projectSpatialLayout(layout, angles, "Alberto");
    const expanded = projectSpatialLayout(layout, angles, "Alberto", {
      expandedPersonId: "Alberto",
      separateLinks: true,
    });
    expect(expanded.people).toEqual(original.people);
    const [first, second, unrelated] = expanded.unions;
    expect([first.expanded, second.expanded, unrelated.expanded]).toEqual([true, true, false]);
    expect(first.partners).toEqual(["Alberto", "Aparecida"]);
    expect(second.partners).toEqual(["Alberto", "Helena"]);
    expect(first.z).not.toEqual(second.z);
    expect(Math.abs(first.x - second.x)).toBeGreaterThanOrEqual(32);
    expect(first.y).toBeLessThan(expanded.people.find(({ id }) => id === "Alberto")!.y);
    expect(second.y).toBeLessThan(expanded.people.find(({ id }) => id === "Alberto")!.y);
    expect(unrelated).toEqual(original.unions[2]);
    expect(expanded.routes.map(({ edge }) => edge)).toEqual(
      original.routes.map(({ edge }) => edge),
    );
    expect(
      expanded.routes
        .filter(({ childIds }) => childIds)
        .map(({ unionId, childIds }) => [unionId, childIds]),
    ).toEqual([
      [first.id, ["Cecília"]],
      [second.id, ["Rita"]],
    ]);
    expect(expanded.routes.find(({ id }) => id === edges[0].id)?.path).toContain(
      `L ${first.x} ${first.y}`,
    );
    expect(expanded.routes.find(({ id }) => id === edges[2].id)?.path).toContain(
      `L ${second.x} ${second.y}`,
    );
    expect({ nodes, edges }).toEqual(inputs);
  });

  it("separates overlapping tracks and ignores their genuine shared trunk and end joins", () => {
    const line = (id: string, start: number, end: number, unionId?: string) => ({
      id,
      unionId,
      priority: 0,
      strokes: [
        [
          { x: start, y: 0 },
          { x: end, y: 0 },
        ],
      ],
    });
    const first = line("a", 0, 100, "same");
    const sameUnion = line("b", 10, 90, "same");
    const joined = {
      id: "c",
      unionId: "same",
      priority: 0,
      strokes: [
        [
          { x: 65, y: 0 },
          { x: 65, y: 70 },
        ],
      ],
    };
    const unrelated = line("d", 30, 70, "different");
    const front = renderSpatialRoutes([first, sameUnion, joined], { x: 0, y: 0 });
    expect(front.every(({ bridgePaths }) => bridgePaths.length === 0)).toBe(true);
    const overlap = renderSpatialRoutes([first, unrelated], { x: 0, y: 0 });
    expect(overlap[0].bridgePaths).toHaveLength(1);
    expect(overlap[0].path).toBe("M 0 0 L 24 0 M 76 0 L 100 0");
    expect(overlap[1].path).toBe("M 30 0 L 70 0");
    const misleadingJoin = renderSpatialRoutes([first, { ...joined, unionId: "different" }], {
      x: 0,
      y: 0,
    });
    expect(misleadingJoin[0].bridgePaths).toHaveLength(1);
    expect(misleadingJoin[1].path).toBe("M 65 0 L 65 70");
  });

  it("keeps full names, reserves a taller plaque for them and preserves canonical row order", () => {
    const name = "Amélia de Santa Bárbara Martins e Albuquerque Brandão de Oliveira";
    const relationship = "Mãe da Avó Materna do Ramo da Sétima Geração";
    const first = person("first", -120, 1);
    first.data = {
      ...first.data,
      full_name: name,
      preferred_name: "Amélia",
      relationship_to_proband: relationship,
    };
    const second = person("second", -100, 1);
    const layout = buildSpatialLayout([second, first], []);
    const { people } = projectSpatialLayout(layout, {
      yaw: SPATIAL_MAX_YAW,
      pitch: SPATIAL_MAX_PITCH,
    });
    expect(spatialPersonLabel(people[0].data)).toEqual({ name, relationship });
    expect(people[0].height).toBeGreaterThan(people[1].height);
    expect(people[0].x + people[0].width / 2).toBeLessThan(people[1].x - people[1].width / 2);
  });
});
