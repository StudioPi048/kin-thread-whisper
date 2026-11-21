import { expect, it, vi } from "vitest";
import type { Json } from "@/integrations/supabase/types";
import { persistIntakeEvent, type IntakeEvent } from "./intake-event-save";

const original: IntakeEvent = {
  id: "original",
  type: "Mudança   de cidade",
  description: "Ocorrência sintética",
  date: "1980—1985",
  source: "intake",
  source_field: "clan_important_events",
  source_label: "Acontecimentos",
  source_status: "pending",
  source_type: "family",
  source_note: "",
};
const proposed: IntakeEvent = {
  ...original,
  id: "nova-modal",
  type: "MUDANCA de cidade",
  date: "1980–1985",
};

it("detecta a proposta repetida ao reabrir e grava uma nova ocorrência só após confirmação", async () => {
  let events: Json[] = [original];
  const writer = {
    read: async () => ({ events, revision: "rev" }),
    update: vi.fn(async (next: Json[]) => {
      events = next;
      return true;
    }),
  };
  const result = await persistIntakeEvent(writer, proposed);
  expect(result).toMatchObject({
    kind: "duplicate",
    duplicates: [{ id: original.id, description: original.description }],
  });
  expect(writer.update).not.toHaveBeenCalled();
  if (result.kind !== "duplicate") throw new Error("Esperava uma proposta repetida");
  expect(await persistIntakeEvent(writer, proposed, result.signature)).toEqual({ kind: "saved" });
  expect(await persistIntakeEvent(writer, proposed)).toEqual({ kind: "saved" });
  expect(writer.update).toHaveBeenCalledTimes(1);
});

it("confere uma ocorrência simultânea antes de gravar e distingue outras origens ou datas", async () => {
  let events: Json[] = [
    { ...original, id: "date", date: "1980" },
    { ...original, id: "origin", source_type: "document" },
    { ...original, id: "field", source_field: "clan_bonds_ruptures" },
  ];
  const writer = {
    read: async () => ({ events, revision: "rev" }),
    update: vi.fn(async () => {
      events = [...events, original];
      return false;
    }),
  };
  expect(await persistIntakeEvent(writer, proposed)).toMatchObject({
    kind: "duplicate",
    duplicates: [{ id: original.id }],
  });
  expect(writer.update).toHaveBeenCalledTimes(1);
});
