import { parentLinePatterns } from "@/lib/family-relationships";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, Ref } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
  Box,
  GitFork,
  Layers2,
  List,
  Maximize,
  Minus,
  MoveHorizontal,
  Plus,
  Rotate3D,
  ScanLine,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateBR, relationshipLabel, relationshipQualifiers } from "@/lib/genogram";
import { cn } from "@/lib/utils";
import type { PersonNodeData } from "./person-node";
import type { ParentagePreview } from "./parentage-preview";
import {
  mapBranchNames,
  readMapViewAnchor,
  type MapBranch,
  type MapViewAnchor,
} from "./map-view-context";
import { personSymbol } from "./person-symbol";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  spatialPersonLabel,
  type SpatialAngles,
  SPATIAL_CARD_HEIGHT,
  SPATIAL_CARD_WIDTH,
  SPATIAL_MAX_YAW,
  SPATIAL_MAX_PITCH,
  SPATIAL_MAX_NAME_SIZE,
  SPATIAL_MAX_ROLE_SIZE,
  SPATIAL_SYMBOL_CENTER,
  SPATIAL_X_SCALE,
} from "./genogram-spatial-layout";
import "./genogram-spatial-view.css";

interface GenogramSpatialViewProps {
  nodes: Node[];
  edges: Edge[];
  workbench?: boolean;
  onSelectPerson: (id: string) => void;
  selectedPersonId?: string | null;
  connectionOriginId?: string | null;
  parentagePreview?: ParentagePreview | null;
  focusRequest?: { personId: string; relatedPersonIds?: readonly string[] };
  fitRequest?: number;
  viewAnchor?: MapViewAnchor;
  cameraRef?: Ref<SpatialCameraHandle>;
  highlightedBranch?: MapBranch | null;
  onBranchChange?: (branch: MapBranch | null) => void;
  onFocusPerson?: (id: string) => void;
  onReviewParentage?: (id: string) => void;
  onEditRelationship?: (id: string) => void;
  canMovePeople?: boolean;
  getMovePersonDelta?: (id: string, deltaX: number) => number;
  onMovePerson?: (id: string, deltaX: number) => void;
}

type Frame = { width: number; height: number; controls: number };
type Camera = SpatialAngles & { x: number; y: number; zoom: number };
export type SpatialCamera = Camera & { branch: MapBranch | null; familyFocusId: string | null };
export type SpatialCameraHandle = {
  read: () => SpatialCamera | undefined;
  restore: (camera: SpatialCamera) => void;
  readAnchor: () => MapViewAnchor | undefined;
};
type Pointer = { x: number; y: number };
type Layout = ReturnType<typeof buildSpatialLayout>;
type ProjectedPerson = ReturnType<typeof projectSpatialLayout>["people"][number];
type SpatialRoute = ReturnType<typeof projectSpatialLayout>["routes"][number];
type ProjectedUnion = ReturnType<typeof projectSpatialLayout>["unions"][number];
type MovePreview = { id: string; deltaX: number };

function describeRoute(route: SpatialRoute, names: Map<string, string>, union?: ProjectedUnion) {
  const displayNames = (ids: string[]) =>
    ids
      .map((id) => names.get(id))
      .filter(Boolean)
      .join(" · ");
  const partners = union ? displayNames(union.partners) : "";
  if (route.edge.type === "partner") {
    return { title: partners, detail: union?.label || "União" };
  }
  if (route.edge.type === "pedigree") {
    const kind = relationshipQualifiers.parent.find(({ value }) => value === route.parentKind);
    const relation = route.suggested ? "Filiação sugerida" : "Filiação registrada";
    return {
      title: displayNames(route.childIds ?? []),
      detail: [relation, kind?.label, partners].filter(Boolean).join(" · "),
    };
  }
  const { relationshipType, qualifier } = route.edge.data ?? {};
  return {
    title: displayNames([route.edge.source, route.edge.target]),
    detail:
      typeof relationshipType === "string"
        ? relationshipLabel(relationshipType, typeof qualifier === "string" ? qualifier : undefined)
        : "Vínculo",
  };
}

function sameRoute(a: SpatialRoute | undefined, b: SpatialRoute) {
  return (
    a?.id === b.id ||
    (a?.edge.type === "partner" && b.edge.type === "partner" && a.unionId === b.unionId)
  );
}

const FRONT_ANGLES = { yaw: 0, pitch: 0 };
const OBLIQUE_ANGLES = { yaw: -0.34, pitch: 0.18 };
const MAX_ZOOM = 2.4;
const PAN_STEP = 64;
const FRAME_MARGIN = 24;
const CONTROLS_SPACE = 70;
const HEADER_SPACE = 10;
const FAMILY_NAME_TARGET = 12;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function plaqueNameLimit(name: string) {
  const longestWord = name.split(/\s+/).reduce((length, word) => Math.max(length, word.length), 1);
  return clamp(252 / longestWord, 16, SPATIAL_MAX_NAME_SIZE);
}

function plaqueNameSize(name: string, scale: number, family: boolean) {
  return clamp((family ? FAMILY_NAME_TARGET : 10) / scale, 16, plaqueNameLimit(name));
}

function fitCamera(layout: Layout, frame: Frame, angles: SpatialAngles): Camera {
  return fitProjectedPeople(projectSpatialLayout(layout, angles).people, frame, angles);
}

function confirmedFamilies(layout: Layout) {
  const familyChildren = new Map<string, Set<string>>();
  for (const edge of layout.edges) {
    if (edge.type !== "pedigree" || !Array.isArray(edge.data?.childIds)) continue;
    const unionId = String(edge.data.unionId ?? edge.source);
    const children = familyChildren.get(unionId) ?? new Set<string>();
    const suggested = new Set(
      Array.isArray(edge.data.suggestedChildIds) ? edge.data.suggestedChildIds : [],
    );
    for (const id of edge.data.childIds.map(String)) {
      if (!suggested.has(id)) children.add(id);
    }
    familyChildren.set(unionId, children);
  }
  return layout.unions.map(({ id, partners }) => ({
    parents: partners,
    children: familyChildren.get(id) ?? new Set<string>(),
  }));
}

function familyOf(families: ReturnType<typeof confirmedFamilies>, personId: string) {
  const ids = new Set([personId]);
  for (const { parents, children } of families) {
    if (!parents.includes(personId) && !children.has(personId)) continue;
    parents.forEach((id) => ids.add(id));
    children.forEach((id) => ids.add(id));
  }
  return ids;
}

function branchPeople(
  layout: Layout,
  families: ReturnType<typeof confirmedFamilies>,
  branch: MapBranch,
) {
  const members = layout.people.filter((person) => person.branch === branch).map(({ id }) => id);
  const shared = new Set(
    layout.people.filter(({ branch }) => branch === "common").map(({ id }) => id),
  );
  const parentsByChild = new Map<string, string[]>();
  for (const { parents, children } of families) {
    for (const id of children) {
      parentsByChild.set(id, [...(parentsByChild.get(id) ?? []), ...parents]);
    }
  }
  // Canonical side assignment keeps a shared ancestor in one card. Include
  // that card when a recorded path from the selected side reaches it.
  const ids = new Set(members);
  for (let index = 0; index < members.length; index++) {
    for (const parentId of parentsByChild.get(members[index]) ?? []) {
      if (!shared.has(parentId) || ids.has(parentId)) continue;
      ids.add(parentId);
      members.push(parentId);
    }
  }
  for (const { id, generation } of layout.people) {
    if (generation === 0) ids.add(id);
  }
  return ids;
}

function fitProjectedPeople(
  projected: ProjectedPerson[],
  frame: Frame,
  angles: SpatialAngles,
  familyFocusId?: string | null,
): Camera {
  const { yaw, pitch } = angles;
  if (!projected.length || !frame.width || !frame.height) {
    return { x: 0, y: 0, zoom: 1, yaw, pitch };
  }
  const left = Math.min(...projected.map(({ x, width }) => x - width / 2));
  const right = Math.max(...projected.map(({ x, width }) => x + width / 2));
  const top = Math.min(...projected.map(({ y }) => y));
  const bottom = Math.max(...projected.map(({ y, height }) => y + height));
  const rulerWidth = frame.width >= 690 ? 120 : 0;
  const zoom = Math.min(
    1.14,
    Math.max(1, frame.width - rulerWidth - 2 * FRAME_MARGIN) / (right - left),
    Math.max(1, frame.height - HEADER_SPACE - frame.controls - FRAME_MARGIN) / (bottom - top),
  );
  const fitted = {
    x: (-(left + right) * zoom + rulerWidth) / 2,
    y: (-(top + bottom) * zoom + HEADER_SPACE - frame.controls) / 2,
    zoom,
    yaw,
    pitch,
  };
  const familyAnchor = familyFocusId && projected.find(({ id }) => id === familyFocusId);
  if (!familyAnchor) return fitted;
  const nameLimit = plaqueNameLimit(spatialPersonLabel(familyAnchor.data).name);
  const readingZoom = FAMILY_NAME_TARGET / (familyAnchor.scale * nameLimit);
  if (zoom >= readingZoom) return fitted;
  // On a narrow screen, start at the focus person at a readable scale.
  // Panning and the directory still reach every other person in the scene.
  const centered = centerPerson(fitted, familyAnchor, readingZoom, frame.controls);
  return { ...centered, x: centered.x + rulerWidth / 2 };
}

function centerPerson(
  camera: Camera,
  person: ProjectedPerson,
  zoom: number,
  controls: number,
): Camera {
  return {
    ...camera,
    zoom,
    x: -person.x * zoom,
    y: -(person.y + person.height / 2) * zoom + (HEADER_SPACE - controls) / 2,
  };
}

function zoomAt(camera: Camera, zoom: number, anchor: Pointer): Camera {
  const factor = zoom / camera.zoom;
  return {
    ...camera,
    zoom,
    x: anchor.x - (anchor.x - camera.x) * factor,
    y: anchor.y - (anchor.y - camera.y) * factor,
  };
}

type Vertex = readonly [number, number];
const circleOutline: Vertex[] = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
  return [26 * Math.cos(angle), 26 * Math.sin(angle)];
});
const solidOutlines: Record<string, Vertex[]> = {
  masculino: [
    [-25, -25],
    [25, -25],
    [25, 25],
    [-25, 25],
  ],
  feminino: circleOutline,
  aborto: [
    [0, -27],
    [26, 23],
    [-26, 23],
  ],
};
const diamond: Vertex[] = [
  [0, -29],
  [28, 0],
  [0, 29],
  [-28, 0],
];

function outlinePoints(values: { x: number; y: number }[]) {
  return values.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function SpatialSymbol({ person, angles }: { person: PersonNodeData; angles: SpatialAngles }) {
  const type = personSymbol(person);
  const silhouette = solidOutlines[type] ?? diamond;
  const angle = angles.yaw;
  const pitch = angles.pitch;
  const project = ([x, y]: Vertex, z: number) => {
    const depth = z * Math.cos(angle) - x * Math.sin(angle);
    const cameraDepth = depth * Math.cos(pitch) + y * Math.sin(pitch);
    const ratio = 198 / (198 - cameraDepth);
    return {
      x: (x * Math.cos(angle) + z * Math.sin(angle)) * ratio,
      y: (y * Math.cos(pitch) - depth * Math.sin(pitch)) * ratio,
      depth: cameraDepth,
    };
  };
  const thickness = type === "feminino" ? 12 : 15;
  const front = silhouette.map((vertex) => project(vertex, thickness));
  const back = silhouette.map((vertex) => project(vertex, -thickness));
  const side = silhouette.map(([x1, y1], start) => {
    const end = (start + 1) % silhouette.length;
    const [x2, y2] = silhouette[end];
    const orientation = Math.hypot(x2 - x1, y2 - y1);
    const light = clamp(((y2 - y1) * 0.56 - (x2 - x1) * 0.82) / orientation, -1, 1);
    const vertices = [front[start], back[start], back[end], front[end]];
    return {
      start,
      light,
      vertices,
      depth: vertices.reduce((sum, point) => sum + point.depth, 0) / 4,
    };
  });
  side.sort((a, b) => a.depth - b.depth);
  const mark = outlinePoints([project([-17, -12], thickness), project([17, -12], thickness)]);
  return (
    <svg viewBox="-49 -41 98 82" className="geno-spatial-symbol" aria-hidden="true">
      <polygon points={outlinePoints(back)} className="geno-spatial-back" />
      {side.map(({ start, light, vertices }) => (
        <polygon
          key={start}
          points={outlinePoints(vertices)}
          className="geno-spatial-side"
          style={{ "--face-light": `${Math.round(25 + light * 23)}%` } as CSSProperties}
        />
      ))}
      <polygon points={outlinePoints(front)} className="geno-spatial-face" />
      {(person.is_deceased || person.death_date) && (
        <polyline points={mark} className="geno-spatial-death" />
      )}
    </svg>
  );
}

const foldText = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function GenogramSpatialView({
  nodes,
  edges,
  workbench = false,
  onSelectPerson,
  selectedPersonId,
  connectionOriginId,
  parentagePreview,
  focusRequest,
  fitRequest,
  viewAnchor,
  cameraRef,
  highlightedBranch,
  onBranchChange,
  onFocusPerson,
  onReviewParentage,
  onEditRelationship,
  canMovePeople,
  getMovePersonDelta,
  onMovePerson,
}: GenogramSpatialViewProps) {
  const instructionsId = useId();
  const directoryId = useId();
  const unionsId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const directoryTrigger = useRef<HTMLButtonElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const lastFocus = useRef<GenogramSpatialViewProps["focusRequest"]>(undefined);
  const lastFit = useRef(fitRequest);
  const lastAnchor = useRef<MapViewAnchor>(undefined);
  const dragPerson = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    scale: number;
    deltaX: number;
    moved: boolean;
  } | null>(null);
  const skipPersonClick = useRef(false);
  const [frame, setFrame] = useState<Frame>({ width: 0, height: 0, controls: 0 });
  const [spatialToolsOpen, setSpatialToolsOpen] = useState(false);
  const [manualCamera, setManualCamera] = useState<Camera | null>(null);
  const [fitAngles, setFitAngles] = useState<SpatialAngles>(FRONT_ANGLES);
  const [localBranch, setLocalBranch] = useState<MapBranch | null>(null);
  const [familyFocusId, setFamilyFocusId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panMode, setPanMode] = useState(true);
  const [moveMode, setMoveMode] = useState(false);
  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const [separateLinks, setSeparateLinks] = useState(false);
  const [unionsOpen, setUnionsOpen] = useState(false);
  const [openedPersonId, setOpenedPersonId] = useState<string | null>(null);
  const [chosenRoute, setChosenRoute] = useState<string | null>(null);
  const [chosenUnion, setChosenUnion] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryMode, setDirectoryMode] = useState<"people" | "links">("people");
  const [query, setQuery] = useState("");
  const layout = useMemo(() => buildSpatialLayout(nodes, edges), [nodes, edges]);
  const families = useMemo(() => confirmedFamilies(layout), [layout]);
  const selectedHasFamily = useMemo(
    () => !!selectedPersonId && familyOf(families, selectedPersonId).size > 1,
    [families, selectedPersonId],
  );
  const branches = (["paternal", "maternal"] as const).filter((branch) =>
    layout.people.some((person) => person.branch === branch),
  );
  const requestedBranch = highlightedBranch === undefined ? localBranch : highlightedBranch;
  const branch = requestedBranch && branches.includes(requestedBranch) ? requestedBranch : null;
  const previousBranch = useRef(branch);
  const scopedFamilyId = layout.people.some(({ id }) => id === familyFocusId)
    ? familyFocusId
    : null;
  const scopedIds = useMemo(() => {
    if (scopedFamilyId) return familyOf(families, scopedFamilyId);
    return branch ? branchPeople(layout, families, branch) : null;
  }, [branch, families, layout, scopedFamilyId]);
  const unionMembers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const union of layout.unions) {
      if (union.single) continue;
      for (const id of union.partners) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return layout.people.filter(({ id }) => (counts.get(id) ?? 0) > 1);
  }, [layout]);
  const expandedPersonId =
    unionsOpen && unionMembers.some(({ id }) => id === openedPersonId) ? openedPersonId : null;
  const positionMode = moveMode && !!canMovePeople && !!onMovePerson;
  const displayLayout = useMemo(
    () =>
      movePreview?.deltaX
        ? buildSpatialLayout(
            nodes.map((node) =>
              node.id === movePreview.id
                ? {
                    ...node,
                    position: { ...node.position, x: node.position.x + movePreview.deltaX },
                  }
                : node,
            ),
            edges,
          )
        : layout,
    [nodes, edges, layout, movePreview],
  );
  const frontPeople = useMemo(() => projectSpatialLayout(layout, FRONT_ANGLES).people, [layout]);
  const fitted = useMemo(
    () => fitProjectedPeople(frontPeople, frame, FRONT_ANGLES),
    [frontPeople, frame],
  );
  const scopedFit = useMemo(() => {
    if (!scopedIds && fitAngles === FRONT_ANGLES) return fitted;
    const people =
      fitAngles === FRONT_ANGLES ? frontPeople : projectSpatialLayout(layout, fitAngles).people;
    return fitProjectedPeople(
      scopedIds ? people.filter(({ id }) => scopedIds.has(id)) : people,
      frame,
      fitAngles,
      scopedFamilyId,
    );
  }, [fitAngles, fitted, frame, frontPeople, layout, scopedFamilyId, scopedIds]);
  const camera = manualCamera ?? scopedFit;
  const minZoom = Math.min(0.16, fitted.zoom);
  const changeCamera = useCallback(
    (update: (current: Camera) => Camera) =>
      setManualCamera((current) => update(current ?? scopedFit)),
    [scopedFit],
  );

  const display = useMemo(
    () =>
      projectSpatialLayout(
        displayLayout,
        { yaw: camera.yaw, pitch: camera.pitch },
        selectedPersonId,
        { separateLinks, expandedPersonId, parentagePreview },
      ),
    [
      displayLayout,
      camera.yaw,
      camera.pitch,
      selectedPersonId,
      separateLinks,
      expandedPersonId,
      parentagePreview,
    ],
  );
  const names = useMemo(
    () => display.people.map((person) => ({ person, ...spatialPersonLabel(person.data) })),
    [display.people],
  );
  const namedPeople = names.filter(({ name, relationship }) =>
    foldText(`${name} ${relationship}`).includes(foldText(query.trim())),
  );
  const hasFrame = frame.width > 0 && frame.height > 0;

  const fitAutomatically = useCallback(({ yaw, pitch }: SpatialAngles) => {
    setFitAngles((current) =>
      current.yaw === yaw && current.pitch === pitch
        ? current
        : yaw === FRONT_ANGLES.yaw && pitch === FRONT_ANGLES.pitch
          ? FRONT_ANGLES
          : { yaw, pitch },
    );
    setManualCamera(null);
  }, []);

  const changeBranch = useCallback(
    (nextBranch: MapBranch | null, angles: SpatialAngles) => {
      if (onBranchChange) onBranchChange(nextBranch);
      else setLocalBranch(nextBranch);
      setFamilyFocusId(null);
      setChosenRoute(null);
      setChosenUnion(null);
      fitAutomatically(angles);
    },
    [onBranchChange, fitAutomatically],
  );

  useImperativeHandle(
    cameraRef,
    () => ({
      read: () => (hasFrame ? { ...camera, branch, familyFocusId: scopedFamilyId } : undefined),
      restore: ({ branch: savedBranch, familyFocusId, ...savedCamera }) => {
        // The workbench restores its controlled branch in the same update.
        // Keep that transition from overwriting the exact captured framing.
        previousBranch.current = savedBranch;
        if (highlightedBranch === undefined) setLocalBranch(savedBranch);
        setFamilyFocusId(familyFocusId);
        setManualCamera(savedCamera);
      },
      readAnchor: () => {
        const fitted = fitCamera(layout, frame, camera);
        const anchor = readMapViewAnchor(
          display.people.map(({ id, x, y, height }) => ({
            id,
            x: frame.width / 2 + camera.x + x * camera.zoom,
            y: frame.height / 2 + camera.y + (y + height / 2) * camera.zoom,
          })),
          frame.width,
          frame.height,
          camera.zoom / fitted.zoom,
          selectedPersonId,
        );
        const overview =
          Math.abs(camera.x - fitted.x) < frame.width * 0.035 &&
          Math.abs(camera.y - fitted.y) < frame.height * 0.035 &&
          Math.abs(camera.zoom / fitted.zoom - 1) < 0.06;
        return anchor ? { ...anchor, overview } : undefined;
      },
    }),
    [
      branch,
      camera,
      display.people,
      frame,
      hasFrame,
      highlightedBranch,
      layout,
      scopedFamilyId,
      selectedPersonId,
    ],
  );

  useEffect(() => {
    if (!hasFrame || lastFit.current === fitRequest) return;
    lastFit.current = fitRequest;
    changeBranch(null, camera);
  }, [camera, changeBranch, fitRequest, hasFrame]);

  useEffect(() => {
    if (previousBranch.current === branch) return;
    previousBranch.current = branch;
    // The panorama outside the 3D viewport can also change the active branch.
    setFamilyFocusId(null);
    fitAutomatically(camera);
  }, [branch, camera, fitAutomatically]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () =>
      setFrame({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        controls: workbench ? 0 : CONTROLS_SPACE,
      });
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();
    return () => observer.disconnect();
  }, [workbench]);

  useEffect(() => {
    if (!hasFrame || !focusRequest || focusRequest === lastFocus.current) return;
    const requested = display.people.find(({ id }) => id === focusRequest.personId);
    if (!requested) return;
    lastFocus.current = focusRequest;
    const related = display.people.filter(
      ({ id }) => focusRequest.relatedPersonIds?.includes(id) && id !== requested.id,
    );
    changeCamera((current) =>
      related.length
        ? fitProjectedPeople([requested, ...related], frame, current)
        : centerPerson(
            current,
            requested,
            Math.max(1.08 / requested.scale, current.zoom),
            frame.controls,
          ),
    );
  }, [changeCamera, focusRequest, frame, hasFrame, display.people]);

  useEffect(() => {
    if (!hasFrame || !viewAnchor || lastAnchor.current === viewAnchor) return;
    const person = display.people.find(({ id }) => id === viewAnchor.personId);
    if (!person) return;
    lastAnchor.current = viewAnchor;
    changeCamera((current) => {
      const fitted = fitCamera(layout, frame, current);
      if (viewAnchor.overview) {
        return scopedIds
          ? fitProjectedPeople(
              display.people.filter(({ id }) => scopedIds.has(id)),
              frame,
              current,
              scopedFamilyId,
            )
          : fitted;
      }
      const zoom = clamp(fitted.zoom * viewAnchor.scale, minZoom, MAX_ZOOM);
      return {
        ...current,
        zoom,
        x: frame.width * (viewAnchor.horizontal - 0.5) - person.x * zoom,
        y: frame.height * (viewAnchor.vertical - 0.5) - (person.y + person.height / 2) * zoom,
      };
    });
  }, [
    changeCamera,
    display.people,
    frame,
    hasFrame,
    layout,
    minZoom,
    scopedFamilyId,
    scopedIds,
    viewAnchor,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pivot = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const factor = Math.exp(clamp(-event.deltaY * 0.008, -0.28, 0.28));
      changeCamera((current) =>
        zoomAt(current, clamp(current.zoom * factor, minZoom, MAX_ZOOM), pivot),
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [changeCamera, minZoom]);

  function rotate(yaw: number, pitch = 0) {
    changeCamera((current) => {
      const angles = {
        yaw: clamp(current.yaw + yaw, -SPATIAL_MAX_YAW, SPATIAL_MAX_YAW),
        pitch: clamp(current.pitch + pitch, 0, SPATIAL_MAX_PITCH),
      };
      if (angles.pitch === current.pitch && angles.yaw === current.yaw) return current;
      const before = projectSpatialLayout(layout, current, selectedPersonId);
      const pivot = before.people.reduce<ProjectedPerson | undefined>((closest, item) => {
        const distance = (person: ProjectedPerson) =>
          Math.hypot(
            person.x * current.zoom + current.x,
            (person.y + person.height / 2) * current.zoom + current.y,
          );
        return !closest || distance(item) < distance(closest) ? item : closest;
      }, undefined);
      const after = projectSpatialLayout(layout, angles, selectedPersonId);
      const destination = after.people.find((person) => person.id === pivot?.id);
      if (!destination || !pivot) return { ...current, ...angles };
      return {
        ...current,
        ...angles,
        x: current.x + (pivot.x - destination.x) * current.zoom,
        y: current.y + (pivot.y - destination.y) * current.zoom,
      };
    });
  }

  function pan(x: number, y: number) {
    changeCamera((current) => ({ ...current, x: current.x + x, y: current.y + y }));
  }

  function zoomBy(factor: number) {
    changeCamera((current) =>
      zoomAt(current, clamp(current.zoom * factor, minZoom, MAX_ZOOM), { x: 0, y: 0 }),
    );
  }

  function focusPerson(person: ProjectedPerson) {
    changeCamera((current) =>
      centerPerson(
        current,
        person,
        clamp(Math.max(current.zoom, 1.06 / person.scale), minZoom, MAX_ZOOM),
        frame.controls,
      ),
    );
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return;
    switch (event.key) {
      case "ArrowLeft":
        if (event.shiftKey || panMode) pan(PAN_STEP, 0);
        else rotate(-0.13);
        break;
      case "ArrowRight":
        if (event.shiftKey || panMode) pan(-PAN_STEP, 0);
        else rotate(0.13);
        break;
      case "ArrowUp":
        if (event.shiftKey || panMode) pan(0, PAN_STEP);
        else rotate(0, 0.08);
        break;
      case "ArrowDown":
        if (event.shiftKey || panMode) pan(0, -PAN_STEP);
        else rotate(0, -0.08);
        break;
      case "+":
      case "=":
        zoomBy(1.25);
        break;
      case "-":
        zoomBy(0.8);
        break;
      case "0":
        changeBranch(null, camera);
        break;
      case "Home":
        changeBranch(null, FRONT_ANGLES);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function startPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    skipPersonClick.current = false;
    const person = event.target.closest<HTMLElement>("[data-person-id]");
    const id = person?.dataset.personId;
    if (id && positionMode && !dragPerson.current && pointers.current.size === 0) {
      dragPerson.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        scale: camera.zoom * Math.cos(camera.yaw) * SPATIAL_X_SCALE,
        deltaX: 0,
        moved: false,
      };
      // A tap still selects the person. Capture only after it becomes a drag.
      return;
    }
    if (dragPerson.current || event.target.closest("button, [data-route-id], [data-union-id]"))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    const person = dragPerson.current;
    if (person?.pointerId === event.pointerId) {
      if (!positionMode) return;
      const distance = event.clientX - person.startX;
      if (!person.moved && Math.abs(distance) < 5) return;
      if (!person.moved) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setManualCamera(camera);
        setDragging(true);
        person.moved = true;
        skipPersonClick.current = true;
      }
      const deltaX = distance / person.scale;
      person.deltaX = getMovePersonDelta?.(person.id, deltaX) ?? deltaX;
      setMovePreview({ id: person.id, deltaX: person.deltaX });
      return;
    }
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);

    const other = [...pointers.current].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const previousDistance = Math.hypot(prev.x - other.x, prev.y - other.y);
      const distance = Math.hypot(next.x - other.x, next.y - other.y);
      const rect = event.currentTarget.getBoundingClientRect();
      const pivot = {
        x: (prev.x + other.x) / 2 - rect.left - rect.width / 2,
        y: (prev.y + other.y) / 2 - rect.top - rect.height / 2,
      };
      const ratio = previousDistance > 8 ? distance / previousDistance : 1;
      changeCamera((current) => {
        const zoomed = zoomAt(current, clamp(current.zoom * ratio, minZoom, MAX_ZOOM), pivot);
        return {
          ...zoomed,
          x: zoomed.x + (next.x - prev.x) / 2,
          y: zoomed.y + (next.y - prev.y) / 2,
        };
      });
    } else if (event.shiftKey || panMode) {
      pan(next.x - prev.x, next.y - prev.y);
    } else {
      rotate((next.x - prev.x) * 0.006, (next.y - prev.y) * 0.005);
    }
  }

  function endPointer(event: PointerEvent<HTMLDivElement>) {
    const person = dragPerson.current;
    if (person?.pointerId === event.pointerId) {
      dragPerson.current = null;
      setMovePreview(null);
      if (event.type === "pointerup" && positionMode && person.moved && person.deltaX) {
        onMovePerson?.(person.id, person.deltaX);
      }
    }
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function revealCard(person: ProjectedPerson) {
    const x = frame.width / 2 + camera.x + person.x * camera.zoom;
    const y = frame.height / 2 + camera.y + person.y * camera.zoom;
    if (
      x - (person.width / 2) * camera.zoom < 0 ||
      x + (person.width / 2) * camera.zoom > frame.width ||
      y < HEADER_SPACE ||
      y + person.height * camera.zoom > frame.height - CONTROLS_SPACE
    )
      focusPerson(person);
  }

  function toggleDirectory() {
    if (directoryOpen) {
      setDirectoryOpen(false);
    } else {
      setDirectoryOpen(true);
      requestAnimationFrame(() => directoryInput.current?.focus());
    }
  }

  function closeDirectory() {
    setDirectoryOpen(false);
    directoryTrigger.current?.focus();
  }

  function toggleUnions() {
    if (unionsOpen) {
      setUnionsOpen(false);
      setChosenUnion(null);
      return;
    }
    const member = unionMembers.find(({ id }) => id === selectedPersonId) ?? unionMembers[0];
    if (!member) return;
    openUnions(member.id);
  }

  function openUnions(id: string) {
    setOpenedPersonId(id);
    setChosenUnion(null);
    setChosenRoute(null);
    setUnionsOpen(true);
  }

  function followRoute(route: SpatialRoute) {
    setChosenRoute((current) =>
      sameRoute(
        display.routes.find(({ id }) => id === current),
        route,
      )
        ? null
        : route.id,
    );
    setChosenUnion(null);
  }

  function selectPerson(id: string) {
    setChosenRoute(null);
    setChosenUnion(null);
    onSelectPerson(id);
  }

  const x = frame.width / 2 + camera.x;
  const y = frame.height / 2 + camera.y;
  const frontal = camera.yaw === 0 && camera.pitch === 0;
  const selected = display.people.find((person) => person.id === selectedPersonId);
  const hasSuggestions = display.routes.some((route) => route.suggested);
  const shownUnions = display.unions.filter((union) => union.expanded);
  const nameById = new Map(names.map(({ person, name }) => [person.id, name]));
  const scopeName = scopedFamilyId
    ? `Família de ${nameById.get(scopedFamilyId)}`
    : branch
      ? mapBranchNames[branch]
      : "Árvore inteira";
  const unionById = new Map(display.unions.map((union) => [union.id, union]));
  const activeRoute = display.routes.find(({ id }) => id === chosenRoute);
  const activeRouteDescription = activeRoute
    ? describeRoute(activeRoute, nameById, unionById.get(activeRoute.unionId ?? ""))
    : undefined;
  const expandedUnion = shownUnions.find(({ id }) => id === chosenUnion);
  const contextRoute =
    activeRoute ??
    display.routes.find(
      ({ unionId, edge }) => expandedUnion?.id === unionId && edge.type === "partner",
    );
  const linkRelationshipId =
    typeof contextRoute?.edge.data?.relationshipId === "string"
      ? contextRoute.edge.data.relationshipId
      : contextRoute &&
          !["pedigree", "partner"].includes(contextRoute.edge.type ?? "") &&
          typeof contextRoute.edge.data?.relationshipType === "string"
        ? contextRoute.edge.id
        : undefined;
  const routePeople = (route: SpatialRoute) =>
    route.unionId
      ? [...(route.childIds ?? []), ...(unionById.get(route.unionId)?.partners ?? [])]
      : [route.edge.source, route.edge.target];
  const focusRoute = (route: SpatialRoute) => {
    const ids = new Set(routePeople(route));
    changeCamera((current) =>
      fitProjectedPeople(
        display.people.filter(({ id }) => ids.has(id)),
        frame,
        current,
      ),
    );
  };
  const routeMemberIds = activeRoute
    ? (activeRoute.childIds ?? unionById.get(activeRoute.unionId ?? "")?.partners ?? [])
    : [];
  const contextChildren =
    activeRoute?.edge.type === "pedigree"
      ? (activeRoute.childIds ?? [])
      : expandedUnion
        ? display.routes
            .filter(({ unionId, edge }) => unionId === expandedUnion.id && edge.type === "pedigree")
            .flatMap(({ childIds }) => childIds ?? [])
        : [];
  const highlightedUnion = expandedUnion?.id ?? activeRoute?.unionId;
  const routeIsActive = (route: SpatialRoute) =>
    parentagePreview
      ? false
      : highlightedUnion
        ? route.unionId === highlightedUnion
        : activeRoute
          ? route.id === activeRoute.id
          : route.highlighted;
  const routeIsMuted = (route: SpatialRoute) =>
    parentagePreview ||
    ((activeRoute || expandedUnion) && !routeIsActive(route)) ||
    (scopedIds &&
      !routeIsActive(route) &&
      (!branch || scopedFamilyId || route.branch !== branch) &&
      routePeople(route).filter((id) => scopedIds.has(id)).length < 2)
      ? true
      : undefined;
  const routeClass = (route: SpatialRoute) =>
    cn(
      "geno-spatial-link",
      routeIsActive(route) && "geno-spatial-link-current",
      route.suggested && "geno-spatial-link-suggested",
      !["pedigree", "partner"].includes(route.edge.type ?? "") && "geno-spatial-link-social",
    );
  const routeDash = ({ edge, parentKind, suggested }: SpatialRoute) =>
    suggested
      ? "5 5"
      : ((parentKind && parentLinePatterns[parentKind]) ??
        edge.style?.strokeDasharray ??
        (edge.type === "pedigree" || edge.type === "partner" ? undefined : "3 5"));
  const bridgeStatus = display.bridgeCount
    ? `${display.bridgeCount} ${display.bridgeCount === 1 ? "cruzamento separado" : "cruzamentos separados"}`
    : "Nenhum cruzamento entre os vínculos visíveis";
  const partnerUnions = new Set<string>();
  const listedRoutes =
    directoryOpen && directoryMode === "links"
      ? display.routes.flatMap((route) => {
          if (route.edge.type === "partner" && route.unionId) {
            if (partnerUnions.has(route.unionId)) return [];
            partnerUnions.add(route.unionId);
          }
          const { title, detail } = describeRoute(
            route,
            nameById,
            unionById.get(route.unionId ?? ""),
          );
          if (!foldText(`${title} ${detail}`).includes(foldText(query.trim()))) return [];
          return [{ route, title, detail }];
        })
      : [];

  const spatialFeatureButtons = (
    <>
      <Button
        type="button"
        size="sm"
        variant={separateLinks ? "forest" : "outline"}
        aria-pressed={separateLinks}
        onClick={() => {
          setSeparateLinks((active) => !active);
          setChosenRoute(null);
          setSpatialToolsOpen(false);
        }}
      >
        <Layers2 aria-hidden />
        Separar vínculos
      </Button>
      <Button
        type="button"
        size="sm"
        variant={expandedPersonId ? "forest" : "outline"}
        aria-expanded={!!expandedPersonId}
        aria-controls={unionsId}
        disabled={!unionMembers.length}
        title={unionMembers.length ? undefined : "Nenhum familiar tem mais de uma união no mapa"}
        onClick={() => {
          toggleUnions();
          setSpatialToolsOpen(false);
        }}
      >
        <GitFork aria-hidden />
        {expandedPersonId ? "Recolher uniões" : "Abrir uniões"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={positionMode ? "forest" : "outline"}
        aria-pressed={positionMode}
        disabled={!canMovePeople || !onMovePerson}
        onClick={() => {
          setMoveMode((active) => !active);
          setSpatialToolsOpen(false);
        }}
      >
        <MoveHorizontal aria-hidden />
        Mover pessoa
      </Button>
    </>
  );

  const spatialModeFeedback = positionMode
    ? "Arraste a pessoa para os lados"
    : separateLinks
      ? bridgeStatus
      : "";

  return (
    <section
      className="geno-spatial"
      aria-label="Visualização 3D do genossociograma"
      data-view-scope={scopedFamilyId ? "family" : (branch ?? "overview")}
    >
      <span className="sr-only" role="status">
        {activeRouteDescription &&
          `Vínculo destacado no mapa. ${activeRouteDescription.title}. ${activeRouteDescription.detail}.`}
      </span>
      {workbench && (
        <span className="sr-only" role="status">
          {spatialModeFeedback}
        </span>
      )}
      {layout.people.length > 0 && (
        <div className="geno-spatial-navigation">
          <div className="geno-spatial-scopes" role="group" aria-label="Explorar ramos da família">
            <button
              type="button"
              aria-pressed={!scopedIds}
              onClick={() => changeBranch(null, camera)}
            >
              Árvore inteira
            </button>
            {branches.map((id) => (
              <button
                key={id}
                type="button"
                data-branch={id}
                aria-pressed={branch === id && !scopedFamilyId}
                onClick={() => changeBranch(id, camera)}
              >
                {mapBranchNames[id]}
              </button>
            ))}
            {selectedHasFamily && selected && (
              <button
                type="button"
                className="geno-spatial-family"
                aria-label={`Focar família de ${nameById.get(selected.id)}`}
                aria-pressed={scopedFamilyId === selected.id}
                title={`Focar família de ${nameById.get(selected.id)}`}
                onClick={() => {
                  setFamilyFocusId(selected.id);
                  setChosenRoute(null);
                  setChosenUnion(null);
                  fitAutomatically(camera);
                }}
              >
                <UsersRound aria-hidden />
                <span>Focar família</span>
              </button>
            )}
          </div>
          <span className={scopedFamilyId ? "geno-spatial-scope-detail" : "sr-only"} role="status">
            {scopeName}
          </span>
          {hasSuggestions && <span className="geno-spatial-suggestion">Filiação sugerida</span>}
        </div>
      )}
      {!workbench && (
        <div
          className="geno-spatial-features"
          role="group"
          aria-label="Trabalhar com a árvore em 3D"
        >
          {spatialFeatureButtons}
          <span className="geno-spatial-feedback" role="status">
            {spatialModeFeedback}
          </span>
        </div>
      )}
      {(activeRouteDescription || expandedUnion) && (
        <section className="geno-spatial-link-context" aria-label="Vínculo em foco">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong>
                {activeRouteDescription?.title ??
                  expandedUnion?.partners
                    .map((id) => nameById.get(id))
                    .filter(Boolean)
                    .join(" · ")}
              </strong>
              <p>{activeRouteDescription?.detail ?? expandedUnion?.label ?? "União"}</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Fechar vínculo em foco"
              onClick={() => {
                setChosenRoute(null);
                setChosenUnion(null);
              }}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {contextRoute && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => focusRoute(contextRoute)}
              >
                Enquadrar vínculo
              </Button>
            )}
            {onEditRelationship && linkRelationshipId && (
              <Button
                type="button"
                size="sm"
                variant="forest"
                onClick={() => onEditRelationship(linkRelationshipId)}
              >
                Editar vínculo
              </Button>
            )}
            {activeRoute && !separateLinks && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSeparateLinks(true);
                  if (frontal) rotate(0.24, 0.14);
                }}
              >
                Separar cruzamentos
              </Button>
            )}
            {unionMembers.find(({ id }) => routeMemberIds.includes(id)) && !expandedPersonId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const member = unionMembers.find(({ id }) => routeMemberIds.includes(id));
                  if (member) openUnions(member.id);
                }}
              >
                Abrir uniões deste vínculo
              </Button>
            )}
          </div>
          {contextChildren.length > 0 && (
            <ul>
              {[...new Set(contextChildren)].map((id) => (
                <li key={id}>
                  <Button type="button" size="sm" variant="ghost" onClick={() => selectPerson(id)}>
                    {nameById.get(id)}
                  </Button>
                  {onReviewParentage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onReviewParentage(id)}
                    >
                      Revisar filiação
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="geno-spatial-workspace">
        <div
          ref={viewportRef}
          className="geno-spatial-viewport"
          data-dragging={dragging}
          data-moving-person={positionMode || undefined}
          tabIndex={0}
          role="region"
          aria-label="Área de navegação do mapa 3D"
          aria-describedby={instructionsId}
          onKeyDown={handleKey}
          onPointerDown={startPointer}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
        >
          {!layout.people.length && (
            <p className="geno-spatial-empty">Nenhum familiar disponível no mapa.</p>
          )}
          {hasFrame && (
            <>
              <svg className="geno-spatial-geometry" width="100%" height="100%" aria-hidden="true">
                <g transform={`translate(${x} ${y}) scale(${camera.zoom})`}>
                  {Array.from(display.rows, ([rowY, row]) => {
                    const left = row[0].x - row[0].width / 2 - 20;
                    const right = row.at(-1)!.x + row.at(-1)!.width / 2 + 20;
                    const guideY = rowY + 31;
                    return (
                      <path
                        key={rowY}
                        d={`M ${left} ${guideY} H ${right}`}
                        className="geno-spatial-guide"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  {display.routes.map((route) => (
                    <path
                      key={route.id}
                      d={route.path}
                      data-branch={route.branch}
                      data-suggested={route.suggested || undefined}
                      data-muted={routeIsMuted(route)}
                      data-rendered-route={route.id}
                      className={routeClass(route)}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={routeDash(route)}
                    />
                  ))}
                  {display.routes.flatMap((route) =>
                    route.bridgePaths.map((path, index) => (
                      <g
                        key={`${route.id}-bridge-${index}`}
                        data-bridge={route.id}
                        data-branch={route.branch}
                        data-muted={routeIsMuted(route)}
                      >
                        <path
                          d={path}
                          className="geno-spatial-bridge-clearance"
                          vectorEffect="non-scaling-stroke"
                        />
                        <path
                          d={path}
                          className={routeClass(route)}
                          vectorEffect="non-scaling-stroke"
                          strokeDasharray={routeDash(route)}
                        />
                      </g>
                    )),
                  )}
                  {!positionMode &&
                    !connectionOriginId &&
                    display.routes.map((route) => (
                      <path
                        key={`${route.id}-hit`}
                        d={[route.path, ...route.bridgePaths].join(" ")}
                        className="geno-spatial-link-hit"
                        data-route-id={route.id}
                        vectorEffect="non-scaling-stroke"
                        onClick={() => followRoute(route)}
                      />
                    ))}
                  {display.unions
                    .filter((union) => !union.single)
                    .map((union) => (
                      <g
                        key={union.id}
                        data-branch={union.branch}
                        data-union-id={union.id}
                        data-expanded={union.expanded || undefined}
                        data-active={highlightedUnion === union.id || undefined}
                        transform={`translate(${union.x} ${union.y})`}
                      >
                        {union.label && <title>{union.label}</title>}
                        <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" className="geno-spatial-union" />
                        {union.kind === "divorcio" && (
                          <path d="M -8 7 L -2 -7 M 0 7 L 6 -7" className="geno-spatial-break" />
                        )}
                      </g>
                    ))}
                  {display.parentageTracks.map(({ role, paths }) => (
                    <g
                      key={role}
                      data-parentage-track={role}
                      className="geno-spatial-parentage-track"
                    >
                      {paths.map((path, index) => (
                        <path
                          key={index}
                          d={path}
                          className="geno-spatial-parentage-clearance"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      {paths.map((path, index) => (
                        <path
                          key={index}
                          d={path}
                          className="geno-spatial-parentage-line"
                          data-parentage-preview={role === "previous" ? "current" : role}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </g>
                  ))}
                </g>
              </svg>
              <div className="geno-spatial-ruler" aria-hidden="true">
                {Array.from(display.rows, ([rowY, row]) => (
                  <span
                    className="geno-spatial-generation"
                    key={rowY}
                    style={{ top: y + (rowY + SPATIAL_SYMBOL_CENTER) * camera.zoom }}
                  >
                    {row[0].rowLabel}
                  </span>
                ))}
              </div>
              <div className="geno-spatial-people">
                {names.map(({ person, name, relationship }) => {
                  const data = person.data;
                  const birth = formatDateBR(data.birth_date);
                  const death = formatDateBR(data.death_date);
                  const plaqueScale = person.scale * camera.zoom;
                  const inFocusedFamily = !!scopedFamilyId && !!scopedIds?.has(person.id);
                  const isSubject = parentagePreview?.childId === person.id;
                  const isPrevious =
                    parentagePreview?.phase === "draft" &&
                    parentagePreview.previousParentIds.includes(person.id);
                  const isProposed = parentagePreview?.proposedParentIds.includes(person.id);
                  const parentageRole = isSubject
                    ? "subject"
                    : isProposed && parentagePreview?.phase === "confirmed"
                      ? "confirmed"
                      : isPrevious && isProposed
                        ? "retained"
                        : isPrevious
                          ? "previous"
                          : isProposed
                            ? "proposed"
                            : undefined;
                  const roleLabel =
                    parentageRole &&
                    {
                      subject: "Pessoa cuja filiação está em revisão",
                      retained: "Genitor comum à filiação atual e à proposta",
                      previous: "Genitor atual",
                      proposed: "Genitor proposto",
                      confirmed: "Genitor confirmado",
                    }[parentageRole];
                  const label = [
                    name,
                    relationship,
                    birth && `Nascimento ${birth}`,
                    death ? `Falecimento ${death}` : data.is_deceased && "Falecimento registrado",
                    roleLabel,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={person.id}
                      type="button"
                      className="geno-spatial-person"
                      style={
                        {
                          left: x + person.x * camera.zoom,
                          top: y + person.y * camera.zoom,
                          "--plaque-width": `${SPATIAL_CARD_WIDTH}px`,
                          "--plaque-height": `${person.height / person.scale}px`,
                          "--plaque-scale": plaqueScale,
                          "--plaque-name-size": `${plaqueNameSize(name, plaqueScale, inFocusedFamily)}px`,
                          "--plaque-role-size": `${clamp(8 / plaqueScale, 14, SPATIAL_MAX_ROLE_SIZE)}px`,
                          "--depth-x": `${-16 * Math.sin(camera.yaw)}px`,
                          "--depth-y": `${9 * Math.sin(camera.pitch)}px`,
                        } as CSSProperties
                      }
                      aria-pressed={person.id === selectedPersonId}
                      aria-label={label}
                      data-reference={data.is_proband || undefined}
                      data-branch={person.branch}
                      data-branch-muted={
                        (!!scopedIds && !scopedIds.has(person.id) && !parentageRole) || undefined
                      }
                      data-person-id={person.id}
                      data-generation={person.generation}
                      data-parentage-person={parentageRole}
                      data-connecting={person.id === connectionOriginId || undefined}
                      onClick={(event) => {
                        if (event.detail && skipPersonClick.current) return;
                        selectPerson(person.id);
                      }}
                      onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) {
                          revealCard(person);
                          onFocusPerson?.(person.id);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (!positionMode || !["ArrowLeft", "ArrowRight"].includes(event.key))
                          return;
                        event.preventDefault();
                        onMovePerson?.(person.id, event.key === "ArrowLeft" ? -26 : 26);
                      }}
                    >
                      <SpatialSymbol person={data} angles={camera} />
                      <span className="geno-spatial-person-label">
                        <span className="geno-spatial-person-name">{name}</span>
                        {relationship && (
                          <span className="geno-spatial-person-role">{relationship}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {directoryOpen && (
          <section
            id={directoryId}
            className="geno-spatial-directory"
            aria-label="Índice do genossociograma"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closeDirectory();
              }
            }}
          >
            <header className="geno-spatial-directory-header">
              <strong>Pessoas e vínculos</strong>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Fechar índice"
                onClick={closeDirectory}
              >
                <X />
              </Button>
            </header>
            <div className="geno-spatial-directory-search">
              <Search aria-hidden="true" />
              <Input
                ref={directoryInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={directoryMode === "people" ? "Buscar pessoa" : "Buscar vínculo"}
                placeholder={directoryMode === "people" ? "Nome ou parentesco" : "Nome ou tipo"}
              />
            </div>
            <div
              className="geno-spatial-directory-modes"
              role="group"
              aria-label="Mostrar no índice"
            >
              {(
                [
                  ["people", "Pessoas"],
                  ["links", "Vínculos"],
                ] as const
              ).map(([mode, label]) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={directoryMode === mode ? "forest" : "outline"}
                  aria-pressed={directoryMode === mode}
                  onClick={() => {
                    setDirectoryMode(mode);
                    setQuery("");
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            {directoryMode === "people" ? (
              <ul className="geno-spatial-directory-list" aria-label="Pessoas">
                {namedPeople.map(({ person, name, relationship }) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      aria-current={person.id === selectedPersonId || undefined}
                      onClick={() => {
                        focusPerson(person);
                        selectPerson(person.id);
                        closeDirectory();
                      }}
                    >
                      <strong>{name}</strong>
                      {relationship && <span>{relationship}</span>}
                    </button>
                  </li>
                ))}
                {namedPeople.length === 0 && (
                  <li className="geno-spatial-directory-empty">Nenhuma pessoa encontrada.</li>
                )}
              </ul>
            ) : (
              <ul className="geno-spatial-directory-list" aria-label="Vínculos no mapa">
                {listedRoutes.map(({ route, title, detail }) => (
                  <li key={route.id}>
                    <button
                      type="button"
                      aria-pressed={sameRoute(activeRoute, route)}
                      onClick={() => {
                        setSeparateLinks(true);
                        followRoute(route);
                        closeDirectory();
                      }}
                    >
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </button>
                  </li>
                ))}
                {listedRoutes.length === 0 && (
                  <li className="geno-spatial-directory-empty">Nenhum vínculo encontrado.</li>
                )}
              </ul>
            )}
          </section>
        )}
        <div className="geno-spatial-deck">
          <div className="geno-spatial-tools" role="group" aria-label="Controles do mapa 3D">
            {!workbench && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={!panMode}
                aria-label="Girar ao arrastar"
                title={panMode ? "Girar ao arrastar" : "Mover mapa ao arrastar"}
                onClick={() => setPanMode((active) => !active)}
              >
                <Rotate3D />
              </Button>
            )}
            {workbench && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Vista em perspectiva"
                title="Mostrar o enquadramento em perspectiva"
                aria-pressed={!frontal}
                onClick={() => fitAutomatically(OBLIQUE_ANGLES)}
              >
                <Box aria-hidden />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={frontal}
              aria-label="Vista frontal"
              title="Vista frontal"
              onClick={() => fitAutomatically(FRONT_ANGLES)}
            >
              <ScanLine />
            </Button>
            <span className="geno-spatial-tools-divider" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Afastar mapa 3D"
              title="Afastar mapa"
              onClick={() => zoomBy(0.8)}
              disabled={camera.zoom <= minZoom}
            >
              <Minus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Aproximar mapa 3D"
              title="Aproximar mapa"
              onClick={() => zoomBy(1.25)}
              disabled={camera.zoom >= MAX_ZOOM}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Enquadrar mapa 3D"
              title="Enquadrar todos os familiares"
              onClick={() => changeBranch(null, camera)}
            >
              <Maximize />
            </Button>
            <span className="geno-spatial-tools-divider" aria-hidden="true" />
            <Button
              ref={directoryTrigger}
              type="button"
              variant="ghost"
              className="geno-spatial-names"
              aria-controls={directoryId}
              aria-expanded={directoryOpen}
              aria-label="Pessoas e vínculos"
              title="Pessoas e vínculos"
              onClick={toggleDirectory}
            >
              <List />
              <span>Pessoas e vínculos</span>
            </Button>
            {workbench && (
              <Popover open={spatialToolsOpen} onOpenChange={setSpatialToolsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Ferramentas 3D"
                    title="Ferramentas 3D"
                  >
                    <Layers2 aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="geno-spatial-tools-popover" align="start" side="top">
                  <Button
                    type="button"
                    variant={panMode ? "outline" : "forest"}
                    size="sm"
                    aria-pressed={!panMode}
                    onClick={() => {
                      setPanMode((active) => !active);
                      setSpatialToolsOpen(false);
                    }}
                  >
                    <Rotate3D aria-hidden /> Girar ao arrastar
                  </Button>
                  {spatialFeatureButtons}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="geno-spatial-help" data-mode-active={workbench && !!spatialModeFeedback}>
            {workbench && spatialModeFeedback && (
              <span className="geno-spatial-mode" aria-hidden="true">
                {spatialModeFeedback}
              </span>
            )}
            {selected && (
              <button type="button" onClick={() => focusPerson(selected)}>
                Focar pessoa
              </button>
            )}
            <span aria-hidden="true">{panMode ? "Arraste para mover" : "Arraste para girar"}</span>
          </div>
        </div>
      </div>
      {expandedPersonId && (
        <section id={unionsId} className="geno-spatial-unions" aria-label="Uniões abertas">
          <header>
            <strong>Uniões de {nameById.get(expandedPersonId)}</strong>
            {unionMembers.length > 1 && (
              <select
                aria-label="Ver uniões de outra pessoa"
                value={expandedPersonId}
                onChange={(event) => {
                  setOpenedPersonId(event.target.value);
                  setChosenUnion(null);
                  setChosenRoute(null);
                }}
              >
                {unionMembers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {spatialPersonLabel(person.data).name}
                  </option>
                ))}
              </select>
            )}
          </header>
          <ul className="geno-spatial-unions-list">
            {shownUnions.map((union) => {
              const children = new Map<string, boolean>();
              for (const route of display.routes) {
                if (route.unionId !== union.id) continue;
                for (const id of route.childIds ?? []) {
                  children.set(id, (children.get(id) ?? true) && route.suggested === true);
                }
              }
              const partners = union.partners
                .filter((id) => id !== expandedPersonId)
                .map((id) => nameById.get(id))
                .filter(Boolean)
                .join(" e ");
              return (
                <li key={union.id} data-union-summary={union.id}>
                  <button
                    type="button"
                    aria-pressed={highlightedUnion === union.id}
                    onClick={() => {
                      setChosenRoute(null);
                      setChosenUnion((current) => (current === union.id ? null : union.id));
                    }}
                  >
                    <strong>{partners}</strong>
                    {union.label && <span>{union.label}</span>}
                  </button>
                  {children.size ? (
                    <ul aria-label="Filhos ligados a este par">
                      {[...children].map(([id, suggested]) => (
                        <li key={id}>
                          <button
                            type="button"
                            className="geno-spatial-union-child"
                            onClick={() => {
                              const child = display.people.find((person) => person.id === id);
                              if (child) focusPerson(child);
                              onSelectPerson(id);
                            }}
                          >
                            {nameById.get(id)}
                            {suggested && " · filiação sugerida"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sem filhos vinculados</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <span id={instructionsId} className="sr-only">
        Arraste o fundo para mover o mapa. Ative Girar ao arrastar para inclinar a vista. Com dois
        dedos, mova e amplie. Use as setas para navegar, mais e menos para ampliar, e zero para
        enquadrar. No modo Mover pessoa, arraste um cartão para os lados ou use as setas esquerda e
        direita sobre o cartão.
      </span>
    </section>
  );
}
