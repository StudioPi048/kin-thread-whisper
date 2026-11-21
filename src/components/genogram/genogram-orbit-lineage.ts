import type { OrbitRoute } from "./genogram-orbit-model";

function visitRelatives(personId: string, relatives: ReadonlyMap<string, string[]>) {
  const visited = new Set([personId]);
  const queue = [personId];
  for (let next = 0; next < queue.length; next++) {
    for (const id of relatives.get(queue[next]) ?? []) {
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(id);
    }
  }
  return visited;
}

/** Highlight recorded paths between the consultante and a direct ancestor. */
export function traceOrbitLineage(
  routes: readonly OrbitRoute[],
  consultanteId?: string | null,
  ancestorId?: string | null,
): Set<string> {
  if (!consultanteId || !ancestorId || consultanteId === ancestorId) return new Set();

  const parentsByUnion = new Map<string, { personId: string; routeId: string }[]>();
  for (const { kind, unionId, personId, id } of routes) {
    if (kind !== "partner" || !unionId || !personId) continue;
    const parents = parentsByUnion.get(unionId) ?? [];
    parents.push({ personId, routeId: id });
    parentsByUnion.set(unionId, parents);
  }

  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const filiation: { childId: string; parentId: string; routeIds: [string, string] }[] = [];
  for (const { kind, unionId, personId: childId, suggested, id } of routes) {
    if (kind !== "pedigree" || !unionId || !childId || suggested) continue;
    for (const { personId: parentId, routeId } of parentsByUnion.get(unionId) ?? []) {
      const parents = parentsByChild.get(childId) ?? [];
      const children = childrenByParent.get(parentId) ?? [];
      parents.push(parentId);
      children.push(childId);
      parentsByChild.set(childId, parents);
      childrenByParent.set(parentId, children);
      filiation.push({ childId, parentId, routeIds: [id, routeId] });
    }
  }

  const ascendents = visitRelatives(consultanteId, parentsByChild);
  if (!ascendents.has(ancestorId)) return new Set();
  const descendants = visitRelatives(ancestorId, childrenByParent);
  return new Set(
    filiation
      .filter(({ childId, parentId }) => ascendents.has(childId) && descendants.has(parentId))
      .flatMap(({ routeIds }) => routeIds),
  );
}
