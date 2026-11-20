import { z } from "zod";

const timedSegment = z
  .object({
    text: z.string().trim().min(1),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
  })
  .refine(({ start, end }) => end >= start);

export function parseTimedTranscript(raw: unknown) {
  const parsed = z.array(timedSegment).safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.some(
      (segment, index, segments) => index > 0 && segment.start < segments[index - 1].start,
    )
  )
    return [];
  return parsed.data;
}

export function transcriptPassages(transcript: string, timed: unknown) {
  const segments = parseTimedTranscript(timed);
  if (segments.length) {
    return segments.map(({ text, start }, index) => ({ index, text, start }));
  }
  const chunks: string[] = [];
  const sentences =
    typeof Intl.Segmenter === "function"
      ? [...new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(transcript)].map(
          ({ segment }) => segment,
        )
      : transcript.split(/(?<=[.!?])\s+/).map((part) => `${part} `);
  let current = "";
  for (const segment of sentences) {
    if (current && current.length + segment.length > 450) {
      chunks.push(current.trim());
      current = "";
    }
    current += segment;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((text, index) => ({ index, text, start: null }));
}

export const transcriptDecisionLabels = {
  confirmed: "Confirmado",
  corrected: "Corrigido",
  excluded: "Descartado",
} as const;

export type TranscriptDecision = keyof typeof transcriptDecisionLabels;

const reviewSchema = z.object({
  decision: z.enum(["confirmed", "corrected", "excluded"]),
  correction: z.string(),
  audio_second: z.number().finite().nonnegative().nullable(),
  reviewed_at: z.string(),
});

export type TranscriptReviewEntry = z.infer<typeof reviewSchema>;

export function readTranscriptReviews(raw: unknown): Record<string, TranscriptReviewEntry> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([index, value]) => {
      if (!/^\d+$/.test(index)) return [];
      const parsed = reviewSchema.safeParse(value);
      return parsed.success ? [[index, parsed.data]] : [];
    }),
  );
}
