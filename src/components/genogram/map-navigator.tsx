import { useState } from "react";
import { Crosshair, MapPinned } from "lucide-react";
import { getNodesBounds, type Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generationTitle } from "./genogram-spatial-layout";
import type { PersonNodeData } from "./person-node";

import { mapBranchNames, type MapBranch } from "./map-view-context";
const branches = ["paternal", "maternal"] as const;

export function MapNavigator({
  nodes,
  focusId,
  branch,
  onBranch,
  onLocate,
}: {
  nodes: readonly Node[];
  focusId?: string;
  branch: MapBranch | null;
  onBranch: (branch: MapBranch | null) => void;
  onLocate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          aria-label="Navegar pelo panorama"
          title="Navegar pelo panorama"
          size="icon"
          variant="outline"
        >
          <MapPinned className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="geno-map-navigator"
        align="end"
        collisionPadding={8}
        aria-label="Panorama da família"
      >
        <MapNavigatorContent
          nodes={nodes}
          focusId={focusId}
          branch={branch}
          onBranch={(next) => {
            setOpen(false);
            onBranch(next);
          }}
          onLocate={(id) => {
            setOpen(false);
            onLocate(id);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function MapNavigatorContent({
  nodes,
  focusId,
  branch,
  onBranch,
  onLocate,
}: {
  nodes: readonly Node[];
  focusId?: string;
  branch: MapBranch | null;
  onBranch: (branch: MapBranch | null) => void;
  onLocate: (id: string) => void;
}) {
  const people = nodes.filter((node) => node.type === "person");
  const bounds = getNodesBounds(people);
  const generations = new Map<string, { level: number; people: Node[] }>();
  const inScope = people.filter(
    (node) => !branch || node.data.branchId === branch || node.data.is_proband,
  );
  for (const node of inScope) {
    const level = Number(node.data.generation);
    const title = generationTitle(level, node.data.lane);
    const generation = generations.get(title);
    if (generation) generation.people.push(node);
    else generations.set(title, { level, people: [node] });
  }
  const centerX = (node: Node) => node.position.x + (node.measured?.width ?? node.width ?? 0) / 2;

  return (
    <>
      <h3>
        Panorama da família
        <small>
          {people.length} {people.length === 1 ? "familiar" : "familiares"}
        </small>
      </h3>
      <div
        className="geno-map-navigator-plot"
        data-dense={people.length > 100 || undefined}
        aria-hidden="true"
      >
        {people.map((node) => {
          const data = node.data as PersonNodeData;
          return (
            <span
              key={node.id}
              data-current={node.id === focusId || undefined}
              data-muted={(!!branch && data.branchId !== branch && !data.is_proband) || undefined}
              data-branch={String(data.branchId)}
              data-reference={data.is_proband || undefined}
              style={{
                left: `${6 + (88 * (centerX(node) - bounds.x)) / Math.max(1, bounds.width)}%`,
                top: `${9 + (82 * (node.position.y - bounds.y)) / Math.max(1, bounds.height)}%`,
              }}
            />
          );
        })}
      </div>
      <div className="geno-map-navigator-actions">
        {branches
          .filter((item) => people.some((node) => node.data.branchId === item))
          .map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={branch === item ? "forest" : "outline"}
              aria-pressed={branch === item}
              onClick={() => onBranch(branch === item ? null : item)}
            >
              {mapBranchNames[item]}
            </Button>
          ))}
      </div>
      <div className="geno-map-navigator-generations">
        {[...generations]
          .sort(([, first], [, second]) => first.level - second.level)
          .map(([title, { people: row }]) => {
            const { x, width } = getNodesBounds(row);
            const distance = (node: Node) => Math.abs(centerX(node) - (x + width / 2));
            const person =
              row.find((node) => node.data.is_proband) ??
              row.reduce((best, next) => (distance(next) < distance(best) ? next : best));
            return (
              <Button
                key={title}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onLocate(person.id)}
              >
                <Crosshair className="size-4" aria-hidden /> {title}
                <small>{row.length}</small>
              </Button>
            );
          })}
      </div>
    </>
  );
}
