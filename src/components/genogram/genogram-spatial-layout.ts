import type { Edge, Node } from "@xyflow/react";
import { GEN_GAP, NODE_W, PERSON_SHAPE, type ParentKind } from "@/lib/geno/build";
import type { PersonNodeData } from "./person-node";

export const SPATIAL_CARD_WIDTH = 144;
export const SPATIAL_CARD_HEIGHT = 102;
export const SPATIAL_MAX_YAW = (42 * Math.PI) / 180;
export const SPATIAL_DEFAULT_YAW = (24 * Math.PI) / 180;

export const SPATIAL_ROW_GAP = 172;
export const SPATIAL_SYMBOL_CENTER = 31;
const DEPTH_PER_ROW = 92;
const MIN_PERSON_SPACING = (SPATIAL_CARD_WIDTH + 20) / Math.cos(SPATIAL_MAX_YAW);
const CARD_HALF = SPATIAL_CARD_WIDTH / 2;
const SYMBOL_HALF = 33;

type Point = { x: number; y: number };
type SpatialPoint = Point & { z: number };
type SpatialPerson = SpatialPoint & { id: string; data: PersonNodeData };
type SpatialUnion = SpatialPoint & { id: string; label?: string; kind?: string; single: boolean };
type Span = { left: number; right: number };

export const spatialDepth = (rowY: number) => (-rowY / SPATIAL_ROW_GAP) * DEPTH_PER_ROW;

export function projectSpatialPoint(point: SpatialPoint, yaw: number): Point {
  // Orthographic yaw around the vertical axis. Card Y is independent of camera angle.
  return { x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw), y: point.y };
}

export function buildSpatialLayout(nodes: Node[], edges: Edge[]) {
  const rows = new Map<number, SpatialPerson[]>();
  const originalX = new Map<string, number>();
  for (const node of nodes) {
    if (node.hidden || node.type !== "person") continue;
    const y = (node.position.y / GEN_GAP) * SPATIAL_ROW_GAP;
    const centerX = (node.position.x + NODE_W / 2) * 0.84;
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
    const rowY =
      typeof node.data.generation === "number"
        ? node.data.generation * SPATIAL_ROW_GAP
        : ((node.position.y - PERSON_SHAPE / 2) / GEN_GAP) * SPATIAL_ROW_GAP;
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
      x:
        partners.length === 2
          ? (partners[0].x + partners[1].x) / 2
          : (partners[0]?.x ?? node.position.x * 0.84 + shift / Math.max(1, partners.length)),
      y: rowY + SPATIAL_SYMBOL_CENTER,
      z: spatialDepth(rowY),
      label: typeof node.data.label === "string" ? node.data.label : undefined,
      kind: typeof node.data.kind === "string" ? node.data.kind : undefined,
      single: node.data.isSingle === true || partnersByUnion.get(node.id)?.length === 1,
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
    if (projected.single) return projected;
    const rowY = union.y - SPATIAL_SYMBOL_CENTER;
    const row = peopleByRow.get(rowY) ?? [];
    const prior = unionsByRow.get(rowY) ?? [];
    projected.x = nearestFreeX(projected.x, [
      ...row.map(({ x }) => ({ left: x - SYMBOL_HALF - 13, right: x + SYMBOL_HALF + 13 })),
      ...prior.map(({ x }) => ({ left: x - 17, right: x + 17 })),
    ]);
    prior.push(projected);
    unionsByRow.set(rowY, prior);
    return projected;
  });
  const unionsById = new Map(unions.map((union) => [union.id, union]));

  const rails = new Map<string, Span[][]>();
  const routes: {
    id: string;
    path: string;
    highlighted: boolean;
    edge: Edge;
    parentKind?: ParentKind;
    suggested?: boolean;
  }[] = [];
  for (const edge of layout.edges) {
    if (edge.type === "pedigree") {
      const union = unionsById.get(String(edge.data?.unionId ?? edge.source));
      const childIds = edge.data?.childIds;
      const childKinds = edge.data?.childKinds as Record<string, ParentKind> | undefined;
      const suggestedIds = new Set(
        Array.isArray(edge.data?.suggestedChildIds) ? edge.data.suggestedChildIds : [],
      );
      if (!union || !Array.isArray(childIds)) continue;
      const childGroups = new Map<
        string,
        { rowY: number; parentKind: ParentKind; suggested: boolean; children: SpatialPerson[] }
      >();
      for (const childId of new Set(childIds)) {
        const child = peopleById.get(childId);
        if (!child) continue;
        const parentKind = childKinds?.[child.id] ?? "unknown";
        const suggested = suggestedIds.has(child.id);
        const key = `${child.y}:${parentKind}:${suggested}`;
        const group = childGroups.get(key) ?? {
          rowY: child.y,
          parentKind,
          suggested,
          children: [],
        };
        group.children.push(child);
        childGroups.set(key, group);
      }
      for (const [key, { rowY, parentKind, suggested, children }] of childGroups) {
        const childIsLower = rowY > union.y;
        const cardAnchorY = childIsLower ? rowY : rowY + SPATIAL_CARD_HEIGHT;
        const portY =
          union.y +
          (union.single
            ? childIsLower
              ? SPATIAL_CARD_HEIGHT - SPATIAL_SYMBOL_CENTER
              : -SPATIAL_SYMBOL_CENTER
            : childIsLower
              ? 7
              : -7);
        const firstRailY = childIsLower
          ? Math.max(portY + 6, cardAnchorY - 18)
          : Math.min(portY - 6, cardAnchorY + 20);
        const obstructing = people.filter(({ y }) =>
          between(y + SPATIAL_SYMBOL_CENTER, union.y, firstRailY),
        );
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
        const laneOffset = 28 * (1 - Math.exp(-0.25 * lane));
        const barY = childIsLower
          ? Math.max(portY + 6, firstRailY - laneOffset)
          : Math.min(portY - 6, firstRailY + laneOffset);
        const unionPort = { x: union.x, y: portY };
        const departureY = portY + (barY > portY ? 12 : -12);
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
          suggested,
        });
      }
      continue;
    }
    if (edge.type === "partner") {
      const person = peopleById.get(String(edge.data?.personId ?? edge.source));
      const union = unionsById.get(String(edge.data?.unionId ?? edge.target));
      if (!person || !union || union.single) continue;
      const startY = person.y + SPATIAL_SYMBOL_CENTER;
      const startX = person.x + Math.sign(union.x - person.x || 1) * SYMBOL_HALF;
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
      routes.push({
        id: edge.id,
        path,
        highlighted: person.id === selectedId,
        edge,
        suggested: edge.data?.suggested === true,
      });
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
  return { people, unions, rows: peopleByRow, routes };
}
