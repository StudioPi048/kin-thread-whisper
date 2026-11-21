import type { ParentKind, ResolvedParent } from "@/lib/geno/build";
import { relationshipQualifiers } from "@/lib/genogram";

export type PedigreeData = {
  parentsByChild?: Record<string, readonly ResolvedParent[]>;
  childKinds?: Record<string, ParentKind>;
  suggestedChildIds?: string[];
};

export function findPedigreeRelationship(
  data: PedigreeData,
  id: string,
  children: readonly string[] = Object.keys(data.parentsByChild ?? {}),
  parentId?: string,
) {
  for (const childId of children) {
    const parent = data.parentsByChild?.[childId]?.find(
      (link) => link.relationshipId === id && (!parentId || link.personId === parentId),
    );
    if (parent) return { childId, parent };
  }
}

export function parentageTrackLabel(kind: ParentKind, source: ResolvedParent["source"]) {
  const nature = relationshipQualifiers.parent.find((item) => item.value === kind)?.label;
  const status = {
    explicit: "Filiação registrada",
    legacy: "Filiação por rótulo legado",
    suggested: "Filiação sugerida",
  }[source];
  return `${status} · ${nature ?? "Natureza por confirmar"}`;
}

type PedigreeGroup<T> = {
  key: string;
  rowY: number;
  kind: ParentKind;
  source: ResolvedParent["source"];
  parentId?: string;
  children: T[];
};

/** Homogeneous siblings share a rail. Mixed links use one rail per actual parent. */
export function groupPedigreeChildren<T extends { id: string }>(
  children: readonly T[],
  rowOf: (child: T) => number,
  data?: PedigreeData,
) {
  const groups = new Map<string, PedigreeGroup<T>>();
  for (const child of children) {
    const links = data?.parentsByChild?.[child.id] ?? [];
    const first = links[0];
    const mixed =
      first && links.some((link) => link.kind !== first.kind || link.source !== first.source);
    const rowY = rowOf(child);
    const tracks = mixed
      ? links.map(({ personId, kind, source }) => ({ parentId: personId, kind, source }))
      : ([
          {
            parentId: undefined,
            kind: first?.kind ?? data?.childKinds?.[child.id] ?? "unknown",
            source:
              first?.source ??
              (data?.suggestedChildIds?.includes(child.id) ? "suggested" : "explicit"),
          },
        ] satisfies Pick<PedigreeGroup<T>, "parentId" | "kind" | "source">[]);
    for (const { parentId, kind, source } of tracks) {
      const key = `${rowY}:${kind}:${source}:${parentId ?? ""}`;
      const group = groups.get(key) ?? { key, rowY, kind, source, parentId, children: [] };
      group.children.push(child);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}
