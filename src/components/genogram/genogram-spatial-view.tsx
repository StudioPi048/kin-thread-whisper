import { parentLinePatterns } from "@/lib/family-relationships";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import { List, Maximize, Minus, Move, Plus, Rotate3D, ScanLine, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBR } from "@/lib/genogram";
import { cn } from "@/lib/utils";
import type { PersonNodeData } from "./person-node";
import { personSymbol } from "./person-symbol";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  spatialPersonLabel,
  type SpatialAngles,
  SPATIAL_CARD_HEIGHT,
  SPATIAL_CARD_WIDTH,
  SPATIAL_DEFAULT_YAW,
  SPATIAL_MAX_YAW,
  SPATIAL_MAX_PITCH,
  SPATIAL_DEFAULT_PITCH,
  SPATIAL_SYMBOL_CENTER,
} from "./genogram-spatial-layout";
import "./genogram-spatial-view.css";

interface GenogramSpatialViewProps {
  nodes: Node[];
  edges: Edge[];
  onSelectPerson: (id: string) => void;
  selectedPersonId?: string | null;
  connectionOriginId?: string | null;
  focusRequest?: { personId: string };
}

type Frame = { width: number; height: number };
type Camera = SpatialAngles & { x: number; y: number; zoom: number };
type Pointer = { x: number; y: number };
type Layout = ReturnType<typeof buildSpatialLayout>;
type ProjectedPerson = ReturnType<typeof projectSpatialLayout>["people"][number];

const DEFAULT_ANGLES = { yaw: SPATIAL_DEFAULT_YAW, pitch: SPATIAL_DEFAULT_PITCH };
const MAX_ZOOM = 2.4;
const PAN_STEP = 64;
const FRAME_MARGIN = 24;
const CONTROLS_SPACE = 70;
const HEADER_SPACE = 57;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function fitCamera(
  layout: Layout,
  frame: Frame,
  angles: SpatialAngles,
  throughGeneration?: number,
): Camera {
  const { yaw, pitch } = angles;
  const projected = projectSpatialLayout(layout, { yaw, pitch }).people.filter(
    (person) => throughGeneration === undefined || person.generation <= throughGeneration,
  );
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
    Math.max(1, frame.height - HEADER_SPACE - CONTROLS_SPACE - FRAME_MARGIN) / (bottom - top),
  );
  return {
    x: (-(left + right) * zoom + rulerWidth) / 2,
    y:
      throughGeneration === undefined
        ? (-(top + bottom) * zoom + HEADER_SPACE - CONTROLS_SPACE) / 2
        : HEADER_SPACE + FRAME_MARGIN - frame.height / 2 - top * zoom,
    zoom,
    yaw,
    pitch,
  };
}

function centerPerson(camera: Camera, person: ProjectedPerson, zoom: number): Camera {
  return {
    ...camera,
    zoom,
    x: -person.x * zoom,
    y: -(person.y + person.height / 2) * zoom + (HEADER_SPACE - CONTROLS_SPACE) / 2,
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
  onSelectPerson,
  selectedPersonId,
  connectionOriginId,
  focusRequest,
}: GenogramSpatialViewProps) {
  const instructionsId = useId();
  const directoryId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const directoryTrigger = useRef<HTMLButtonElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const lastFocus = useRef<GenogramSpatialViewProps["focusRequest"]>(undefined);
  const [frame, setFrame] = useState<Frame>({ width: 0, height: 0 });
  const [manualCamera, setManualCamera] = useState<Camera | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const layout = useMemo(() => buildSpatialLayout(nodes, edges), [nodes, edges]);

  const fitted = useMemo(() => fitCamera(layout, frame, DEFAULT_ANGLES), [layout, frame]);
  const initialCamera = useMemo(() => {
    if (fitted.zoom >= 0.59 || !frame.width) return fitted;
    if (frame.width >= 690) return fitCamera(layout, frame, DEFAULT_ANGLES, 1);
    const { people } = projectSpatialLayout(layout, DEFAULT_ANGLES);
    const root = people.find(({ data }) => data.is_proband) ?? people[0];
    if (!root) return fitted;
    // Dense maps open on the consultante with usable type. Fit remains available to see the whole family.
    const zoom = frame.width < 520 ? 0.83 : 0.79;
    const centered = centerPerson(fitted, root, zoom);
    return {
      ...centered,
      y: HEADER_SPACE + (frame.width < 430 ? 26 : 8) - frame.height / 2 - root.y * zoom,
    };
  }, [fitted, frame, layout]);
  const camera = manualCamera ?? initialCamera;
  const minZoom = Math.min(0.16, fitted.zoom);
  const changeCamera = useCallback(
    (update: (current: Camera) => Camera) =>
      setManualCamera((current) => update(current ?? initialCamera)),
    [initialCamera],
  );

  const display = useMemo(
    () => projectSpatialLayout(layout, { yaw: camera.yaw, pitch: camera.pitch }, selectedPersonId),
    [layout, camera.yaw, camera.pitch, selectedPersonId],
  );
  const names = useMemo(
    () => display.people.map((person) => ({ person, ...spatialPersonLabel(person.data) })),
    [display.people],
  );
  const namedPeople = names.filter(({ name, relationship }) =>
    foldText(`${name} ${relationship}`).includes(foldText(query.trim())),
  );
  const hasFrame = frame.width > 0 && frame.height > 0;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => setFrame({ width: viewport.clientWidth, height: viewport.clientHeight });
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasFrame || !focusRequest || focusRequest === lastFocus.current) return;
    const requested = display.people.find(({ id }) => id === focusRequest.personId);
    if (!requested) return;
    lastFocus.current = focusRequest;
    changeCamera((current) =>
      centerPerson(current, requested, Math.max(1.08 / requested.scale, current.zoom)),
    );
  }, [changeCamera, focusRequest, hasFrame, display.people]);

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

  function fit(angles: SpatialAngles = camera) {
    changeCamera(() => fitCamera(layout, frame, angles));
  }

  function focusPerson(person: ProjectedPerson) {
    changeCamera((current) =>
      centerPerson(
        current,
        person,
        clamp(Math.max(current.zoom, 1.06 / person.scale), minZoom, MAX_ZOOM),
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
        fit();
        break;
      case "Home":
        setManualCamera(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function startPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
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

  const x = frame.width / 2 + camera.x;
  const y = frame.height / 2 + camera.y;
  const frontal = camera.yaw === 0 && camera.pitch === 0;
  const selected = display.people.find((person) => person.id === selectedPersonId);
  const hasPaternal = display.people.some((person) => person.branch === "paternal");
  const hasMaternal = display.people.some((person) => person.branch === "maternal");
  const hasSuggestions = display.routes.some((route) => route.suggested);

  return (
    <section className="geno-spatial" aria-label="Visualização 3D do genossociograma">
      <div
        ref={viewportRef}
        className="geno-spatial-viewport"
        data-dragging={dragging}
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
                {display.routes.map(
                  ({ id, path, highlighted, edge, parentKind, suggested, branch }) => {
                    const structural = edge.type === "pedigree" || edge.type === "partner";
                    const dash = suggested
                      ? "5 5"
                      : ((parentKind && parentLinePatterns[parentKind]) ??
                        edge.style?.strokeDasharray ??
                        (structural ? undefined : "3 5"));
                    return (
                      <path
                        key={id}
                        d={path}
                        data-branch={branch}
                        data-suggested={suggested || undefined}
                        className={cn(
                          "geno-spatial-link",
                          highlighted && "geno-spatial-link-current",
                          suggested && "geno-spatial-link-suggested",
                          !structural && "geno-spatial-link-social",
                        )}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={dash}
                      />
                    );
                  },
                )}
                {display.unions
                  .filter((union) => !union.single)
                  .map((union) => (
                    <g
                      key={union.id}
                      data-branch={union.branch}
                      transform={`translate(${union.x} ${union.y})`}
                    >
                      {union.label && <title>{union.label}</title>}
                      <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" className="geno-spatial-union" />
                      {union.kind === "divorcio" && (
                        <path d="M -8 7 L -2 -7 M 0 7 L 6 -7" className="geno-spatial-break" />
                      )}
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
                const label = [
                  name,
                  relationship,
                  birth && `Nascimento ${birth}`,
                  death ? `Falecimento ${death}` : data.is_deceased && "Falecimento registrado",
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
                        "--plaque-scale": person.scale * camera.zoom,
                        "--depth-x": `${-16 * Math.sin(camera.yaw)}px`,
                        "--depth-y": `${9 * Math.sin(camera.pitch)}px`,
                      } as CSSProperties
                    }
                    aria-pressed={person.id === selectedPersonId}
                    aria-label={label}
                    data-reference={data.is_proband || undefined}
                    data-branch={person.branch}
                    data-person-id={person.id}
                    data-connecting={person.id === connectionOriginId || undefined}
                    onClick={() => onSelectPerson(person.id)}
                    onFocus={() => revealCard(person)}
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
      <div className="geno-spatial-context">
        {(hasPaternal || hasMaternal || hasSuggestions) && (
          <div className="geno-spatial-branches" aria-label="Traços do mapa">
            {hasPaternal && <span data-branch="paternal">Ramo paterno</span>}
            {hasMaternal && <span data-branch="maternal">Ramo materno</span>}
            {hasSuggestions && <span data-suggested="true">Filiação sugerida</span>}
          </div>
        )}
      </div>
      {directoryOpen && (
        <section
          id={directoryId}
          className="geno-spatial-directory"
          aria-label="Pessoas no genossociograma"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setDirectoryOpen(false);
              directoryTrigger.current?.focus();
            }
          }}
        >
          <header className="geno-spatial-directory-header">
            <strong>Pessoas no mapa</strong>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar lista de pessoas"
              onClick={() => {
                setDirectoryOpen(false);
                directoryTrigger.current?.focus();
              }}
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
              aria-label="Buscar pessoa por nome ou parentesco"
              placeholder="Nome ou parentesco"
            />
          </div>
          <ul className="geno-spatial-directory-list">
            {namedPeople.map(({ person, name, relationship }) => (
              <li key={person.id}>
                <button
                  type="button"
                  aria-current={person.id === selectedPersonId || undefined}
                  onClick={() => {
                    focusPerson(person);
                    onSelectPerson(person.id);
                    setDirectoryOpen(false);
                    directoryTrigger.current?.focus();
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
        </section>
      )}
      <div className="geno-spatial-deck">
        <div className="geno-spatial-tools" role="group" aria-label="Controles do mapa 3D">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={panMode}
            aria-label="Mover mapa ao arrastar"
            title={panMode ? "Mudar para girar o mapa" : "Mover mapa ao arrastar"}
            onClick={() => setPanMode((active) => !active)}
          >
            {panMode ? <Move /> : <Rotate3D />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={frontal}
            aria-label="Vista frontal"
            title="Vista frontal"
            onClick={() => fit(frontal ? DEFAULT_ANGLES : { yaw: 0, pitch: 0 })}
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
            onClick={() => fit()}
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
            aria-label="Ler nomes completos"
            title="Ler nomes completos"
            onClick={toggleDirectory}
          >
            <List />
            <span>Nomes completos</span>
          </Button>
        </div>
        <div className="geno-spatial-help">
          {selected && (
            <button type="button" onClick={() => focusPerson(selected)}>
              Focar pessoa
            </button>
          )}
          <span aria-hidden="true">{panMode ? "Arraste para mover" : "Arraste para girar"}</span>
        </div>
      </div>
      <span id={instructionsId} className="sr-only">
        Arraste para girar. Use o modo de deslocamento ou segure Shift para mover o mapa. Com dois
        dedos, mova e amplie. Use as setas para girar, mais e menos para ampliar, e zero para
        enquadrar. O botão Nomes completos abre uma lista pesquisável.
      </span>
    </section>
  );
}
