/** A legenda de filiação é a mesma nos modos 2D e 3D. */
export const parentLinePatterns: Readonly<Record<string, string | undefined>> = {
  adoptive: "2 4",
  foster: "7 5",
  stepparent: "8 4 2 4",
  unknown: "5 4",
};

type FamilyLink = {
  id: string;
  from_person_id: string;
  to_person_id: string;
};

/** Checks a proposed parent → child link against the other recorded parent links. */
export function validateParentLink(
  from: string,
  to: string,
  recorded: readonly FamilyLink[],
  editingId?: string,
): string | null {
  if (from === to) return "Escolha duas pessoas diferentes.";
  const children = new Map<string, string[]>();
  const parents = new Set<string>();
  for (const link of recorded) {
    if (link.id === editingId) continue;
    const { from_person_id: parent, to_person_id: child } = link;
    if (child === to) parents.add(parent);
    const siblings = children.get(parent) ?? [];
    siblings.push(child);
    children.set(parent, siblings);
  }
  if (parents.has(from)) return "Essa filiação já está registrada.";
  if (parents.size >= 2) {
    return "Essa pessoa já tem duas filiações registradas. Revise os vínculos na ficha.";
  }
  const pending = [to];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === from) {
      return "Essa ligação criaria um ciclo. Confira quem é genitor e quem é filho.";
    }
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return null;
}
