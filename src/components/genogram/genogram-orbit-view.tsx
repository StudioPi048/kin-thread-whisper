import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import type { Edge, Node } from "@xyflow/react";
import {
  ArrowLeft,
  ArrowUpToLine,
  Focus,
  GitBranch,
  Hand,
  Minus,
  Orbit,
  Plus,
  Square,
  X,
} from "lucide-react";
import {
  buildOrbitModel,
  fitOrbitCamera,
  ORBIT_DEFAULT_ANGLES,
  ORBIT_FRONT_ANGLES,
  ORBIT_MAX_PITCH,
  projectOrbitPoint,
  projectOrbitScene,
  type OrbitAngles,
  type OrbitCamera,
  type OrbitFrame,
  type OrbitRoute,
} from "./genogram-orbit-model";
import { traceOrbitLineage } from "./genogram-orbit-lineage";
import {
  mapBranchNames,
  readMapViewAnchor,
  type MapBranch,
  type MapViewAnchor,
} from "./map-view-context";
import type { ParentagePreview } from "./parentage-preview";
import { personSymbol } from "./person-symbol";
import "./genogram-orbit-view.css";

export type OrbitCameraSnapshot = {
  camera: OrbitCamera;
  branch: MapBranch | null;
  personIds: readonly string[];
};

export type OrbitCameraHandle = {
  read: () => OrbitCameraSnapshot | undefined;
  restore: (snapshot: OrbitCameraSnapshot) => void;
  readAnchor: () => MapViewAnchor | undefined;
};

interface GenogramOrbitViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedPersonId?: string | null;
  onSelectPerson: (id: string) => void;
  connectionOriginId?: string | null;
  focusRequest?: { personId: string; relatedPersonIds?: readonly string[] };
  parentagePreview?: ParentagePreview | null;
  highlightedBranch?: MapBranch | null;
  onBranchChange?: (branch: MapBranch | null) => void;
  onReturnToBoard?: () => void;
  onFocusPerson?: (id: string) => void;
  onReviewParentage?: (id: string) => void;
  onEditRelationship?: (id: string) => void;
  fitRequest?: number;
  viewAnchor?: MapViewAnchor;
  cameraRef?: Ref<OrbitCameraHandle>;
}

type Point = { x: number; y: number };
type ProjectedPerson = ReturnType<typeof projectOrbitScene>["people"][number];
type NamePlacement = {
  person: ProjectedPerson;
  x: number;
  width: number;
  fontSize: number;
};

const BRANCHES = ["paternal", "maternal"] as const;
const ZOOM_MIN = 0.26;
const ZOOM_MAX = 5;
const TURN = Math.PI * 2;
const clamp = (number: number, min: number, max: number) => Math.min(max, Math.max(min, number));

function placeNames(people: readonly ProjectedPerson[], frame: OrbitFrame) {
  const rows = new Map<number, NamePlacement[]>();
  const placements = new Map<string, NamePlacement>();
  for (const person of people) {
    const placement = {
      person,
      x: person.x,
      width: clamp(158 * person.scale, 19, 212),
      fontSize: clamp(15 * person.scale, 3, 16),
    };
    placements.set(person.id, placement);
    if (!person.visible) continue;
    const row = rows.get(person.generation) ?? [];
    row.push(placement);
    rows.set(person.generation, row);
  }
  // The printed names can move sideways for readability, while their markers
  // and all relationship endpoints stay at the original XYZ coordinates.
  for (const row of rows.values()) {
    row.sort((first, second) => first.x - second.x);
    const inFrame = row.every(
      ({ person }) =>
        person.x >= 0 && person.x <= frame.width && person.y >= 0 && person.y <= frame.height,
    );
    const margin = Math.min(10, frame.width * 0.12);
    const gap = inFrame ? Math.min(3, (frame.width * 0.15) / row.length) : 3;
    const availableWidth = frame.width - margin * 2 - gap * (row.length - 1);
    const totalWidth = row.reduce((sum, item) => sum + item.width, 0);
    if (inFrame && totalWidth > availableWidth) {
      const ratio = Math.max(0.1, availableWidth / totalWidth);
      for (const item of row) {
        item.width *= ratio;
        item.fontSize *= ratio;
      }
    }
    const proband = row.findIndex(({ person }) => person.data.is_proband);
    const center = proband >= 0 ? proband : Math.floor((row.length - 1) / 2);
    for (const direction of [-1, 1]) {
      for (let index = center + direction; index >= 0 && index < row.length; index += direction) {
        const item = row[index];
        const neighbor = row[index - direction];
        const distance = (item.width + neighbor.width) / 2 + gap;
        const boundary = neighbor.x + direction * distance;
        item.x = direction < 0 ? Math.min(item.x, boundary) : Math.max(item.x, boundary);
      }
    }
    if (inFrame) {
      let left = margin;
      let remaining = row.reduce((sum, item) => sum + item.width + gap, 0);
      for (const item of row) {
        remaining -= item.width + gap;
        const halfWidth = item.width / 2;
        const right = frame.width - margin - remaining;
        item.x = clamp(item.x, left + halfWidth, right - halfWidth);
        left = item.x + halfWidth + gap;
      }
    }
  }
  return placements;
}

function rotated(camera: OrbitCamera, yaw: number, pitch: number): OrbitCamera {
  return {
    ...camera,
    yaw: ((((camera.yaw + yaw + Math.PI) % TURN) + TURN) % TURN) - Math.PI,
    pitch: clamp(camera.pitch + pitch, -ORBIT_MAX_PITCH, ORBIT_MAX_PITCH),
  };
}

function zoomed(camera: OrbitCamera, factor: number, pivot: Point = { x: 0, y: 0 }): OrbitCamera {
  const zoom = clamp(camera.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const ratio = zoom / camera.zoom;
  return {
    ...camera,
    zoom,
    panX: pivot.x - (pivot.x - camera.panX) * ratio,
    panY: pivot.y - (pivot.y - camera.panY) * ratio,
  };
}

function recordedParents(routes: readonly OrbitRoute[]) {
  const parentsByChild = new Map<string, string[]>();
  for (const route of routes) {
    if (route.kind !== "pedigree" || route.suggested || !route.childId || !route.parentIds)
      continue;
    const parents = parentsByChild.get(route.childId) ?? [];
    parents.push(...route.parentIds);
    parentsByChild.set(route.childId, parents);
  }
  return parentsByChild;
}

function ancestorIds(parentsByChild: ReadonlyMap<string, readonly string[]>, people: string[]) {
  const ids = new Set(people);
  const queue = [...ids];
  for (let index = 0; index < queue.length; index++) {
    for (const parent of parentsByChild.get(queue[index]) ?? []) {
      if (ids.has(parent)) continue;
      queue.push(parent);
      ids.add(parent);
    }
  }
  return queue;
}

function previewRole(preview: ParentagePreview | null | undefined, id: string) {
  if (!preview) return undefined;
  if (id === preview.childId) return "subject";
  if (preview.proposedParentIds.includes(id)) {
    if (preview.phase === "confirmed") return "confirmed";
    return preview.previousParentIds.includes(id) ? "retained" : "proposed";
  }
  if (preview.previousParentIds.includes(id)) return "previous";
}

function comparisonTracks(
  preview: ParentagePreview | null | undefined,
  people: ReadonlyMap<string, ProjectedPerson>,
  camera: OrbitCamera,
  frame: OrbitFrame,
) {
  const child = preview && people.get(preview.childId);
  if (!preview || !child?.visible) return [];
  return [...new Set([...preview.previousParentIds, ...preview.proposedParentIds])].flatMap(
    (id) => {
      const parent = people.get(id);
      const role = previewRole(preview, id);
      if (!parent?.visible || !role) return [];
      const midY = (child.world.y + parent.world.y) / 2;
      const childCorner = projectOrbitPoint({ ...child.world, y: midY }, camera, frame);
      const parentCorner = projectOrbitPoint({ ...parent.world, y: midY }, camera, frame);
      if (!childCorner.visible || !parentCorner.visible) return [];
      const points = [child, childCorner, parentCorner, parent];
      return [{ id, role, d: "M " + points.map(({ x, y }) => `${x} ${y}`).join(" L ") }];
    },
  );
}

export function GenogramOrbitView({
  nodes,
  edges,
  selectedPersonId,
  onSelectPerson,
  connectionOriginId,
  focusRequest,
  parentagePreview,
  highlightedBranch,
  onBranchChange,
  onReturnToBoard,
  onFocusPerson,
  onReviewParentage,
  onEditRelationship,
  fitRequest,
  viewAnchor,
  cameraRef,
}: GenogramOrbitViewProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const planePatternId = useId();
  const pointerPositions = useRef(new Map<number, Point>());
  const queuedCameraChange = useRef<((camera: OrbitCamera) => OrbitCamera) | null>(null);
  const animationFrame = useRef<number | null>(null);
  const lastFit = useRef(fitRequest);
  const lastFocus = useRef(focusRequest);
  const lastAnchor = useRef<MapViewAnchor>(undefined);
  const [frame, setFrame] = useState<OrbitFrame>({ width: 0, height: 0 });
  const [cameraOverride, setCameraOverride] = useState<OrbitCamera | null>(null);
  const [localBranch, setLocalBranch] = useState<MapBranch | null>(null);
  const [lineage, setLineage] = useState<readonly string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const model = useMemo(() => buildOrbitModel(nodes, edges), [nodes, edges]);
  const requestedBranch = highlightedBranch === undefined ? localBranch : highlightedBranch;
  const branch =
    requestedBranch && model.people.some((person) => person.branch === requestedBranch)
      ? requestedBranch
      : null;
  const lastBranch = useRef(branch);
  const hasFrame = frame.width > 0 && frame.height > 0;
  const selected = model.people.find(({ id }) => id === selectedPersonId);
  const parentsByChild = useMemo(() => recordedParents(model.routes), [model.routes]);
  const possibleLineage = useMemo(
    () => (selectedPersonId ? ancestorIds(parentsByChild, [selectedPersonId]) : []),
    [parentsByChild, selectedPersonId],
  );
  const probandId = model.people.find(({ data }) => data.is_proband)?.id;
  const pathToProband = useMemo(
    () => traceOrbitLineage(model.routes, probandId, selectedPersonId),
    [model.routes, probandId, selectedPersonId],
  );

  const branchPeople = useCallback(
    (side: MapBranch) => {
      const sidePeople = model.people.filter((person) => person.branch === side);
      // A shared ancestor appears just once, but both registered lines can reach it.
      const linked = new Set(
        ancestorIds(
          parentsByChild,
          sidePeople.map(({ id }) => id),
        ),
      );
      return model.people
        .filter(
          ({ id, generation, branch: personBranch }) =>
            generation === 0 ||
            personBranch === side ||
            (personBranch === "common" && linked.has(id)),
        )
        .map(({ id }) => id);
    },
    [model.people, parentsByChild],
  );
  const scopedIds = useMemo(
    () => new Set(lineage.length ? lineage : branch ? branchPeople(branch) : []),
    [branch, branchPeople, lineage],
  );

  const fitted = useMemo(() => fitOrbitCamera(model, frame, ORBIT_DEFAULT_ANGLES), [frame, model]);
  const defaultCamera = useMemo(
    () =>
      branch ? fitOrbitCamera(model, frame, ORBIT_DEFAULT_ANGLES, branchPeople(branch)) : fitted,
    [branch, branchPeople, fitted, frame, model],
  );
  const camera = cameraOverride ?? defaultCamera;
  const projected = useMemo(() => projectOrbitScene(model, camera, frame), [camera, frame, model]);
  const projectedById = useMemo(
    () => new Map(projected.people.map((person) => [person.id, person])),
    [projected.people],
  );
  const namePlacements = useMemo(
    () => placeNames(projected.people, frame),
    [projected.people, frame],
  );
  const peopleById = useMemo(
    () => new Map(model.people.map((person) => [person.id, person])),
    [model.people],
  );
  const depthIndex = useMemo(
    () => new Map(projected.people.map(({ id }, index) => [id, index])),
    [projected.people],
  );
  const activeRoute = projected.routes.find(({ id }) => id === activeRouteId);
  const activePeople = new Set(activeRoute?.personIds);
  const unions = new Map<string, (typeof projected.routes)[number]>();
  for (const route of projected.routes) {
    if (route.kind === "partner" && route.unionId && route.personIds.length > 1) {
      const previous = unions.get(route.unionId);
      if (!previous || pathToProband.has(route.id) || route.id === activeRouteId) {
        unions.set(route.unionId, route);
      }
    }
  }
  const tracks = comparisonTracks(
    parentagePreview,
    projectedById,
    { ...camera, pitch: projected.pitch },
    frame,
  );

  const changeCamera = useCallback(
    (change: (camera: OrbitCamera) => OrbitCamera) => {
      setCameraOverride((current) => change(current ?? defaultCamera));
    },
    [defaultCamera],
  );

  function queueCameraChange(change: (camera: OrbitCamera) => OrbitCamera) {
    const previous = queuedCameraChange.current;
    queuedCameraChange.current = previous ? (next) => change(previous(next)) : change;
    animationFrame.current ??= requestAnimationFrame(() => {
      animationFrame.current = null;
      const apply = queuedCameraChange.current;
      queuedCameraChange.current = null;
      if (apply) changeCamera(apply);
    });
  }

  const branchFocus = useCallback(
    (next: MapBranch | null) => {
      lastBranch.current = next;
      if (onBranchChange) onBranchChange(next);
      else setLocalBranch(next);
      setLineage([]);
      setActiveRouteId(null);
      changeCamera((current) =>
        fitOrbitCamera(model, frame, current, next ? branchPeople(next) : undefined),
      );
    },
    [branchPeople, changeCamera, frame, model, onBranchChange],
  );

  useImperativeHandle(
    cameraRef,
    () => ({
      read: () => (hasFrame ? { camera, branch, personIds: lineage } : undefined),
      restore: ({ camera: savedCamera, branch: savedBranch, personIds }) => {
        lastBranch.current = savedBranch;
        if (highlightedBranch === undefined) setLocalBranch(savedBranch);
        setLineage(personIds);
        setActiveRouteId(null);
        setCameraOverride(savedCamera);
      },
      readAnchor: () => {
        const overview = !scopedIds.size && cameraOverride === null;
        const visible = projected.people.filter((person) => person.visible);
        const anchor = readMapViewAnchor(
          visible,
          frame.width,
          frame.height,
          (fitted.distance / camera.distance) * camera.zoom,
          selectedPersonId,
        );
        return anchor ? { ...anchor, overview } : undefined;
      },
    }),
    [
      branch,
      camera,
      cameraOverride,
      fitted.distance,
      frame,
      hasFrame,
      highlightedBranch,
      lineage,
      projected.people,
      scopedIds.size,
      selectedPersonId,
    ],
  );

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setFrame((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 12 : event.deltaMode === 2 ? rect.height : 1;
      const factor = Math.exp(clamp(-event.deltaY * unit * 0.0018, -0.75, 0.75));
      changeCamera((current) =>
        zoomed(current, factor, {
          x: event.clientX - rect.left - rect.width / 2,
          y: event.clientY - rect.top - rect.height / 2,
        }),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [changeCamera]);

  useEffect(() => {
    if (!hasFrame || lastFit.current === fitRequest) return;
    lastFit.current = fitRequest;
    branchFocus(null);
  }, [branchFocus, fitRequest, hasFrame]);

  useEffect(() => {
    if (!hasFrame || lastBranch.current === branch) return;
    lastBranch.current = branch;
    setLineage([]);
    changeCamera((current) =>
      fitOrbitCamera(model, frame, current, branch ? branchPeople(branch) : undefined),
    );
  }, [branch, branchPeople, changeCamera, frame, hasFrame, model]);

  useEffect(() => {
    if (!hasFrame || !focusRequest || lastFocus.current === focusRequest) return;
    if (!peopleById.has(focusRequest.personId)) return;
    lastFocus.current = focusRequest;
    setActiveRouteId(null);
    const people = [focusRequest.personId, ...(focusRequest.relatedPersonIds ?? [])];
    changeCamera((current) => fitOrbitCamera(model, frame, current, people));
  }, [changeCamera, focusRequest, frame, hasFrame, model, peopleById]);

  useEffect(() => {
    if (!hasFrame || !viewAnchor || lastAnchor.current === viewAnchor) return;
    const person = peopleById.get(viewAnchor.personId);
    if (!person) return;
    lastAnchor.current = viewAnchor;
    if (viewAnchor.overview) return;
    changeCamera((current) => {
      const fitted = fitOrbitCamera(model, frame, current);
      return {
        ...fitted,
        target: person.world,
        zoom: clamp(viewAnchor.scale, ZOOM_MIN, ZOOM_MAX),
        panX: frame.width * (viewAnchor.horizontal - 0.5),
        panY: frame.height * (viewAnchor.vertical - 0.5),
      };
    });
  }, [changeCamera, frame, hasFrame, model, peopleById, viewAnchor]);

  function fitAt(angles: OrbitAngles) {
    changeCamera(() =>
      fitOrbitCamera(model, frame, angles, scopedIds.size ? [...scopedIds] : undefined),
    );
  }

  function focusPerson(id: string) {
    setActiveRouteId(null);
    changeCamera((current) => fitOrbitCamera(model, frame, current, [id]));
  }

  function followLineage() {
    if (!selectedPersonId || possibleLineage.length < 2) return;
    setLineage(possibleLineage);
    setActiveRouteId(null);
    changeCamera((current) => fitOrbitCamera(model, frame, current, possibleLineage));
  }

  function onPointerStart(event: PointerEvent<HTMLDivElement>) {
    if (event.button < 0 || event.button > 2 || !(event.target instanceof Element)) return;
    if (event.target.closest("button, [data-orbit-route-hit], [data-orbit-union]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerPositions.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointerPositions.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointerPositions.current.set(event.pointerId, next);
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const other = [...pointerPositions.current].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
      const distance = Math.hypot(next.x - other.x, next.y - other.y);
      const bounds = event.currentTarget.getBoundingClientRect();
      const pivot = {
        x: (previous.x + other.x) / 2 - bounds.left - bounds.width / 2,
        y: (previous.y + other.y) / 2 - bounds.top - bounds.height / 2,
      };
      queueCameraChange((current) => {
        const nextCamera = zoomed(current, oldDistance > 8 ? distance / oldDistance : 1, pivot);
        return { ...nextCamera, panX: nextCamera.panX + dx / 2, panY: nextCamera.panY + dy / 2 };
      });
    } else if (panMode || event.shiftKey || (event.buttons & 6) !== 0) {
      queueCameraChange((current) => ({
        ...current,
        panX: current.panX + dx,
        panY: current.panY + dy,
      }));
    } else {
      queueCameraChange((current) => rotated(current, dx * 0.009, -dy * 0.005));
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointerPositions.current.delete(event.pointerId);
    if (!pointerPositions.current.size) setDragging(false);
  }

  function onKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey)
      return;
    const pan = panMode || event.shiftKey;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        const x = (event.key === "ArrowLeft" ? -1 : 0) + (event.key === "ArrowRight" ? 1 : 0);
        const y = (event.key === "ArrowUp" ? -1 : 0) + (event.key === "ArrowDown" ? 1 : 0);
        changeCamera((current) =>
          pan
            ? { ...current, panX: current.panX + x * 56, panY: current.panY + y * 56 }
            : rotated(current, x * 0.17, -y * 0.105),
        );
        break;
      }
      case "+":
      case "=":
        changeCamera((current) => zoomed(current, 1.25));
        break;
      case "-":
        changeCamera((current) => zoomed(current, 0.8));
        break;
      case "0":
      case "Home":
        branchFocus(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function revealPerson({ person, x, width }: NamePlacement) {
    const margin = 28;
    if (
      x + width / 2 < margin ||
      x - width / 2 > frame.width - margin ||
      person.y < margin ||
      person.y > frame.height - margin
    ) {
      focusPerson(person.id);
    }
  }

  const displayedBranches = BRANCHES.filter((side) =>
    model.people.some((person) => person.branch === side),
  );
  const routeName =
    activeRoute?.kind === "pedigree"
      ? activeRoute.suggested
        ? "Filiação sugerida"
        : "Filiação registrada"
      : activeRoute?.kind === "partner"
        ? "União"
        : "Vínculo";

  return (
    <section
      className="geno-orbit"
      aria-label="Cena orbital do genossociograma"
      data-orbit-branch={branch ?? "all"}
    >
      <div className="geno-orbit-navigation">
        <div className="geno-orbit-branches" role="group" aria-label="Ramos na cena orbital">
          <button
            type="button"
            aria-pressed={!branch && !lineage.length}
            onClick={() => branchFocus(null)}
          >
            Árvore inteira
          </button>
          {displayedBranches.map((side) => (
            <button
              key={side}
              type="button"
              data-branch={side}
              aria-pressed={branch === side && !lineage.length}
              onClick={() => branchFocus(side)}
            >
              {mapBranchNames[side]}
            </button>
          ))}
        </div>
        {onReturnToBoard && (
          <button
            type="button"
            className="geno-orbit-return"
            aria-label="Voltar ao board"
            onClick={onReturnToBoard}
          >
            <ArrowLeft aria-hidden /> <span>Voltar ao board</span>
          </button>
        )}
      </div>

      <div
        className="geno-orbit-viewport"
        ref={viewport}
        role="region"
        aria-label="Área de navegação orbital"
        aria-describedby={instructionsId}
        tabIndex={0}
        data-dragging={dragging || undefined}
        data-pan={panMode || undefined}
        data-azimuth={camera.yaw.toFixed(4)}
        data-inclination={camera.pitch.toFixed(4)}
        onPointerDown={onPointerStart}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onLostPointerCapture={onPointerEnd}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={onKeyboard}
      >
        {!model.people.length && (
          <p className="geno-orbit-empty">Nenhum familiar disponível no mapa.</p>
        )}
        {hasFrame && (
          <>
            <svg
              className="geno-orbit-world"
              width={frame.width}
              height={frame.height}
              aria-hidden="true"
            >
              <defs>
                <pattern id={planePatternId} width="7" height="7" patternUnits="userSpaceOnUse">
                  <path d="M 0 7 L 7 0" className="geno-orbit-hatch" />
                </pattern>
              </defs>
              {projected.generations
                .filter(({ visible }) => visible)
                .map((plane) => (
                  <g key={plane.generation} data-orbit-generation={plane.generation}>
                    <path d={plane.d} className="geno-orbit-plane" />
                    <path
                      d={plane.d}
                      className="geno-orbit-plane-texture"
                      fill={`url(#${planePatternId})`}
                    />
                  </g>
                ))}
              {projected.routes
                .filter(({ visible }) => visible)
                .map((route) => {
                  const selected =
                    pathToProband.size === 0 &&
                    selectedPersonId &&
                    route.personIds.includes(selectedPersonId);
                  const isOnPath = pathToProband.has(route.id);
                  const lineageRoute =
                    lineage.length && route.personIds.every((id) => scopedIds.has(id));
                  const active = route.id === activeRouteId || selected || lineageRoute || isOnPath;
                  const related =
                    scopedIds.size === 0 || route.personIds.some((id) => scopedIds.has(id));
                  return (
                    <g key={route.id}>
                      <path
                        className="geno-orbit-route"
                        d={route.d}
                        data-orbit-route={route.id}
                        data-branch={route.branch}
                        data-suggested={route.suggested || undefined}
                        data-muted={(!active && !related) || undefined}
                        data-active={!!active || undefined}
                        data-lineage={isOnPath || undefined}
                      />
                      <path
                        d={route.d}
                        className="geno-orbit-route-hit"
                        data-orbit-route-hit={route.id}
                        onClick={() => setActiveRouteId(route.id)}
                      />
                    </g>
                  );
                })}
              {[...unions].map(([id, route]) => {
                const point = projectOrbitPoint(
                  route.points[route.points.length - 1],
                  { ...camera, pitch: projected.pitch },
                  frame,
                );
                if (!point.visible) return null;
                const muted =
                  scopedIds.size > 0 && !route.personIds.some((id) => scopedIds.has(id));
                return (
                  <g
                    key={id}
                    className="geno-orbit-union"
                    data-orbit-union={id}
                    data-muted={muted || undefined}
                    data-active={
                      pathToProband.has(route.id) || activeRouteId === route.id || undefined
                    }
                    transform={`translate(${point.x} ${point.y})`}
                    onClick={() => setActiveRouteId(route.id)}
                  >
                    <circle r="11" className="geno-orbit-union-hit" />
                    <path d="M 0 -4 L 4 0 L 0 4 L -4 0 Z" />
                  </g>
                );
              })}
              {tracks.map(({ id, role, d }) => (
                <path
                  key={id}
                  d={d}
                  data-parentage-track={role}
                  className="geno-orbit-review-track"
                />
              ))}
              {[...namePlacements.values()].flatMap(({ person, x }) =>
                person.visible && Math.abs(person.x - x) >= 3
                  ? [
                      <line
                        key={person.id}
                        x1={person.x}
                        y1={person.y}
                        x2={x}
                        y2={person.y}
                        className="geno-orbit-name-leader"
                        data-branch={person.branch}
                      />,
                    ]
                  : [],
              )}
            </svg>
            <div className="geno-orbit-generation-labels" aria-hidden="true">
              {projected.generations
                .filter(({ visible, y }) => visible && y >= 10 && y < frame.height - 12)
                .map((plane) => (
                  <span
                    key={plane.generation}
                    style={{ top: plane.y, left: clamp(plane.x - 10, 10, frame.width - 105) }}
                  >
                    {plane.label}
                  </span>
                ))}
            </div>
            <div className="geno-orbit-people">
              {model.people.map(
                ({ id, data, name, relationship, branch: personBranch, generation }) => {
                  const placement = namePlacements.get(id);
                  const role = previewRole(parentagePreview, id);
                  const active =
                    id === selectedPersonId ||
                    id === connectionOriginId ||
                    role ||
                    activePeople.has(id);
                  if (!placement) return null;
                  const { person, x, width, fontSize } = placement;
                  const symbol = personSymbol(data);
                  const title =
                    relationship && relationship !== name ? `${name}, ${relationship}` : name;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="geno-orbit-person"
                      style={{
                        top: person.y,
                        left: x,
                        width,
                        fontSize,
                        zIndex: (depthIndex.get(id) ?? 0) + (active ? model.people.length : 0),
                      }}
                      hidden={!person.visible}
                      aria-pressed={id === selectedPersonId}
                      aria-label={title}
                      title={title}
                      data-person-id={id}
                      data-generation={generation}
                      data-branch={personBranch}
                      data-reference={data.is_proband || undefined}
                      data-connection-origin={id === connectionOriginId || undefined}
                      data-muted={
                        (scopedIds.size > 0 && !scopedIds.has(id) && !active && generation !== 0) ||
                        undefined
                      }
                      data-parentage-person={role}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) revealPerson(placement);
                      }}
                      onClick={() => {
                        setActiveRouteId(null);
                        onSelectPerson(id);
                      }}
                    >
                      <i
                        className="geno-orbit-symbol"
                        data-symbol={symbol}
                        data-deceased={data.is_deceased || undefined}
                        aria-hidden
                      />
                      <span className="geno-orbit-person-name">{name}</span>
                    </button>
                  );
                },
              )}
            </div>
          </>
        )}
      </div>

      {(lineage.length > 0 || activeRoute) && (
        <div
          className="geno-orbit-context"
          role="region"
          aria-label={activeRoute ? "Vínculo em foco" : "Ascendência em foco"}
        >
          <span>
            <strong>
              {activeRoute ? routeName : `Ascendência de ${peopleById.get(lineage[0])?.name ?? ""}`}
            </strong>
            {activeRoute?.personIds
              .map((id) => peopleById.get(id)?.name)
              .filter(Boolean)
              .join(" · ")}
          </span>
          {activeRoute?.childId && onReviewParentage && (
            <button
              type="button"
              onClick={() => {
                onReviewParentage(activeRoute.childId!);
                setActiveRouteId(null);
              }}
            >
              Revisar filiação
            </button>
          )}
          {activeRoute?.relationshipId && onEditRelationship && (
            <button
              type="button"
              onClick={() => {
                onEditRelationship(activeRoute.relationshipId!);
                setActiveRouteId(null);
              }}
            >
              Editar vínculo
            </button>
          )}
          <button
            type="button"
            aria-label="Fechar foco do mapa"
            onClick={() => {
              if (activeRoute) setActiveRouteId(null);
              else branchFocus(branch);
            }}
          >
            <X aria-hidden />
          </button>
        </div>
      )}

      <div className="geno-orbit-controls" role="group" aria-label="Câmera da cena orbital">
        <button
          type="button"
          aria-label="Vista em órbita"
          title="Vista em órbita"
          onClick={() => fitAt(ORBIT_DEFAULT_ANGLES)}
        >
          <Orbit aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Vista frontal"
          title="Vista frontal"
          onClick={() => fitAt(ORBIT_FRONT_ANGLES)}
        >
          <Square aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Mover câmera ao arrastar"
          aria-pressed={panMode}
          title="Mover câmera ao arrastar"
          onClick={() => setPanMode((current) => !current)}
        >
          <Hand aria-hidden />
        </button>
        <span className="geno-orbit-control-divider" aria-hidden />
        <button
          type="button"
          aria-label="Afastar cena orbital"
          title="Afastar cena orbital"
          disabled={camera.zoom <= ZOOM_MIN}
          onClick={() => changeCamera((current) => zoomed(current, 0.8))}
        >
          <Minus aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Aproximar cena orbital"
          title="Aproximar cena orbital"
          disabled={camera.zoom >= ZOOM_MAX}
          onClick={() => changeCamera((current) => zoomed(current, 1.25))}
        >
          <Plus aria-hidden />
        </button>
        {probandId && (
          <button
            type="button"
            aria-label="Ir ao topo da árvore"
            title="Ir ao consultante e aos irmãos"
            onClick={() => {
              const top = model.people.filter(({ generation }) => generation === 0);
              changeCamera((current) =>
                fitOrbitCamera(
                  model,
                  frame,
                  current,
                  top.map(({ id }) => id),
                ),
              );
            }}
          >
            <ArrowUpToLine aria-hidden />
          </button>
        )}
        {selected && (
          <>
            <span className="geno-orbit-control-divider" aria-hidden />
            <button
              type="button"
              className="geno-orbit-control-labeled"
              aria-label="Focar pessoa selecionada"
              title={selected.name}
              onClick={() => focusPerson(selected.id)}
            >
              <Focus aria-hidden /> <span>Focar pessoa</span>
            </button>
            {possibleLineage.length > 1 && (
              <button
                type="button"
                className="geno-orbit-control-labeled"
                aria-label="Seguir ascendência"
                title="Seguir ascendência"
                aria-pressed={lineage[0] === selected.id}
                onClick={followLineage}
              >
                <GitBranch aria-hidden /> <span>Seguir ascendência</span>
              </button>
            )}
            {onFocusPerson && (
              <button
                type="button"
                className="geno-orbit-reader"
                onClick={() => onFocusPerson(selected.id)}
              >
                Ler ficha
              </button>
            )}
          </>
        )}
        <p className="geno-orbit-gesture" id={instructionsId}>
          {panMode ? "Arraste para mover" : "Arraste para girar"}
          <span className="sr-only">
            . Use roda ou pinça para aproximar, e Shift ao arrastar para mover. No teclado, use as
            setas para girar, Shift com as setas para mover, mais e menos para aproximar e afastar,
            e zero para enquadrar.
          </span>
        </p>
      </div>
    </section>
  );
}
