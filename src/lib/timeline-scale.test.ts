import { describe, expect, it } from "vitest";
import type { CaseTimelineItem, DatePrecision } from "./timeline";
import { buildTimelineScale, groupTimelineMarkers } from "./timeline-scale";

function event(key: string, rawDate: string | null, precision: DatePrecision): CaseTimelineItem {
  return {
    key,
    personId: key,
    personName: key,
    relationship: null,
    generation: null,
    kind: "event",
    label: "Mudança",
    rawDate,
    precision,
    year: precision === "unknown" ? null : Number(rawDate?.slice(0, 4)),
    source: "Fixture",
  };
}

describe("escala gráfica da cronologia", () => {
  it("mantém eventos sem data e datas impossíveis fora do eixo", () => {
    const noDate = event("a", null, "unknown");
    const invalid = event("b", "2023-02-29", "day");
    const leapDay = event("c", "2024-02-29", "day");

    const scale = buildTimelineScale([noDate, invalid, leapDay]);
    expect(scale?.events.map(({ item }) => item.key)).toEqual(["c"]);
    expect(scale?.fromYear).toBe(2024);
    expect(buildTimelineScale([noDate, invalid])).toBeNull();
  });

  it("separa dia exato, intervalo de mês e intervalo de ano", () => {
    const scale = buildTimelineScale([
      event("dia", "2024-02-29", "day"),
      event("mês", "2024-02", "month"),
      event("ano", "2024", "year"),
    ])!;
    const [day, month, year] = scale.events;
    expect(day.from).toBe(day.to);
    expect(month.from).toBeLessThan(day.from);
    expect(month.to).toBeGreaterThan(day.to);
    expect(year.from).toBe(0);
    expect(year.to).toBe(100);
    expect(scale.ticks.map(({ label }) => label)).toEqual(["jan", "abr", "jul", "out"]);
  });

  it("agrupa registros próximos sem perder identidades nem datas", () => {
    const scale = buildTimelineScale([
      event("muito depois", "2020-01-01", "day"),
      event("mais cedo", "1990-01-01", "day"),
      event("pouco depois", "1990-01-02", "day"),
    ])!;
    const groups = groupTimelineMarkers(scale.events);
    expect(groups.map(({ members }) => members.map(({ item }) => item.key))).toEqual([
      ["mais cedo", "pouco depois"],
      ["muito depois"],
    ]);
    expect(groups[0].members[0].at).toBeLessThan(groups[0].members[1].at);
  });
});
