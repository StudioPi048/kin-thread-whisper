import { describe, expect, it } from "vitest";
import type { PersonRow } from "@/lib/patterns";
import { buildCaseTimeline, filterTimeline, formatByPrecision, precisionOf } from "./timeline";

const p = (o: Partial<PersonRow>): PersonRow =>
  ({
    id: o.id ?? "x",
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
  p({ id: "m", full_name: "Mãe Teste", relationship_to_proband: "Mãe", birth_date: "1960-01-02", life_events: [{ date: "1985", description: "Mudança" }] }),
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
});
