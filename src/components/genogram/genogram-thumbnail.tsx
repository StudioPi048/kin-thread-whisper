import { personSymbol } from "./person-symbol";
import { useMemo } from "react";
import { buildLogicalGraph, layoutGraph, NODE_W } from "@/lib/geno/build";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";
/** Read-only projection of the SAME graph engine; never persists or invents a relationship. */
export function GenogramThumbnail({
  persons,
  rels,
}: {
  persons: PersonRow[];
  rels: RelationshipRow[];
}) {
  const { graph, placement, box } = useMemo(() => {
    const graph = buildLogicalGraph({
      persons,
      rels,
      probandId: persons.find((p) => p.is_proband)?.id,
    });
    const placement = layoutGraph(graph);
    const points = [...placement.personPos.values()];
    const minX = Math.min(0, ...points.map((p) => p.x)) - 60,
      minY = Math.min(0, ...points.map((p) => p.y)) - 60;
    return {
      graph,
      placement,
      box: `${minX} ${minY} ${Math.max(200, ...points.map((p) => p.x + NODE_W)) - minX + 60} ${Math.max(120, ...points.map((p) => p.y + 120)) - minY + 60}`,
    };
  }, [persons, rels]);
  if (!persons.length)
    return <div className="gv-map-empty">A história começa com a primeira pessoa.</div>;
  return (
    <svg
      className="gv-map-thumbnail"
      viewBox={box}
      role="img"
      aria-label={`Prévia do genossociograma com ${persons.length} pessoas`}
    >
      <g stroke="#a49c8e" strokeWidth="3" fill="none">
        {[...graph.unions].map(([id, u]) => {
          const pos = placement.unionPos.get(id);
          if (!pos) return null;
          return (
            <g key={id}>
              {u.partners.map((pid) => {
                const p = placement.personPos.get(pid);
                return p ? (
                  <path key={pid} d={`M${p.x + NODE_W / 2} ${p.y + 38}H${pos.x}`} />
                ) : null;
              })}
              {u.children.map((pid) => {
                const p = placement.personPos.get(pid);
                return p ? (
                  <path
                    key={pid}
                    d={`M${p.x + NODE_W / 2} ${p.y + 50}V${(p.y + pos.y) / 2}H${pos.x}V${pos.y}`}
                  />
                ) : null;
              })}
            </g>
          );
        })}
      </g>
      {[...graph.persons].map(([id, p]) => {
        const pos = placement.personPos.get(id);
        if (!pos) return null;
        const cx = pos.x + NODE_W / 2,
          cy = pos.y + 38;
        const symbol = personSymbol(p.row);
        return (
          <g
            key={id}
            fill={p.row.is_proband ? "#805647" : "#e9e0d3"}
            stroke={p.row.is_proband ? "#805647" : "#6b7e79"}
            strokeWidth="3"
          >
            {symbol === "feminino" ? (
              <circle cx={cx} cy={cy} r={26} />
            ) : symbol === "aborto" ? (
              <path d={`M${cx} ${cy - 26}L${cx + 26} ${cy + 26}H${cx - 26}Z`} />
            ) : symbol === "desconhecido" ? (
              <path d={`M${cx} ${cy - 30}L${cx + 30} ${cy}L${cx} ${cy + 30}L${cx - 30} ${cy}Z`} />
            ) : (
              <rect x={cx - 26} y={cy - 26} width={52} height={52} rx={2} />
            )}
            {p.row.is_deceased && (
              <path d={`M${cx - 28} ${cy + 28}L${cx + 28} ${cy - 28}`} stroke="#354a3e" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
