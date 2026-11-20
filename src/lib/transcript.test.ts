import { describe, expect, it } from "vitest";
import { parseTimedTranscript, readTranscriptReviews, transcriptPassages } from "./transcript";

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
});
