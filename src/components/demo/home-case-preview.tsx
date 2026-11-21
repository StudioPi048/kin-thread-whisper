import { useCallback, useId, useRef, useState, type MouseEvent } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { practiceFamily } from "@/lib/geno/fixtures";
import type { DemoEntry } from "./consultante-demo";
import "./home-case-preview.css";

const { persons, rels, probandId } = practiceFamily();
const consultante = persons.find(({ id }) => id === probandId)!;
const parentsOf = (childId: string) =>
  rels
    .filter((link) => link.to_person_id === childId && link.relationship_type === "parent")
    .map((link) => link.from_person_id);
const parentIds = parentsOf(probandId);
const [father, mother] = persons.filter(({ id }) => parentIds.includes(id));
const sister = persons.find(({ id }) => {
  if (id === probandId) return false;
  const parents = parentsOf(id);
  return (
    parents.length === parentIds.length && parentIds.every((parent) => parents.includes(parent))
  );
})!;
const union = rels.find(
  (link) =>
    link.relationship_type === "union" &&
    parentIds.includes(link.from_person_id) &&
    parentIds.includes(link.to_person_id),
)!;

const firstName = (person: (typeof persons)[number]) => person.full_name.split(" ")[0];
const events = [
  { date: union.start_date, label: `Casamento de ${firstName(father)} e ${firstName(mother)}` },
  { date: consultante.birth_date, label: `Nascimento de ${firstName(consultante)}` },
  { date: sister.birth_date, label: `Nascimento de ${firstName(sister)}` },
];
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });
const roles = {
  [consultante.id]: "Consultante",
  [sister.id]: "Irmã",
  [father.id]: "Pai",
  [mother.id]: "Mãe",
};
type Person = (typeof persons)[number];

function NamePlate({
  person,
  selected,
  onOpenRecord,
}: {
  person: Person;
  selected: boolean;
  onOpenRecord: (person: Person) => void;
}) {
  const role = roles[person.id];
  return (
    <button
      type="button"
      className="home-case-name"
      aria-current={selected || undefined}
      aria-label={`${role} ${person.full_name}. Ver registro`}
      onClick={() => onOpenRecord(person)}
    >
      <span className="home-case-role">
        <span className="home-case-person-mark" data-gender={person.gender} aria-hidden="true" />
        {role}
        <ArrowUpRight className="home-case-name-arrow" size={14} aria-hidden="true" />
      </span>
      <strong>{person.full_name}</strong>
    </button>
  );
}

export function HomeCasePreview({
  onOpenCase,
}: {
  onOpenCase?: (event: MouseEvent<HTMLAnchorElement>, entry: DemoEntry) => void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState("relacoes");
  const [record, setRecord] = useState(consultante);
  const shouldFocusRecord = useRef(false);
  const focusRecord = useCallback((heading: HTMLHeadingElement | null) => {
    if (!heading || !shouldFocusRecord.current) return;
    shouldFocusRecord.current = false;
    heading.focus({ preventScroll: true });
  }, []);

  function openRecord(person: Person) {
    shouldFocusRecord.current = true;
    setRecord(person);
    setTab("registros");
  }

  const recordParentIds = parentsOf(record.id);
  const recordParents = persons.filter(({ id }) => recordParentIds.includes(id));

  return (
    <section className="home-case-preview" aria-labelledby={titleId}>
      <header className="home-case-header">
        <h2 id={titleId}>{consultante.full_name}</h2>
        <p>Dossiê fictício</p>
      </header>

      <Tabs.Root value={tab} onValueChange={setTab} className="home-case-tabs">
        <Tabs.List className="home-case-tab-list" aria-label="Prévia do dossiê">
          <Tabs.Trigger className="home-case-tab" value="relacoes">
            Vínculos
          </Tabs.Trigger>
          <Tabs.Trigger className="home-case-tab" value="cronologia">
            Cronologia
          </Tabs.Trigger>
          <Tabs.Trigger className="home-case-tab" value="registros">
            Registros
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className="home-case-panel" value="relacoes">
          <figure className="home-case-map">
            <figcaption className="sr-only">
              {firstName(consultante)} e {firstName(sister)} são filhas da união de{" "}
              {firstName(father)} e {firstName(mother)}.
            </figcaption>
            <div className="home-case-pair">
              <NamePlate
                person={consultante}
                selected={record.id === consultante.id}
                onOpenRecord={openRecord}
              />
              <NamePlate
                person={sister}
                selected={record.id === sister.id}
                onOpenRecord={openRecord}
              />
            </div>
            <div className="home-case-branch" aria-hidden="true" />
            <div className="home-case-pair">
              <NamePlate
                person={father}
                selected={record.id === father.id}
                onOpenRecord={openRecord}
              />
              <div className="home-case-union" aria-hidden="true">
                <span />
              </div>
              <NamePlate
                person={mother}
                selected={record.id === mother.id}
                onOpenRecord={openRecord}
              />
            </div>
          </figure>
        </Tabs.Content>

        <Tabs.Content className="home-case-panel" value="cronologia">
          <ol className="home-case-years">
            {events.map(({ date, label }) => (
              <li key={label}>
                {date && <time dateTime={date}>{date.slice(0, 4)}</time>}
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </Tabs.Content>

        <Tabs.Content className="home-case-panel" value="registros">
          <div className="home-case-record">
            <p>{roles[record.id]}</p>
            <h3 ref={focusRecord} tabIndex={-1}>
              {record.full_name}
            </h3>
            <dl>
              <div>
                <dt>Nascimento</dt>
                <dd>
                  {record.birth_date && (
                    <time dateTime={record.birth_date}>
                      {dateFormat.format(new Date(record.birth_date))}
                    </time>
                  )}
                </dd>
              </div>
              {recordParents.length > 0 && (
                <div>
                  <dt>Pais</dt>
                  <dd>
                    {recordParents.map((parent) => (
                      <span key={parent.id}>{parent.full_name}</span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <footer className="home-case-footer">
        <span>{Object.keys(roles).length} pessoas neste recorte</span>
        <a
          href="#caso-ficticio"
          onClick={(event) =>
            onOpenCase?.(event, {
              personId: tab === "registros" ? record.id : undefined,
              mode: tab === "cronologia" ? "timeline" : "map",
            })
          }
        >
          Ver caso completo <ArrowDown size={16} aria-hidden="true" />
        </a>
      </footer>
    </section>
  );
}
