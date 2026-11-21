import type { Edge, Node } from "@xyflow/react";
import { GEN_GAP, NODE_W } from "@/lib/geno/build";
import { generationTitle, spatialPersonLabel, type SpatialBranch } from "./genogram-spatial-layout";
import type { PersonNodeData } from "./person-node";

export type Vec3 = { x: number; y: number; z: number };
export type OrbitAngles = { yaw: number; pitch: number };
export type OrbitFrame = { width: number; height: number };
export type OrbitCamera = OrbitAngles & {
  target: Vec3;
  distance: number;
  zoom: number;
  panX: number;
  panY: number;
};

export type OrbitPerson = {
  id: string;
  data: PersonNodeData;
  generation: number;
  branch: SpatialBranch;
  world: Vec3;
  name: string;
  relationship: string;
};

export type OrbitGeneration = {
  generation: number;
  label: string;
  corners: Vec3[];
};

export type OrbitRoute = {
  id: string;
  kind: "partner" | "pedigree" | "social";
  unionId?: string;
  relationshipId?: string;
  personId?: string;
  personIds: string[];
  childId?: string;
  parentIds?: readonly string[];
  branch: SpatialBranch;
  suggested: boolean;
  points: Vec3[];
};

type OrbitModel = {
  people: OrbitPerson[];
  generations: OrbitGeneration[];
  routes: OrbitRoute[];
};

type ProjectedPoint = { x: number; y: number; depth: number; scale: number; visible: boolean };

export const ORBIT_MAX_PITCH = Math.PI * 0.29;
export const ORBIT_FRONT_ANGLES: OrbitAngles = { yaw: 0, pitch: 0 };
export const ORBIT_DEFAULT_ANGLES: OrbitAngles = { yaw: 0.28, pitch: 0.31 };
const ROW_SPACING = 220;
const WORLD_X_SCALE = 0.66;
const PLANE_PADDING = 72;
const NEAR = 20;

const branchFor = (branch: unknown): SpatialBranch =>
  branch === "paternal" || branch === "maternal" ? branch : "common";

function centerOf(points: readonly Vec3[]): Vec3 {
  if (!points.length) return { x: 0, y: 0, z: 0 };
  const min = { ...points[0] };
  const max = { ...min };
  for (const point of points) {
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
  }
  return {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
}

function generationPlane(row: OrbitPerson[]): OrbitGeneration {
  const { generation, world, data } = row[0];
  const end = row.at(-1)!.world;
  const runX = end.x - world.x;
  const runZ = end.z - world.z;
  const stretch = Math.hypot(runX, runZ);
  const alongX = stretch ? runX / stretch : 1;
  const alongZ = stretch ? runZ / stretch : 0;
  const projected = row.map(({ world: point }) => ({
    along: point.x * alongX + point.z * alongZ,
    across: point.z * alongX - point.x * alongZ,
  }));
  const left = Math.min(...projected.map(({ along }) => along)) - PLANE_PADDING;
  const right = Math.max(...projected.map(({ along }) => along)) + PLANE_PADDING;
  const back = Math.min(...projected.map(({ across }) => across)) - PLANE_PADDING;
  const front = Math.max(...projected.map(({ across }) => across)) + PLANE_PADDING;
  const y = world.y + 34;
  const corner = (along: number, across: number) => ({
    x: along * alongX - across * alongZ,
    y,
    z: along * alongZ + across * alongX,
  });
  return {
    generation,
    label: generationTitle(generation, data.lane),
    corners: [corner(left, back), corner(right, back), corner(right, front), corner(left, front)],
  };
}

export function buildOrbitModel(nodes: Node[], edges: Edge[]): OrbitModel {
  const visibleNodes = nodes.filter((node) => !node.hidden);
  const visibleEdges = edges.filter((edge) => !edge.hidden);
  const originX =
    visibleNodes.find((node) => node.type === "person" && node.data.is_proband)?.position.x ?? 0;
  const rows = new Map<number, OrbitPerson[]>();
  for (const node of visibleNodes) {
    if (node.type !== "person") continue;
    const data = node.data as PersonNodeData;
    const generation =
      typeof data.generation === "number" && Number.isFinite(data.generation)
        ? data.generation
        : node.position.y / GEN_GAP;
    const row = rows.get(generation) ?? [];
    const world = {
      x: (node.position.x - originX) * WORLD_X_SCALE * (generation === 0 ? 1.35 : 1),
      y: generation * ROW_SPACING,
      z: 0,
    };
    row.push({
      id: node.id,
      data,
      generation,
      branch: branchFor(data.branchId),
      world,
      ...spatialPersonLabel(data),
    });
    rows.set(generation, row);
  }

  const generations = [...rows]
    .sort(([a], [b]) => a - b)
    .map(([generation, row]) => {
      row.sort((a, b) => a.world.x - b.world.x || a.id.localeCompare(b.id));
      const spread = generation === 0 ? 46 : 38;
      const branchOffset = generation === 0 ? 0 : 108 + Math.min(generation, 5) * 29;
      for (let index = 0; index < row.length; index++) {
        const person = row[index];
        const side = { paternal: -1, maternal: 1, common: 0 }[person.branch];
        const rank = index - (row.length - 1) / 2;
        // Stagger neighboring families in depth so no single bearing can
        // collapse an entire generation onto the same line of sight.
        const stagger = Math.sin(index * 2.35 + generation * 0.85) * 33;
        person.world.z = side * branchOffset + rank * spread + stagger;
      }
      return generationPlane(row);
    });

  const people = [...rows.values()].flat();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const partnersByUnion = new Map<string, OrbitPerson[]>();
  for (const edge of visibleEdges) {
    if (edge.type !== "partner") continue;
    const unionId = String(edge.data?.unionId ?? edge.target);
    const person = peopleById.get(String(edge.data?.personId ?? edge.source));
    if (!person) continue;
    const partners = partnersByUnion.get(unionId) ?? [];
    if (!partners.some(({ id }) => id === person.id)) partners.push(person);
    partnersByUnion.set(unionId, partners);
  }
  const unions = new Map(
    visibleNodes
      .filter((node) => node.type === "union")
      .map((node) => {
        const partners = partnersByUnion.get(node.id) ?? [];
        const generation =
          typeof node.data.generation === "number"
            ? node.data.generation
            : (partners[0]?.generation ?? (node.position.y - NODE_W / 2) / GEN_GAP);
        const center = centerOf(partners.map(({ world }) => world));
        const sides = new Set(partners.map(({ branch }) => branch));
        const recordedBranch = branchFor(node.data.branchId);
        const branch =
          recordedBranch === "common" && sides.size === 1
            ? (partners[0]?.branch ?? "common")
            : recordedBranch;
        return [
          node.id,
          {
            partners,
            branch,
            world: {
              x: partners.length ? center.x : (node.position.x - originX) * WORLD_X_SCALE,
              y: generation * ROW_SPACING,
              z: center.z,
            },
          },
        ];
      }),
  );

  const routes: OrbitRoute[] = [];
  for (const edge of visibleEdges) {
    if (edge.type === "partner") {
      const unionId = String(edge.data?.unionId ?? edge.target);
      const person = peopleById.get(String(edge.data?.personId ?? edge.source));
      const union = unions.get(unionId);
      if (!person || !union) continue;
      routes.push({
        id: edge.id,
        kind: "partner",
        unionId,
        personId: person.id,
        relationshipId:
          typeof edge.data?.relationshipId === "string" ? edge.data.relationshipId : undefined,
        personIds: union.partners.map(({ id }) => id),
        branch: union.branch,
        suggested: false,
        points: [person.world, union.world],
      });
    } else if (edge.type === "pedigree") {
      const unionId = String(edge.data?.unionId ?? edge.source);
      const union = unions.get(unionId);
      if (!union) continue;
      const childIds: string[] = Array.isArray(edge.data?.childIds)
        ? [...new Set(edge.data.childIds.map(String))]
        : [edge.target];
      const suggested = new Set(
        Array.isArray(edge.data?.suggestedChildIds) ? edge.data.suggestedChildIds.map(String) : [],
      );
      const parentIds = union.partners.map(({ id }) => id);
      for (const childId of childIds) {
        const child = peopleById.get(childId);
        if (!child) continue;
        const y = (union.world.y + child.world.y) / 2;
        routes.push({
          id: `${edge.id}-${child.id}`,
          kind: "pedigree",
          unionId,
          personId: child.id,
          personIds: [child.id, ...parentIds],
          childId: child.id,
          parentIds,
          branch: union.branch,
          suggested: suggested.has(child.id),
          points: [child.world, { ...child.world, y }, { ...union.world, y }, union.world],
        });
      }
    } else if (
      edge.data?.relationshipType === "emotional" ||
      edge.data?.relationshipType === "sibling"
    ) {
      const from = peopleById.get(edge.source);
      const to = peopleById.get(edge.target);
      if (!from || !to) continue;
      routes.push({
        id: edge.id,
        kind: "social",
        relationshipId: edge.id,
        personIds: [from.id, to.id],
        branch: from.branch === to.branch ? from.branch : "common",
        suggested: false,
        points: [
          from.world,
          {
            x: (from.world.x + to.world.x) / 2,
            y: (from.world.y + to.world.y) / 2 - 32,
            z: (from.world.z + to.world.z) / 2,
          },
          to.world,
        ],
      });
    }
  }

  return { people, generations, routes };
}

function viewTransform(camera: OrbitAngles & { target: Vec3 }) {
  const pitch = Math.max(-ORBIT_MAX_PITCH, Math.min(ORBIT_MAX_PITCH, camera.pitch));
  const sinYaw = Math.sin(camera.yaw);
  const cosYaw = Math.cos(camera.yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  return (world: Vec3): Vec3 => {
    const worldX = world.x - camera.target.x;
    const worldY = world.y - camera.target.y;
    const worldZ = world.z - camera.target.z;
    const x = worldX * cosYaw + worldZ * sinYaw;
    const depth = worldZ * cosYaw - worldX * sinYaw;
    return {
      x,
      y: worldY * cosPitch + depth * sinPitch,
      z: depth * cosPitch - worldY * sinPitch,
    };
  };
}

function focalLength(frame: OrbitFrame) {
  return Math.max(1, Math.min(frame.width, frame.height) * 1.16);
}

function projector(camera: OrbitCamera, frame: OrbitFrame) {
  const transform = viewTransform(camera);
  const focal = focalLength(frame) * camera.zoom;
  return (world: Vec3): ProjectedPoint => {
    const point = transform(world);
    const depth = camera.distance - point.z;
    const scale = focal / Math.max(NEAR, depth);
    return {
      x: frame.width / 2 + camera.panX + point.x * scale,
      y: frame.height / 2 + camera.panY + point.y * scale,
      depth,
      scale,
      visible: depth >= NEAR,
    };
  };
}

export function projectOrbitPoint(point: Vec3, camera: OrbitCamera, frame: OrbitFrame) {
  return projector(camera, frame)(point);
}

function safePitch(model: OrbitModel, camera: OrbitCamera): number {
  const maximum = Math.max(-ORBIT_MAX_PITCH, Math.min(ORBIT_MAX_PITCH, camera.pitch));
  const root = model.people.filter(({ generation }) => generation === 0);
  if (!maximum || !root.length) return maximum;

  function topVisible(pitch: number) {
    const transform = viewTransform({ ...camera, pitch });
    let bottomOfTop = -Infinity;
    let topOfRest = Infinity;
    for (const person of model.people) {
      const point = transform(person.world);
      const depth = camera.distance - point.z;
      if (depth < NEAR) continue;
      const y = point.y / depth;
      if (person.generation === 0) bottomOfTop = Math.max(bottomOfTop, y);
      else topOfRest = Math.min(topOfRest, y);
    }
    return bottomOfTop <= topOfRest;
  }
  if (topVisible(maximum)) return maximum;

  // Keep the actual camera level at the top if its tilt would make a
  // nearer ancestor appear above the consultante. Azimuth remains unlimited.
  let lower = 0;
  let upper = 1;
  for (let step = 0; step < 12; step++) {
    const sample = (lower + upper) / 2;
    if (topVisible(maximum * sample)) lower = sample;
    else upper = sample;
  }
  return maximum * lower;
}

export function fitOrbitCamera(
  model: OrbitModel,
  frame: OrbitFrame,
  angles: OrbitAngles = ORBIT_DEFAULT_ANGLES,
  focusPersonIds?: readonly string[],
): OrbitCamera {
  const focusIds = new Set(focusPersonIds);
  const focus = model.people.filter(({ id }) => focusIds.has(id));
  const points = focus.length
    ? focus.map(({ world }) => world)
    : [
        ...model.people.map(({ world }) => world),
        ...model.generations.flatMap(({ corners }) => corners),
      ];
  const target = centerOf(points);
  const focal = focalLength(frame);
  const usableX = Math.max(20, frame.width / 2 - 36);
  const usableY = Math.max(20, frame.height / 2 - 41);
  const fitAt = (pitch: number) => {
    const transform = viewTransform({ ...angles, pitch, target });
    let distance = focal * (focus.length ? 0.93 : 1.1);
    for (const world of points) {
      const point = transform(world);
      distance = Math.max(
        distance,
        point.z +
          Math.max(
            NEAR,
            (Math.abs(point.x) * focal) / usableX,
            (Math.abs(point.y) * focal) / usableY,
          ),
      );
    }
    return distance;
  };
  const distance = Math.max(fitAt(angles.pitch), fitAt(0));
  const camera = { ...angles, target, distance, zoom: 1, panX: 0, panY: 0 };
  if (points.length < 2) return camera;

  const pitch = safePitch(model, camera);
  const project = projector({ ...camera, pitch }, frame);
  const projected = points.map(project);
  const left = Math.min(...projected.map(({ x }) => x));
  const right = Math.max(...projected.map(({ x }) => x));
  const top = Math.min(...projected.map(({ y }) => y));
  const bottom = Math.max(...projected.map(({ y }) => y));
  const zoom = Math.min(
    1.5,
    (usableX * 2) / Math.max(1, right - left),
    (usableY * 2) / Math.max(1, bottom - top),
  );
  return {
    ...camera,
    zoom,
    panX: ((frame.width - left - right) / 2) * zoom,
    panY: ((frame.height - top - bottom) / 2) * zoom,
  };
}

function svgPath(points: ProjectedPoint[], close = false) {
  let result = "";
  let penDown = false;
  for (const { x, y, visible } of points) {
    if (!visible) {
      penDown = false;
      continue;
    }
    result += `${penDown ? " L" : " M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    penDown = true;
  }
  return result.trim() + (close && points.every(({ visible }) => visible) ? " Z" : "");
}

export function projectOrbitScene(model: OrbitModel, camera: OrbitCamera, frame: OrbitFrame) {
  const pitch = safePitch(model, camera);
  const project = projector({ ...camera, pitch }, frame);
  const backToFront = (a: { depth: number }, b: { depth: number }) => b.depth - a.depth;
  const people = model.people
    .map((person) => ({ ...person, ...project(person.world) }))
    .sort(backToFront);
  const generations = model.generations
    .map((generation) => {
      const points = generation.corners.map(project);
      const anchor = points.reduce((left, point) =>
        point.visible && (!left.visible || point.x < left.x) ? point : left,
      );
      return {
        ...generation,
        x: anchor.x,
        y: anchor.y,
        depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
        visible: points.every(({ visible }) => visible),
        d: svgPath(points, true),
      };
    })
    .sort(backToFront);
  const routes = model.routes
    .map((route) => {
      const points = route.points.map(project);
      return {
        ...route,
        depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length,
        visible: points.some((point, index) => point.visible && points[index - 1]?.visible),
        d: svgPath(points),
      };
    })
    .sort(backToFront);
  return { people, generations, routes, pitch };
}
