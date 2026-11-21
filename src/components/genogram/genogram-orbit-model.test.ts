import { describe, expect, it } from "vitest";
import { consultanteFamily } from "@/lib/geno/fixtures";
import { buildRenderGraph } from "./render-graph";
import {
  buildOrbitModel,
  fitOrbitCamera,
  ORBIT_DEFAULT_ANGLES,
  ORBIT_FRONT_ANGLES,
  ORBIT_MAX_PITCH,
  projectOrbitScene,
} from "./genogram-orbit-model";

function caseModels(generations: number) {
  const family = consultanteFamily(generations);
  const { graph, nodes, edges } = buildRenderGraph(family.persons, family.rels, family.probandId);
  return { family, graph, nodes, edges, orbit: buildOrbitModel(nodes, edges) };
}

describe("órbita do genossociograma", () => {
  it("conserva todas as pessoas e representa os vínculos pelos IDs do grafo", () => {
    const { family, graph, nodes, edges, orbit } = caseModels(4);
    const baseline = structuredClone({ nodes, edges });
    expect(orbit.people).toHaveLength(35);
    expect(new Map(orbit.people.map((person) => [person.id, person.name]))).toEqual(
      new Map(family.persons.map(({ id, full_name }) => [id, full_name])),
    );
    expect(
      new Set(orbit.people.filter(({ generation }) => generation === 0).map(({ id }) => id)),
    ).toEqual(graph.topRowIds);

    for (const route of orbit.routes) {
      if (route.kind === "social") continue;
      const union = graph.unions.get(route.unionId!)!;
      expect(union).toBeDefined();
      if (route.kind === "partner") {
        expect(union.partners).toContain(route.personId);
        expect(route.points[0]).toEqual(
          orbit.people.find(({ id }) => id === route.personId)?.world,
        );
      } else {
        expect(union.children).toContain(route.childId);
        expect(route.parentIds).toEqual(union.partners);
        expect(route.personIds).toEqual([route.childId, ...union.partners]);
      }
    }
    const coveredChildren = orbit.routes.filter(({ kind }) => kind === "pedigree");
    expect(coveredChildren).toHaveLength(
      [...graph.unions.values()].reduce((total, { children }) => total + children.length, 0),
    );

    // Projecting new angles must never rewrite a saved person coordinate or an edge.
    const frame = { width: 1200, height: 710 };
    projectOrbitScene(orbit, fitOrbitCamera(orbit, frame), frame);
    expect({ nodes, edges }).toEqual(baseline);
  });

  it("isola a filiação sugerida dentro de uma fratria", () => {
    const { family, nodes, edges } = caseModels(4);
    const edge = edges.find(
      ({ data, type }) =>
        type === "pedigree" &&
        Array.isArray(data?.childIds) &&
        data.childIds.includes(family.probandId),
    )!;
    const [suggested] = (edge.data!.childIds as string[]).filter((id) => id !== family.probandId);
    const orbit = buildOrbitModel(
      nodes,
      edges.map((candidate) =>
        candidate === edge
          ? { ...candidate, data: { ...candidate.data, suggestedChildIds: [suggested] } }
          : candidate,
      ),
    );
    const rootGroup = orbit.routes.filter(
      ({ kind, unionId }) => kind === "pedigree" && unionId === edge.data!.unionId,
    );
    expect(rootGroup).toHaveLength(3);
    expect(rootGroup.filter(({ suggested }) => suggested).map(({ childId }) => childId)).toEqual([
      suggested,
    ]);
  });

  it.each([
    { rows: 4, total: 35, frame: { width: 1440, height: 780 } },
    { rows: 4, total: 35, frame: { width: 390, height: 630 } },
    { rows: 6, total: 131, frame: { width: 390, height: 630 } },
  ])("conserva o topo em uma volta inteira com $total familiares", ({ rows, total, frame }) => {
    const { orbit } = caseModels(rows);
    const top = orbit.people.filter(({ generation }) => generation === 0);
    expect(top.map(({ name }) => name).sort()).toEqual(["Consultante", "Irmã", "Irmão"]);
    expect(orbit.people).toHaveLength(total);
    const overview = fitOrbitCamera(orbit, frame);
    for (let turn = 0; turn <= 24; turn++) {
      const yaw = (turn * Math.PI) / 12;
      for (const pitch of [-ORBIT_MAX_PITCH, 0, ORBIT_MAX_PITCH]) {
        const camera = fitOrbitCamera(orbit, frame, { yaw, pitch });
        const scene = projectOrbitScene(orbit, camera, frame);
        expect(scene.people).toHaveLength(total);
        expect(
          scene.people.every(
            (p) => p.visible && [p.x, p.y, p.depth, p.scale].every(Number.isFinite),
          ),
        ).toBe(true);
        expect(
          scene.people.every(
            ({ x, y }) => x >= 8 && x <= frame.width - 8 && y >= 8 && y <= frame.height - 8,
          ),
        ).toBe(true);
        const heads = scene.people.filter(({ generation }) => generation === 0);
        const ancestors = scene.people.filter(({ generation }) => generation > 0);
        expect(Math.max(...heads.map(({ y }) => y))).toBeLessThanOrEqual(
          Math.min(...ancestors.map(({ y }) => y)),
        );
        const dragged = projectOrbitScene(orbit, { ...overview, yaw, pitch }, frame);
        const draggedHeads = dragged.people.filter(
          ({ generation, visible }) => generation === 0 && visible,
        );
        const draggedAncestors = dragged.people.filter(
          ({ generation, visible }) => generation > 0 && visible,
        );
        expect(draggedHeads).toHaveLength(top.length);
        expect(Math.max(...draggedHeads.map(({ y }) => y))).toBeLessThanOrEqual(
          Math.min(...draggedAncestors.map(({ y }) => y)),
        );
      }
    }
  });

  it("aplica parallax e perspectiva real nas pessoas e nos planos horizontais", () => {
    const { orbit } = caseModels(4);
    const frame = { width: 1440, height: 780 };
    const frontal = projectOrbitScene(
      orbit,
      fitOrbitCamera(orbit, frame, ORBIT_FRONT_ANGLES),
      frame,
    );
    const perspective = projectOrbitScene(
      orbit,
      fitOrbitCamera(orbit, frame, ORBIT_DEFAULT_ANGLES),
      frame,
    );
    const rear = projectOrbitScene(
      orbit,
      fitOrbitCamera(orbit, frame, { yaw: Math.PI, pitch: 0 }),
      frame,
    );
    const father = orbit.people.find(({ name }) => name === "Pai")!;
    const mother = orbit.people.find(({ name }) => name === "Mãe")!;
    expect(father.world.z).toBeLessThan(mother.world.z);
    const x = (scene: typeof frontal, id: string) =>
      scene.people.find((person) => person.id === id)!.x;
    expect(x(frontal, father.id)).toBeLessThan(x(frontal, mother.id));
    expect(x(rear, father.id)).toBeGreaterThan(x(rear, mother.id));
    expect(new Set(perspective.people.map(({ scale }) => scale)).size).toBeGreaterThan(5);
    expect(perspective.generations.every(({ d }) => d.startsWith("M ") && d.endsWith(" Z"))).toBe(
      true,
    );
    expect(
      perspective.generations.every(
        ({ sideFaces }) =>
          sideFaces.length === 4 &&
          sideFaces.every((face) => face.startsWith("M ") && face.endsWith(" Z")),
      ),
    ).toBe(true);
    expect(perspective.people[0].depth).toBeGreaterThan(perspective.people.at(-1)!.depth);
    expect(perspective.pitch).not.toBe(0);
  });

  it("centraliza um familiar na aproximação sem excluir o restante do modelo", () => {
    const { orbit } = caseModels(4);
    const selected = orbit.people.find(({ name }) => name === "Pai")!;
    const frame = { width: 390, height: 630 };
    const camera = fitOrbitCamera(orbit, frame, ORBIT_DEFAULT_ANGLES, [selected.id]);
    const scene = projectOrbitScene(orbit, camera, frame);
    const target = scene.people.find(({ id }) => id === selected.id)!;
    expect(scene.people).toHaveLength(35);
    expect(target.x).toBeCloseTo(frame.width / 2);
    expect(target.y).toBeCloseTo(frame.height / 2);
    expect(target.scale).toBeGreaterThan(1);
  });

  it("reserva espaço para os dois nomes no enquadramento dos avós em 390 px", () => {
    const { orbit } = caseModels(4);
    const frame = { width: 390, height: 500 };
    const grandparents = orbit.people
      .filter(({ generation, branch }) => generation === 2 && branch === "paternal")
      .map(({ id }) => id);
    const camera = fitOrbitCamera(orbit, frame, ORBIT_DEFAULT_ANGLES, grandparents);
    const scene = projectOrbitScene(orbit, camera, frame);
    const focused = scene.people.filter(({ id }) => grandparents.includes(id));
    expect(focused).toHaveLength(2);
    for (const { x, scale } of focused) {
      const halfWidth = Math.min(106, 79 * scale);
      expect(x - halfWidth).toBeGreaterThanOrEqual(10);
      expect(x + halfWidth).toBeLessThanOrEqual(frame.width - 10);
    }
  });
});
