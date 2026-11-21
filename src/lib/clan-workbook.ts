import {
  analyzeImport,
  autoMap,
  IMPORT_FIELDS,
  parseDateField,
  type ClanSheet,
} from "./clan-import";
import { genogramGenderOptions, relationshipQualifiers, type RelationshipType } from "./genogram";
import {
  parentageSnapshot,
  parentageSources,
  reviewMatchesCurrent,
  validateParentagePlan,
  type ParentageCandidate,
  type ParentageHistoryEntry,
  type ParentageSource,
} from "./parentage-review";
import { civilDate } from "./civil-date";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Person = Tables<"genogram_persons">;
type Relation = Tables<"genogram_relationships">;
type PersonPatch = TablesUpdate<"genogram_persons">;
type VitalColumn = "birth_date" | "death_date";

const PERSON_ID = "ID da pessoa";
const CONSULTANTE = "consultante";
const UNION_ORDER = "Ordem da união";
const PARENTAGE_REVIEW_SHEET = "Revisões de filiação";
const REVIEW_HEADERS = {
  child: "ID do filho",
  reviewed: "Filiação revisada",
  id: "ID da revisão original",
  createdAt: "Data da revisão original",
  decision: "Ação da revisão original",
  source: "Fonte da revisão",
  note: "Nota da revisão",
} as const;
const LINK_HEADERS = [
  "ID do vínculo",
  "Origem",
  "Destino",
  "Tipo",
  "Natureza",
  "Início",
  "Fim",
  "Observações",
  UNION_ORDER,
] as const;
const TYPES: Record<string, RelationshipType> = {
  parent: "parent",
  filiacao: "parent",
  union: "union",
  uniao: "union",
  sibling: "sibling",
  irmandade: "sibling",
  emotional: "emotional",
  "vinculo emocional": "emotional",
};
const DEFAULT_LINK_TYPE = {
  parent: "Filiação",
  union: "União",
  sibling: "Irmandade",
  emotional: "Vínculo emocional",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getClanPersonKey(person: Person) {
  return person.is_proband ? CONSULTANTE : (person.clan_reference ?? person.id);
}

export function isIdentifiedClanSheet(sheet: ClanSheet) {
  return sheet.header.some((header) => normalize(header) === normalize(PERSON_ID));
}

export function isClanLinksSheet(sheet: ClanSheet) {
  const headers = sheet.header.map(normalize);
  return ["origem", "destino", "tipo"].every((name) => headers.includes(name));
}

function hasHeader(sheet: ClanSheet, header: string) {
  return sheet.header.some((label) => normalize(label) === normalize(header));
}

export function isClanParentageSheet(sheet: ClanSheet) {
  return (
    normalize(sheet.name) === normalize(PARENTAGE_REVIEW_SHEET) ||
    (hasHeader(sheet, REVIEW_HEADERS.child) && hasHeader(sheet, REVIEW_HEADERS.reviewed))
  );
}

function rawCellValue(sheet: ClanSheet, row: string[], header: string) {
  const index = sheet.header.findIndex((label) => normalize(label) === normalize(header));
  return row[index] ?? "";
}

function cellValue(sheet: ClanSheet, row: string[], header: string) {
  return rawCellValue(sheet, row, header).trim();
}

function parseLinkDate(value: string, type: RelationshipType) {
  const civil = type === "parent" ? civilDate(value) : null;
  if (civil?.precision === "day") return { kind: "exact" as const, iso: civil.value };
  return parseDateField(value);
}

export function parseClanVitalDate(field: VitalColumn, value: string) {
  const parsed = parseDateField(value);
  if (parsed.kind === "invalid") throw new Error(parsed.reason);
  const v = parsed.kind === "exact" ? parsed.iso : null;
  const partial = parsed.kind === "partial" ? parsed.raw : null;
  return { [field]: v, [`${field}_partial`]: partial } as PersonPatch;
}

type ParentKind = NonNullable<ParentageCandidate["kind"]>;
export type PersonWrite = {
  key: string;
  person_id: string | null;
  expected_updated_at: string | null;
  patch: PersonPatch;
};
type RelationWrite = {
  key: string | null;
  relationship_id: string | null;
  expected_updated_at: string | null;
  from_key: string;
  to_key: string;
  relationship_type: Exclude<RelationshipType, "parent">;
  qualifier: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  marriage_order?: number | null;
  marriage_order_present?: boolean;
};
type ParentageWrite = {
  child_key: string;
  expected: ReturnType<typeof parentageSnapshot>;
  expected_reviewed?: boolean;
  expected_review_id?: string | null;
  parents: Array<{ key: string; kind: ParentKind | null; link?: ParentLinkWrite }>;
  restore?: ParentageRestore;
};
type ParentLinkWrite = Pick<
  RelationWrite,
  "key" | "relationship_id" | "expected_updated_at" | "start_date" | "end_date" | "notes"
>;
type ReviewDecision = "confirm" | "edit" | "undo";
type OriginReview = {
  original_id: string;
  original_created_at: string;
  source: ParentageSource;
  note: string | null;
  decision: ReviewDecision;
};
type ParentageRestore = { reviewed: boolean; review: OriginReview | null };
export type WorkbookParentageReview = ParentageHistoryEntry;
type SheetParent = { kind: ParentKind | null; link?: ParentLinkWrite };
export type ClanWorkbookWrite = {
  people: PersonWrite[];
  links: RelationWrite[];
  parentages: ParentageWrite[];
};
type PersonPreview = {
  line: number;
  key: string;
  name: string;
  state: "include" | "update" | "keep" | "match" | "error";
  changes: string[];
  candidates: Person[];
};
type RelationPreview = {
  line: number;
  sheet?: typeof PARENTAGE_REVIEW_SHEET;
  name: string;
  detail: string;
  state: "include" | "update" | "keep" | "error";
};

const validKey = (key: string) => /^[A-Za-z0-9_-]{1,80}$/.test(key);
const equal = (left: unknown, right: unknown) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const parentKinds = ["biological", "adoptive", "foster", "stepparent", "unknown"];
const reviewDecisions = ["confirm", "edit", "undo"];

function mostRecentReviews(reviews: WorkbookParentageReview[]) {
  const byChild = new Map<string, WorkbookParentageReview>();
  for (const review of reviews) {
    if ((byChild.get(review.child_id)?.review_number ?? -1) < review.review_number)
      byChild.set(review.child_id, review);
  }
  return byChild;
}

function reviewOrigin(
  review: WorkbookParentageReview | undefined,
  links: ReturnType<typeof parentageSnapshot>,
  reviewed: boolean,
): OriginReview | null {
  if (!review || !reviewMatchesCurrent(review, links, reviewed)) return null;
  const originalId = review.workbook_import ? review.imported_review_key : review.id;
  const originalAt = review.workbook_import ? review.imported_review_created_at : review.created_at;
  const decision = review.workbook_import ? review.imported_review_decision : review.decision;
  if (!originalId || !originalAt || !decision) return null;
  return {
    original_id: originalId,
    original_created_at: originalAt,
    source: review.source as ParentageSource,
    note: review.note,
    decision: decision as ReviewDecision,
  };
}

function timeKey(value: string) {
  const stamp =
    /^(\d{4}-\d{2}-\d{2})[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:?\d{2})$/.exec(
      value,
    );
  if (!stamp || !civilDate(stamp[1])) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? `${instant}:${(stamp[2] ?? "").padEnd(6, "0").slice(3)}` : null;
}

function sameReview(left: OriginReview | null, right: OriginReview | null) {
  if (!left || !right) return left === right;
  return (
    left.original_id === right.original_id &&
    timeKey(left.original_created_at) === timeKey(right.original_created_at) &&
    left.source === right.source &&
    left.note === right.note &&
    left.decision === right.decision
  );
}

export function planClanWorkbook({
  peopleSheet,
  linksSheet,
  reviewSheet,
  existingPeople,
  existingLinks,
  existingReviews = [],
  choices,
  replaceParentage,
}: {
  peopleSheet: ClanSheet;
  linksSheet?: ClanSheet;
  reviewSheet?: ClanSheet;
  existingPeople: Person[];
  existingLinks: Relation[];
  existingReviews?: WorkbookParentageReview[];
  choices: Record<string, string>;
  replaceParentage: boolean;
}) {
  const plan: ClanWorkbookWrite = { people: [], links: [], parentages: [] };
  const mapping = autoMap(peopleSheet.header, false);
  const input = analyzeImport(peopleSheet.rows, mapping);
  const people: PersonPreview[] = [];
  const relations: RelationPreview[] = [];
  const byId = new Map(existingPeople.map((person) => [person.id, person]));
  const byKey = new Map(existingPeople.map((person) => [getClanPersonKey(person), person]));
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const labelByKey = new Map([...byKey].map(([key, person]) => [key, person.full_name]));
  const stableReference = new Map(
    existingPeople.map((person) => [person.id, getClanPersonKey(person)]),
  );

  for (const item of input) {
    const row = peopleSheet.rows[item.line - 2];
    if (row.every((value) => !value.trim())) continue;
    const key = cellValue(peopleSheet, row, PERSON_ID);
    const name = item.record?.full_name ?? cellValue(peopleSheet, row, "Nome");
    const direct = byKey.get(key) ?? byId.get(key);
    const chosen = direct ?? byId.get(choices[key]);
    const problems: string[] = [];
    if (!validKey(key))
      problems.push("Informe um ID único com letras, números, hífen ou sublinhado.");
    if (usedKeys.has(key)) problems.push("O mesmo ID aparece em duas linhas.");
    if (chosen && usedIds.has(chosen.id))
      problems.push("A mesma pessoa foi escolhida para duas linhas.");
    usedKeys.add(key);
    if (chosen) usedIds.add(chosen.id);
    if (key === CONSULTANTE || chosen?.is_proband) {
      if (!chosen?.is_proband)
        problems.push("Abra o genossociograma para inicializar a pessoa consultante.");
      if (!problems.length && chosen) {
        labelByKey.set(key, chosen.full_name);
        byKey.set(key, chosen);
        plan.people.push({
          key,
          person_id: chosen.id,
          expected_updated_at: chosen.updated_at,
          patch: {},
        });
      }
      people.push({
        line: item.line,
        key,
        name,
        state: problems.length ? "error" : "keep",
        changes: problems.length ? problems : ["Cadastro do consultante preservado."],
        candidates: [],
      });
      continue;
    }
    if (!problems.length && direct && !direct.full_name.trim() && !name.trim()) {
      people.push({
        line: item.line,
        key,
        name: direct.relationship_to_proband ?? "Pessoa sem nome",
        state: "keep",
        changes: ["Espaço reservado preservado. Informe um nome para importar dados nesta linha."],
        candidates: [],
      });
      continue;
    }
    if (!item.record || item.status === "error") problems.push(...item.messages);
    if (problems.length || !item.record) {
      people.push({
        line: item.line,
        key,
        name,
        state: "error",
        changes: problems.length ? problems : ["Confira a linha e o parentesco."],
        candidates: [],
      });
      continue;
    }
    const record = item.record;
    const possible = existingPeople.filter(
      (person) => !person.is_proband && normalize(person.full_name) === normalize(name),
    );
    if (!chosen && possible.length && choices[key] !== "new") {
      people.push({
        line: item.line,
        key,
        name,
        state: "match",
        changes: ["Escolha a pessoa existente ou confirme uma nova."],
        candidates: possible,
      });
      continue;
    }
    const patch: PersonPatch = { full_name: record.full_name };
    const mappedValue = (column: keyof typeof mapping) => row[mapping[column] ?? -1]?.trim() ?? "";
    for (const [field, value] of [
      ["relationship_to_proband", mappedValue("relationship")],
      ["gestational_weeks", record.gestational_weeks],
      ["occupation", record.occupation],
      ["vices", record.vices],
      ["temperament", record.temperament],
      ["birth_order", record.birth_order],
      ["notes", mappedValue("notes")],
      ["preferred_name", cellValue(peopleSheet, row, "Nome preferido")],
    ] as const) {
      if (value !== null && value !== "") Object.assign(patch, { [field]: value });
    }
    const birth = mappedValue("birth");
    const death = mappedValue("death");
    if (birth) Object.assign(patch, parseClanVitalDate("birth_date", birth));
    if (death) {
      Object.assign(
        patch,
        parseClanVitalDate("death_date", /^(sim|x|falecid[oa])$/i.test(death) ? "" : death),
      );
      patch.is_deceased = true;
    }
    const combinedBirth = "birth_date" in patch ? patch.birth_date : chosen?.birth_date;
    const combinedDeath = "death_date" in patch ? patch.death_date : chosen?.death_date;
    if (combinedBirth && combinedDeath && combinedBirth > combinedDeath) {
      people.push({
        line: item.line,
        key,
        name,
        state: "error",
        changes: [
          "Confira as colunas Nascimento e Falecimento. O falecimento deve ocorrer a partir do nascimento.",
        ],
        candidates: [],
      });
      continue;
    }
    const deceased = normalize(cellValue(peopleSheet, row, "Falecido"));
    if (!death && (deceased === "sim" || deceased === "nao"))
      patch.is_deceased = deceased === "sim";
    const health = mappedValue("illnesses");
    if (health.startsWith("[")) {
      try {
        const conditions: unknown = JSON.parse(health);
        if (
          !Array.isArray(conditions) ||
          conditions.some((condition) => typeof condition !== "string")
        )
          throw new Error();
        patch.health_conditions = conditions as string[];
      } catch {
        people.push({
          line: item.line,
          key,
          name,
          state: "error",
          changes: ["Confira a lista de enfermidades."],
          candidates: [],
        });
        continue;
      }
    } else if (record.health_conditions.length) patch.health_conditions = record.health_conditions;
    const rawGender = cellValue(peopleSheet, row, "Gênero");
    const gender = normalize(rawGender);
    if (gender) {
      const genderKey = gender === "m" ? "masculino" : gender === "f" ? "feminino" : gender;
      const option = genogramGenderOptions.find(
        (candidate) => candidate.value === genderKey || normalize(candidate.label) === genderKey,
      );
      if (chosen?.gender === rawGender) patch.gender = chosen.gender;
      else if (option) patch.gender = option.value;
      else {
        people.push({
          line: item.line,
          key,
          name,
          state: "error",
          changes: ["Confira o gênero informado."],
          candidates: [],
        });
        continue;
      }
    } else if (!chosen) patch.gender = record.gender;
    const cause = cellValue(peopleSheet, row, "Causa do falecimento");
    if (cause) patch.cause_of_death = cause;
    const changed = Object.entries(patch).filter(
      ([field, value]) => !equal(chosen?.[field as keyof Person], value),
    );
    const fieldNames: Record<string, string> = {
      full_name: "Nome",
      relationship_to_proband: "Parentesco",
      gender: "Gênero",
      birth_date: "Nascimento",
      birth_date_partial: "Precisão do nascimento",
      death_date: "Falecimento",
      death_date_partial: "Precisão do falecimento",
      gestational_weeks: "Gestação",
      is_deceased: "Situação de falecimento",
      preferred_name: "Nome preferido",
      health_conditions: "Enfermidades",
      cause_of_death: "Causa do falecimento",
      occupation: "Profissão",
      vices: "Vícios",
      temperament: "Temperamento",
      birth_order: "Ordem",
      notes: "Observações",
    };
    people.push({
      line: item.line,
      key,
      name,
      state: !chosen ? "include" : changed.length ? "update" : "keep",
      changes: chosen ? changed.map(([field]) => fieldNames[field] ?? field) : [],
      candidates: direct ? [] : possible,
    });
    labelByKey.set(key, name);
    if (chosen) {
      byKey.set(key, chosen);
      stableReference.set(chosen.id, key);
    }
    plan.people.push({
      key,
      person_id: chosen?.id ?? null,
      expected_updated_at: chosen?.updated_at ?? null,
      patch: chosen ? Object.fromEntries(changed) : patch,
    });
  }

  const parentRows = new Map<string, { lines: number[]; parents: Map<string, SheetParent> }>();
  const linkIds = new Set<string>();
  const explicitLinkKeys = new Set<string>();
  const changedLinkRows: RelationPreview[] = [];
  const hasUnionOrder = linksSheet?.header.some(
    (header) => normalize(header) === normalize(UNION_ORDER),
  );
  const resolveId = (key: string) =>
    byKey.get(key)?.id ?? byId.get(key)?.id ?? (labelByKey.has(key) ? `new:${key}` : "");
  const label = (key: string) => labelByKey.get(key) ?? byId.get(key)?.full_name ?? key;
  const showLink = (from: string, to: string) => `${label(from)} → ${label(to)}`;

  for (const [index, row] of (linksSheet?.rows ?? []).entries()) {
    if (!linksSheet || row.every((value) => !value.trim())) continue;
    const line = index + 2;
    const from = cellValue(linksSheet, row, "Origem");
    const to = cellValue(linksSheet, row, "Destino");
    const rawType = normalize(cellValue(linksSheet, row, "Tipo"));
    const type = Object.hasOwn(TYPES, rawType) ? TYPES[rawType] : undefined;
    const nature = cellValue(linksSheet, row, "Natureza");
    const qualifier = type
      ? (relationshipQualifiers[type].find(
          (q) => q.value === nature || normalize(q.label) === normalize(nature),
        )?.value ??
        (nature || null))
      : null;
    const name = showLink(from, to);
    if (!type || !resolveId(from) || !resolveId(to) || resolveId(from) === resolveId(to)) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "Confira o tipo e os IDs de duas pessoas diferentes.",
      });
      continue;
    }
    const start = parseLinkDate(cellValue(linksSheet, row, "Início"), type);
    const end = parseLinkDate(cellValue(linksSheet, row, "Fim"), type);
    if (
      start.kind === "invalid" ||
      start.kind === "partial" ||
      end.kind === "invalid" ||
      end.kind === "partial" ||
      (start.kind === "exact" && end.kind === "exact" && start.iso > end.iso)
    ) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "Confira as datas completas e a ordem do vínculo.",
      });
      continue;
    }
    const startDate = start.kind === "exact" ? start.iso : null;
    const endDate = end.kind === "exact" ? end.iso : null;
    const notes = cellValue(linksSheet, row, "Observações") || null;
    const linkKey = cellValue(linksSheet, row, "ID do vínculo");
    const rawOrder = cellValue(linksSheet, row, UNION_ORDER);
    const marriageOrder = rawOrder ? Number(rawOrder) : null;
    const hasOrderValue = type === "union" && hasUnionOrder;
    if (
      rawOrder &&
      (type !== "union" ||
        !/^\d+$/.test(rawOrder) ||
        !Number.isSafeInteger(marriageOrder) ||
        marriageOrder! < 1 ||
        marriageOrder! > 32767)
    ) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "Informe um número inteiro positivo na coluna Ordem da união, somente para uniões.",
      });
      continue;
    }
    const existing = existingLinks.find(
      (link) => linkKey && (link.id === linkKey || link.clan_reference === linkKey),
    );
    if (
      existing &&
      (existing.relationship_type !== type ||
        existing.from_person_id !== resolveId(from) ||
        existing.to_person_id !== resolveId(to))
    ) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "O ID pertence a um vínculo de outras pessoas ou de outro tipo.",
      });
      continue;
    }
    if (linkKey && (!validKey(linkKey) || explicitLinkKeys.has(linkKey))) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "O ID do vínculo precisa ser válido e único no arquivo.",
      });
      continue;
    }
    if (linkKey) explicitLinkKeys.add(linkKey);
    if (type === "parent") {
      const parentNote = rawCellValue(linksSheet, row, "Observações") || null;
      if (parentNote && [...parentNote].length > 32767) {
        relations.push({
          line,
          name,
          state: "error",
          detail: "As observações do vínculo devem ter até 32.767 caracteres.",
        });
        continue;
      }
      const kind = (
        normalize(qualifier ?? "") === "por confirmar" ? "unknown" : qualifier
      ) as ParentKind | null;
      if (kind != null && !parentKinds.includes(kind)) {
        relations.push({
          line,
          name,
          state: "error",
          detail: "Informe uma natureza de filiação válida.",
        });
        continue;
      }
      const childKey = stableReference.get(resolveId(to)) ?? to;
      const parentKey = stableReference.get(resolveId(from)) ?? from;
      const group = parentRows.get(childKey) ?? {
        lines: [] as number[],
        parents: new Map<string, SheetParent>(),
      };
      if (group.parents.has(parentKey)) {
        relations.push({
          line,
          name,
          state: "error",
          detail: "A mesma filiação aparece mais de uma vez.",
        });
        continue;
      }
      const matching = existingLinks.filter(
        (link) =>
          link.relationship_type === "parent" &&
          link.from_person_id === resolveId(from) &&
          link.to_person_id === resolveId(to),
      );
      const target = existing ?? matching[0];
      if (
        (!existing && matching.length > 1) ||
        (linkKey &&
          target?.clan_reference &&
          linkKey !== target.id &&
          linkKey !== target.clan_reference)
      ) {
        relations.push({
          line,
          name,
          state: "error",
          detail:
            "Esta filiação já tem outro ID lógico no dossiê. Confira o ID do vínculo antes de importar.",
        });
        continue;
      }
      const hasDetails =
        reviewSheet ||
        linkKey ||
        ["Início", "Fim", "Observações"].some((header) => hasHeader(linksSheet, header));
      const link = hasDetails
        ? {
            key: target?.clan_reference ?? (linkKey || null),
            relationship_id: target?.id ?? null,
            expected_updated_at: target?.updated_at ?? null,
            start_date: hasHeader(linksSheet, "Início") ? startDate : (target?.start_date ?? null),
            end_date: hasHeader(linksSheet, "Fim") ? endDate : (target?.end_date ?? null),
            notes: hasHeader(linksSheet, "Observações") ? parentNote : (target?.notes ?? null),
          }
        : undefined;
      const desiredKind = reviewSheet
        ? kind
        : (kind ?? (target ? (target.qualifier as ParentKind | null) : "unknown"));
      group.lines.push(line);
      group.parents.set(parentKey, { kind: desiredKind, ...(link ? { link } : {}) });
      parentRows.set(childKey, group);
      continue;
    }
    const matches = existingLinks.filter(
      (link) =>
        link.relationship_type === type &&
        link.from_person_id === resolveId(from) &&
        link.to_person_id === resolveId(to) &&
        link.qualifier === qualifier &&
        link.start_date === startDate &&
        link.end_date === endDate &&
        link.notes === notes &&
        (!hasOrderValue || link.marriage_order === marriageOrder),
    );
    if (!existing && matches.length > 1) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "Há mais de um vínculo semelhante. Informe o ID do vínculo ou a ordem da união.",
      });
      continue;
    }
    const identical = existing ? matches.find(({ id }) => id === existing.id) : matches[0];
    const target = existing ?? identical;
    if (target && linkIds.has(target.id)) {
      relations.push({
        line,
        name,
        state: "error",
        detail: "O mesmo vínculo aparece em duas linhas.",
      });
      continue;
    }
    if (target) linkIds.add(target.id);
    const state =
      identical?.id === target?.id && identical ? "keep" : target ? "update" : "include";
    const preview = {
      line,
      name,
      state,
      detail: DEFAULT_LINK_TYPE[type],
    } satisfies RelationPreview;
    relations.push(preview);
    if (state !== "keep") {
      changedLinkRows.push(preview);
      plan.links.push({
        key: linkKey || null,
        relationship_id: target?.id ?? null,
        expected_updated_at: target?.updated_at ?? null,
        from_key: from,
        to_key: to,
        relationship_type: type,
        qualifier,
        start_date: startDate,
        end_date: endDate,
        notes,
        ...(hasOrderValue ? { marriage_order: marriageOrder, marriage_order_present: true } : {}),
      });
    }
  }

  const replacements = new Map(
    plan.links.flatMap((link) =>
      link.relationship_id ? [[link.relationship_id, link] as const] : [],
    ),
  );
  const unionOrders = new Map<string, Array<RelationPreview | null>>();
  const recordOrder = (
    from: string,
    to: string,
    order: number | null,
    row: RelationPreview | null,
  ) => {
    const key = JSON.stringify([[from, to].sort(), order]);
    const rows = unionOrders.get(key) ?? [];
    rows.push(row);
    unionOrders.set(key, rows);
  };
  for (const link of existingLinks) {
    if (link.relationship_type === "union" && !replacements.has(link.id)) {
      recordOrder(link.from_person_id, link.to_person_id, link.marriage_order, null);
    }
  }
  for (const [index, link] of plan.links.entries()) {
    if (link.relationship_type !== "union") continue;
    const order = link.marriage_order_present
      ? (link.marriage_order ?? null)
      : (existingLinks.find((existing) => existing.id === link.relationship_id)?.marriage_order ??
        null);
    recordOrder(resolveId(link.from_key), resolveId(link.to_key), order, changedLinkRows[index]);
  }
  for (const rows of unionOrders.values()) {
    if (rows.length < 2) continue;
    for (const row of rows) {
      if (!row) continue;
      row.state = "error";
      row.detail =
        "Há outra união com esta ordem para as mesmas pessoas. Confira a ordem das duas uniões.";
    }
  }

  const existingParents = existingLinks.filter((link) => link.relationship_type === "parent");
  const restoredReviews = new Map<string, { line: number; restore: ParentageRestore }>();
  const reviewIds = new Set<string>();
  const latestReviews = mostRecentReviews(existingReviews);
  if (
    reviewSheet &&
    (!hasHeader(reviewSheet, REVIEW_HEADERS.child) ||
      !hasHeader(reviewSheet, REVIEW_HEADERS.reviewed))
  ) {
    relations.push({
      line: 1,
      sheet: PARENTAGE_REVIEW_SHEET,
      name: PARENTAGE_REVIEW_SHEET,
      state: "error",
      detail: "Inclua as colunas ID do filho e Filiação revisada.",
    });
  } else if (reviewSheet) {
    for (const [index, row] of reviewSheet.rows.entries()) {
      if (row.every((value) => !value.trim())) continue;
      const line = index + 2;
      const inputKey = cellValue(reviewSheet, row, REVIEW_HEADERS.child);
      const childId = resolveId(inputKey);
      const key = stableReference.get(childId) ?? inputKey;
      const flag = normalize(cellValue(reviewSheet, row, REVIEW_HEADERS.reviewed));
      const originalId = cellValue(reviewSheet, row, REVIEW_HEADERS.id);
      const originalAt = cellValue(reviewSheet, row, REVIEW_HEADERS.createdAt);
      const decision = normalize(cellValue(reviewSheet, row, REVIEW_HEADERS.decision));
      const source = normalize(cellValue(reviewSheet, row, REVIEW_HEADERS.source));
      const note = rawCellValue(reviewSheet, row, REVIEW_HEADERS.note) || null;
      const withOrigin = Boolean(originalId || originalAt || decision || source || note);
      const problems: string[] = [];
      if (!childId || restoredReviews.has(key)) problems.push("Confira o ID único do filho.");
      if (flag !== "sim" && flag !== "nao")
        problems.push("Informe Sim ou Não em Filiação revisada.");
      if (
        withOrigin &&
        (!validKey(originalId) ||
          reviewIds.has(originalId) ||
          !timeKey(originalAt) ||
          !reviewDecisions.includes(decision) ||
          !Object.hasOwn(parentageSources, source))
      ) {
        problems.push("Confira ID, data completa com fuso, ação e fonte da revisão original.");
      }
      if (note && [...note].length > 3000)
        problems.push("A nota da revisão deve ter até 3.000 caracteres.");
      if (problems.length) {
        relations.push({
          line,
          sheet: PARENTAGE_REVIEW_SHEET,
          name: label(key) || "Revisão de filiação",
          state: "error",
          detail: problems.join(" "),
        });
        continue;
      }
      if (originalId) reviewIds.add(originalId);
      restoredReviews.set(key, {
        line,
        restore: {
          reviewed: flag === "sim",
          review: withOrigin
            ? {
                original_id: originalId,
                original_created_at: originalAt,
                decision: decision as ReviewDecision,
                source: source as ParentageSource,
                note,
              }
            : null,
        },
      });
      if (
        !parentRows.has(key) &&
        (flag === "sim" ||
          withOrigin ||
          byId.get(childId)?.parentage_reviewed ||
          latestReviews.has(childId) ||
          existingParents.some((link) => link.to_person_id === childId))
      ) {
        parentRows.set(key, { lines: [], parents: new Map() });
      }
    }
  }

  const parentPlans = [...parentRows].map(([key, group]) => {
    const childId = resolveId(key);
    const before = existingParents.filter((link) => link.to_person_id === childId);
    const parents = new Map(group.parents);
    const restoreLine = restoredReviews.get(key);
    let extraParents = false;
    for (const link of before) {
      const existingKey = stableReference.get(link.from_person_id) ?? link.from_person_id;
      if (!parents.has(existingKey) && !replaceParentage) {
        extraParents = true;
        parents.set(existingKey, { kind: null });
      }
    }
    const choicesForChild = [...parents].map(([parentKey, { kind }]) => {
      const personId = resolveId(parentKey);
      return {
        personId,
        kind:
          kind ?? (before.some((link) => link.from_person_id === personId) ? undefined : "unknown"),
      } satisfies ParentageCandidate;
    });
    return { key, group, childId, before, parents, choicesForChild, restoreLine, extraParents };
  });
  const affectedChildren = new Set(parentPlans.map(({ childId }) => childId));
  const proposed: Parameters<typeof validateParentagePlan>[2] = [
    ...existingParents.filter((link) => !affectedChildren.has(link.to_person_id)),
    ...parentPlans.flatMap(({ childId, choicesForChild }) =>
      choicesForChild.map((parent) => ({
        id: `planned:${parent.personId}:${childId}`,
        from_person_id: parent.personId,
        to_person_id: childId,
        relationship_type: "parent",
        updated_at: "",
      })),
    ),
  ];
  for (const {
    key,
    group,
    childId,
    before,
    parents,
    choicesForChild,
    restoreLine,
    extraParents,
  } of parentPlans) {
    const expected = parentageSnapshot(existingLinks, childId);
    const beforeReviewed = byId.get(childId)?.parentage_reviewed ?? false;
    const latestReview = latestReviews.get(childId);
    const original = reviewOrigin(latestReview, expected, beforeReviewed);
    const restore = restoreLine?.restore;
    const error =
      (restore && extraParents
        ? "O dossiê tem outros genitores. Confira e autorize a substituição para restaurar esta revisão."
        : null) ?? validateParentagePlan(childId, choicesForChild, proposed);
    const changed =
      before.length !== choicesForChild.length ||
      [...parents].some(([parentKey, desired]) => {
        const stored = before.find((link) => link.from_person_id === resolveId(parentKey));
        if (!stored) return true;
        if (!desired.link) return desired.kind !== null && desired.kind !== stored.qualifier;
        const { link } = desired;
        return (
          desired.kind !== stored.qualifier ||
          (link.key !== null && link.key !== (stored.clan_reference ?? stored.id)) ||
          link.start_date !== stored.start_date ||
          link.end_date !== stored.end_date ||
          (link.notes ?? "") !== (stored.notes ?? "")
        );
      }) ||
      (restore && (restore.reviewed !== beforeReviewed || !sameReview(restore.review, original)));
    const beforeLabel = before.map(
      (link) => byId.get(link.from_person_id)?.full_name ?? link.from_person_id,
    );
    const afterLabel = [...parents.keys()].map(label);
    relations.push({
      line: group.lines[0] ?? restoreLine!.line,
      ...(group.lines.length ? {} : { sheet: PARENTAGE_REVIEW_SHEET }),
      name: label(key),
      state: error ? "error" : changed ? (byId.has(childId) ? "update" : "include") : "keep",
      detail:
        error ??
        [
          `Filiação atual: ${beforeLabel.join(" e ") || "sem registro"}. Proposta: ${afterLabel.join(" e ") || "sem genitores registrados"}.`,
          ...[...parents].flatMap(([parentKey, { kind, link }]) =>
            link
              ? [
                  `${label(parentKey)}: ${relationshipQualifiers.parent.find((entry) => entry.value === kind)?.label ?? "natureza sem registro"}${link.start_date ? `, início ${link.start_date}` : ""}${link.end_date ? `, fim ${link.end_date}` : ""}${link.notes ? ", com observações" : ""}.`,
                ]
              : [],
          ),
          restore &&
            (restore.reviewed
              ? "Estado no arquivo: filiação revisada."
              : "Estado no arquivo: filiação a revisar."),
          restore?.review &&
            `Revisão de origem: ${parentageSources[restore.review.source]} · ${restore.review.original_created_at}.`,
        ]
          .filter(Boolean)
          .join(" "),
    });
    if (!error && changed) {
      plan.parentages.push({
        child_key: key,
        expected,
        parents: [...parents].map(([parentKey, desired]) => ({ key: parentKey, ...desired })),
        ...(restore
          ? {
              expected_reviewed: beforeReviewed,
              expected_review_id: latestReview?.id ?? null,
              restore,
            }
          : {}),
      });
    }
  }

  return {
    people,
    relations,
    plan,
    blocking:
      people.some((person) => person.state === "match" || person.state === "error") ||
      relations.some((relation) => relation.state === "error"),
    actionable:
      people.some((person) => person.state === "include" || person.state === "update") ||
      plan.links.length > 0 ||
      plan.parentages.length > 0 ||
      plan.people.some(
        (person) =>
          person.person_id &&
          !byId.get(person.person_id)?.clan_reference &&
          !byId.get(person.person_id)?.is_proband &&
          person.key !== person.person_id,
      ),
  };
}

export async function createClanWorkbook(
  people: Person[],
  relationships: Relation[],
  reviews: WorkbookParentageReview[] = [],
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const linkedIds = new Set(
    relationships.flatMap((link) => [link.from_person_id, link.to_person_id]),
  );
  const exportedPeople = people.filter(
    (person) =>
      person.is_proband ||
      linkedIds.has(person.id) ||
      person.parentage_reviewed ||
      person.is_deceased ||
      person.health_conditions.length > 0 ||
      [
        person.full_name.trim(),
        person.preferred_name,
        person.birth_date,
        person.birth_date_partial,
        person.death_date,
        person.death_date_partial,
        person.gestational_weeks,
        person.cause_of_death,
        person.occupation,
        person.temperament,
        person.vices,
        person.birth_order,
        person.notes,
      ].some((value) => value != null && value !== ""),
  );
  const keys = new Map(exportedPeople.map((person) => [person.id, getClanPersonKey(person)]));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        PERSON_ID,
        ...IMPORT_FIELDS.map((field) => field.label),
        "Nome preferido",
        "Gênero",
        "Falecido",
        "Causa do falecimento",
      ],
      ...exportedPeople.map((person) => [
        getClanPersonKey(person),
        person.full_name,
        person.relationship_to_proband ?? "",
        person.birth_date ?? person.birth_date_partial ?? "",
        person.gestational_weeks ?? "",
        person.death_date ?? person.death_date_partial ?? "",
        person.health_conditions.length ? JSON.stringify(person.health_conditions) : "",
        person.occupation ?? "",
        person.vices ?? "",
        person.temperament ?? "",
        person.birth_order ?? "",
        person.notes ?? "",
        person.preferred_name ?? "",
        person.gender ?? "",
        person.is_deceased ? "Sim" : "Não",
        person.cause_of_death ?? "",
      ]),
    ]),
    "Pessoas",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [...LINK_HEADERS],
      ...relationships.flatMap((link) =>
        keys.has(link.from_person_id) && keys.has(link.to_person_id)
          ? [
              [
                link.clan_reference ?? link.id,
                keys.get(link.from_person_id),
                keys.get(link.to_person_id),
                DEFAULT_LINK_TYPE[link.relationship_type as RelationshipType],
                link.qualifier ?? "",
                link.start_date ?? "",
                link.end_date ?? "",
                link.notes ?? "",
                link.marriage_order ?? "",
              ],
            ]
          : [],
      ),
    ]),
    "Vínculos",
  );
  const latestReviews = mostRecentReviews(reviews);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      Object.values(REVIEW_HEADERS),
      ...exportedPeople.map((person) => {
        const review = reviewOrigin(
          latestReviews.get(person.id),
          parentageSnapshot(relationships, person.id),
          !!person.parentage_reviewed,
        );
        return [
          getClanPersonKey(person),
          person.parentage_reviewed ? "Sim" : "Não",
          review?.original_id ?? "",
          review?.original_created_at ?? "",
          review?.decision ?? "",
          review?.source ?? "",
          review?.note ?? "",
        ];
      }),
    ]),
    PARENTAGE_REVIEW_SHEET,
  );
  return workbook;
}
