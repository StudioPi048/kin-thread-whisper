/**
 * Famílias SINTÉTICAS (nomes fictícios) para testes, demonstração da landing
 * e inspeção visual. Nunca usar dados de pacientes reais aqui.
 */
import type { PersonRow, RelationshipRow } from "@/lib/patterns";

let seq = 0;
function person(
  rel: string,
  name: string,
  gender: "M" | "F",
  extra: Partial<PersonRow> = {},
): PersonRow {
  seq++;
  return {
    id: `syn-${seq}`,
    client_id: "synthetic",
    full_name: name,
    preferred_name: null,
    gender,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    is_proband: rel === "Consulente",
    occupation: null,
    notes: null,
    tags: [],
    position_x: 0,
    position_y: 0,
    created_at: "",
    updated_at: "",
    cause_of_death: null,
    health_conditions: [],
    life_events: [],
    relationship_to_proband: rel,
    temperament: null,
    vices: null,
    gestational_weeks: null,
    birth_order: null,
    ...extra,
  } as PersonRow;
}

function parentRel(from: string, to: string): RelationshipRow {
  return {
    id: `syn-r-${from}-${to}`,
    client_id: "synthetic",
    from_person_id: from,
    to_person_id: to,
    relationship_type: "parent",
    qualifier: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: "",
    updated_at: "",
    marriage_order: null,
  } as RelationshipRow;
}

export type SyntheticFamily = { persons: PersonRow[]; rels: RelationshipRow[]; probandId: string };

/** Família pequena: cliente, 1 irmã, pais, avós paternos. */
export function smallFamily(): SyntheticFamily {
  seq = 0;
  const c = person("Consulente", "Helena (fictícia)", "F", { birth_date: "1990-04-12" });
  const s = person("Irmã(o)", "Lia (fictícia)", "F", { birth_date: "1993-08-01" });
  const pai = person("Pai", "Carlos (fictício)", "M", { birth_date: "1961-02-20" });
  const mae = person("Mãe", "Mariana (fictícia)", "F", { birth_date: "1963-11-05" });
  const avo = person("Avô paterno", "Antônio (fictício)", "M", {
    is_deceased: true,
    death_date: "2010-06-01",
  });
  const ava = person("Avó paterna", "Rosa (fictícia)", "F");
  const persons = [c, s, pai, mae, avo, ava];
  const rels = [
    parentRel(pai.id, c.id),
    parentRel(mae.id, c.id),
    parentRel(pai.id, s.id),
    parentRel(mae.id, s.id),
    parentRel(avo.id, pai.id),
    parentRel(ava.id, pai.id),
  ];
  return { persons, rels, probandId: c.id };
}

/** Família grande: cliente + 3 irmãos, pais, 4 avós, 8 bisavós, todos com filiação explícita. */
export function largeFamily(): SyntheticFamily {
  seq = 0;
  const persons: PersonRow[] = [];
  const rels: RelationshipRow[] = [];
  const c = person("Consulente", "Cliente fictício", "F");
  persons.push(c);
  const sibs = ["Irmão A", "Irmã B", "Irmão C"].map((n, i) =>
    person("Irmã(o)", `${n} (fictício)`, i % 2 ? "F" : "M"),
  );
  persons.push(...sibs);
  const pai = person("Pai", "Pai fictício", "M");
  const mae = person("Mãe", "Mãe fictícia", "F");
  persons.push(pai, mae);
  for (const k of [c, ...sibs]) rels.push(parentRel(pai.id, k.id), parentRel(mae.id, k.id));
  const grand = (side: "paterno" | "materno", child: PersonRow) => {
    const a = person(`Avô ${side}`, `Avô ${side} fictício`, "M");
    const b = person(
      side === "paterno" ? "Avó paterna" : "Avó materna",
      `Avó ${side} fictícia`,
      "F",
    );
    persons.push(a, b);
    rels.push(parentRel(a.id, child.id), parentRel(b.id, child.id));
    return [a, b];
  };
  const gp = [...grand("paterno", pai), ...grand("materno", mae)];
  gp.forEach((g, i) => {
    const side = i < 2 ? "paterno" : "materno";
    const fem = side === "paterno" ? "paterna" : "materna";
    const of = i % 2 === 0 ? "do avô" : "da avó";
    const a = person(`Bisavô ${side} (pai ${of})`, `Bisavô ${i + 1} fictício`, "M");
    const b = person(`Bisavó ${fem} (mãe ${of})`, `Bisavó ${i + 1} fictícia`, "F");
    persons.push(a, b);
    rels.push(parentRel(a.id, g.id), parentRel(b.id, g.id));
  });
  return { persons, rels, probandId: c.id };
}
