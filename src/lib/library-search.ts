/** Busca da Biblioteca: conceito, autor, obra ou termo, sem acentos/maiúsculas. */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

type Searchable = {
  category: string;
  title: string;
  meta: string;
  body: string;
  details?: string[];
  term?: { full?: string; authors?: string[]; related?: string[]; books?: string[] };
};

export function searchLibrary<T extends Searchable>(
  items: T[],
  q: string,
  category = "Todos",
): T[] {
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const scored = items
    .filter((x) => category === "Todos" || x.category === category)
    .map((x) => {
      const title = normalize(x.title);
      const hay = normalize(
        [
          x.title,
          x.meta,
          x.body,
          ...(x.details ?? []),
          x.term?.full ?? "",
          ...(x.term?.authors ?? []),
          ...(x.term?.related ?? []),
          ...(x.term?.books ?? []),
        ].join(" "),
      );
      if (!terms.every((t) => hay.includes(t))) return null;
      const score = terms.reduce((acc, t) => acc + (title.includes(t) ? 2 : 1), 0);
      return { x, score };
    })
    .filter((v): v is { x: T; score: number } => v !== null);
  if (terms.length) scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.x);
}
