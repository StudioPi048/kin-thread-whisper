import type { Edge } from "@xyflow/react";
import { avoidCards, pathThrough, type SpatialPoint2D } from "./genogram-spatial-crossings";
import type { ParentagePreview } from "./parentage-preview";

type Person = SpatialPoint2D & { id: string; width: number; height: number };
type Union = SpatialPoint2D & { id: string; partners: string[]; single: boolean };
type Route = {
  id: string;
  unionId?: string;
  edge: Edge;
  childIds?: string[];
  suggested?: boolean;
  path: string;
  bridgePaths: string[];
};

export type SpatialParentageTrack = {
  role: "previous" | "proposed" | "confirmed";
  paths: string[];
};

function samePeople(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function segmentPort(person: Person, towardY: number) {
  return { x: person.x, y: towardY > person.y ? person.y + person.height : person.y };
}

function elbow(first: SpatialPoint2D, second: SpatialPoint2D) {
  const middle = (first.y + second.y) / 2;
  return pathThrough([first, { x: first.x, y: middle }, { x: second.x, y: middle }, second]);
}

/** A draft may select a pair with no recorded union. Draw only the proposed
 * filiation, with a shared rail by direction and no wedding or union symbol. */
function newParentagePath(child: Person, parents: Person[], people: Person[]) {
  return [false, true].flatMap((down) => {
    const peers = parents.filter((parent) => parent.y > child.y === down);
    if (!peers.length) return [];
    const direction = down ? 1 : -1;
    const start = { x: child.x, y: child.y + (down ? child.height : 0) };
    const ends = peers.map((parent) => ({
      x: parent.x,
      y: parent.y + (!down && parent.y < child.y ? parent.height : 0),
    }));
    const available = people.flatMap((person) => {
      const edge = down ? person.y : person.y + person.height;
      const gap = (edge - start.y) * direction;
      return gap > 0 ? [gap] : [];
    });
    const gap = Math.min(72, ...available);
    const railY =
      start.y + (peers.some((parent) => parent.y === child.y) ? 22 : gap / 2) * direction;
    const arms = ends.map((end) => {
      const low = Math.min(end.y, railY);
      const high = Math.max(end.y, railY);
      const obstructed = people
        .filter(({ y, height }) => y + height > low && y < high)
        .map(({ x, width }) => ({ left: x - width / 2 - 10, right: x + width / 2 + 10 }));
      const column = avoidCards(end.x, obstructed);
      const approach = Math.sign(end.y - railY) * Math.min(8, Math.abs(end.y - railY) / 2);
      return {
        column,
        path: pathThrough([
          { x: column, y: railY },
          { x: column, y: end.y - approach },
          { x: end.x, y: end.y - approach },
          end,
        ]),
      };
    });
    const xs = [start.x, ...arms.map(({ column }) => column)];
    return [
      pathThrough([start, { x: start.x, y: railY }]),
      pathThrough([
        { x: Math.min(...xs), y: railY },
        { x: Math.max(...xs), y: railY },
      ]),
      ...arms.map(({ path }) => path),
    ];
  });
}

export function buildSpatialParentageTracks({
  preview,
  people,
  unions,
  routes,
  childStrokes,
}: {
  preview?: ParentagePreview | null;
  people: Person[];
  unions: Union[];
  routes: Route[];
  childStrokes: ReadonlyMap<string, string[]>;
}): SpatialParentageTrack[] {
  if (!preview) return [];
  const child = people.find(({ id }) => id === preview.childId);
  if (!child) return [];
  const stages =
    preview.phase === "draft"
      ? ([
          { role: "previous", ids: preview.previousParentIds },
          { role: "proposed", ids: preview.proposedParentIds },
        ] as const)
      : ([{ role: "confirmed", ids: preview.proposedParentIds }] as const);
  return stages.flatMap(({ role, ids }) => {
    const parentIds = [...new Set(ids)].filter((id) => id !== child.id);
    const parents = people.filter(({ id }) => parentIds.includes(id));
    if (!parents.length || parents.length !== parentIds.length) return [];
    const candidates = unions.filter(({ partners }) => samePeople(partners, parentIds));
    const registered = routes.find(
      (route) =>
        !route.suggested &&
        childStrokes.has(route.id) &&
        candidates.some(({ id }) => id === route.unionId),
    );
    const known =
      candidates.find(({ id }) => id === registered?.unionId) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    if (!known) return [{ role, paths: newParentagePath(child, parents, people) }];

    const partnerPaths = routes.flatMap((route) => {
      const personId = route.edge.data?.personId ?? route.edge.source;
      return route.edge.type === "partner" &&
        route.unionId === known.id &&
        parentIds.includes(String(personId))
        ? [route.path, ...route.bridgePaths]
        : [];
    });
    const filialPaths = registered
      ? registered.childIds?.length === 1
        ? [registered.path, ...registered.bridgePaths]
        : childStrokes.get(registered.id)!
      : [
          elbow(
            segmentPort(child, known.y),
            known.single ? segmentPort(parents[0], child.y) : known,
          ),
        ];
    return [{ role, paths: [...partnerPaths, ...filialPaths] }];
  });
}
