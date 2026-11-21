import type { Edge, Node } from "@xyflow/react";
import {
  GEN_GAP,
  NODE_W,
  PERSON_SHAPE,
  type ParentKind,
  type ResolvedParent,
} from "@/lib/geno/build";
import { groupPedigreeChildren, type PedigreeData } from "./genogram-pedigree";
import {
  avoidCards,
  pathThrough,
  renderSpatialRoutes,
  type SpatialPoint2D,
} from "./genogram-spatial-crossings";
import { buildSpatialParentageTracks } from "./genogram-spatial-parentage";
import type { ParentagePreview } from "./parentage-preview";
import type { PersonNodeData } from "./person-node";

export const SPATIAL_CARD_WIDTH = 222;
export const SPATIAL_CARD_HEIGHT = 91;
export const SPATIAL_ROW_GAP = 188;
export const SPATIAL_SYMBOL_CENTER = 31;
export const SPATIAL_X_SCALE = 0.84;
export const SPATIAL_MAX_NAME_SIZE = 26;
export const SPATIAL_MAX_ROLE_SIZE = 18;
export const SPATIAL_MAX_YAW = (39 * Math.PI) / 180;
export const SPATIAL_DEFAULT_YAW = (23 * Math.PI) / 180;
export const SPATIAL_MAX_PITCH = (24 * Math.PI) / 180;
export const SPATIAL_DEFAULT_PITCH = (19 * Math.PI) / 180;

const CAMERA_DISTANCE = 1680;
const MIN_PERSON_GAP = 22;
const UNION_SEPARATION = 32;

type SpatialPoint = SpatialPoint2D & { z: number };
export type SpatialAngles = { yaw: number; pitch: number };
export type SpatialBranch = "paternal" | "maternal" | "common";
type SpatialLayoutOptions = {
  separateLinks?: boolean;
  expandedPersonId?: string | null;
  parentagePreview?: ParentagePreview | null;
};

type SpatialPerson = SpatialPoint & {
  id: string;
  generation: number;
  height: number;
  branch: SpatialBranch;
  rowLabel: string;
  data: PersonNodeData;
};
type SpatialUnion = SpatialPoint & {
  id: string;
  generation: number;
  partners: string[];
  kind?: string;
  label?: string;
  relationshipId?: string;
  hubOffset?: number;
  branch: SpatialBranch;
  single: boolean;
};
type Span = { left: number; right: number };
type SpatialRoute = {
  id: string;
  edge: Edge;
  strokes: SpatialPoint2D[][];
  highlighted: boolean;
  branch: SpatialBranch;
  priority: number;
  unionId?: string;
  childIds?: string[];
  sharedAnchor?: string;
  parentKind?: ParentKind;
  parentSource?: ResolvedParent["source"];
  parentId?: string;
  suggested?: boolean;
};

const branchFor = (branch: unknown): SpatialBranch =>
  branch === "paternal" || branch === "maternal" ? branch : "common";

export function generationTitle(level: number, lane?: unknown) {
  if (level === 0) return "Consultante e irmãos";
  if (lane === "social") return "Vínculos próximos";
  if (lane === "descendant") return "Descendentes";
  return ["", "Pais e tios", "Avós", "Bisavós", "Tataravós"][level] || `Geração ${level}`;
}

export function spatialPersonLabel(person: PersonNodeData) {
  const name = person.full_name?.trim() || person.preferred_name?.trim() || "Pessoa sem nome";
  const relationship = person.is_proband
    ? "Consultante"
    : person.relationship_to_proband?.trim() || "Parentesco não informado";
  return {
    name,
    relationship:
      name.localeCompare(relationship, "pt-BR", { sensitivity: "base" }) === 0 ? "" : relationship,
  };
}

export function projectSpatialPoint(point: SpatialPoint, angles: SpatialAngles) {
  const { yaw, pitch } = angles;
  const horizontal = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const depth = (point.z * Math.cos(yaw) - point.x * Math.sin(yaw)) * Math.cos(pitch);
  const scale = Math.max(0.69, Math.min(1.15, CAMERA_DISTANCE / (CAMERA_DISTANCE - depth)));
  // People stay on the family plane. Only connections use a nonzero depth.
  return { x: horizontal * scale, y: point.y - point.z * Math.sin(pitch) * 0.49, scale };
}

function textLines(value: string, columns: number) {
  let lines = 1;
  let length = 0;
  for (const word of value.split(/\s+/)) {
    if (length + word.length + 1 > columns) {
      if (length) lines++;
      lines += Math.floor(Math.max(0, word.length - 1) / columns);
      length = word.length % columns || Math.min(columns, word.length);
    } else {
      length += word.length + 1;
    }
  }
  return lines;
}

function plaqueHeight(data: PersonNodeData) {
  const { name, relationship } = spatialPersonLabel(data);
  // Reserve the typography box before painting connectors. The HTML can still grow
  // with browser text settings and keeps its complete name.
  return Math.max(
    SPATIAL_CARD_HEIGHT,
    30 +
      Math.ceil(SPATIAL_MAX_NAME_SIZE * 1.25) * textLines(name, 10) +
      (relationship ? Math.ceil(SPATIAL_MAX_ROLE_SIZE * 1.25) * textLines(relationship, 14) : 0),
  );
}

export function buildSpatialLayout(nodes: Node[], edges: Edge[]) {
  const sourceRows = new Map<number, SpatialPerson[]>();
  for (const node of nodes) {
    if (node.hidden || node.type !== "person") continue;
    const data = node.data as PersonNodeData;
    const generation =
      typeof data.generation === "number" ? data.generation : node.position.y / GEN_GAP;
    const row = sourceRows.get(generation) ?? [];
    row.push({
      id: node.id,
      x: (node.position.x + NODE_W / 2) * SPATIAL_X_SCALE,
      y: 0,
      z: 0,
      generation,
      height: plaqueHeight(data),
      branch: branchFor(data.branchId),
      rowLabel: generationTitle(generation, data.lane),
      data,
    });
    sourceRows.set(generation, row);
  }

  const sorted = [...sourceRows].sort(([a], [b]) => a - b);
  const rows: [number, SpatialPerson[]][] = [];
  const rowPosition = new Map<number, number>();
  let bottom = -SPATIAL_ROW_GAP;
  let previousGeneration = 0;
  const extraSpaceByRow = new Map<number, number>();
  for (const node of nodes) {
    const { generation, hubOffset } = node.data;
    if (node.type === "union" && typeof generation === "number" && typeof hubOffset === "number") {
      extraSpaceByRow.set(
        generation,
        Math.max(extraSpaceByRow.get(generation) ?? 0, hubOffset + 26),
      );
    }
  }
  for (const [generation, row] of sorted) {
    row.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const y = rows.length
      ? Math.max(
          generation * SPATIAL_ROW_GAP,
          bottom +
            Math.max(
              generation - previousGeneration >= 1 ? 58 : 39,
              extraSpaceByRow.get(generation) ?? 0,
            ),
        )
      : generation * SPATIAL_ROW_GAP;
    for (const person of row) person.y = y;
    bottom = y + Math.max(...row.map((person) => person.height));
    previousGeneration = generation;
    rowPosition.set(generation, y);
    rows.push([y, row]);
  }
  const people = rows.flatMap(([, row]) => row);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const visibleEdges = edges.filter((edge) => !edge.hidden);
  const partnersByUnion = new Map<string, string[]>();
  for (const edge of visibleEdges) {
    if (edge.type !== "partner") continue;
    const uid = String(edge.data?.unionId ?? edge.target);
    const partners = partnersByUnion.get(uid) ?? [];
    partners.push(String(edge.data?.personId ?? edge.source));
    partnersByUnion.set(uid, partners);
  }
  const unions: SpatialUnion[] = [];
  for (const node of nodes) {
    if (node.hidden || node.type !== "union") continue;
    const partners = partnersByUnion.get(node.id) ?? [];
    const linked = partners.flatMap((id) => {
      const person = peopleById.get(id);
      return person ? [person] : [];
    });
    const generation =
      typeof node.data.generation === "number"
        ? node.data.generation
        : (linked[0]?.generation ?? (node.position.y - PERSON_SHAPE / 2) / GEN_GAP);
    unions.push({
      id: node.id,
      x: node.position.x * SPATIAL_X_SCALE,
      y: (rowPosition.get(generation) ?? generation * SPATIAL_ROW_GAP) + SPATIAL_SYMBOL_CENTER,
      z: 0,
      generation,
      partners: [...new Set(partners)],
      branch: branchFor(node.data.branchId),
      single: node.data.isSingle === true || partners.length === 1,
      kind: typeof node.data.kind === "string" ? node.data.kind : undefined,
      label: typeof node.data.label === "string" ? node.data.label : undefined,
      relationshipId:
        typeof node.data.relationshipId === "string" ? node.data.relationshipId : undefined,
      hubOffset: typeof node.data.hubOffset === "number" ? node.data.hubOffset : undefined,
    });
  }
  return { people, rows, unions, edges: visibleEdges };
}

function routePriority(
  type: Edge["type"],
  highlighted: boolean,
  kind?: ParentKind,
  suggested?: boolean,
) {
  const selection = Number(highlighted);
  if (suggested) return 2 + selection;
  if (type === "partner") return 6 + selection;
  if (type !== "pedigree") return selection;
  return (kind === "biological" || kind === "unknown" ? 8 : 4) + selection;
}

function overlaps(a: Span, b: Span) {
  return a.right + 10 >= b.left && a.left - 10 <= b.right;
}

function reserveRail(rails: Map<string, Span[][]>, key: string, span: Span) {
  const lanes = rails.get(key) ?? [];
  let lane = lanes.findIndex((entries) => entries.every((other) => !overlaps(span, other)));
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
  angles: SpatialAngles,
  selectedId?: string | null,
  { separateLinks = false, expandedPersonId, parentagePreview }: SpatialLayoutOptions = {},
) {
  const rows = new Map(
    layout.rows.map(([_, row]) => {
      const projected = row.map((person) => {
        const camera = projectSpatialPoint(person, angles);
        return {
          ...person,
          ...camera,
          width: SPATIAL_CARD_WIDTH * camera.scale,
          height: person.height * camera.scale,
        };
      });
      const anchor = projected.findIndex((person) => person.data.is_proband);
      const center = anchor >= 0 ? anchor : Math.floor(projected.length / 2);
      for (let i = center + 1; i < projected.length; i++) {
        const previous = projected[i - 1];
        const person = projected[i];
        person.x = Math.max(
          person.x,
          previous.x + (person.width + previous.width) / 2 + MIN_PERSON_GAP,
        );
      }
      for (let i = center - 1; i >= 0; i--) {
        const next = projected[i + 1];
        const person = projected[i];
        person.x = Math.min(person.x, next.x - (person.width + next.width) / 2 - MIN_PERSON_GAP);
      }
      // A complete row stays aligned even when perspective changes card scale.
      return [projected[0].y, projected] as const;
    }),
  );
  const people = Array.from(rows.values()).flat();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const coordinatedUnions = layout.unions
    .filter((union) => !union.single && union.partners.includes(expandedPersonId ?? ""))
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const expandedRanks = new Map(
    coordinatedUnions.length > 1 ? coordinatedUnions.map((union, index) => [union.id, index]) : [],
  );
  const expandedCenters = new Map<number, Span[]>();
  const rowClearance = new Map<number, number>();
  let previousBottom = -Infinity;
  for (const [rowY, row] of rows) {
    rowClearance.set(rowY, rowY - previousBottom);
    previousBottom = rowY + Math.max(...row.map(({ height }) => height));
  }
  const unions = layout.unions.map((union) => {
    const projected = projectSpatialPoint(union, angles);
    const partners = union.partners.flatMap((id) => {
      const person = peopleById.get(id);
      return person ? [person] : [];
    });
    const corresponding = partners.filter((person) => person.generation === union.generation);
    let x = corresponding.length
      ? corresponding.reduce((sum, person) => sum + person.x, 0) / corresponding.length
      : projected.x;
    let y = corresponding.length
      ? corresponding[0].y + SPATIAL_SYMBOL_CENTER * corresponding[0].scale
      : projected.y;
    if (union.hubOffset && corresponding.length)
      y = corresponding[0].y - (12 + union.hubOffset) * corresponding[0].scale;
    const rank = expandedRanks.get(union.id);
    const expanded = rank !== undefined;
    let z = union.z;
    if (expanded) {
      z = 110 + (rank * 105) / (coordinatedUnions.length - 1);
      const inDepth = projectSpatialPoint({ ...union, z }, angles);
      const rowY = corresponding[0]?.y ?? union.y - SPATIAL_SYMBOL_CENTER;
      const centers = expandedCenters.get(rowY) ?? [];
      const xOffset = Math.max(-78, Math.min(78, inDepth.x - projected.x));
      x = avoidCards(x + xOffset, centers);
      centers.push({ left: x - UNION_SEPARATION, right: x + UNION_SEPARATION });
      expandedCenters.set(rowY, centers);
      // Keep every open hub in the free channel above its people.
      // A frontal view still offsets the hub from the row so it remains inspectable.
      const lift = Math.min(15, Math.max(-5, (projected.y - inDepth.y) / 3));
      const openOffset = 17 + lift + (rank * 10) / (coordinatedUnions.length - 1);
      const clearance = Math.max(12, (rowClearance.get(rowY) ?? Infinity) - 10);
      y = rowY - Math.min(clearance, openOffset);
    }
    const branch: SpatialBranch =
      union.branch !== "common"
        ? union.branch
        : partners[0]?.branch !== "common" &&
            partners.every((person) => person.branch === partners[0]?.branch)
          ? (partners[0]?.branch ?? "common")
          : "common";
    return { ...union, ...projected, x, y, z, branch, expanded };
  });
  const unionsById = new Map(unions.map((union) => [union.id, union]));

  const rails = new Map<string, Span[][]>();
  const selectedUnions = new Set<string>();
  for (const edge of layout.edges) {
    if (
      edge.type === "pedigree" &&
      Array.isArray(edge.data?.childIds) &&
      edge.data.childIds.includes(selectedId)
    ) {
      selectedUnions.add(String(edge.data?.unionId ?? edge.source));
    }
    if (edge.type === "partner" && String(edge.data?.personId ?? edge.source) === selectedId) {
      selectedUnions.add(String(edge.data?.unionId ?? edge.target));
    }
  }
  const routes: SpatialRoute[] = [];
  const childStrokes = new Map<string, string[]>();
  for (const edge of layout.edges) {
    if (edge.type === "pedigree") {
      const union = unionsById.get(String(edge.data?.unionId ?? edge.source));
      if (!union || !Array.isArray(edge.data?.childIds)) continue;
      const childNodes = [...new Set<string>(edge.data.childIds.map(String))].flatMap((id) => {
        const child = peopleById.get(id);
        return child ? [child] : [];
      });
      const groups = groupPedigreeChildren(childNodes, ({ y }) => y, edge.data as PedigreeData);
      for (const { key, rowY, kind, source, parentId, children } of groups) {
        const suggested = source !== "explicit";
        const down =
          edge.data?.direction === "down" || (edge.data?.direction !== "up" && rowY > union.y);
        const direction = down ? 1 : -1;
        const knownParent = parentId
          ? peopleById.get(parentId)
          : union.single
            ? peopleById.get(union.partners[0])
            : undefined;
        const hubX = parentId && knownParent ? knownParent.x : union.x;
        const portOffset = parentId ? (hubX < union.x ? -8 : 8) : 0;
        const anchors = children.map((child) => ({
          x: child.x + portOffset,
          y: child.y + (down ? 0 : child.height),
        }));
        const near = down
          ? Math.min(...anchors.map((point) => point.y))
          : Math.max(...anchors.map((point) => point.y));
        const portY = knownParent
          ? knownParent.y + (down ? knownParent.height : 0)
          : union.y + direction * 6;
        const middle = (near + portY) / 2;
        const obstruction = people.filter(({ y, height }) => {
          const centerY = y + height / 2;
          return centerY > Math.min(near, portY) && centerY < Math.max(near, portY);
        });
        const column = avoidCards(
          hubX,
          obstruction.map(({ x, width }) => ({
            left: x - width / 2 - 12,
            right: x + width / 2 + 12,
          })),
        );
        const xs = anchors.map(({ x }) => x);
        const span = { left: Math.min(column, ...xs), right: Math.max(column, ...xs) };
        const lane = reserveRail(rails, `${rowY}:${down}`, span);
        const barY =
          middle +
          Math.sign(near - portY) *
            Math.min(20, Math.abs(near - portY) * 0.4) *
            (1 - Math.exp(-0.35 * lane));
        const departureY = portY + (barY - portY) * 0.28;
        const strokes = [
          [
            { x: hubX, y: portY },
            { x: hubX, y: departureY },
            { x: column, y: departureY },
            { x: column, y: barY },
          ],
          [
            { x: span.left, y: barY },
            { x: span.right, y: barY },
          ],
          ...anchors.map(({ x, y }) => [
            { x, y: barY },
            { x, y },
          ]),
        ];
        const highlighted =
          selectedUnions.has(union.id) &&
          (union.partners.includes(selectedId ?? "") ||
            children.some((person) => person.id === selectedId));
        const id = `${edge.id}-${key}`;
        if (parentagePreview && !suggested) {
          const childIndex = children.findIndex((child) => child.id === parentagePreview.childId);
          if (childIndex !== -1) {
            const childAnchor = anchors[childIndex];
            childStrokes.set(id, [
              pathThrough(strokes[0]),
              pathThrough([
                { x: column, y: barY },
                { x: childAnchor.x, y: barY },
              ]),
              pathThrough(strokes[childIndex + 2]),
            ]);
          }
        }
        routes.push({
          id,
          strokes,
          edge,
          branch: union.branch,
          suggested,
          parentKind: kind,
          parentSource: source,
          parentId,
          highlighted,
          unionId: union.id,
          childIds: children.map((child) => child.id),
          sharedAnchor: knownParent?.id,
          priority: routePriority(edge.type, highlighted, kind, suggested),
        });
      }
      continue;
    }
    if (edge.type === "partner") {
      const person = peopleById.get(String(edge.data?.personId ?? edge.source));
      const union = unionsById.get(String(edge.data?.unionId ?? edge.target));
      if (!person || !union || union.single) continue;
      const direction = Math.sign(union.x - person.x || 1);
      const x = person.x + (direction * person.width) / 2;
      const y = person.y + SPATIAL_SYMBOL_CENTER * person.scale;
      const row = rows.get(person.y) ?? [];
      const crossesCard = row.some(
        (other) =>
          other.id !== person.id &&
          other.x > Math.min(person.x, union.x) &&
          other.x < Math.max(person.x, union.x),
      );
      const railY = crossesCard ? person.y - 12 : y;
      const rank = expandedRanks.get(union.id);
      const port =
        person.id === expandedPersonId && rank !== undefined
          ? person.x + (rank / (coordinatedUnions.length - 1) - 0.5) * person.width * 0.5
          : person.x;
      const strokes =
        union.expanded || union.hubOffset
          ? [[{ x: port, y: person.y }, { x: port, y: union.y }, union]]
          : [[{ x, y }, { x, y: railY }, { x: union.x, y: railY }, union]];
      const highlighted = selectedUnions.has(union.id);
      const suggested = edge.data?.suggested === true;
      routes.push({
        id: edge.id,
        strokes,
        edge,
        branch: union.branch,
        highlighted,
        suggested,
        unionId: union.id,
        sharedAnchor: person.id,
        priority: routePriority(edge.type, highlighted, undefined, suggested),
      });
      continue;
    }
    const first = peopleById.get(edge.source);
    const second = peopleById.get(edge.target);
    if (!first || !second) continue;
    const y = Math.min(first.y, second.y) - 24;
    const highlighted = first.id === selectedId || second.id === selectedId;
    routes.push({
      id: edge.id,
      edge,
      branch: "common",
      strokes: [[first, { x: first.x, y }, { x: second.x, y }, second]],
      highlighted,
      priority: routePriority(edge.type, highlighted),
    });
  }
  const bridgeDepth = projectSpatialPoint({ x: 0, y: 0, z: 72 }, angles);
  const rendered = renderSpatialRoutes(
    routes,
    separateLinks ? { x: bridgeDepth.x / 5, y: -bridgeDepth.y } : null,
  );
  const bridgeCount = rendered.reduce((sum, route) => sum + route.bridgePaths.length, 0);
  const parentageTracks = buildSpatialParentageTracks({
    preview: parentagePreview,
    people,
    unions,
    routes: rendered,
    childStrokes,
  });
  return { people, unions, rows, routes: rendered, bridgeCount, parentageTracks };
}
