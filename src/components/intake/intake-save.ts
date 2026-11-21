import {
  calculateCompletion,
  intakeBirthTimeInput,
  type ClientIntake,
  type IntakeContextKey,
  type IntakeSectionId,
} from "@/lib/intake";
import type { Json } from "@/integrations/supabase/types";

export type IntakeFields = Partial<
  Omit<
    ClientIntake,
    | "id"
    | "client_id"
    | "professional_id"
    | "created_at"
    | "updated_at"
    | "completion_percentage"
    | "section_sources"
    | "field_context"
  >
>;
type IntakeChanges = IntakeFields &
  Partial<
    Record<
      `source:${IntakeSectionId}` | `context:${keyof ClientIntake}:${IntakeContextKey}`,
      string | null
    >
  >;
type IntakeCursor = Pick<IntakeFields, "last_section_edited" | "last_field_edited">;
type IntakeEdit = { revision: number; value: Json; expected: Json; cursor?: IntakeCursor };
export type IntakeEdits = Record<string, IntakeEdit>;
export type IntakeConflicts = Record<string, { previous: Json; current: Json }>;
type IntakePatch = IntakeFields & Pick<Partial<ClientIntake>, "section_sources" | "field_context">;
type IntakeSavePatch = IntakePatch & { completion_percentage: number };

function jsonObject(value: Json | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function savedValue(row: Partial<ClientIntake> | null | undefined, key: string): Json {
  if (key.startsWith("context:")) {
    const [, field, attribute] = key.split(":");
    return jsonObject(jsonObject(row?.field_context)[field])[attribute] ?? null;
  }
  if (key.startsWith("source:")) {
    return jsonObject(row?.section_sources)[key.slice("source:".length)] ?? null;
  }
  return row?.[key as keyof ClientIntake] ?? null;
}

function equalJson(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) && a.length === b.length && a.every((entry, i) => equalJson(entry, b[i]))
    );
  }
  if (Array.isArray(b)) return false;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([key, value]) => Object.hasOwn(b, key) && equalJson(value, b[key]))
  );
}

function sameValue(key: string, saved: Json, proposed: Json) {
  if (key === "birth_datetime" && typeof saved === "string" && typeof proposed === "string") {
    const civil = intakeBirthTimeInput(saved);
    if (civil) return civil === intakeBirthTimeInput(proposed);
  }
  return equalJson(saved, proposed);
}

export function captureIntakeEdits(
  changes: IntakeChanges,
  revision: number,
  current?: Partial<ClientIntake> | null,
  pending: IntakeEdits = {},
): IntakeEdits {
  const { last_field_edited, last_section_edited, ...fields } = changes;
  const cursor = last_field_edited ? { last_field_edited, last_section_edited } : undefined;
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [
            [
              key,
              {
                revision,
                value,
                expected: pending[key] ? pending[key].expected : savedValue(current, key),
                ...(cursor ? { cursor } : {}),
              },
            ],
          ],
    ),
  );
}

export function acknowledgeIntakeEdits(
  pending: IntakeEdits,
  saved: IntakeEdits,
  row?: ClientIntake | null,
): IntakeEdits {
  return Object.fromEntries(
    Object.entries(pending).flatMap(([key, edit]) => {
      const accepted = saved[key];
      if (!accepted) return [[key, edit]];
      if (edit.revision === accepted.revision) return [];
      return [[key, row === undefined ? edit : { ...edit, expected: savedValue(row, key) }]];
    }),
  );
}

export function intakePatch(current: Partial<ClientIntake> | null | undefined, edits: IntakeEdits) {
  const fields: Array<[string, Json]> = [];
  let sources: Record<string, Json | undefined> | undefined;
  let context: Record<string, Json | undefined> | undefined;
  let latest: IntakeEdit | undefined;
  for (const [key, edit] of Object.entries(edits)) {
    const { value, cursor } = edit;
    if (cursor && (!latest || latest.revision < edit.revision)) latest = edit;
    if (key.startsWith("context:")) {
      const [, field, attribute] = key.split(":");
      context ??= { ...jsonObject(current?.field_context) };
      const next = { ...jsonObject(context[field]) };
      if (value === null) delete next[attribute];
      else next[attribute] = value;
      if (Object.keys(next).length) context[field] = next;
      else delete context[field];
      continue;
    }
    if (!key.startsWith("source:")) {
      fields.push([key, value]);
      continue;
    }

    sources ??= { ...jsonObject(current?.section_sources) };
    const section = key.slice("source:".length);
    if (value === null) delete sources[section];
    else sources[section] = value;
  }
  const patch: IntakePatch = { ...Object.fromEntries(fields), ...latest?.cursor };
  if (sources) patch.section_sources = sources;
  if (context) patch.field_context = context;
  return patch;
}

type IntakeWriter = {
  read: () => Promise<ClientIntake | null>;
  insert: (patch: IntakeSavePatch) => Promise<ClientIntake | null>;
  update: (patch: IntakeSavePatch, previous: ClientIntake) => Promise<ClientIntake | null>;
};

export type IntakeSaveResult = {
  row: ClientIntake | null;
  accepted: IntakeEdits;
  conflicts: IntakeConflicts;
  wrote: boolean;
};

export async function persistIntakeEdits(
  writer: IntakeWriter,
  edits: IntakeEdits,
): Promise<IntakeSaveResult> {
  // O CAS da linha impede que outra transação passe entre a comparação e a escrita.
  for (let attempt = 0; attempt < 3; attempt++) {
    const previous = await writer.read();
    const accepted: IntakeEdits = {};
    const conflicts: IntakeConflicts = {};
    let hasWrite = false;
    for (const [key, edit] of Object.entries(edits)) {
      const current = savedValue(previous, key);
      const alreadySaved = sameValue(key, current, edit.value);
      if (alreadySaved || equalJson(current, edit.expected)) {
        accepted[key] = edit;
        hasWrite ||= !alreadySaved;
      } else {
        conflicts[key] = { previous: edit.expected, current };
      }
    }
    if (!hasWrite) return { row: previous, accepted, conflicts, wrote: false };

    const patch = intakePatch(previous, accepted);
    const payload = {
      ...patch,
      completion_percentage: calculateCompletion({ ...previous, ...patch }),
    };
    const saved = previous ? await writer.update(payload, previous) : await writer.insert(payload);
    if (saved) return { row: saved, accepted, conflicts, wrote: true };
  }
  throw new Error("A anamnese mudou durante o salvamento. Tente salvar de novo.");
}
