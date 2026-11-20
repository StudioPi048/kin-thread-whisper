import { useEffect, useMemo, useRef, useState } from "react";
import { Scan, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  spatialPersonLabel,
} from "@/components/genogram/genogram-spatial-layout";
import { personSymbol } from "@/components/genogram/person-symbol";
import type { ParentagePreview } from "@/components/genogram/parentage-preview";
import type { buildRenderGraph } from "@/components/genogram/render-graph";
import { formatDateBR } from "@/lib/genogram";

type PlaneProps = {
  tree: ReturnType<typeof buildRenderGraph>;
  personId: string;
  focusRequest: { personId: string } | undefined;
  onSelect: (id: string) => void;
  parentagePreview: ParentagePreview | null;
};

const front = { yaw: 0, pitch: 0 };
const margin = 26;
const readingScale = 0.75;

export function ConsultantePlane({
  tree,
  personId,
  focusRequest,
  onSelect,
  parentagePreview,
}: PlaneProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const lastFocus = useRef(focusRequest);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const [frameWidth, setFrameWidth] = useState(0);
  const [overview, setOverview] = useState<boolean | null>(null);
  const layout = useMemo(() => buildSpatialLayout(tree.nodes, tree.edges), [tree]);
  const sharedPartner = layout.people.find(
    ({ id }) =>
      layout.unions.filter(({ partners }) => partners.length > 1 && partners.includes(id)).length >
      1,
  );
  const display = useMemo(
    () =>
      projectSpatialLayout(layout, front, personId, {
        separateLinks: true,
        expandedPersonId: sharedPartner?.id,
        parentagePreview,
      }),
    [layout, personId, sharedPartner?.id, parentagePreview],
  );
  const extents = display.people.flatMap(({ x, y, width, height }) => [
    { x: x - width / 2, y },
    { x: x + width / 2, y: y + height },
  ]);
  extents.push(...display.unions);
  const left = Math.min(...extents.map(({ x }) => x)) - margin;
  const top = Math.min(...extents.map(({ y }) => y)) - margin;
  const width = Math.max(...extents.map(({ x }) => x)) + margin - left;
  const height = Math.max(...extents.map(({ y }) => y)) + margin - top;
  const canFit = frameWidth > 0 && width * readingScale > frameWidth;
  const fitted = overview ?? canFit;
  const scale = fitted && frameWidth ? Math.min(readingScale, frameWidth / width) : readingScale;
  const branches = new Set(display.routes.map(({ branch }) => branch));

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setFrameWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusRequest || lastFocus.current === focusRequest) return;
    lastFocus.current = focusRequest;
    const frame = viewport.current;
    const card = cards.current.get(focusRequest.personId);
    if (!frame || !card || frame.scrollWidth <= frame.clientWidth) return;
    const cardRect = card.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    frame.scrollLeft += cardRect.left + cardRect.width / 2 - (frameRect.left + frameRect.width / 2);
  }, [focusRequest]);

  return (
    <>
      <div className="consultante-plane-options">
        <div className="consultante-plane-legend" aria-label="Legenda do genossociograma">
          {branches.has("paternal") && <span data-line="paternal">Ramo paterno</span>}
          {branches.has("maternal") && <span data-line="maternal">Ramo materno</span>}
          {parentagePreview && <span data-line="proposed">Filiação proposta</span>}
        </div>
        {canFit && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOverview(!fitted)}>
            {fitted ? <ZoomIn aria-hidden /> : <Scan aria-hidden />}
            {fitted ? "Ampliar nomes" : "Enquadrar árvore"}
          </Button>
        )}
      </div>
      <div
        className="consultante-plane-viewport"
        ref={viewport}
        tabIndex={0}
        role="group"
        aria-label="Genossociograma 2D"
      >
        <div className="consultante-plane" style={{ width: width * scale, height: height * scale }}>
          <svg
            className="consultante-plane-geometry"
            viewBox={`${left} ${top} ${width} ${height}`}
            aria-hidden
          >
            {display.routes.map((route) => (
              <path
                key={route.id}
                data-branch={route.branch}
                data-highlighted={route.highlighted || undefined}
                data-suggested={route.suggested || undefined}
                data-union-id={route.unionId}
                data-child-ids={route.childIds?.join(" ")}
                d={route.path}
                strokeDasharray={
                  route.suggested || route.parentKind === "unknown" ? "4 4" : undefined
                }
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {display.routes.flatMap((route) =>
              route.bridgePaths.map((path, index) => (
                <g key={`${route.id}-bridge-${index}`}>
                  <path d={path} data-bridge-clearance vectorEffect="non-scaling-stroke" />
                  <path
                    data-branch={route.branch}
                    data-highlighted={route.highlighted || undefined}
                    d={path}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )),
            )}
            {display.unions
              .filter((union) => !union.single)
              .map((union) => (
                <g
                  key={union.id}
                  transform={`translate(${union.x} ${union.y})`}
                  data-union-hub={union.id}
                >
                  <path
                    className="consultante-plane-union"
                    data-branch={union.branch}
                    d="M 0 -5 L 5 0 L 0 5 L -5 0 Z"
                  />
                  {union.kind === "divorcio" && (
                    <path data-branch={union.branch} d="M -8 7 L -2 -7 M 0 7 L 6 -7" />
                  )}
                </g>
              ))}
            {display.parentageTracks.map(({ role, paths }) => (
              <g key={role} data-parentage-track={role}>
                {paths.map((path, index) => (
                  <path key={index} d={path} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            ))}
          </svg>
          {display.people.map((person) => {
            const { name, relationship } = spatialPersonLabel(person.data);
            const birth = formatDateBR(person.data.birth_date);
            const death = formatDateBR(person.data.death_date);
            const previewRole =
              parentagePreview &&
              (person.id === parentagePreview.childId
                ? "subject"
                : parentagePreview.proposedParentIds.includes(person.id)
                  ? "proposed"
                  : parentagePreview.previousParentIds.includes(person.id)
                    ? "previous"
                    : undefined);
            return (
              <button
                key={person.id}
                ref={(element) => {
                  if (element) cards.current.set(person.id, element);
                  else cards.current.delete(person.id);
                }}
                type="button"
                className="consultante-plaque"
                style={{
                  left: (person.x - left) * scale,
                  top: (person.y - top) * scale,
                  width: person.width,
                  minHeight: person.height,
                  transform: `scale(${scale}) translateX(-50%)`,
                }}
                aria-label={[
                  name,
                  relationship,
                  birth && `Nascimento ${birth}`,
                  death
                    ? `Falecimento ${death}`
                    : person.data.is_deceased && "Falecimento registrado",
                ]
                  .filter(Boolean)
                  .join(", ")}
                aria-pressed={person.id === personId}
                data-person-id={person.id}
                data-generation={person.generation}
                data-branch={person.branch}
                data-reference={person.data.is_proband || undefined}
                data-preview={previewRole || undefined}
                onClick={() => onSelect(person.id)}
              >
                <span
                  className={`consultante-person-symbol consultante-person-symbol--${personSymbol(person.data)}`}
                  data-deceased={person.data.is_deceased || undefined}
                  aria-hidden
                />
                <span className="consultante-plaque-label">
                  <span>{name}</span>
                  {relationship && <small>{relationship}</small>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
