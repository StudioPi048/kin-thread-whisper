export type MapViewAnchor = {
  personId: string;
  horizontal: number;
  vertical: number;
  scale: number;
  overview?: boolean;
};

export type MapBranch = "paternal" | "maternal";
export const mapBranchNames = { paternal: "Ramo paterno", maternal: "Ramo materno" };

type ScreenPoint = { id: string; x: number; y: number };

/**
 * The two maps have different layouts. Preserve a real person at the same
 * point in the frame and use a zoom relative to each map's whole-tree fit.
 */
export function readMapViewAnchor(
  people: readonly ScreenPoint[],
  width: number,
  height: number,
  scale: number,
  selectedId?: string | null,
): MapViewAnchor | undefined {
  if (!width || !height || !people.length || !Number.isFinite(scale) || scale <= 0) return;
  const visible = (person: ScreenPoint) =>
    person.x >= 0 && person.x <= width && person.y >= 0 && person.y <= height;
  const onScreen = people.filter(visible);
  const selected = onScreen.find((person) => person.id === selectedId);
  const distance = (person: ScreenPoint) =>
    Math.hypot((person.x - width / 2) / width, (person.y - height / 2) / height);
  const person =
    selected ??
    (onScreen.length ? onScreen : people).reduce((best, next) =>
      distance(next) < distance(best) ? next : best,
    );
  return {
    personId: person.id,
    horizontal: person.x / width,
    vertical: person.y / height,
    scale,
  };
}
