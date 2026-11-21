import type { Json } from "@/integrations/supabase/types";
import { yearRange } from "@/lib/timeline";

export type IntakeEvent = {
  id: string;
  type: string;
  description: string;
  date: string;
  source: "intake";
  source_field: string;
  source_label: string;
  source_status: string;
  source_type: string;
  source_note: string;
};

type EventWriter = {
  read: () => Promise<{ events: Json[]; revision: string }>;
  update: (events: Json[], revision: string) => Promise<boolean>;
};

function eventRecord(event: Json) {
  return event && typeof event === "object" && !Array.isArray(event) ? event : null;
}

function normalizedType(value: Json | undefined) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
    : "";
}

function dateKey(value: Json | undefined) {
  if (typeof value !== "string") return "";
  const range = yearRange(value);
  return range ? `${range.first}–${range.last}` : value.trim();
}

function duplicateEvents(existing: Json[], proposed: IntakeEvent) {
  return existing.flatMap((value) => {
    const event = eventRecord(value);
    if (
      !event ||
      event.source !== proposed.source ||
      event.source_field !== proposed.source_field ||
      (event.source_type ?? "") !== proposed.source_type ||
      normalizedType(event.type) !== normalizedType(proposed.type) ||
      dateKey(event.date) !== dateKey(proposed.date)
    ) {
      return [];
    }
    return [
      {
        id: typeof event.id === "string" ? event.id : null,
        type: typeof event.type === "string" ? event.type : proposed.type,
        date: typeof event.date === "string" ? event.date.trim() : "",
        description: typeof event.description === "string" ? event.description : "",
      },
    ];
  });
}

export async function persistIntakeEvent(
  writer: EventWriter,
  event: IntakeEvent,
  confirmed?: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await writer.read();
    if (current.events.some((saved) => eventRecord(saved)?.id === event.id))
      return { kind: "saved" as const };

    const duplicates = duplicateEvents(current.events, event);
    const signature = JSON.stringify(duplicates);
    if (duplicates.length && signature !== confirmed)
      return { kind: "duplicate" as const, duplicates, signature };

    if (await writer.update([...current.events, event], current.revision))
      return { kind: "saved" as const };
  }
  throw new Error("A ficha foi alterada durante o registro. Tente de novo.");
}
