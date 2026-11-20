import type { CaseTimelineItem, DatePrecision } from "./timeline";
import { civilDate } from "./civil-date";

const shortMonths = ["jan", "abr", "jul", "out"];

function dayStamp(year: number, month: number, date: number) {
  const result = new Date(0);
  result.setUTCFullYear(year, month, date);
  return result.getTime();
}

function dateRange(value: string, precision: DatePrecision) {
  const date = civilDate(value);
  if (!date || date.precision !== precision) return null;
  const { year } = date;
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  const begin = dayStamp(year, month - 1, day);
  const end =
    precision === "year"
      ? dayStamp(year + 1, 0, 1)
      : precision === "month"
        ? dayStamp(year, month, 1)
        : begin;
  return Number.isFinite(begin) && Number.isFinite(end) ? { year, begin, end } : null;
}

export function buildTimelineScale(items: CaseTimelineItem[]) {
  const dated = items.flatMap((item) => {
    if (!item.rawDate || item.year === null) return [];
    const range = dateRange(item.rawDate, item.precision);
    return range ? [{ item, ...range }] : [];
  });
  if (!dated.length) return null;

  const fromYear = Math.min(...dated.map(({ year }) => year));
  const toYear = Math.max(...dated.map(({ year }) => year));
  const axisStart = dayStamp(fromYear, 0, 1);
  const axisEnd = dayStamp(toYear + 1, 0, 1);
  const position = (stamp: number) => ((stamp - axisStart) / (axisEnd - axisStart)) * 100;
  const years = toYear - fromYear;
  const yearStep =
    [1, 2, 5, 10, 20, 25, 30, 50, 100, 200, 500, 1000, 2000].find((step) => years / step <= 5) ??
    5000;
  const firstTick = Math.ceil(fromYear / yearStep) * yearStep;
  const ticks =
    years === 0
      ? shortMonths.map((label, i) => ({ label, at: position(dayStamp(fromYear, i * 3, 1)) }))
      : Array.from({ length: Math.floor((toYear - firstTick) / yearStep) + 1 }, (_, i) => {
          const year = firstTick + i * yearStep;
          return { label: String(year), at: position(dayStamp(year, 0, 1)) };
        });

  return {
    fromYear,
    toYear,
    ticks,
    events: dated.map(({ item, begin, end }) => ({
      item,
      at: position((begin + end) / 2),
      from: position(begin),
      to: position(end),
    })),
  };
}

type PlotEvent = NonNullable<ReturnType<typeof buildTimelineScale>>["events"][number];

/** Nearby events share a marker on the overview. Individual records remain selectable. */
export function groupTimelineMarkers(events: PlotEvent[]) {
  const groups: PlotEvent[][] = [];
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    const last = groups.at(-1);
    if (last && event.at - last[0].at < 16) last.push(event);
    else groups.push([event]);
  }
  return groups.map((members) => ({
    members,
    at: members[0].at,
  }));
}
