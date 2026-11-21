import type { projectSpatialLayout } from "./genogram-spatial-layout";

export type PrintBounds = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };
type Segment = [Point, Point];
type Side = "left" | "right" | "top" | "bottom";
type Projection = ReturnType<typeof projectSpatialLayout>;
type PrintContent = Pick<Projection, "people" | "routes" | "unions">;
type Crossing = Point & { side: Side; route: string };

export type PrintPage = {
  title: string;
  number: number;
  bounds: PrintBounds;
  content: PrintContent;
  continuation: Array<Point & { side: Side; page: number; points: Point[] }>;
  detail: boolean;
};

// A3 landscape with 12 mm margins. Bounding the viewBox keeps name text
// above 8 pt in the available physical drawing area.
const WIDTH = 2280;
const HEIGHT = 1450;
const SIDE_MARGIN = 122;
const TOP_MARGIN = 35;
const EPSILON = 0.01;

function segmentsOf(path: string): Segment[] {
  const segments: Segment[] = [];
  let last: Point | undefined;
  // Frontal print projection consists of independent M/L strokes.
  for (const [, command, x, y] of path.matchAll(/([ML])\s+(\S+)\s+(\S+)/g)) {
    const point = { x: Number(x), y: Number(y) };
    if (command === "L" && last && (point.x !== last.x || point.y !== last.y))
      segments.push([last, point]);
    last = point;
  }
  return segments;
}

function chartBounds(projection: PrintContent, strokes: Segment[]): PrintBounds {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  function include(x: number, y: number) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  for (const { x, y, width, height } of projection.people) {
    include(x - width / 2, y);
    include(x + width / 2, y + height);
  }
  for (const { x, y } of projection.unions) include(x, y - 22);
  for (const segment of strokes) for (const point of segment) include(point.x, point.y);
  return left === Infinity
    ? { left: 0, top: 0, right: 320, bottom: 180 }
    : { left: left - 24, top: top - 28, right: right + 24, bottom: bottom + 25 };
}

function verticalCuts(projection: Projection, bounds: PrintBounds) {
  const cuts = [bounds.top];
  let previousBottom = bounds.top;
  for (const [y, row] of projection.rows) {
    const bottom = y + Math.max(...row.map((person) => person.height));
    if (bottom - cuts.at(-1)! > HEIGHT && previousBottom > cuts.at(-1)!) {
      cuts.push((previousBottom + y) / 2);
    }
    previousBottom = bottom;
  }
  return [...cuts, bounds.bottom];
}

function clipSegment([a, b]: Segment, bounds: PrintBounds): Segment | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let start = 0,
    end = 1;
  for (const [slope, offset] of [
    [-dx, a.x - bounds.left],
    [dx, bounds.right - a.x],
    [-dy, a.y - bounds.top],
    [dy, bounds.bottom - a.y],
  ]) {
    if (Math.abs(slope) < EPSILON) {
      if (offset < 0) return;
      continue;
    }
    const candidate = offset / slope;
    if (slope < 0) start = Math.max(start, candidate);
    else end = Math.min(end, candidate);
    if (end <= start) return;
  }
  return [
    { x: a.x + dx * start, y: a.y + dy * start },
    { x: a.x + dx * end, y: a.y + dy * end },
  ];
}

function onSides(point: Point, bounds: PrintBounds): Side[] {
  return (["left", "right", "top", "bottom"] as const).filter(
    (side) =>
      Math.abs(point[side === "left" || side === "right" ? "x" : "y"] - bounds[side]) < EPSILON,
  );
}

const adjoining: Record<Side, [number, number, Side]> = {
  left: [0, -1, "right"],
  right: [0, 1, "left"],
  top: [-1, 0, "bottom"],
  bottom: [1, 0, "top"],
};

export function paginateGenogram(
  title: string,
  projection: Projection,
  firstPage: number,
  addDetail: boolean,
): PrintPage[] {
  const routes = projection.routes.map((route) => ({ route, strokes: segmentsOf(route.path) }));
  const bounds = chartBounds(
    projection,
    routes.flatMap(({ strokes }) => strokes),
  );
  const panorama: PrintPage = {
    title,
    number: firstPage,
    bounds,
    content: projection,
    continuation: [],
    detail: false,
  };
  if (!addDetail || (bounds.right - bounds.left <= WIDTH && bounds.bottom - bounds.top <= HEIGHT))
    return [panorama];

  const rows = verticalCuts(projection, bounds);
  const columns = Math.ceil((bounds.right - bounds.left) / WIDTH);
  const columnWidth = (bounds.right - bounds.left) / columns;
  const tiles = new Map<
    string,
    { page: PrintPage; row: number; col: number; crossings: Crossing[] }
  >();
  for (let row = 0; row + 1 < rows.length; row++) {
    for (let col = 0; col < columns; col++) {
      const core = {
        left: bounds.left + col * columnWidth,
        right: bounds.left + (col + 1) * columnWidth,
        top: rows[row],
        bottom: rows[row + 1],
      };
      const includes = ({ x, y }: Point) =>
        x >= core.left && x < core.right && y >= core.top && y < core.bottom;
      const people = projection.people.filter(includes);
      const unions = projection.unions.filter(includes);
      const crossings: Crossing[] = [];
      const clipped = routes.flatMap(({ route, strokes }) => {
        const paths = strokes.flatMap((segment) => {
          const result = clipSegment(segment, core);
          if (!result) return [];
          for (const point of result) {
            for (const side of onSides(point, core))
              crossings.push({ ...point, side, route: route.id });
          }
          return [`M ${result[0].x} ${result[0].y} L ${result[1].x} ${result[1].y}`];
        });
        return paths.length ? [{ ...route, path: paths.join(" ") }] : [];
      });
      if (!people.length && !unions.length && !clipped.length) continue;
      tiles.set(`${row}:${col}`, {
        row,
        col,
        crossings,
        page: {
          title: `${title} - detalhe`,
          number: firstPage + tiles.size + 1,
          bounds: {
            left: core.left - SIDE_MARGIN,
            right: core.right + SIDE_MARGIN,
            top: core.top - TOP_MARGIN,
            bottom: core.bottom + TOP_MARGIN,
          },
          content: { people, unions, routes: clipped },
          continuation: [],
          detail: true,
        },
      });
    }
  }
  for (const { row, col, page, crossings } of tiles.values()) {
    for (const crossing of crossings) {
      const [dy, dx, opposite] = adjoining[crossing.side];
      const other = tiles.get(`${row + dy}:${col + dx}`);
      if (
        !other?.crossings.some(
          (candidate) =>
            candidate.side === opposite &&
            candidate.route === crossing.route &&
            Math.hypot(candidate.x - crossing.x, candidate.y - crossing.y) < EPSILON,
        )
      )
        continue;
      if (
        page.continuation.some(
          (marker) =>
            marker.side === crossing.side &&
            marker.page === other.page.number &&
            Math.hypot(marker.x - crossing.x, marker.y - crossing.y) < EPSILON,
        )
      )
        continue;
      const { x, y, side } = crossing;
      page.continuation.push({ x, y, side, page: other.page.number, points: [{ x, y }] });
    }
    page.continuation.sort((a, b) => a.side.localeCompare(b.side) || a.y - b.y || a.x - b.x);
    page.continuation = page.continuation.reduce<PrintPage["continuation"]>((markers, current) => {
      const previous = markers.at(-1);
      const threshold = current.side === "top" || current.side === "bottom" ? 92 : 26;
      if (
        previous &&
        previous.side === current.side &&
        previous.page === current.page &&
        Math.hypot(previous.x - current.x, previous.y - current.y) < threshold
      )
        previous.points.push(...current.points);
      else markers.push(current);
      return markers;
    }, []);
  }
  return [panorama, ...[...tiles.values()].map(({ page }) => page)];
}
