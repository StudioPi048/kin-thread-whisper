import { parentLinePatterns } from "@/lib/family-relationships";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Maximize, Minus, Plus, RotateCcw, RotateCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/genogram";
import { cn } from "@/lib/utils";
import type { PersonNodeData } from "./person-node";
import { personSymbol } from "./person-symbol";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  projectSpatialPoint,
  spatialDepth,
  SPATIAL_CARD_HEIGHT,
  SPATIAL_CARD_WIDTH,
  SPATIAL_DEFAULT_YAW,
  SPATIAL_MAX_YAW,
  SPATIAL_ROW_GAP,
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
type Camera = { yaw: number; x: number; y: number; zoom: number };
type Pointer = { x: number; y: number };
type Layout = ReturnType<typeof buildSpatialLayout>;

const ROTATION_STEP = Math.PI / 18;
const MAX_ZOOM = 2;
const PAN_STEP = 64;
const FRAME_MARGIN = 18;
const toolClearance = (width: number) => (width <= 590 ? 74 : 57);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function fitCamera(layout: Layout, frame: Frame, yaw: number): Camera {
  const projected = layout.people.map((person) => projectSpatialPoint(person, yaw));
  if (!projected.length || !frame.width || !frame.height) return { x: 0, y: 0, zoom: 1, yaw };

  const left = Math.min(...projected.map(({ x }) => x)) - SPATIAL_CARD_WIDTH / 2;
  const right = Math.max(...projected.map(({ x }) => x)) + SPATIAL_CARD_WIDTH / 2;
  const top = Math.min(...projected.map(({ y }) => y)) - 7;
  const bottom = Math.max(...projected.map(({ y }) => y)) + SPATIAL_CARD_HEIGHT;
  const rulerWidth = frame.width > 590 ? 98 : 30;
  const clearance = toolClearance(frame.width);
  const zoom = Math.min(
    1.12,
    Math.max(1, frame.width - rulerWidth - 2 * FRAME_MARGIN) / (right - left),
    Math.max(1, frame.height - clearance - 2 * FRAME_MARGIN) / (bottom - top),
  );
  return {
    x: (-(left + right) * zoom + rulerWidth) / 2,
    y: (-(top + bottom) * zoom - clearance) / 2,
    zoom,
    yaw,
  };
}

function centerPerson(camera: Camera, person: Layout["people"][number], zoom: number): Camera {
  const point = projectSpatialPoint(person, camera.yaw);
  return {
    ...camera,
    zoom,
    x: -point.x * zoom,
    y: -(point.y + SPATIAL_CARD_HEIGHT / 2) * zoom,
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

function SpatialSymbol({ person, yaw }: { person: PersonNodeData; yaw: number }) {
  const type = personSymbol(person);
  const silhouette = solidOutlines[type] ?? diamond;
  const angle = yaw + (14 * Math.PI) / 180;
  const pitch = (18 * Math.PI) / 180;
  const project = ([x, y]: Vertex, z: number) => {
    const depth = z * Math.cos(angle) - x * Math.sin(angle);
    return {
      x: x * Math.cos(angle) + z * Math.sin(angle),
      y: y * Math.cos(pitch) - depth * Math.sin(pitch),
      depth: depth * Math.cos(pitch) + y * Math.sin(pitch),
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
    <svg viewBox="-49 -39 98 82" className="geno-spatial-symbol" aria-hidden="true">
      <ellipse cx="1" cy="32" rx="30" ry="6" className="geno-spatial-shadow" />
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

function rowTitle(level: number) {
  if (level === 0) return "Consultante";
  if (!Number.isInteger(level)) return "Outros vínculos";
  return ["", "Pais e tios", "Avós", "Bisavós", "Trisavós"][level] || `Geração ${level}`;
}

export function GenogramSpatialView({
  nodes,
  edges,
  onSelectPerson,
  selectedPersonId,
  connectionOriginId,
  focusRequest,
}: GenogramSpatialViewProps) {
  const instructionsId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const lastFocus = useRef<GenogramSpatialViewProps["focusRequest"]>(undefined);
  const [frame, setFrame] = useState<Frame>({ width: 0, height: 0 });
  const [manualCamera, setManualCamera] = useState<Camera | null>(null);
  const [dragging, setDragging] = useState(false);

  const layout = useMemo(() => buildSpatialLayout(nodes, edges), [nodes, edges]);
  const preferredNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of layout.people) {
      const preferred = person.data.preferred_name;
      if (preferred) counts.set(preferred, (counts.get(preferred) ?? 0) + 1);
    }
    return counts;
  }, [layout]);
  const fitted = useMemo(() => fitCamera(layout, frame, SPATIAL_DEFAULT_YAW), [layout, frame]);
  const initialCamera = useMemo(() => {
    const reference = layout.people.find(({ data }) => data.is_proband) ?? layout.people[0];
    if (frame.width >= 570 || fitted.zoom >= 0.52 || !reference) return fitted;
    const zoom = 0.62;
    const centered = centerPerson(fitted, reference, zoom);
    // Give the case controls clearance and keep the top generations readable on a narrow screen.
    return { ...centered, y: 62 - frame.height / 2 - reference.y * zoom };
  }, [fitted, frame.height, frame.width, layout]);

  const camera = manualCamera ?? initialCamera;
  const minZoom = Math.min(0.14, fitted.zoom);
  const changeCamera = useCallback(
    (update: (current: Camera) => Camera) =>
      setManualCamera((current) => update(current ?? initialCamera)),
    [initialCamera],
  );
  const display = useMemo(
    () => projectSpatialLayout(layout, camera.yaw, selectedPersonId),
    [layout, camera.yaw, selectedPersonId],
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
    const requested = layout.people.find(({ id }) => id === focusRequest.personId);
    if (!requested) return;
    lastFocus.current = focusRequest;
    changeCamera((current) => centerPerson(current, requested, Math.max(0.9, current.zoom)));
  }, [changeCamera, focusRequest, hasFrame, layout]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const factor = Math.exp(clamp(-event.deltaY * 0.012, -0.45, 0.45));
      changeCamera((current) =>
        zoomAt(current, clamp(current.zoom * factor, minZoom, MAX_ZOOM), anchor),
      );
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [changeCamera, minZoom]);

  function rotate(amount: number) {
    changeCamera((current) => {
      const yaw = clamp(current.yaw + amount, -SPATIAL_MAX_YAW, SPATIAL_MAX_YAW);
      const y = (-current.y - toolClearance(frame.width) / 2) / current.zoom;
      const z = spatialDepth(y);
      const x = (-current.x / current.zoom - z * Math.sin(current.yaw)) / Math.cos(current.yaw);
      const pivot = projectSpatialPoint({ x, y, z }, yaw);
      return { ...current, yaw, x: -pivot.x * current.zoom };
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

  function fit() {
    changeCamera(({ yaw }) => fitCamera(layout, frame, yaw));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.currentTarget !== event.target) return;
    switch (event.key) {
      case "ArrowLeft":
        if (event.shiftKey) pan(PAN_STEP, 0);
        else rotate(-ROTATION_STEP);
        break;
      case "ArrowRight":
        if (event.shiftKey) pan(-PAN_STEP, 0);
        else rotate(ROTATION_STEP);
        break;
      case "ArrowUp":
        pan(0, PAN_STEP);
        break;
      case "ArrowDown":
        pan(0, -PAN_STEP);
        break;
      case "+":
      case "=":
        zoomBy(1.2);
        break;
      case "-":
        zoomBy(1 / 1.2);
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
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button")))
      return;
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
      const oldDistance = Math.hypot(prev.x - other.x, prev.y - other.y);
      const newDistance = Math.hypot(next.x - other.x, next.y - other.y);
      const rect = event.currentTarget.getBoundingClientRect();
      const anchor = {
        x: (prev.x + other.x) / 2 - rect.left - rect.width / 2,
        y: (prev.y + other.y) / 2 - rect.top - rect.height / 2,
      };
      const ratio = oldDistance > 8 ? newDistance / oldDistance : 1;
      changeCamera((current) => {
        const zoomed = zoomAt(current, clamp(current.zoom * ratio, minZoom, MAX_ZOOM), anchor);
        return {
          ...zoomed,
          x: zoomed.x + (next.x - prev.x) / 2,
          y: zoomed.y + (next.y - prev.y) / 2,
        };
      });
    } else if (event.shiftKey) {
      pan(next.x - prev.x, next.y - prev.y);
    } else {
      rotate((next.x - prev.x) * 0.007);
      pan(0, next.y - prev.y);
    }
  }

  function endPointer(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function revealCard(person: (typeof display.people)[number]) {
    const horizontal = frame.width / 2 - FRAME_MARGIN;
    const vertical = frame.height / 2 - FRAME_MARGIN;
    const cx = person.x * camera.zoom + camera.x;
    const cy = (person.y + SPATIAL_CARD_HEIGHT / 2) * camera.zoom + camera.y;
    if (
      Math.abs(cx) + (SPATIAL_CARD_WIDTH / 2) * camera.zoom > horizontal ||
      Math.abs(cy) + (SPATIAL_CARD_HEIGHT / 2) * camera.zoom > vertical
    ) {
      const world = layout.people.find(({ id }) => id === person.id);
      if (world) changeCamera((current) => centerPerson(current, world, current.zoom));
    }
  }

  const x = frame.width / 2 + camera.x;
  const y = frame.height / 2 + camera.y;
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
                  const left = row[0].x - SPATIAL_CARD_WIDTH / 2 - 30;
                  const right = row[row.length - 1].x + SPATIAL_CARD_WIDTH / 2 + 30;
                  const guideY = rowY + SPATIAL_SYMBOL_CENTER;
                  return (
                    <path
                      key={rowY}
                      d={`M ${left} ${guideY} H ${right}`}
                      className="geno-spatial-guide"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {display.routes.map(({ id, path, highlighted, edge, parentKind, suggested }) => {
                  const structural = edge.type === "pedigree" || edge.type === "partner";
                  return (
                    <path
                      key={id}
                      d={path}
                      className={cn(
                        "geno-spatial-link",
                        highlighted && "geno-spatial-link-current",
                        suggested && "geno-spatial-link-suggested",
                        !structural && "geno-spatial-link-social",
                      )}
                      data-suggested={suggested || undefined}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={
                        suggested
                          ? "5 5"
                          : ((parentKind && parentLinePatterns[parentKind]) ??
                            edge.style?.strokeDasharray ??
                            (structural ? undefined : "4 5"))
                      }
                    />
                  );
                })}
                {display.unions.map((union) => (
                  <g key={union.id} transform={`translate(${union.x} ${union.y})`}>
                    {union.label && <title>{union.label}</title>}
                    {!union.single && (
                      <path d="M 0 -5 L 5 0 L 0 5 L -5 0 Z" className="geno-spatial-union" />
                    )}
                    {union.kind === "divorcio" && (
                      <path d="M -9 7 L -3 -7 M -1 7 L 5 -7" className="geno-spatial-break" />
                    )}
                  </g>
                ))}
              </g>
            </svg>
            <div className="geno-spatial-ruler" aria-hidden="true">
              {Array.from(display.rows, ([rowY]) => {
                const level = rowY / SPATIAL_ROW_GAP;
                const top = y + (rowY + SPATIAL_SYMBOL_CENTER) * camera.zoom;
                if (top < 48 || top > frame.height - toolClearance(frame.width)) return null;
                return (
                  <span key={rowY} className="geno-spatial-generation" style={{ top }}>
                    <span className="geno-spatial-generation-full">{rowTitle(level)}</span>
                    <span className="geno-spatial-generation-short">
                      {Number.isInteger(level) ? `G${level}` : "·"}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="geno-spatial-people">
              {display.people.map((person) => {
                const data = person.data;
                const preferred = data.preferred_name;
                const name =
                  preferred && preferredNames.get(preferred) === 1
                    ? preferred
                    : data.full_name || preferred || "Pessoa sem nome";
                const birth = formatDateBR(data.birth_date);
                const death = formatDateBR(data.death_date);
                const deceased = Boolean(data.is_deceased || data.death_date);
                const label = [
                  name,
                  data.is_proband ? "Consultante" : data.relationship_to_proband,
                  birth && `Nascimento ${birth}`,
                  death ? `Falecimento ${death}` : deceased && "Falecido(a)",
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
                        width: Math.max(62, SPATIAL_CARD_WIDTH * camera.zoom),
                        minHeight: Math.max(44, SPATIAL_CARD_HEIGHT * camera.zoom),
                        "--symbol-width": `${Math.max(25, 82 * camera.zoom)}px`,
                        "--symbol-height": `${Math.max(24, 68 * camera.zoom)}px`,
                        "--symbol-center": `${SPATIAL_SYMBOL_CENTER * camera.zoom}px`,
                        "--label-top": `${SPATIAL_SYMBOL_CENTER * camera.zoom + 26 * camera.zoom + 4}px`,
                        "--label-size": `${clamp(11 + (camera.zoom - 0.45) * 5, 11, 15)}px`,
                      } as CSSProperties
                    }
                    aria-pressed={person.id === selectedPersonId}
                    aria-label={label}
                    data-reference={data.is_proband}
                    data-connecting={person.id === connectionOriginId || undefined}
                    title={label}
                    onClick={() => onSelectPerson(person.id)}
                    onFocus={() => revealCard(person)}
                  >
                    <SpatialSymbol person={data} yaw={camera.yaw} />
                    <span className="geno-spatial-person-label">
                      <span className="geno-spatial-person-name">{name}</span>
                      {!data.is_proband && camera.zoom >= 0.72 && (birth || death) && (
                        <span className="geno-spatial-person-date">
                          {birth && death
                            ? `${birth.slice(-4)} – ${death.slice(-4)}`
                            : birth || death}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="geno-spatial-deck">
        <div className="geno-spatial-tools" role="group" aria-label="Controles do mapa 3D">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Girar à esquerda"
            title="Girar à esquerda"
            onClick={() => rotate(-ROTATION_STEP)}
            disabled={camera.yaw <= -SPATIAL_MAX_YAW}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Girar à direita"
            title="Girar à direita"
            onClick={() => rotate(ROTATION_STEP)}
            disabled={camera.yaw >= SPATIAL_MAX_YAW}
          >
            <RotateCw />
          </Button>
          <span className="geno-spatial-tools-divider" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Afastar mapa 3D"
            title="Afastar mapa 3D"
            onClick={() => zoomBy(1 / 1.2)}
            disabled={camera.zoom <= minZoom}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Aproximar mapa 3D"
            title="Aproximar mapa 3D"
            onClick={() => zoomBy(1.2)}
            disabled={camera.zoom >= MAX_ZOOM}
          >
            <Plus />
          </Button>
          <span className="geno-spatial-tools-divider" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="geno-spatial-fit"
            aria-label="Enquadrar mapa 3D"
            title="Enquadrar mapa 3D"
            onClick={fit}
          >
            <Maximize /> <span className="geno-spatial-fit-label">Ver tudo</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="geno-spatial-reset"
            aria-label="Repor vista 3D"
            title="Repor vista 3D"
            onClick={() => setManualCamera(null)}
          >
            <ScanLine />
          </Button>
        </div>
        <span className="geno-spatial-pointer-tip" aria-hidden="true">
          <span className="geno-spatial-tip-desktop">Arraste para girar</span>
          <span className="geno-spatial-tip-mobile">Dois dedos para mover</span>
        </span>
      </div>
      <span id={instructionsId} className="sr-only">
        Arraste na horizontal para girar e na vertical para mover. Segure Shift para mover na
        horizontal ou use dois dedos. Setas esquerda e direita para girar. Setas cima e baixo para
        mover na vertical. Mais e menos para ajustar o zoom. Zero para enquadrar. Home para repor.
      </span>
    </section>
  );
}
