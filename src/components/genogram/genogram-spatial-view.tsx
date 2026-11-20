import { parentLinePatterns } from "@/lib/family-relationships";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Maximize, Minus, Plus, RotateCcw, RotateCw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/genogram";
import type { ParentKind } from "@/lib/geno/build";
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
} from "./genogram-spatial-layout";
import "./genogram-spatial-view.css";

interface GenogramSpatialViewProps {
  nodes: Node[];
  edges: Edge[];
  onSelectPerson: (id: string) => void;
  selectedPersonId?: string | null;
  focusRequest?: { personId: string };
}

type Frame = { width: number; height: number };
type Camera = { yaw: number; x: number; y: number; zoom: number };
type Pointer = { x: number; y: number };
type Layout = ReturnType<typeof buildSpatialLayout>;

const ROTATION_STEP = Math.PI / 18;
const MAX_ZOOM = 2;
const PAN_STEP = 64;
const FRAME_MARGIN = 24;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function fitCamera(layout: Layout, frame: Frame, yaw: number): Camera {
  const projected = layout.people.map((person) => projectSpatialPoint(person, yaw));
  if (!projected.length || !frame.width || !frame.height) return { x: 0, y: 0, zoom: 1, yaw };

  const left = Math.min(...projected.map(({ x }) => x)) - SPATIAL_CARD_WIDTH / 2 - 72;
  const right = Math.max(...projected.map(({ x }) => x)) + SPATIAL_CARD_WIDTH / 2 + 72;
  const top = Math.min(...projected.map(({ y }) => y)) - 24;
  const bottom = Math.max(...projected.map(({ y }) => y)) + SPATIAL_CARD_HEIGHT + 52;
  const zoom = Math.min(
    1,
    Math.max(1, frame.width - 2 * FRAME_MARGIN) / (right - left),
    Math.max(1, frame.height - 2 * FRAME_MARGIN) / (bottom - top),
  );
  return { x: (-(left + right) * zoom) / 2, y: (-(top + bottom) * zoom) / 2, zoom, yaw };
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

function SpatialSymbol({ person }: { person: PersonNodeData }) {
  const type = personSymbol(person);
  return (
    <svg viewBox="0 0 40 40" className="geno-spatial-symbol" aria-hidden="true">
      {type === "masculino" ? (
        <rect x="5" y="5" width="30" height="30" />
      ) : type === "feminino" ? (
        <circle cx="20" cy="20" r="15" />
      ) : type === "aborto" ? (
        <polygon points="20 5, 35 34, 5 34" />
      ) : (
        <polygon points="20 3, 37 20, 20 37, 3 20" />
      )}
      {(person.is_deceased || person.death_date) && (
        <path d="M4 13 H36" className="geno-spatial-death" />
      )}
    </svg>
  );
}

export function GenogramSpatialView({
  nodes,
  edges,
  onSelectPerson,
  selectedPersonId,
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
  const fitted = useMemo(() => fitCamera(layout, frame, SPATIAL_DEFAULT_YAW), [layout, frame]);
  const initialCamera = useMemo(() => {
    const reference = layout.people.find(({ data }) => data.is_proband) ?? layout.people[0];
    if (fitted.zoom >= 0.66 || !reference) return fitted;
    const zoom = 0.76;
    const centered = centerPerson(fitted, reference, zoom);
    // Start on the top of the family for large maps, leaving room to read the next row.
    return { ...centered, y: FRAME_MARGIN - frame.height / 2 - reference.y * zoom };
  }, [fitted, frame.height, layout]);

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
      const y = -current.y / current.zoom;
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
      rotate((next.x - prev.x) * 0.008);
    } else {
      pan(next.x - prev.x, next.y - prev.y);
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
          aria-label="Enquadrar mapa 3D"
          title="Enquadrar mapa 3D"
          onClick={fit}
        >
          <Maximize />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Repor vista 3D"
          title="Repor vista 3D"
          onClick={() => setManualCamera(null)}
        >
          <ScanLine />
        </Button>
      </div>
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
                {display.plates.map((plate) => (
                  <g key={plate.y}>
                    <path d={plate.surface} className="geno-spatial-plane" />
                    <path d={plate.rim} className="geno-spatial-rim" />
                  </g>
                ))}
                {display.routes.map(({ id, path, highlighted, edge, parentKind }) => {
                  const structural = edge.type === "pedigree" || edge.type === "partner";
                  return (
                    <path
                      key={id}
                      d={path}
                      className={cn(
                        "geno-spatial-link",
                        highlighted && "geno-spatial-link-current",
                      )}
                      style={structural ? undefined : { stroke: edge.style?.stroke }}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={
                        (parentKind && parentLinePatterns[parentKind]) ??
                        edge.style?.strokeDasharray ??
                        (structural ? undefined : "5 6")
                      }
                    />
                  );
                })}
                {display.unions.map((union) => (
                  <g key={union.id} transform={`translate(${union.x} ${union.y})`}>
                    {union.label && <title>{union.label}</title>}
                    <path d="M 0 -6 L 6 0 L 0 6 L -6 0 Z" className="geno-spatial-union" />
                    {union.kind === "divorcio" && (
                      <path d="M -9 7 L -3 -7 M -1 7 L 5 -7" className="geno-spatial-break" />
                    )}
                  </g>
                ))}
              </g>
            </svg>
            <div
              className="geno-spatial-people"
              style={{ transform: `translate(${x}px, ${y}px) scale(${camera.zoom})` }}
            >
              {display.people.map((person) => {
                const data = person.data;
                const name = data.preferred_name || data.full_name || "Pessoa sem nome";
                const birth = formatDateBR(data.birth_date);
                const death = formatDateBR(data.death_date);
                const deceased = Boolean(data.is_deceased || data.death_date);
                const label = [
                  name,
                  data.is_proband && "Consultante",
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
                    style={{
                      left: person.x - SPATIAL_CARD_WIDTH / 2,
                      top: person.y,
                      width: SPATIAL_CARD_WIDTH,
                      height: SPATIAL_CARD_HEIGHT,
                    }}
                    aria-pressed={person.id === selectedPersonId}
                    aria-label={label}
                    data-reference={data.is_proband}
                    title={label}
                    onClick={() => onSelectPerson(person.id)}
                    onFocus={() => revealCard(person)}
                  >
                    <span className="geno-spatial-person-head">
                      <SpatialSymbol person={data} />
                      <span className="geno-spatial-person-name">{name}</span>
                    </span>
                    {(data.is_proband || birth || death) && (
                      <span className="geno-spatial-person-detail">
                        {data.is_proband && <strong>Consultante</strong>}
                        {birth && <span>Nasc. {birth}</span>}
                        {death && <span>Falec. {death}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <p className="geno-spatial-caption">
        <span>Arraste para mover. Selecione uma pessoa para abrir a ficha.</span>
        <span>A profundidade é visual.</span>
        <span id={instructionsId} className="sr-only">
          Setas esquerda e direita para girar. Use Shift com essas setas para mover na horizontal.
          Setas cima e baixo para mover na vertical. Mais e menos para ampliar e reduzir. Zero para
          enquadrar. Home para repor a vista. No toque, faça pinça para ampliar.
        </span>
      </p>
    </section>
  );
}
