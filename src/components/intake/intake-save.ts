import {
  calculateCompletion,
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
export type IntakeEdits = Record<string, { revision: number; value: Json }>;
type IntakePatch = IntakeFields & Pick<Partial<ClientIntake>, "section_sources" | "field_context">;
type IntakeSavePatch = IntakePatch & { completion_percentage: number };

export function captureIntakeEdits(changes: IntakeChanges, revision: number): IntakeEdits {
  return Object.fromEntries(
    Object.entries(changes).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, { revision, value }]],
    ),
  );
}

export function acknowledgeIntakeEdits(pending: IntakeEdits, saved: IntakeEdits): IntakeEdits {
  return Object.fromEntries(
    Object.entries(pending).filter(([key, edit]) => edit.revision !== saved[key]?.revision),
  );
}

export function intakePatch(current: Partial<ClientIntake> | null | undefined, edits: IntakeEdits) {
  const fields: Array<[string, Json]> = [];
  let sources: Record<string, Json | undefined> | undefined;
  let context: Record<string, Json | undefined> | undefined;
  for (const [key, { value }] of Object.entries(edits)) {
    if (key.startsWith("context:")) {
      const [, field, attribute] = key.split(":");
      const saved = current?.field_context;
      context ??= saved && typeof saved === "object" && !Array.isArray(saved) ? { ...saved } : {};
      const previous = context[field];
      const next =
        previous && typeof previous === "object" && !Array.isArray(previous) ? { ...previous } : {};
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

    if (!sources) {
      const saved = current?.section_sources;
      sources = saved && typeof saved === "object" && !Array.isArray(saved) ? { ...saved } : {};
    }
    const section = key.slice("source:".length);
    if (value === null) delete sources[section];
    else sources[section] = value;
  }
  const patch: IntakePatch = Object.fromEntries(fields);
  if (sources) patch.section_sources = sources;
  if (context) patch.field_context = context;
  return patch;
}

type IntakeWriter = {
  read: () => Promise<ClientIntake | null>;
  insert: (patch: IntakeSavePatch) => Promise<ClientIntake | null>;
  update: (patch: IntakeSavePatch, previous: ClientIntake) => Promise<ClientIntake | null>;
};

export async function persistIntakeEdits(writer: IntakeWriter, edits: IntakeEdits) {
  // On a competing write, re-read and merge only the fields from this edit.
  for (let attempt = 0; attempt < 3; attempt++) {
    const previous = await writer.read();
    const patch = intakePatch(previous, edits);
    const payload = {
      ...patch,
      completion_percentage: calculateCompletion({ ...previous, ...patch }),
    };
    const saved = previous ? await writer.update(payload, previous) : await writer.insert(payload);
    if (saved) return saved;
  }
  throw new Error("A anamnese mudou durante o salvamento. Tente salvar de novo.");
}
