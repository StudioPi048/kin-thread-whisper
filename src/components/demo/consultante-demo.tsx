import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Clock3,
  GitFork,
  Network,
  Pencil,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenogramSpatialView } from "@/components/genogram/genogram-spatial-view";
import type { ParentagePreview } from "@/components/genogram/parentage-preview";
import { buildRenderGraph } from "@/components/genogram/render-graph";
import {
  buildLogicalGraph,
  getResolvedParents,
  NODE_H,
  NODE_W,
  SIBLING_GAP,
  type LogicalGraph,
  type NodePositionRow,
} from "@/lib/geno/build";
import { practiceFamily } from "@/lib/geno/fixtures";
import { clampHorizontalMove, type Snapshot } from "@/lib/geno/layout-history";
import { buildCaseTimeline, formatByPrecision } from "@/lib/timeline";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";
import { ConsultantePlane } from "./consultante-plane";
import "./consultante-demo.css";

const family = practiceFamily();
const initialCase: Case = {
  persons: family.persons,
  links: family.rels.map((link) =>
    link.relationship_type === "parent" ? { ...link, qualifier: "biological" } : link,
  ),
  positions: [],
};
const modes = [
  { value: "map", label: "2D", icon: Network },
  { value: "spatial", label: "3D", icon: Boxes },
  { value: "timeline", label: "Linha do tempo", icon: Clock3 },
] as const;

type Mode = (typeof modes)[number]["value"];
type Case = { persons: PersonRow[]; links: RelationshipRow[]; positions: NodePositionRow[] };
type Edit =
  | { kind: "name"; name: string }
  | { kind: "parent"; linkId: string; parentId: string; qualifier: string };
type RecordChange = {
  case: Case;
  personId: string;
  kind: Edit["kind"] | "position";
};

// In the shared projector, the demo's name plaques are wider than operational flow nodes.
// Give them their full spacing so short horizontal moves remain visible.
const demoWidthScale = 1.85;

const qualifierLabel = (qualifier: string | null) =>
  qualifier === "unknown" ? "Por confirmar" : "Biológico";

const parentsOf = (links: RelationshipRow[], childId: string) =>
  links.filter((link) => link.to_person_id === childId && link.relationship_type === "parent");

function displayRelationships(tree: LogicalGraph) {
  const root = tree.probandId;
  if (!root) return new Map<string, string>();
  const parents = getResolvedParents(tree, root);
  const bloodParents = parents.filter(({ kind }) => kind === "biological");
  const grandparents = bloodParents.flatMap(({ personId }) =>
    getResolvedParents(tree, personId)
      .filter(({ kind }) => kind === "biological")
      .map((link) => ({
        id: link.personId,
        branch: tree.persons.get(personId)?.row.gender === "F" ? "maternal" : "paternal",
      })),
  );
  return new Map(
    [...tree.persons].map(([id, entity]) => {
      const female = entity.row.gender === "F";
      if (id === root) return [id, "Consultante"];
      const parent = parents.find(({ personId }) => personId === id);
      if (parent)
        return [id, parent.kind === "unknown" ? "Filiação por confirmar" : female ? "Mãe" : "Pai"];
      if (tree.topRowIds.has(id)) {
        const siblingsParents = getResolvedParents(tree, id).filter(
          ({ kind }) => kind === "biological",
        );
        const shared = bloodParents.filter(({ personId }) =>
          siblingsParents.some((parent) => parent.personId === personId),
        );
        const sibling = female ? "Irmã" : "Irmão";
        if (shared.length === 2) return [id, sibling];
        if (bloodParents.length === 2 && siblingsParents.length === 2)
          return [id, female ? "Meia-irmã" : "Meio-irmão"];
        return [id, `${sibling} de sangue`];
      }
      const grandparent = grandparents.find((person) => person.id === id);
      if (grandparent) {
        const maternal = grandparent.branch === "maternal";
        return [
          id,
          female
            ? maternal
              ? "Avó materna"
              : "Avó paterna"
            : maternal
              ? "Avô materno"
              : "Avô paterno",
        ];
      }
      if (entity.lane === "social") return [id, "Vínculo próximo"];
      return [id, "Familiar"];
    }),
  );
}

export default function ConsultanteDemo() {
  const id = useId();
  const [mode, setMode] = useState<Mode>("map");
  const [personId, setPersonId] = useState(family.probandId);
  const [snapshot, setSnapshot] = useState<Case>(initialCase);
  const [history, setHistory] = useState<RecordChange[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [status, setStatus] = useState("");
  const [resetId, setResetId] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ personId: string }>();
  const [eventKey, setEventKey] = useState<string>();
  const nameField = useRef<HTMLInputElement>(null);
  const parentField = useRef<HTMLSelectElement>(null);
  const nameAction = useRef<HTMLButtonElement>(null);
  const parentAction = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Edit["kind"] | null>(null);

  const tree = useMemo(() => {
    const rendered = buildRenderGraph(
      snapshot.persons,
      snapshot.links,
      family.probandId,
      snapshot.positions,
    );
    const labels = displayRelationships(rendered.graph);
    return {
      ...rendered,
      nodes: rendered.nodes.map((node) =>
        node.type === "person"
          ? { ...node, data: { ...node.data, relationship_to_proband: labels.get(node.id) } }
          : node,
      ),
    };
  }, [snapshot]);
  const positions = useMemo<Snapshot>(
    () =>
      Object.fromEntries(
        tree.nodes
          .filter((node) => node.type === "person")
          .map(({ id, position }) => [id, [position.x, position.y]]),
      ),
    [tree],
  );
  const viewTree = useMemo(
    () => ({
      ...tree,
      nodes: tree.nodes.map((node) => ({
        ...node,
        position: { ...node.position, x: node.position.x * demoWidthScale },
      })),
    }),
    [tree],
  );
  const timeline = useMemo(
    () => buildCaseTimeline(snapshot.persons, tree.graph, snapshot.links),
    [snapshot, tree],
  );
  const names = new Map(snapshot.persons.map((p) => [p.id, p.full_name]));
  const name = names.get(personId) ?? "";
  const parentLinks = parentsOf(snapshot.links, personId);
  const editLink =
    edit?.kind === "parent" ? parentLinks.find(({ id }) => id === edit.linkId) : undefined;
  const parentGeneration = tree.graph.persons.get(editLink?.from_person_id ?? "")?.generation;
  const childGeneration = tree.graph.persons.get(personId)?.generation ?? 0;
  const otherParents = new Set(
    parentLinks.filter((link) => link !== editLink).map(({ from_person_id }) => from_person_id),
  );
  const parentOptions = [...tree.graph.persons.values()].filter(
    (person) =>
      person.id === editLink?.from_person_id ||
      (person.id !== personId &&
        !otherParents.has(person.id) &&
        person.generation === parentGeneration &&
        person.generation > childGeneration),
  );
  const updatedLinks =
    edit?.kind === "parent" && editLink
      ? snapshot.links.map((link) =>
          link.id === editLink.id
            ? { ...link, from_person_id: edit.parentId, qualifier: edit.qualifier }
            : link,
        )
      : snapshot.links;
  const parentageChanged =
    edit?.kind === "parent" &&
    editLink &&
    (edit.parentId !== editLink.from_person_id || edit.qualifier !== editLink.qualifier);
  const draftParents = parentsOf(updatedLinks, personId);
  const parentagePreview = useMemo<ParentagePreview | null>(() => {
    if (edit?.kind !== "parent" || !editLink || edit.parentId === editLink.from_person_id)
      return null;
    return {
      childId: personId,
      previousParentIds: parentsOf(snapshot.links, personId).map(
        ({ from_person_id }) => from_person_id,
      ),
      proposedParentIds: snapshot.links
        .filter((link) => link.to_person_id === personId && link.relationship_type === "parent")
        .map((link) => (link.id === editLink.id ? edit.parentId : link.from_person_id)),
      phase: "draft",
    };
  }, [personId, snapshot.links, edit, editLink]);

  const editKind = edit?.kind;
  useEffect(() => {
    if (editKind === "name") nameField.current?.focus();
    else if (editKind === "parent") parentField.current?.focus();
    else if (returnFocus.current) {
      const action = returnFocus.current === "name" ? nameAction : parentAction;
      action.current?.focus();
      returnFocus.current = null;
    }
  }, [editKind]);

  function select(id: string) {
    if (id === personId) return;
    setPersonId(id);
    setEdit(null);
    setStatus("");
  }

  function startParentEdit(id: string) {
    const link = parentsOf(snapshot.links, id)[0];
    if (!link) return;
    setPersonId(id);
    setStatus("");
    setEdit({
      kind: "parent",
      linkId: link.id,
      parentId: link.from_person_id,
      qualifier: link.qualifier ?? "biological",
    });
  }

  function finishEdit(kind: Edit["kind"]) {
    returnFocus.current = kind;
    setEdit(null);
  }

  function recordChange(next: Case, kind: RecordChange["kind"], subjectId: string) {
    setHistory((past) => [...past, { case: snapshot, personId: subjectId, kind }]);
    setSnapshot(next);
  }

  function apply(next: Case, kind: Edit["kind"]) {
    recordChange(next, kind, personId);
    finishEdit(kind);
    setStatus(
      kind === "name" ? "Nome atualizado neste exercício." : "Filiação alterada neste exercício.",
    );
  }

  function getMoveDelta(id: string, delta: number) {
    return (
      clampHorizontalMove(positions, id, delta / demoWidthScale, NODE_W + SIBLING_GAP, NODE_H) *
      demoWidthScale
    );
  }

  function movePerson(id: string, delta: number) {
    const moved = getMoveDelta(id, delta);
    if (!moved) return;
    const fixed = Object.entries(positions).map(([nodeId, [x, y]]) => ({
      id: nodeId,
      layout_id: "synthetic",
      layout_mode: "2d",
      node_id: nodeId,
      node_type: "person",
      x: nodeId === id ? x + moved / demoWidthScale : x,
      y,
      created_at: "",
      updated_at: "",
    }));
    recordChange({ ...snapshot, positions: fixed }, "position", id);
    select(id);
    setStatus("Posição horizontal atualizada.");
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    setSnapshot(last.case);
    setPersonId(last.personId);
    setHistory((past) => past.slice(0, -1));
    setStatus(
      {
        name: "Nome anterior restaurado.",
        parent: "Filiação anterior restaurada.",
        position: "Posição anterior restaurada.",
      }[last.kind],
    );
    if (history.length === 1) {
      nameAction.current?.focus();
    }
  }

  function reset() {
    setMode("map");
    setPersonId(family.probandId);
    setSnapshot(initialCase);
    setHistory([]);
    setEdit(null);
    setFocusRequest(undefined);
    setEventKey(undefined);
    setResetId((count) => count + 1);
    setStatus("Exercício reiniciado.");
  }

  return (
    <div className="consultante-demo">
      <header className="consultante-demo-toolbar">
        <div className="consultante-demo-modes" role="group" aria-label="Vista do caso">
          {modes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={value === mode ? "forest" : "outline"}
              aria-pressed={value === mode}
              type="button"
              size="sm"
              onClick={() => {
                setMode(value);
                setFocusRequest(undefined);
              }}
            >
              <Icon aria-hidden /> {label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          <RotateCcw aria-hidden /> Reiniciar exercício
        </Button>
      </header>
      <div className="consultante-demo-workspace">
        <div className="consultante-demo-stage">
          {mode === "map" && (
            <ConsultantePlane
              key={resetId}
              tree={viewTree}
              personId={personId}
              onSelect={select}
              focusRequest={focusRequest}
              parentagePreview={parentagePreview}
            />
          )}
          {mode === "spatial" && (
            <div className="consultante-demo-spatial">
              <GenogramSpatialView
                nodes={viewTree.nodes}
                edges={viewTree.edges}
                selectedPersonId={personId}
                onSelectPerson={select}
                onReviewParentage={startParentEdit}
                focusRequest={focusRequest}
                parentagePreview={parentagePreview}
                canMovePeople={!edit}
                getMovePersonDelta={getMoveDelta}
                onMovePerson={movePerson}
              />
            </div>
          )}
          {mode === "timeline" && (
            <ol className="consultante-demo-timeline" aria-label="Linha do tempo do caso fictício">
              {timeline.map((event) => (
                <li key={event.key}>
                  <span>{formatByPrecision(event.rawDate, event.precision)}</span>
                  <button
                    type="button"
                    aria-pressed={event.key === eventKey && personId === event.personId}
                    onClick={() => {
                      select(event.personId);
                      setEventKey(event.key);
                    }}
                  >
                    <strong>{event.label}</strong>
                    <span>{event.personName}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="consultante-demo-inspector" aria-labelledby={`${id}-name`}>
          <label htmlFor={`${id}-person`}>Localizar familiar</label>
          <select
            id={`${id}-person`}
            value={personId}
            onChange={(event) => {
              const nextId = event.target.value;
              select(nextId);
              if (mode !== "timeline") setFocusRequest({ personId: nextId });
            }}
          >
            {snapshot.persons.map((person) => (
              <option value={person.id} key={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>

          <div className="consultante-demo-record">
            <h4 id={`${id}-name`}>{name}</h4>
            {edit?.kind === "name" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = edit.name.trim();
                  if (!value || value === name) return;
                  apply(
                    {
                      ...snapshot,
                      persons: snapshot.persons.map((person) =>
                        person.id === personId ? { ...person, full_name: value } : person,
                      ),
                    },
                    "name",
                  );
                }}
              >
                <label htmlFor={`${id}-edit-name`}>Nome completo</label>
                <input
                  ref={nameField}
                  id={`${id}-edit-name`}
                  required
                  value={edit.name}
                  onChange={(event) => setEdit({ kind: "name", name: event.target.value })}
                />
                <div className="consultante-demo-actions">
                  <Button
                    size="sm"
                    variant="forest"
                    type="submit"
                    disabled={!edit.name.trim() || edit.name.trim() === name}
                  >
                    Salvar nome
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => finishEdit("name")}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                ref={nameAction}
                disabled={!!edit}
                onClick={() => {
                  setStatus("");
                  setEdit({ kind: "name", name });
                }}
              >
                <Pencil aria-hidden /> Editar nome
              </Button>
            )}
          </div>

          <section className="consultante-demo-parentage" aria-labelledby={`${id}-parents-title`}>
            <h5 id={`${id}-parents-title`}>Filiação registrada</h5>
            {parentLinks.length > 0 ? (
              <ul className="consultante-demo-parents" aria-labelledby={`${id}-parents-title`}>
                {parentLinks.map((link) => (
                  <li key={link.id}>
                    <span>{names.get(link.from_person_id)}</span>
                    <small>{qualifierLabel(link.qualifier)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Genitores ainda desconhecidos neste caso.</p>
            )}

            {edit?.kind === "parent" && editLink ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!parentageChanged) return;
                  const proposed = buildLogicalGraph({
                    persons: snapshot.persons,
                    rels: updatedLinks,
                    probandId: family.probandId,
                  });
                  if (proposed.errors.length) {
                    setStatus("A proposta forma uma ligação contraditória. Escolha outro genitor.");
                    return;
                  }
                  apply({ ...snapshot, links: updatedLinks }, "parent");
                }}
              >
                <label htmlFor={`${id}-parent-link`}>Vínculo a revisar</label>
                <select
                  ref={parentField}
                  id={`${id}-parent-link`}
                  value={edit.linkId}
                  onChange={(event) => {
                    const link = parentLinks.find(({ id }) => id === event.target.value);
                    if (link)
                      setEdit({
                        kind: "parent",
                        linkId: link.id,
                        parentId: link.from_person_id,
                        qualifier: link.qualifier ?? "biological",
                      });
                  }}
                >
                  {parentLinks.map((link) => (
                    <option key={link.id} value={link.id}>
                      {names.get(link.from_person_id)}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${id}-parent`}>Genitor proposto</label>
                <select
                  id={`${id}-parent`}
                  value={edit.parentId}
                  onChange={(event) => setEdit({ ...edit, parentId: event.target.value })}
                >
                  {parentOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.row.full_name}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${id}-qualifier`}>Natureza do vínculo</label>
                <select
                  id={`${id}-qualifier`}
                  value={edit.qualifier}
                  onChange={(event) => setEdit({ ...edit, qualifier: event.target.value })}
                >
                  <option value="biological">Biológico</option>
                  <option value="unknown">Por confirmar</option>
                </select>
                {parentageChanged && (
                  <div className="consultante-demo-proposal">
                    <h6>Filiação proposta</h6>
                    <ul className="consultante-demo-parents">
                      {draftParents.map((link) => (
                        <li key={link.id}>
                          <span>{names.get(link.from_person_id)}</span>
                          <small>{qualifierLabel(link.qualifier)}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="consultante-demo-actions">
                  <Button size="sm" variant="forest" type="submit" disabled={!parentageChanged}>
                    Confirmar filiação
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => finishEdit("parent")}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              parentLinks.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  ref={parentAction}
                  disabled={!!edit}
                  onClick={() => startParentEdit(personId)}
                >
                  <GitFork aria-hidden /> Revisar filiação
                </Button>
              )
            )}
          </section>
          {mode === "map" && !edit && (
            <details className="consultante-demo-position">
              <summary>Ajustar posição</summary>
              <div className="consultante-demo-actions">
                <Button
                  size="icon"
                  variant="outline"
                  type="button"
                  aria-label="Mover familiar para a esquerda"
                  disabled={!getMoveDelta(personId, -70)}
                  onClick={() => movePerson(personId, -70)}
                >
                  <ArrowLeft aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  type="button"
                  aria-label="Mover familiar para a direita"
                  disabled={!getMoveDelta(personId, 70)}
                  onClick={() => movePerson(personId, 70)}
                >
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </details>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!history.length || !!edit}
            onClick={undo}
          >
            <Undo2 aria-hidden /> Desfazer última edição
          </Button>
          <p className="consultante-demo-status" role="status">
            {status}
          </p>
        </aside>
      </div>
    </div>
  );
}
