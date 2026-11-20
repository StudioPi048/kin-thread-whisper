import { Crosshair, Focus, MapPinned } from "lucide-react";
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
  onFit,
}: {
  nodes: Node[];
  focusId?: string;
  branch: MapBranch | null;
  onBranch: (branch: MapBranch | null) => void;
  onLocate: (id: string) => void;
  onFit: () => void;
}) {
  const people = nodes.filter((node) => node.type === "person");
  const bounds = getNodesBounds(people);
  const generations = new Map<number, Node>();
  for (const node of people) {
    const generation = Number(node.data.generation);
    const previous = generations.get(generation);
    const middle = bounds.x + bounds.width / 2;
    if (!previous || Math.abs(node.position.x - middle) < Math.abs(previous.position.x - middle)) {
      generations.set(generation, node);
    }
  }

  return (
    <Popover>
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
      <PopoverContent className="geno-map-navigator" align="start">
        <h3>Panorama da família</h3>
        <div className="geno-map-navigator-plot" aria-hidden="true">
          {people.map((node) => {
            const data = node.data as PersonNodeData;
            return (
              <span
                key={node.id}
                data-current={node.id === focusId || undefined}
                data-muted={(!!branch && data.branchId !== branch && !data.is_proband) || undefined}
                data-branch={String(data.branchId)}
                style={{
                  left: `${6 + (88 * (node.position.x - bounds.x)) / Math.max(1, bounds.width)}%`,
                  top: `${9 + (82 * (node.position.y - bounds.y)) / Math.max(1, bounds.height)}%`,
                }}
              />
            );
          })}
        </div>
        <div className="geno-map-navigator-actions">
          <Button type="button" size="sm" variant="outline" onClick={onFit}>
            <Focus className="size-4" aria-hidden /> Árvore inteira
          </Button>
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
            .sort(([first], [second]) => first - second)
            .map(([generation, node]) => (
              <Button
                key={generation}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onLocate(node.id)}
              >
                <Crosshair className="size-4" aria-hidden />{" "}
                {generationTitle(generation, node.data.lane)}
              </Button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
