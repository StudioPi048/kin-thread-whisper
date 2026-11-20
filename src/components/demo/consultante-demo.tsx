import { useMemo, useState } from "react";
import { ArrowRight, Boxes, Clock3, Network, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenogramSpatialView } from "@/components/genogram/genogram-spatial-view";
import { buildRenderGraph } from "@/components/genogram/render-graph";
import { personSymbol } from "@/components/genogram/person-symbol";
import { GEN_GAP, NODE_W } from "@/lib/geno/build";
import { practiceFamily } from "@/lib/geno/fixtures";
import { buildCaseTimeline, formatByPrecision } from "@/lib/timeline";
import type { RelationshipRow } from "@/lib/patterns";
import "./consultante-demo.css";

const family = practiceFamily();
const names = new Map(family.persons.map((person) => [person.id, person.full_name]));
const initialRelations = family.rels.map((relation) =>
  relation.relationship_type === "parent" ? { ...relation, qualifier: "biological" } : relation,
);
const demonstrationMode = [
  { value: "map", label: "2D", icon: Network },
  { value: "spatial", label: "3D", icon: Boxes },
  { value: "timeline", label: "Linha do tempo", icon: Clock3 },
] as const;
type Mode = (typeof demonstrationMode)[number]["value"];

function DemoPlane({
  tree,
  personId,
  onSelect,
}: {
  tree: ReturnType<typeof buildRenderGraph>;
  personId: string;
  onSelect: (personId: string) => void;
}) {
  const nodes = tree.nodes.filter((node) => node.type === "person");
  const xs = nodes.map((node) => node.position.x);
  const min = Math.min(...xs) - 52;
  const max = Math.max(...xs) + NODE_W + 52;
  const xPosition = (x: number) => (100 * (x - min)) / (max - min);
  const projected = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: xPosition(node.position.x + NODE_W / 2),
        y: 9 + Math.round(node.position.y / GEN_GAP) * 127,
      },
    ]),
  );
  return (
    <div className="consultante-plane" role="group" aria-label="Genossociograma 2D">
      <svg viewBox="0 0 100 383" preserveAspectRatio="none" aria-hidden>
        {[...tree.graph.unions].flatMap(([id, union]) => {
          const parents = union.partners.flatMap((person) => projected.get(person) ?? []);
          if (!parents.length) return [];
          const hubX = parents.reduce((sum, parent) => sum + parent.x, 0) / parents.length;
          const hubY = parents[0].y - 10;
          return [
            ...parents.map((p, index) => (
              <path key={id + "parent" + index} d={`M${p.x},${p.y + 1} V${hubY} H${hubX}`} />
            )),
            ...union.children.flatMap((child) => {
              const p = projected.get(child);
              if (!p) return [];
              const branch = hubY - 14;
              const kind = tree.graph.edges.find(
                (edge) => edge.personId === child && edge.unionId === id && edge.kind === "child",
              )?.childKind;
              return (
                <path
                  key={id + child}
                  d={`M${p.x},${p.y + 82} V${branch} H${hubX} V${hubY}`}
                  strokeDasharray={kind === "unknown" ? "4 4" : undefined}
                />
              );
            }),
          ];
        })}
      </svg>
      {nodes.map((node) => {
        const person = tree.graph.persons.get(node.id);
        const point = projected.get(node.id);
        if (!person || !point) return null;
        return (
          <button
            key={node.id}
            type="button"
            className="consultante-plaque"
            style={{ left: `${point.x}%`, top: point.y }}
            aria-pressed={node.id === personId}
            onClick={() => onSelect(node.id)}
          >
            <span
              className={`consultante-person-symbol consultante-person-symbol--${personSymbol(person.row)}`}
              data-deceased={person.row.is_deceased || undefined}
              aria-hidden
            />
            <span>
              ${""}
              {person.row.full_name}
            </span>
            <small>
              {person.row.is_proband ? "Consultante" : person.row.relationship_to_proband}
            </small>
          </button>
        );
      })}
    </div>
  );
}

export default function ConsultanteDemo() {
  const [mode, setMode] = useState<Mode>("map");
  const [personId, setPersonId] = useState(family.probandId);
  const [links, setLinks] = useState<RelationshipRow[]>(initialRelations);
  const [previous, setPrevious] = useState<RelationshipRow[] | null>(null);
  const [draft, setDraft] = useState<{ id: string; qualifier: string } | null>(null);
  const [status, setStatus] = useState("");
  const [resetId, setResetId] = useState(0);
  const tree = useMemo(() => buildRenderGraph(family.persons, links, family.probandId), [links]);
  const timeline = useMemo(
    () => buildCaseTimeline(family.persons, tree.graph, links),
    [tree, links],
  );
  const parentLinks = links.filter(
    (link) => link.to_person_id === personId && link.relationship_type === "parent",
  );
  const draftLink = parentLinks.find((link) => link.id === draft?.id);

  function select(id: string) {
    setPersonId(id);
    setDraft(null);
  }

  function reset() {
    setMode("map");
    setPersonId(family.probandId);
    setLinks(initialRelations);
    setPrevious(null);
    setDraft(null);
    setResetId((id) => id + 1);
    setStatus("Exercício reiniciado.");
  }

  return (
    <div className="consultante-demo">
      <header className="consultante-demo-toolbar">
        <div className="consultante-demo-modes" role="group" aria-label="Vista do caso">
          {demonstrationMode.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={value === mode ? "default" : "outline"}
              aria-pressed={value === mode}
              type="button"
              onClick={() => setMode(value)}
            >
              <Icon size={16} aria-hidden /> {label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" onClick={reset}>
          <RotateCcw size={16} aria-hidden /> Reiniciar exercício
        </Button>
      </header>
      <div className="consultante-demo-workspace">
        <div className="consultante-demo-stage">
          {mode === "map" && <DemoPlane tree={tree} personId={personId} onSelect={select} />}
          {mode === "spatial" && (
            <div className="consultante-demo-spatial">
              <GenogramSpatialView
                key={resetId}
                nodes={tree.nodes}
                edges={tree.edges}
                selectedPersonId={personId}
                onSelectPerson={select}
              />
            </div>
          )}
          {mode === "timeline" && (
            <ol className="consultante-demo-timeline" aria-label="Linha do tempo do Consultante">
              {timeline.map((event) => (
                <li key={event.key}>
                  <span>{formatByPrecision(event.rawDate, event.precision)}</span>
                  <button type="button" onClick={() => select(event.personId)}>
                    {event.label} · {event.personName}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="consultante-demo-inspector">
          <label htmlFor="consultante-demo-person">Localizar familiar</label>
          <select
            id="consultante-demo-person"
            value={personId}
            onChange={(event) => select(event.target.value)}
          >
            {family.persons.map((person) => (
              <option value={person.id} key={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
          <h4>{names.get(personId)}</h4>
          {mode === "spatial" && (
            <p className="text-ink-soft">
              Use “Abrir uniões” para conferir os filhos de cada união de Mariana.
            </p>
          )}
          <ul className="consultante-demo-parents" aria-label="Filiação registrada">
            {parentLinks.map((link) => (
              <li key={link.id}>
                <span>{names.get(link.from_person_id)}</span>
                <small>{link.qualifier === "unknown" ? "Por confirmar" : "Biológico"}</small>
              </li>
            ))}
          </ul>
          {parentLinks.length === 0 && <p>Genitores ainda desconhecidos neste caso.</p>}
          {draft ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draftLink || draftLink.qualifier === draft.qualifier) return;
                setPrevious(links);
                setLinks(
                  links.map((link) =>
                    link.id === draft.id ? { ...link, qualifier: draft.qualifier } : link,
                  ),
                );
                setDraft(null);
                setStatus("Filiação confirmada neste exercício.");
              }}
            >
              <label htmlFor="consultante-demo-parent">Genitor</label>
              <select
                id="consultante-demo-parent"
                value={draft.id}
                onChange={(event) => {
                  const link = parentLinks.find(({ id }) => id === event.target.value);
                  if (link) setDraft({ id: link.id, qualifier: link.qualifier ?? "biological" });
                }}
              >
                {parentLinks.map((link) => (
                  <option key={link.id} value={link.id}>
                    {names.get(link.from_person_id)}
                  </option>
                ))}
              </select>
              <label htmlFor="consultante-demo-kind">Natureza do vínculo</label>
              <select
                id="consultante-demo-kind"
                value={draft.qualifier}
                onChange={(event) => setDraft({ ...draft, qualifier: event.target.value })}
              >
                <option value="biological">Biológico</option>
                <option value="unknown">Por confirmar</option>
              </select>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={!draftLink || draft.qualifier === draftLink.qualifier}
                >
                  Confirmar filiação
                </Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {parentLinks.length > 0 && (
                <Button
                  type="button"
                  onClick={() => {
                    const link = parentLinks[0];
                    setDraft({ id: link.id, qualifier: link.qualifier ?? "biological" });
                    setStatus("");
                  }}
                >
                  Revisar filiação <ArrowRight size={16} aria-hidden />
                </Button>
              )}
              {previous && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLinks(previous);
                    setPrevious(null);
                    setStatus("Filiação anterior restaurada.");
                  }}
                >
                  Desfazer filiação
                </Button>
              )}
            </div>
          )}
          <p className="consultante-demo-status" role="status">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}
