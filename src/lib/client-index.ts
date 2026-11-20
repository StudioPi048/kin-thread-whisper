import { supabase } from "@/integrations/supabase/client";

export function foldSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const variants: Record<string, string> = {
  a: "[aáàâãä]",
  c: "[cç]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  n: "[nñ]",
  o: "[oóòôõö]",
  u: "[uúùûü]",
};

export function nameSearchPattern(value: string) {
  const words =
    foldSearch(value)
      .slice(0, 96)
      .match(/[\p{Letter}\d]+/gu) ?? [];
  return words
    .map((word) => Array.from(word, (character) => variants[character] ?? character).join(""))
    .join(".*");
}

export async function readClientNamePage(
  userId: string,
  search: string,
  from: number,
  size: number,
) {
  const pattern = nameSearchPattern(search);
  if (search.trim() && !pattern) return { clients: [], hasMore: false };

  let request = supabase
    .from("clients")
    .select("id, full_name, preferred_name")
    .eq("professional_id", userId)
    .eq("status", "active");
  if (pattern) {
    request = request.or(`full_name.imatch."${pattern}",preferred_name.imatch."${pattern}"`);
  }
  const { data, error } = await request
    .order("full_name")
    .order("id")
    .range(from, from + size);
  if (error) throw error;
  const rows = data ?? [];
  return { clients: rows.slice(0, size), hasMore: rows.length > size };
}
