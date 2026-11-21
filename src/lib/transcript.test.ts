import { describe, expect, it, vi } from "vitest";
import {
  parseTimedTranscript,
  prepareSessionTranscript,
  readTranscriptReviews,
  transcriptForSummary,
  transcriptPassages,
} from "./transcript";

describe("revisão da transcrição", () => {
  it("usa tempos do provedor válidos e preserva a revisão sem tempo quando ausentes", () => {
    expect(transcriptPassages("Rio", [{ text: "Rio", start: 15, end: 18 }])).toEqual([
      { index: 0, text: "Rio", start: 15 },
    ]);
    expect(parseTimedTranscript([{ text: "Rio", start: 18, end: 15 }])).toEqual([]);
    expect(transcriptPassages("Registro de teste.", undefined)).toEqual([
      { index: 0, text: "Registro de teste.", start: null },
    ]);
  });
  it("descarta entradas fora do formato", () => {
    expect(
      readTranscriptReviews({
        0: {
          decision: "confirmed",
          correction: "",
          audio_second: null,
          reviewed_at: "2026-11-20T00:00:00Z",
        },
        1: { decision: "other" },
      }),
    ).toEqual({
      0: {
        decision: "confirmed",
        correction: "",
        audio_second: null,
        reviewed_at: "2026-11-20T00:00:00Z",
      },
    });
  });

  it("estrutura somente o conteúdo aceito da transcrição", () => {
    const review = { audio_second: null, reviewed_at: "2026-11-20T00:00:00Z" };
    expect(
      transcriptForSummary(
        "Registro original",
        [
          { text: "Conversa fora do prontuário", start: 0, end: 2 },
          { text: "1980", start: 2, end: 3 },
          { text: "Local confirmado", start: 3, end: 4 },
        ],
        {
          0: { ...review, decision: "excluded", correction: "" },
          1: { ...review, decision: "corrected", correction: "1985" },
          2: { ...review, decision: "confirmed", correction: "" },
        },
      ),
    ).toBe("1985\n\nLocal confirmado");
  });

  it("retoma a transcrição guardada quando a síntese falha", async () => {
    const transcript = { text: "Relato fictício", segments: [] };
    const transcribe = vi.fn(async () => transcript);
    const persist = vi.fn(async () => {});
    const structure = vi
      .fn()
      .mockRejectedValueOnce(new Error("Falha da IA"))
      .mockResolvedValueOnce("Síntese");
    const initial = await prepareSessionTranscript(null, transcribe, persist);
    expect(persist).toHaveBeenCalledWith(initial);
    await expect(structure(initial)).rejects.toThrow("Falha da IA");
    await expect(
      structure(await prepareSessionTranscript(initial, transcribe, persist)),
    ).resolves.toBe("Síntese");
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
