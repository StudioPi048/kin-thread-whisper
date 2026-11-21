import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Edge, Node } from "@xyflow/react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parentLinePatterns } from "@/lib/family-relationships";
import { personDatesLabel } from "@/lib/genogram";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  spatialPersonLabel,
} from "./genogram-spatial-layout";
import { personSymbol } from "./person-symbol";
import { mapBranchNames, type MapBranch } from "./map-view-context";
import "./genogram-print-preview.css";

type PrintFields = { relationships: boolean; dates: boolean };
const branches = ["paternal", "maternal"] as const;

function wrapLines(text: string, maximum: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maximum) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    const letters = Array.from(word);
    while (letters.length > maximum) lines.push(letters.splice(0, maximum).join(""));
    line = letters.join("");
  }
  if (line) lines.push(line);
  return lines;
}

function selectPage(nodes: Node[], edges: Edge[], branch?: MapBranch) {
  if (!branch) return { nodes, edges };
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const branchPeople = nodes
    .filter((node) => node.type === "person" && node.data.branchId === branch)
    .map(({ id }) => id);
  const people = new Set(
    nodes
      .filter(
        (node) =>
          node.type === "person" && (node.data.branchId === branch || node.data.generation === 0),
      )
      .map(({ id }) => id),
  );
  const partnersByUnion = new Map<string, Edge[]>();
  const originsByChild = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === "partner") {
      const partners = partnersByUnion.get(edge.target) ?? [];
      partnersByUnion.set(edge.target, [...partners, edge]);
    } else if (edge.type === "pedigree") {
      for (const id of (edge.data?.childIds as string[] | undefined) ?? []) {
        const origins = originsByChild.get(id) ?? [];
        originsByChild.set(id, [...origins, edge.source]);
      }
    }
  }
  // Close shared ancestry reached from this branch. The other branch's
  // parents can still appear beside the consultante's parents as context.
  for (const child of branchPeople) {
    for (const union of originsByChild.get(child) ?? []) {
      for (const { source: parent } of partnersByUnion.get(union) ?? []) {
        if (people.has(parent) || nodeById.get(parent)?.data.branchId !== "other") continue;
        people.add(parent);
        branchPeople.push(parent);
      }
    }
  }
  const children = edges.flatMap((edge) => {
    if (edge.type !== "pedigree") return [];
    const childIds =
      (edge.data?.childIds as string[] | undefined)?.filter((id) => people.has(id)) ?? [];
    return childIds.length
      ? [{ ...edge, target: childIds[0], data: { ...edge.data, childIds } }]
      : [];
  });
  const unionIds = new Set(children.map(({ source }) => source));
  for (const [id, partners] of partnersByUnion) {
    if (partners.some((edge) => people.has(edge.source))) unionIds.add(id);
  }
  const partners = [...unionIds].flatMap((id) => partnersByUnion.get(id) ?? []);
  for (const partner of partners) people.add(partner.source);
  return {
    nodes: nodes.filter(({ id }) => people.has(id) || unionIds.has(id)),
    edges: [
      ...children,
      ...partners,
      ...edges.filter(
        (edge) =>
          edge.type !== "pedigree" &&
          edge.type !== "partner" &&
          people.has(edge.source) &&
          people.has(edge.target),
      ),
    ],
  };
}

function PrintSheet({
  title,
  projection,
  fields,
}: {
  title: string;
  projection: ReturnType<typeof projectSpatialLayout>;
  fields: PrintFields;
}) {
  const people = projection.people;
  const minX = Math.min(...people.map(({ x, width }) => x - width / 2)) - 24;
  const maxX = Math.max(...people.map(({ x, width }) => x + width / 2)) + 24;
  const minY = Math.min(...people.map(({ y }) => y)) - 30;
  const maxY = Math.max(...people.map(({ y, height }) => y + height)) + 30;
  return (
    <section className="geno-print-sheet">
      <h3>{title}</h3>
      <svg role="img" aria-label={title} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}>
        {projection.routes.map((route) => (
          <path
            key={route.id}
            d={route.path}
            fill="none"
            stroke={
              route.suggested || route.branch === "maternal" ? "var(--bronze)" : "var(--forest)"
            }
            strokeWidth={3}
            strokeDasharray={
              route.suggested
                ? "4 5"
                : route.parentKind
                  ? parentLinePatterns[route.parentKind]
                  : route.edge.type === "partner"
                    ? undefined
                    : "4 5"
            }
          />
        ))}
        {projection.unions.map((union) => (
          <g key={union.id}>
            <circle cx={union.x} cy={union.y} r={4} fill="var(--forest)" />
            {!union.single && union.label && (
              <text
                x={union.x}
                y={union.y - 12}
                textAnchor="middle"
                fontSize={14}
                fill="var(--forest)"
                stroke="var(--card)"
                strokeWidth={8}
                paintOrder="stroke"
              >
                {union.label}
              </text>
            )}
          </g>
        ))}
        {people.map((person) => {
          const { name, relationship } = spatialPersonLabel(person.data);
          const names = wrapLines(name, 22);
          const roles = fields.relationships && relationship ? wrapLines(relationship, 26) : [];
          const dates = fields.dates
            ? personDatesLabel(person.data.birth_date, person.data.death_date)
            : "";
          const symbol = personSymbol(person.data);
          const stroke = { fill: "var(--archive)", stroke: "var(--forest)", strokeWidth: 2.6 };
          const detailsY = 25 + names.length * 21;
          const dateY = detailsY + roles.length * 17;
          return (
            <g key={person.id} transform={`translate(${person.x - person.width / 2} ${person.y})`}>
              <rect
                width={person.width}
                height={person.height}
                rx={6}
                fill="var(--card)"
                stroke={person.data.is_proband ? "var(--bronze)" : "var(--input)"}
                strokeWidth={2}
              />
              {symbol === "masculino" ? (
                <rect x={13} y={16} width={23} height={23} {...stroke} />
              ) : symbol === "feminino" ? (
                <circle cx={24.5} cy={27.5} r={11.5} {...stroke} />
              ) : symbol === "aborto" ? (
                <path d="M24.5 15 L37 39 H12 Z" {...stroke} />
              ) : (
                <path d="M24.5 14 L38 27.5 L24.5 41 L11 27.5 Z" {...stroke} />
              )}
              {(person.data.is_deceased || person.data.death_date) && (
                <path d="M15 20 H34" stroke="var(--forest)" strokeWidth={2} />
              )}
              <text x={47} y={26} fill="var(--ink)" fontSize={19} fontWeight={650}>
                {names.map((line, index) => (
                  <tspan key={index} x={47} dy={index ? 21 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text x={47} y={detailsY} fill="var(--ink-soft)" fontSize={15}>
                {roles.map((line, index) => (
                  <tspan key={index} x={47} dy={index ? 17 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              {dates && (
                <text x={47} y={dateY} fill="var(--ink-soft)" fontSize={14}>
                  {dates}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="geno-print-legend">
        Quadrado · masculino. Círculo · feminino. Losango · outro ou desconhecido. Triângulo · perda
        gestacional. Traço horizontal superior · falecimento. Linha contínua · filiação biológica.
        Linha pontilhada · confira a natureza do vínculo na ficha.
      </p>
    </section>
  );
}

export function GenogramPrintPreview({
  open,
  onOpenChange,
  nodes,
  edges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  edges: Edge[];
}) {
  const [mode, setMode] = useState<"whole" | "branches">("whole");
  const [fields, setFields] = useState<PrintFields>({ relationships: true, dates: false });
  const representedBranches = branches.filter((branch) =>
    nodes.some((node) => node.type === "person" && node.data.branchId === branch),
  );
  const pages = useMemo(() => {
    if (!open) return [];
    const available = branches.filter((branch) =>
      nodes.some((node) => node.type === "person" && node.data.branchId === branch),
    );
    const scopes = mode === "branches" ? [undefined, ...available] : [undefined];
    return scopes.map((branch) => {
      const page = selectPage(nodes, edges, branch);
      return {
        title: branch ? mapBranchNames[branch] : "Genossociograma",
        projection: projectSpatialLayout(buildSpatialLayout(page.nodes, page.edges), {
          yaw: 0,
          pitch: 0,
        }),
      };
    });
  }, [edges, mode, nodes, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="geno-print-dialog">
        <DialogHeader>
          <DialogTitle>Imprimir genossociograma</DialogTitle>
          <DialogDescription>
            Confira as páginas e os dados que deseja incluir no PDF A3.
          </DialogDescription>
        </DialogHeader>
        <div className="geno-print-options">
          <label>
            Organização
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value === "branches" ? "branches" : "whole")
              }
            >
              <option value="whole">Árvore inteira</option>
              {representedBranches.length > 0 && (
                <option value="branches">Árvore inteira e páginas por ramo</option>
              )}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.relationships}
              onChange={(event) => setFields({ ...fields, relationships: event.target.checked })}
            />{" "}
            Parentescos
          </label>
          <label>
            <input
              type="checkbox"
              checked={fields.dates}
              onChange={(event) => setFields({ ...fields, dates: event.target.checked })}
            />{" "}
            Datas de nascimento e falecimento
          </label>
        </div>
        <div className="geno-print-preview" aria-label="Prévia de impressão">
          {pages.map((page) => (
            <PrintSheet key={page.title} {...page} fields={fields} />
          ))}
        </div>
        <Button
          type="button"
          variant="forest"
          className="justify-self-end min-h-11"
          onClick={() => window.print()}
        >
          <Printer className="size-4" aria-hidden /> Imprimir ou salvar PDF
        </Button>
      </DialogContent>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="geno-print-document" aria-hidden="true">
            {pages.map((page) => (
              <PrintSheet key={page.title} {...page} fields={fields} />
            ))}
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
