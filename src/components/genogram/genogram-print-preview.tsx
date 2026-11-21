import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Edge, Node } from "@xyflow/react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parentLinePatterns } from "@/lib/family-relationships";
import { parentageTrackLabel } from "./genogram-pedigree";
import { formatDateBR } from "@/lib/genogram";
import {
  buildSpatialLayout,
  projectSpatialLayout,
  spatialPersonLabel,
} from "./genogram-spatial-layout";
import { personSymbol } from "./person-symbol";
import { paginateGenogram, type PrintPage } from "./genogram-print-pages";
import { downloadGenogramPdf } from "./genogram-pdf";
import { mapBranchNames, type MapBranch } from "./map-view-context";
import "./genogram-print-preview.css";

type PrintFields = { relationships: boolean; dates: boolean; socialLinks: boolean };
const branches = ["paternal", "maternal"] as const;
const isSocialLink = (edge: Edge) => Boolean(edge.data?.relationshipType);

function labelWidth(text: string, fontSize: number) {
  return [...text.normalize("NFC")].reduce((width, character) => {
    if (/\s|[iIl.,'!·]/u.test(character)) return width + 0.29 * fontSize;
    if (/[WMwm@%]/u.test(character)) return width + 0.94 * fontSize;
    if (/[^\p{Script=Latin}\p{N}\p{P}]/u.test(character)) return width + fontSize;
    return width + (/\p{Lu}/u.test(character) ? 0.72 : 0.57) * fontSize;
  }, 0);
}

function unionLabelPosition(
  union: PrintPage["content"]["unions"][number],
  { people }: PrintPage["content"],
  bounds: PrintPage["bounds"],
) {
  if (union.single || !union.label) return;
  const width = labelWidth(union.label, 14);
  const half = width / 2 + 6;
  const x = Math.min(bounds.right - half, Math.max(bounds.left + half, union.x));
  const adjacent = people.filter(
    (person) => x - half < person.x + person.width / 2 && x + half > person.x - person.width / 2,
  );
  const above = union.y - 12;
  const candidates = [above, ...adjacent.flatMap(({ y, height }) => [y - 6, y + height + 20])].sort(
    (a, b) => Math.abs(a - above) - Math.abs(b - above),
  );
  const y = candidates.find(
    (baseline) =>
      Math.abs(baseline - above) <= 62 &&
      baseline >= bounds.top + 18 &&
      baseline <= bounds.bottom - 6 &&
      adjacent.every(
        (person) => baseline + 5 <= person.y || baseline - 17 >= person.y + person.height,
      ),
  );
  return y === undefined ? undefined : { x, y, width };
}

function wrapLines(text: string, fontSize: number, maximum: number) {
  const lines: Array<{ text: string; width: number }> = [];
  const fits = (value: string) => labelWidth(value, fontSize) <= maximum;
  const append = (value: string) => {
    if (value) lines.push({ text: value, width: Math.min(maximum, labelWidth(value, fontSize)) });
  };
  let line = "";
  let lineWidth = 0;
  for (const word of text.split(/\s+/)) {
    const wordWidth = labelWidth(word, fontSize);
    const separator = line ? fontSize * 0.29 : 0;
    if (lineWidth + separator + wordWidth <= maximum) {
      line = line ? `${line} ${word}` : word;
      lineWidth += separator + wordWidth;
      continue;
    }
    append(line);
    line = "";
    for (const character of word) {
      if (!fits(line + character)) {
        append(line);
        line = "";
      }
      line += character;
    }
    lineWidth = labelWidth(line, fontSize);
  }
  append(line);
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
  content,
  bounds,
  continuation,
  detail,
  number,
  total,
  fields,
}: PrintPage & { total: number; fields: PrintFields }) {
  const { left, top, right, bottom } = bounds;
  const figureTitle = detail ? `${title} ${number}` : title;
  return (
    <section className="geno-print-sheet" data-print-page={number}>
      <header className="geno-print-sheet-heading">
        <h3>{title}</h3>
        <span>
          Página {number} de {total}
        </span>
      </header>
      <svg
        role="img"
        aria-label={figureTitle}
        fontFamily="Arial, sans-serif"
        viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
      >
        {content.routes.map((route) => (
          <path
            key={route.id}
            data-social-link={isSocialLink(route.edge) || undefined}
            d={route.path}
            fill="none"
            stroke={
              route.suggested || route.branch === "maternal" ? "var(--bronze)" : "var(--forest)"
            }
            strokeWidth={3}
            strokeDasharray={
              route.parentSource === "legacy"
                ? "2 3"
                : route.suggested
                  ? "4 5"
                  : route.parentKind
                    ? parentLinePatterns[route.parentKind]
                    : route.edge.type === "partner"
                      ? undefined
                      : "4 5"
            }
          >
            {route.parentKind && route.parentSource && (
              <title>{parentageTrackLabel(route.parentKind, route.parentSource)}</title>
            )}
          </path>
        ))}
        {content.unions.map((union) => {
          const label = unionLabelPosition(union, content, bounds);
          return (
            <g key={union.id}>
              {union.label && <title>{union.label}</title>}
              <circle cx={union.x} cy={union.y} r={4} fill="var(--forest)" />
              {label && (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  fontSize={14}
                  textLength={label.width}
                  lengthAdjust="spacingAndGlyphs"
                  fill="var(--forest)"
                  stroke="var(--card)"
                  strokeWidth={8}
                  paintOrder="stroke"
                >
                  {union.label}
                </text>
              )}
            </g>
          );
        })}
        {content.people.map((person) => {
          const { name, relationship } = spatialPersonLabel(person.data);
          const textWidth = person.width - 58;
          const names = wrapLines(name, 19, textWidth);
          const roles =
            fields.relationships && relationship ? wrapLines(relationship, 15, textWidth) : [];
          const birth = formatDateBR(person.data.birth_date) || person.data.birth_date_partial;
          const death = formatDateBR(person.data.death_date) || person.data.death_date_partial;
          const dates = fields.dates
            ? [birth ? `Nascimento ${birth}` : "", death ? `Falecimento ${death}` : ""].filter(
                Boolean,
              )
            : [];
          const symbol = personSymbol(person.data);
          const stroke = { fill: "var(--archive)", stroke: "var(--forest)", strokeWidth: 2.6 };
          const detailsY = 25 + names.length * 21;
          const dateY = detailsY + roles.length * 17;
          return (
            <g
              key={person.id}
              data-print-person={person.id}
              aria-label={name}
              transform={`translate(${person.x - person.width / 2} ${person.y})`}
            >
              <title>{name}</title>
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
              {(person.data.is_deceased || death) && (
                <path d="M15 20 H34" stroke="var(--forest)" strokeWidth={2} />
              )}
              <text x={47} y={26} fill="var(--ink)" fontSize={19} fontWeight={650}>
                {names.map(({ text, width }, index) => (
                  <tspan
                    key={index}
                    x={47}
                    dy={index ? 21 : 0}
                    textLength={width}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {text}
                  </tspan>
                ))}
              </text>
              <text x={47} y={detailsY} fill="var(--ink-soft)" fontSize={15}>
                {roles.map(({ text, width }, index) => (
                  <tspan
                    key={index}
                    x={47}
                    dy={index ? 17 : 0}
                    textLength={width}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {text}
                  </tspan>
                ))}
              </text>
              {dates.length > 0 && (
                <text x={47} y={dateY} fill="var(--ink-soft)" fontSize={14}>
                  {dates.map((date, index) => (
                    <tspan
                      key={date}
                      x={47}
                      dy={index ? 16 : 0}
                      textLength={Math.min(textWidth, labelWidth(date, 14))}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {date}
                    </tspan>
                  ))}
                </text>
              )}
            </g>
          );
        })}
        {continuation.map(({ x, y, points, page, side }) => {
          const dx = side === "left" ? -1 : side === "right" ? 1 : 0;
          const dy = side === "top" ? -1 : side === "bottom" ? 1 : 0;
          const last = points.at(-1)!;
          const labelX = (x + last.x) / 2 + dx * 21;
          const labelY = (y + last.y) / 2 + (dy < 0 ? -20 : dy > 0 ? 28 : 4.5);
          return (
            <g key={`${side}:${x}:${y}:${page}`} data-continuation={page}>
              {points.map((point) => (
                <g key={`${point.x}:${point.y}`}>
                  <path
                    d={`M ${point.x} ${point.y} l ${dx * 13} ${dy * 13}`}
                    stroke="var(--forest)"
                    strokeWidth={3}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill="var(--card)"
                    stroke="var(--forest)"
                    strokeWidth={2}
                  />
                </g>
              ))}
              <text
                x={labelX}
                y={labelY}
                textAnchor={dx < 0 ? "end" : dx > 0 ? "start" : "middle"}
                fill="var(--forest)"
                stroke="var(--card)"
                paintOrder="stroke"
                strokeWidth={4}
                fontSize={17}
                fontWeight={650}
              >
                Pág. {page}
                {points.length > 1 ? ` (${points.length})` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="geno-print-legend">
        Quadrado · masculino. Círculo · feminino. Losango · outro ou desconhecido. Triângulo · perda
        gestacional. Traço horizontal superior · falecimento. Linha contínua · filiação biológica.
        Na filiação, traço curto com espaçamento curto · adoção. Traço longo · acolhimento.
        Traço-ponto · padrasto/madrasta. Traço médio · natureza por confirmar. Em bronze, pontos
        curtos · rótulo legado. Tracejado · sugestão.
        {continuation.length > 0 &&
          " O círculo na borda indica onde o traço continua. O número entre parênteses agrupa traços próximos."}
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
  const [mode, setMode] = useState<"whole" | "mosaic" | "branches">("mosaic");
  const preview = useRef<HTMLDivElement>(null);
  const [downloadPage, setDownloadPage] = useState<number | null>(null);
  const [fields, setFields] = useState<PrintFields>({
    relationships: true,
    dates: false,
    socialLinks: false,
  });
  const socialCount = edges.filter(isSocialLink).length;
  const representedBranches = branches.filter((branch) =>
    nodes.some((node) => node.type === "person" && node.data.branchId === branch),
  );
  const pages = useMemo(() => {
    if (!open) return [];
    const available = branches.filter((branch) =>
      nodes.some((node) => node.type === "person" && node.data.branchId === branch),
    );
    const scopes = mode === "branches" ? [undefined, ...available] : [undefined];
    const rendered: PrintPage[] = [];
    for (const branch of scopes) {
      const page = selectPage(
        nodes,
        fields.socialLinks ? edges : edges.filter((edge) => !isSocialLink(edge)),
        branch,
      );
      rendered.push(
        ...paginateGenogram(
          branch ? mapBranchNames[branch] : "Genossociograma",
          projectSpatialLayout(buildSpatialLayout(page.nodes, page.edges), {
            yaw: 0,
            pitch: 0,
          }),
          rendered.length + 1,
          mode !== "whole",
        ),
      );
    }
    return rendered;
  }, [edges, fields.socialLinks, mode, nodes, open]);

  async function downloadPdf() {
    if (!preview.current || downloadPage !== null) return;
    setDownloadPage(1);
    try {
      await downloadGenogramPdf(preview.current, setDownloadPage);
      toast.success(`PDF A3 gerado · ${pages.length} ${pages.length === 1 ? "folha" : "folhas"}`);
    } catch {
      toast.error("Não foi possível baixar o PDF A3. Tente novamente ou use Imprimir.");
    } finally {
      setDownloadPage(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="geno-print-dialog">
        <DialogHeader>
          <DialogTitle>Genossociograma em PDF A3</DialogTitle>
          <DialogDescription>
            Confira as páginas e os dados que deseja incluir no PDF A3.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="geno-print-options" disabled={downloadPage !== null}>
          <label>
            Organização
            <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="mosaic">Panorama e páginas de leitura</option>
              <option value="whole">Somente panorama</option>
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
          {socialCount > 0 && (
            <label>
              <input
                type="checkbox"
                checked={fields.socialLinks}
                onChange={(event) => setFields({ ...fields, socialLinks: event.target.checked })}
              />{" "}
              Vínculos sociais ({socialCount})
            </label>
          )}
        </fieldset>
        <div ref={preview} className="geno-print-preview" aria-label="Prévia de impressão">
          {pages.map((page) => (
            <PrintSheet key={page.number} {...page} total={pages.length} fields={fields} />
          ))}
        </div>
        <div className="geno-print-actions">
          <span role="status">
            {downloadPage !== null
              ? `Preparando folha ${downloadPage} de ${pages.length}`
              : `${pages.length} ${pages.length === 1 ? "folha A3" : "folhas A3"}`}
          </span>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={downloadPage !== null}
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden /> Imprimir
          </Button>
          <Button
            type="button"
            variant="forest"
            className="min-h-11"
            disabled={downloadPage !== null}
            onClick={() => void downloadPdf()}
          >
            <Download className="size-4" aria-hidden /> Baixar PDF A3
          </Button>
        </div>
      </DialogContent>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="geno-print-document" aria-hidden="true">
            {pages.map((page) => (
              <PrintSheet key={page.number} {...page} total={pages.length} fields={fields} />
            ))}
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
