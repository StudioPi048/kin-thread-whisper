import { supabase } from "@/integrations/supabase/client";
import { readWorkspaceClientPage } from "@/lib/workspace-client-search";

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

export function readClientNamePage(_userId: string, search: string, from: number, size: number) {
  if (search.trim() && !nameSearchPattern(search)) {
    return Promise.resolve({ clients: [], total: 0, hasMore: false });
  }
  return readWorkspaceClientPage(supabase, { search, offset: from, limit: size });
}
