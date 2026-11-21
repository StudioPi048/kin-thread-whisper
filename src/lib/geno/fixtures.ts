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
    qualifier: "biological",
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

/** Exercício público: duas uniões da mãe, com as filhas ligadas à união correspondente. */
export function practiceFamily(): SyntheticFamily {
  const family = smallFamily();
  const [, , carlos, mariana] = family.persons;
  const names = [
    "Helena Andrade Nogueira",
    "Lia Andrade Nogueira",
    "Carlos Augusto Nogueira",
    "Mariana Beatriz Andrade",
    "Antônio José Nogueira",
    "Rosa Maria Teixeira",
  ];
  const companion = person("Companheiro da mãe", "Gilberto Henrique Lima", "M", {
    birth_date: "1965-04-10",
  });
  const halfSister = person("Meia-irmã", "Sofia Andrade Lima", "F", {
    birth_date: "2001-06-08",
  });
  return {
    probandId: family.probandId,
    persons: [
      ...family.persons.map((p, index) => ({ ...p, full_name: names[index] })),
      companion,
      halfSister,
    ],
    rels: [
      ...family.rels,
      parentRel(mariana.id, halfSister.id),
      parentRel(companion.id, halfSister.id),
      {
        ...parentRel(carlos.id, mariana.id),
        relationship_type: "union",
        qualifier: "marriage",
        start_date: "1985-03-04",
        end_date: "1996-07-14",
        marriage_order: 1,
      },
      {
        ...parentRel(companion.id, mariana.id),
        relationship_type: "union",
        qualifier: "marriage",
        start_date: "2000-02-19",
        marriage_order: 2,
      },
    ],
  };
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

/** Árvore de treinamento com a convenção do Instituto Liz, sem dados reais. */
export function consultanteFamily(ancestorGenerations = 4): SyntheticFamily {
  seq = 0;
  const consultante = person("Consulente", "Consultante", "F", { birth_date: "1992-01-05" });
  const brother = person("Irmão", "Irmão", "M");
  const sister = person("Irmã", "Irmã", "F");
  const paternalUncle = person("Tio paterno", "Tio paterno", "M");
  const maternalUncle = person("Tio materno", "Tio materno", "M");
  const persons: PersonRow[] = [consultante, brother, sister, paternalUncle, maternalUncle];
  const rels: RelationshipRow[] = [];
  const levels = [
    ["Pai", "Mãe"],
    ["Avô", "Avó"],
    ["Bisavô", "Bisavó"],
    ["Tataravô", "Tataravó"],
  ];
  let current = [consultante];
  for (let level = 0; level < ancestorGenerations; level++) {
    const next: PersonRow[] = [];
    for (const [index, child] of current.entries()) {
      const paternal = index < current.length / 2;
      const side = paternal ? "paterno" : "materno";
      const femaleSide = paternal ? "paterna" : "materna";
      const [maleLabel, femaleLabel] = levels[level] ?? ["Antepassado", "Antepassada"];
      const title = (label: string, gender: "M" | "F") => {
        if (level === 0) return label;
        const branch = gender === "M" ? side : femaleSide;
        return level === 1
          ? `${label} ${branch}`
          : `${label} ${branch} (${gender === "M" ? "pai" : "mãe"} de ${child.full_name})`;
      };
      const father = person(
        level === 0 ? "Pai" : title(maleLabel, "M"),
        title(maleLabel, "M"),
        "M",
      );
      const mother = person(
        level === 0 ? "Mãe" : title(femaleLabel, "F"),
        title(femaleLabel, "F"),
        "F",
      );
      const children =
        level === 0
          ? [consultante, brother, sister]
          : level === 1
            ? [child, index === 0 ? paternalUncle : maternalUncle]
            : [child];
      persons.push(father, mother);
      next.push(father, mother);
      rels.push({
        ...parentRel(father.id, mother.id),
        id: `syn-union-${father.id}-${mother.id}`,
        relationship_type: "union",
        qualifier: "marriage",
      });
      for (const member of children) {
        rels.push({ ...parentRel(father.id, member.id), qualifier: "biological" });
        rels.push({ ...parentRel(mother.id, member.id), qualifier: "biological" });
      }
    }
    current = next;
  }
  return { persons, rels, probandId: consultante.id };
}
