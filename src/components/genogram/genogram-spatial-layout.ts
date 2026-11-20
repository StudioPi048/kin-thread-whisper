import type { Edge, Node } from "@xyflow/react";
import { GEN_GAP, NODE_W, PERSON_SHAPE, type ParentKind } from "@/lib/geno/build";
import type { PersonNodeData } from "./person-node";

export const SPATIAL_CARD_WIDTH = 158;
export const SPATIAL_CARD_HEIGHT = 114;
export const SPATIAL_MAX_YAW = (44 * Math.PI) / 180;
export const SPATIAL_DEFAULT_YAW = (30 * Math.PI) / 180;

const DEPTH_PER_ROW = 124;
const PLANE_DEPTH = 112;
const MIN_PERSON_SPACING = (SPATIAL_CARD_WIDTH + 20) / Math.cos(SPATIAL_MAX_YAW);
const CARD_HALF = SPATIAL_CARD_WIDTH / 2;
const CARD_MID_Y = SPATIAL_CARD_HEIGHT / 2;

type Point = { x: number; y: number };
type SpatialPoint = Point & { z: number };
type SpatialPerson = SpatialPoint & { id: string; data: PersonNodeData };
type SpatialUnion = SpatialPoint & { id: string; label?: string; kind?: string };
type Span = { left: number; right: number };

export const spatialDepth = (rowY: number) => (-rowY / GEN_GAP) * DEPTH_PER_ROW;

export function projectSpatialPoint(point: SpatialPoint, yaw: number): Point {
  // Orthographic yaw around the vertical axis. Card Y is independent of camera angle.
  return { x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw), y: point.y };
}

export function buildSpatialLayout(nodes: Node[], edges: Edge[]) {
  const rows = new Map<number, SpatialPerson[]>();
  const originalX = new Map<string, number>();
  for (const node of nodes) {
    if (node.hidden || node.type !== "person") continue;
    const { x, y } = node.position;
    const centerX = x + NODE_W / 2;
    const person = {
      id: node.id,
      x: centerX,
      y,
      z: spatialDepth(y),
      data: node.data as PersonNodeData,
    };
    const row = rows.get(y) ?? [];
    row.push(person);
    rows.set(y, row);
    originalX.set(node.id, centerX);
  }

  // The reading view can space crowded cards without moving a single saved 2D position.
  const orderedRows = [...rows].sort(([first], [second]) => first - second);
  for (const [, row] of orderedRows) {
    row.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const anchor = row.find((person) => person.data.is_proband) ?? row[Math.floor(row.length / 2)];
    const middle = row.indexOf(anchor);
    for (let i = middle + 1; i < row.length; i++) {
      row[i].x = Math.max(row[i].x, row[i - 1].x + MIN_PERSON_SPACING);
    }
    for (let i = middle - 1; i >= 0; i--) {
      row[i].x = Math.min(row[i].x, row[i + 1].x - MIN_PERSON_SPACING);
    }
  }
  const people = orderedRows.flatMap(([, row]) => row);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const partnersByUnion = new Map<string, string[]>();
  const visibleEdges = edges.filter((edge) => !edge.hidden);
  for (const edge of visibleEdges) {
    if (edge.type !== "partner") continue;
    const personId = String(edge.data?.personId ?? edge.source);
    const unionId = String(edge.data?.unionId ?? edge.target);
    const partners = partnersByUnion.get(unionId) ?? [];
    partners.push(personId);
    partnersByUnion.set(unionId, partners);
  }

  const unions: SpatialUnion[] = [];
  for (const node of nodes) {
    if (node.hidden || node.type !== "union") continue;
    const rowY = node.position.y - PERSON_SHAPE / 2;
    const partners = (partnersByUnion.get(node.id) ?? []).flatMap((id) => {
      const partner = peopleById.get(id);
      return partner?.y === rowY ? [partner] : [];
    });
    const shift = partners.reduce(
      (sum, partner) => sum + partner.x - (originalX.get(partner.id) ?? partner.x),
      0,
    );
    unions.push({
      id: node.id,
      x: node.position.x + shift / Math.max(1, partners.length),
      y: rowY + CARD_MID_Y,
      z: spatialDepth(rowY),
      label: typeof node.data.label === "string" ? node.data.label : undefined,
      kind: typeof node.data.kind === "string" ? node.data.kind : undefined,
    });
  }
  return { people, rows: orderedRows, unions, edges: visibleEdges };
}

function nearestFreeX(preferred: number, intervals: Span[]) {
  // Only interval boundaries and the preferred column can minimize this distance.
  let best = preferred;
  let distance = Infinity;
  const sorted = [...intervals].sort((a, b) => a.left - b.left);
  const merged: typeof sorted = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.left < previous.right) {
      previous.right = Math.max(previous.right, interval.right);
    } else {
      merged.push({ ...interval });
    }
  }
  for (const interval of merged) {
    if (preferred <= interval.left || preferred >= interval.right) continue;
    for (const boundary of [interval.left, interval.right]) {
      const next = Math.abs(preferred - boundary);
      if (next < distance) {
        best = boundary;
        distance = next;
      }
    }
  }
  return best;
}

function pathThrough(points: Point[]) {
  return points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function between(point: number, first: number, last: number) {
  return point > Math.min(first, last) && point < Math.max(first, last);
}

function reserveRail(rails: Map<string, Span[][]>, key: string, span: Span) {
  const lanes = rails.get(key) ?? [];
  let lane = lanes.findIndex((entries) =>
    entries.every((other) => span.right + 12 < other.left || span.left > other.right + 12),
  );
  if (lane === -1) {
    lane = lanes.length;
    lanes.push([]);
  }
  lanes[lane].push(span);
  rails.set(key, lanes);
  return lane;
}

export function projectSpatialLayout(
  layout: ReturnType<typeof buildSpatialLayout>,
  yaw: number,
  selectedId?: string | null,
) {
  const people = layout.people.map((person) => ({
    ...person,
    ...projectSpatialPoint(person, yaw),
  }));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const peopleByRow = new Map(
    layout.rows.map(([y, row]) => [y, row.map((person) => peopleById.get(person.id)!)]),
  );
  const unionsByRow = new Map<number, SpatialUnion[]>();
  const unions = layout.unions.map((union) => {
    const projected = { ...union, ...projectSpatialPoint(union, yaw) };
    const rowY = union.y - CARD_MID_Y;
    const row = peopleByRow.get(rowY) ?? [];
    const prior = unionsByRow.get(rowY) ?? [];
    projected.x = nearestFreeX(projected.x, [
      ...row.map(({ x }) => ({ left: x - CARD_HALF - 12, right: x + CARD_HALF + 12 })),
      ...prior.map(({ x }) => ({ left: x - 17, right: x + 17 })),
    ]);
    prior.push(projected);
    unionsByRow.set(rowY, prior);
    return projected;
  });
  const unionsById = new Map(unions.map((union) => [union.id, union]));

  const plates = layout.rows.map(([y, row]) => {
    const depth = spatialDepth(y);
    const left = row[0].x - CARD_HALF - 35;
    const right = row[row.length - 1].x + CARD_HALF + 35;
    const base = y + SPATIAL_CARD_HEIGHT + 15;
    const corners = [
      { x: left, y: base + 11, z: depth + PLANE_DEPTH / 2 },
      { x: right, y: base + 11, z: depth + PLANE_DEPTH / 2 },
      { x: right, y: base - 11, z: depth - PLANE_DEPTH / 2 },
      { x: left, y: base - 11, z: depth - PLANE_DEPTH / 2 },
    ].map((p) => projectSpatialPoint(p, yaw));
    return { y, surface: pathThrough(corners) + " Z", rim: pathThrough(corners.slice(0, 2)) };
  });

  const rails = new Map<string, Span[][]>();
  const routes: {
    id: string;
    path: string;
    highlighted: boolean;
    edge: Edge;
    parentKind?: ParentKind;
  }[] = [];
  for (const edge of layout.edges) {
    if (edge.type === "pedigree") {
      const union = unionsById.get(String(edge.data?.unionId ?? edge.source));
      const childIds = edge.data?.childIds;
      const childKinds = edge.data?.childKinds as Record<string, ParentKind> | undefined;
      if (!union || !Array.isArray(childIds)) continue;
      const childGroups = new Map<
        string,
        { rowY: number; parentKind: ParentKind; children: SpatialPerson[] }
      >();
      for (const childId of new Set(childIds)) {
        const child = peopleById.get(childId);
        if (!child) continue;
        const parentKind = childKinds?.[child.id] ?? "unknown";
        const key = `${child.y}:${parentKind}`;
        const group = childGroups.get(key) ?? { rowY: child.y, parentKind, children: [] };
        group.children.push(child);
        childGroups.set(key, group);
      }
      for (const [key, { rowY, parentKind, children }] of childGroups) {
        const childIsLower = rowY > union.y;
        const cardAnchorY = childIsLower ? rowY : rowY + SPATIAL_CARD_HEIGHT;
        const firstRailY = cardAnchorY + (childIsLower ? -36 : 45);
        const obstructing = people.filter(({ y }) => between(y + CARD_MID_Y, union.y, firstRailY));
        const column = nearestFreeX(
          union.x,
          obstructing.map(({ x }) => ({
            left: x - CARD_HALF - 12,
            right: x + CARD_HALF + 12,
          })),
        );
        const xs = children.map((child) => child.x);
        const span = { left: Math.min(column, ...xs), right: Math.max(column, ...xs) };
        const lane = reserveRail(rails, `${rowY}:${childIsLower}`, span);
        // Offset overlapping sibling bars, so separate unions never share a drawn line.
        const laneOffset = 110 * (1 - Math.exp(-0.15 * lane));
        const barY = firstRailY + (childIsLower ? -laneOffset : laneOffset);
        const unionPort = { x: union.x, y: union.y + (barY > union.y ? 7 : -7) };
        const departureY = barY > union.y ? union.y + CARD_MID_Y + 29 : union.y - CARD_MID_Y - 29;
        const trunk =
          column === union.x
            ? pathThrough([unionPort, { x: column, y: barY }])
            : pathThrough([
                unionPort,
                { x: union.x, y: departureY },
                { x: column, y: departureY },
                { x: column, y: barY },
              ]);
        const bar = pathThrough([
          { x: span.left, y: barY },
          { x: span.right, y: barY },
        ]);
        const arms = children.map((child) =>
          pathThrough([
            { x: child.x, y: barY },
            { x: child.x, y: cardAnchorY },
          ]),
        );
        routes.push({
          id: `${edge.id}-${key}`,
          path: [trunk, bar, ...arms].join(" "),
          highlighted: children.some((child) => child.id === selectedId),
          edge,
          parentKind,
        });
      }
      continue;
    }
    if (edge.type === "partner") {
      const person = peopleById.get(String(edge.data?.personId ?? edge.source));
      const union = unionsById.get(String(edge.data?.unionId ?? edge.target));
      if (!person || !union) continue;
      const startY = person.y + CARD_MID_Y;
      const startX = person.x + Math.sign(union.x - person.x || 1) * CARD_HALF;
      const row = peopleByRow.get(person.y) ?? [];
      const crossesCard = row.some(
        (other) => other.id !== person.id && between(other.x, person.x, union.x),
      );
      const path = crossesCard
        ? pathThrough([
            { x: person.x, y: person.y },
            { x: person.x, y: person.y - 24 },
            { x: union.x, y: person.y - 24 },
            union,
          ])
        : pathThrough([{ x: startX, y: startY }, { x: union.x, y: startY }, union]);
      routes.push({ id: edge.id, path, highlighted: person.id === selectedId, edge });
      continue;
    }

    const first = peopleById.get(edge.source);
    const second = peopleById.get(edge.target);
    if (!first || !second) continue;
    const y = Math.min(first.y, second.y) - 30;
    routes.push({
      id: edge.id,
      path: pathThrough([first, { x: first.x, y }, { x: second.x, y }, second]),
      highlighted: first.id === selectedId || second.id === selectedId,
      edge,
    });
  }
  return { people, unions, plates, routes };
}
