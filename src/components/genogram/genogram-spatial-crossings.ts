export type SpatialPoint2D = { x: number; y: number };

type SpatialRouteGeometry = {
  id: string;
  unionId?: string;
  sharedAnchor?: string;
  priority: number;
  strokes: SpatialPoint2D[][];
};

type Range = { start: number; end: number };
type Segment = Range & {
  id: number;
  route: SpatialRouteGeometry;
  horizontal: boolean;
  fixed: number;
  bridges: Range[];
};

const CELL_SIZE = 240;
const EPSILON = 0.01;
const BRIDGE_RADIUS = 15;
const BRIDGE_HEIGHT = 19;

function pathThrough(points: SpatialPoint2D[]) {
  return points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function coordinates(segment: Segment, along: number, normal = 0) {
  return segment.horizontal
    ? `${along} ${segment.fixed - normal}`
    : `${segment.fixed + normal} ${along}`;
}

function frontSegment(a: Segment, b: Segment) {
  if (a.route.priority !== b.route.priority) return a.route.priority > b.route.priority ? a : b;
  return a.route.id < b.route.id ? a : b;
}

function inside(value: number, segment: Segment) {
  return value > segment.start + EPSILON && value < segment.end - EPSILON;
}

function contains(value: number, segment: Segment) {
  return value >= segment.start - EPSILON && value <= segment.end + EPSILON;
}

function addBridge(segment: Segment, start: number, end: number) {
  const clippedStart = Math.max(segment.start + EPSILON, start);
  const clippedEnd = Math.min(segment.end - EPSILON, end);
  if (clippedEnd - clippedStart < 7) return;
  segment.bridges.push({ start: clippedStart, end: clippedEnd });
}

function separateIntersection(a: Segment, b: Segment) {
  if (a.route.id === b.route.id) return;
  const joinsUnion = a.route.unionId && a.route.unionId === b.route.unionId;
  const joinsPerson = a.route.sharedAnchor && a.route.sharedAnchor === b.route.sharedAnchor;
  if (a.horizontal === b.horizontal) {
    // A shared port or a union trunk is an intended join, even when drawn by two strokes.
    if (joinsUnion || joinsPerson || Math.abs(a.fixed - b.fixed) > EPSILON) return;
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    if (end - start >= 8) addBridge(frontSegment(a, b), start - 6, end + 6);
    return;
  }
  const horizontal = a.horizontal ? a : b;
  const vertical = a.horizontal ? b : a;
  if (!contains(vertical.fixed, horizontal) || !contains(horizontal.fixed, vertical)) return;
  const throughHorizontal = inside(vertical.fixed, horizontal);
  const throughVertical = inside(horizontal.fixed, vertical);
  if (!throughHorizontal && !throughVertical) return;
  // Keep the end of an anchored stroke fixed at a T crossing. Only a passing
  // stroke can lift away, and a known common trunk or port stays joined.
  if ((!throughHorizontal || !throughVertical) && (joinsUnion || joinsPerson)) return;
  const front =
    throughHorizontal && throughVertical
      ? frontSegment(a, b)
      : throughHorizontal
        ? horizontal
        : vertical;
  const crossing = front.horizontal ? vertical.fixed : horizontal.fixed;
  addBridge(front, crossing - BRIDGE_RADIUS, crossing + BRIDGE_RADIUS);
}

function findIntersections(segments: Segment[]) {
  const cells = new Map<string, Segment[]>();
  for (const segment of segments) {
    const row = Math.floor(segment.fixed / CELL_SIZE);
    const first = Math.floor(segment.start / CELL_SIZE);
    const last = Math.floor(segment.end / CELL_SIZE);
    const seen = new Set<number>();
    for (let i = first; i <= last; i++) {
      const key = segment.horizontal ? `${i}:${row}` : `${row}:${i}`;
      const cell = cells.get(key);
      if (!cell) {
        cells.set(key, [segment]);
        continue;
      }
      for (const other of cell) {
        if (seen.has(other.id)) continue;
        seen.add(other.id);
        separateIntersection(segment, other);
      }
      cell.push(segment);
    }
  }
}

function renderSegment(segment: Segment, backwards: boolean, depth: SpatialPoint2D) {
  const ranges: Range[] = [];
  for (const range of segment.bridges.sort((a, b) => a.start - b.start)) {
    const previous = ranges.at(-1);
    if (previous && range.start <= previous.end + 4) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      ranges.push({ ...range });
    }
  }
  if (backwards) ranges.reverse();

  const sections = [];
  const bridgePaths = [];
  const height = BRIDGE_HEIGHT + (segment.horizontal ? depth.y : depth.x);
  for (const range of ranges) {
    const from = backwards ? range.end : range.start;
    const to = backwards ? range.start : range.end;
    const rise = Math.min(14, (range.end - range.start) / 2) * (backwards ? -1 : 1);
    sections.push(`L ${coordinates(segment, from)} M ${coordinates(segment, to)}`);
    bridgePaths.push(
      [
        `M ${coordinates(segment, from)}`,
        `C ${coordinates(segment, from + rise * 0.28)} ${coordinates(segment, from + rise * 0.55, height)} ${coordinates(segment, from + rise, height)}`,
        `L ${coordinates(segment, to - rise, height)}`,
        `C ${coordinates(segment, to - rise * 0.55, height)} ${coordinates(segment, to - rise * 0.28)} ${coordinates(segment, to)}`,
      ].join(" "),
    );
  }
  return { sections, bridgePaths };
}

export function renderSpatialRoutes<T extends SpatialRouteGeometry>(
  routes: T[],
  depth: SpatialPoint2D | null,
) {
  if (!depth) {
    return routes.map(({ strokes, priority: _priority, sharedAnchor: _anchor, ...route }) => ({
      ...route,
      path: strokes.map(pathThrough).join(" "),
      bridgePaths: [] as string[],
    }));
  }
  const segments: Segment[] = [];
  const routeSegments = routes.map((route) =>
    route.strokes.map((stroke) =>
      stroke.slice(1).map((to, index) => {
        const from = stroke[index];
        const horizontal = Math.abs(from.y - to.y) < EPSILON;
        const start = horizontal ? from.x : from.y;
        const end = horizontal ? to.x : to.y;
        if (Math.abs(end - start) <= EPSILON) return undefined;
        const segment: Segment = {
          id: segments.length,
          route,
          horizontal,
          fixed: horizontal ? from.y : from.x,
          start: Math.min(start, end),
          end: Math.max(start, end),
          bridges: [],
        };
        segments.push(segment);
        return { segment, backwards: start > end };
      }),
    ),
  );
  findIntersections(segments);
  return routes.map(
    ({ strokes, priority: _priority, sharedAnchor: _anchor, ...route }, routeIndex) => {
      const bridgePaths: string[] = [];
      const paths = strokes.map((stroke, strokeIndex) => {
        const entries = routeSegments[routeIndex][strokeIndex];
        if (entries.every((entry) => !entry?.segment.bridges.length)) return pathThrough(stroke);
        const commands = [`M ${stroke[0].x} ${stroke[0].y}`];
        for (let i = 1; i < stroke.length; i++) {
          const entry = entries[i - 1];
          if (entry?.segment.bridges.length) {
            const bridge = renderSegment(entry.segment, entry.backwards, depth);
            commands.push(...bridge.sections);
            bridgePaths.push(...bridge.bridgePaths);
          }
          commands.push(`L ${stroke[i].x} ${stroke[i].y}`);
        }
        return commands.join(" ");
      });
      return { ...route, path: paths.join(" "), bridgePaths };
    },
  );
}
