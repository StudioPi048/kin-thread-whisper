import { describe, expect, it } from "vitest";
import {
  audioStateOf,
  clinicalStatusOf,
  confirmReview,
  isDirty,
  noteDraftInit,
  noteReducer,
} from "./session-state";

const now = new Date("2026-11-02T12:00:00Z");
const past = "2026-11-01T12:00:00Z";

describe("estado clínico separado do áudio", () => {
  it("futuro = agendada; passado sem registro = registro pendente; com nota = concluída", () => {
    expect(clinicalStatusOf({ session_date: "2026-11-03T12:00:00Z", status: "draft" }, now)).toBe(
      "scheduled",
    );
    expect(clinicalStatusOf({ session_date: past, status: "ready" }, now)).toBe("pending_record");
    expect(
      clinicalStatusOf({ session_date: past, status: "error", manual_notes: "obs" }, now),
    ).toBe("completed");
  });
  it("valor gravado explicitamente prevalece", () => {
    expect(
      clinicalStatusOf(
        { session_date: past, status: "ready", clinical_status: "in_progress" },
        now,
      ),
    ).toBe("in_progress");
  });
  it("erro de áudio não muda o estado clínico", () => {
    const s = { session_date: past, status: "error", audio_path: "a", manual_notes: "nota" };
    expect(audioStateOf(s)).toBe("error");
    expect(clinicalStatusOf(s, now)).toBe("completed");
  });
  it("texto gerado fica em revisão até confirmação", () => {
    expect(
      audioStateOf({ session_date: past, status: "ready", audio_path: "a", structured_note: {} }),
    ).toBe("review");
    expect(
      audioStateOf({
        session_date: past,
        status: "ready",
        audio_path: "a",
        structured_note: {},
        ai_reviewed_at: past,
      }),
    ).toBe("reviewed");
  });
});

describe("nota não se perde em falhas", () => {
  it("falha ao salvar mantém texto e pendência", () => {
    let s = noteDraftInit("antiga");
    s = noteReducer(s, { type: "edit", text: "nova observação" });
    s = noteReducer(s, { type: "save_start" });
    s = noteReducer(s, { type: "save_fail", message: "rede" });
    expect(s.text).toBe("nova observação");
    expect(isDirty(s)).toBe(true);
    expect(s.phase).toBe("error");
  });
  it("edição durante o envio continua pendente após sucesso", () => {
    let s = noteDraftInit("");
    s = noteReducer(s, { type: "edit", text: "a" });
    s = noteReducer(s, { type: "save_start" });
    s = noteReducer(s, { type: "edit", text: "ab" });
    s = noteReducer(s, { type: "save_ok", persisted: "a" });
    expect(s.text).toBe("ab");
    expect(isDirty(s)).toBe(true);
  });
  it("atualização do servidor (ex.: erro de áudio) não apaga edição local", () => {
    let s = noteDraftInit("x");
    s = noteReducer(s, { type: "edit", text: "x + local" });
    s = noteReducer(s, { type: "reset", saved: "x" });
    expect(s.text).toBe("x + local");
  });
});

describe("revisão só quando persistida", () => {
  it("falha de rede não marca revisado", async () => {
    expect((await confirmReview(() => Promise.reject(new Error("offline")))).reviewed).toBe(false);
  });
  it("resposta sem ai_reviewed_at não marca revisado", async () => {
    expect((await confirmReview(async () => ({ ai_reviewed_at: null }))).reviewed).toBe(false);
  });
  it("resposta confirmada marca revisado", async () => {
    expect((await confirmReview(async () => ({ ai_reviewed_at: past }))).reviewed).toBe(true);
  });
});

describe("descartar nota no diálogo de saída", () => {
  it("volta ao texto confirmado pelo banco", async () => {
    const { noteReducer, noteDraftInit, isDirty } = await import("./session-state");
    let s = noteDraftInit("salvo");
    s = noteReducer(s, { type: "edit", text: "editado" });
    s = noteReducer(s, { type: "save_fail", message: "x" });
    expect(isDirty(s)).toBe(true);
    s = noteReducer(s, { type: "discard" });
    expect(s.text).toBe("salvo");
    expect(isDirty(s)).toBe(false);
  });
});
