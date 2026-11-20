/** A civil date has calendar fields and no time zone. */
export function civilDate(raw: string | null | undefined) {
  const value = raw?.trim();
  const match = value?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!value || !match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (year < 1 || (month !== null && (month < 1 || month > 12))) return null;
  if (month !== null && day !== null) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > days[month - 1]) return null;
  }
  const precision = day === null ? (month === null ? "year" : "month") : "day";
  return { value, year, month, day, precision } as const;
}

export function civilAge(birth: string | null, reference: string | null): number | null {
  const b = civilDate(birth);
  const r = civilDate(reference);
  if (!b?.day || !b.month || !r?.day || !r.month || r.value < b.value) return null;
  const beforeBirthday = r.month < b.month || (r.month === b.month && r.day < b.day);
  return r.year - b.year - Number(beforeBirthday);
}
