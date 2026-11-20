import { describe, expect, it } from "vitest";
import { buildLogicalGraph } from "@/lib/geno/build";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";
import { analyzeImport } from "./clan-import";
import { buildCaseTimeline, filterTimeline, formatByPrecision, precisionOf } from "./timeline";
import { buildTimelineScale } from "./timeline-scale";

const p = (o: Partial<PersonRow>): PersonRow =>
  ({
    id: o.id ?? "x",
    client_id: "synthetic",
    full_name: o.full_name ?? "Pessoa",
    preferred_name: null,
    is_proband: false,
    is_deceased: false,
    birth_date: null,
    death_date: null,
    relationship_to_proband: null,
    life_events: [],
    cause_of_death: null,
    ...o,
  }) as PersonRow;

const persons = [
  p({ id: "c", full_name: "Cliente Teste", is_proband: true, birth_date: "1990-05-10" }),
  p({
    id: "m",
    full_name: "Mãe Teste",
    relationship_to_proband: "Mãe",
    birth_date: "1960-01-02",
    life_events: [{ date: "1985", description: "Mudança" }],
  }),
  p({ id: "a", full_name: "Avô Teste", relationship_to_proband: "Avô materno", is_deceased: true }),
  p({ id: "s", full_name: "Sem vínculo", life_events: [{ date: "", description: "Algo" }] }),
];

describe("linha do tempo do caso", () => {
  const items = buildCaseTimeline(persons);

  it("não inventa precisão: ano só é ano, falecimento sem data é desconhecido", () => {
    expect(precisionOf("1985")).toBe("year");
    expect(precisionOf("1985-03")).toBe("month");
    expect(precisionOf("")).toBe("unknown");
    expect(formatByPrecision("1985", "year")).toBe("1985 (só o ano)");
    const death = items.find((i) => i.personId === "a" && i.kind === "death")!;
    expect(death.precision).toBe("unknown");
    expect(death.year).toBeNull();
  });
  it("datas desconhecidas vão para o fim, sem posição cronológica falsa", () => {
    const unknown = items.filter((i) => i.precision === "unknown");
    expect(items.slice(-unknown.length)).toEqual(unknown);
  });
  it("gerações: cliente 0, mãe 1, avô 2, sem vínculo = null", () => {
    expect(filterTimeline(items, { generation: 0 }).every((i) => i.personId === "c")).toBe(true);
    expect(filterTimeline(items, { generation: 1 }).map((i) => i.personId)).toEqual(["m", "m"]);
    expect(filterTimeline(items, { generation: 2 }).map((i) => i.personId)).toEqual(["a"]);
    expect(filterTimeline(items, { generation: "none" }).map((i) => i.personId)).toEqual(["s"]);
  });
  it("filtra por pessoa e tipo; cada item traz fonte", () => {
    expect(filterTimeline(items, { personId: "m", kind: "event" })).toHaveLength(1);
    expect(items.every((i) => i.source.length > 0)).toBe(true);
  });

  it("usa a geração canônica de uma filiação registrada que diverge da etiqueta", () => {
    const people = [
      p({ id: "consultante", is_proband: true, birth_date: "1990-01-04" }),
      p({ id: "genitor", relationship_to_proband: "Irmão", birth_date: "1960-01-04" }),
    ];
    const graph = buildLogicalGraph({
      persons: people,
      probandId: "consultante",
      rels: [
        {
          id: "filiação",
          client_id: "synthetic",
          from_person_id: "genitor",
          to_person_id: "consultante",
          relationship_type: "parent",
          qualifier: "biological",
        } as RelationshipRow,
      ],
    });
    const events = buildCaseTimeline(people, graph);
    expect(filterTimeline(events, { generation: 0 }).map(({ personId }) => personId)).toEqual([
      "consultante",
    ]);
    expect(filterTimeline(events, { generation: 1 }).map(({ personId }) => personId)).toEqual([
      "genitor",
    ]);
  });

  it("lê datas parciais legadas das observações de importação sem inventar precisão", () => {
    const rows = analyzeImport(
      [
        ["Ano", "1945", ""],
        ["Mês", "03/1950", ""],
        ["Dia/mês", "29/02", "02/1950"],
      ],
      { full_name: 0, birth: 1, death: 2 },
      [],
    );
    expect(
      rows.every(({ record }) => record?.birth_date === null && record?.death_date === null),
    ).toBe(true);
    const events = buildCaseTimeline(
      rows.map(({ record }) =>
        p({
          ...record,
          id: record!.full_name,
          birth_date_partial: null,
          death_date_partial: null,
        }),
      ),
    );
    expect(events.map(({ rawDate, precision }) => [rawDate, precision])).toEqual([
      ["1945", "year"],
      ["1950-02", "month"],
      ["1950-03", "month"],
      ["29/02", "month_day"],
    ]);
    expect(events.every(({ source }) => source.includes("Observações da importação"))).toBe(true);
    expect(buildTimelineScale(events)?.events).toHaveLength(3);
    expect(formatByPrecision(events[3].rawDate, events[3].precision)).toBe("29/02 (sem ano)");
  });

  it("representa um intervalo cadastrado e inclui o vínculo para os dois familiares", () => {
    const people = [
      p({ id: "a", full_name: "Pessoa A", birth_date_partial: "1968–1972" }),
      p({ id: "b", full_name: "Pessoa B" }),
    ];
    const union = {
      id: "union",
      relationship_type: "union",
      qualifier: "marriage",
      from_person_id: "a",
      to_person_id: "b",
      start_date: "1991-01-20",
    } as RelationshipRow;
    const timeline = buildCaseTimeline(people, undefined, [union]);
    const [birth] = filterTimeline(timeline, { decade: 1970 });
    const scale = buildTimelineScale([birth], 1970);
    expect(birth).toMatchObject({ rawDate: "1968–1972", precision: "range" });
    expect(scale?.events[0]?.from).toBe(0);
    expect(scale?.events[0]?.to).toBeGreaterThan(0);
    expect(filterTimeline(timeline, { personId: "b", kind: "union" })).toMatchObject([
      { personIds: ["a", "b"], personName: "Pessoa A e Pessoa B" },
    ]);
  });

  it("mantém relatos sem data e deixa datas civis impossíveis fora do gráfico", () => {
    const events = buildCaseTimeline([
      p({
        id: "relato",
        life_events: [
          { type: "Mudança", description: "Memória relatada" },
          { date: "1900-02-29", type: "Mudança", description: "Dia inconsistente" },
        ],
      }),
    ]);
    expect(events.map(({ label, precision }) => [label, precision])).toEqual([
      ["Mudança", "unknown"],
      ["Mudança", "unknown"],
    ]);
    expect(events[0].rawDate).toBeNull();
    expect(events[1].meta).toBe("Dia inconsistente");
    expect(buildTimelineScale(events)).toBeNull();
  });
});
