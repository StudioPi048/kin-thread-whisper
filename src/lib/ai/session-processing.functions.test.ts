import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  run: null as ((request: { data: unknown; context: unknown }) => Promise<unknown>) | null,
  authorize: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      middleware: () => builder,
      validator: (parser: typeof validate) => {
        validate = parser;
        return builder;
      },
      handler: (
        bridge: NonNullable<typeof server.run>,
        provider?: NonNullable<typeof server.run>,
      ) => {
        const handler = provider ?? bridge;
        server.run = ({ data, context }) => handler({ data: validate(data), context });
        return server.run;
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/audio-consent", () => ({ requireAudioConsent: server.authorize }));

// @ts-expect-error TanStack Start exposes the server implementation through a Vite query.
import "./session-processing.functions.ts?tss-serverfn-split";

const sessionId = "10000000-0000-4000-8000-000000000001";
const clientId = "10000000-0000-4000-8000-000000000002";
const userId = "10000000-0000-4000-8000-000000000003";
const consentId = "10000000-0000-4000-8000-000000000004";
const recordingGrantId = "10000000-0000-4000-8000-000000000005";
const audioPath = `${userId}/${clientId}/${sessionId}/fala.webm`;
const priorTranscript = "Teste fictício na plataforma Gena Liz.";
const normalizedTranscript = "Teste fictício na plataforma Genealiz.";
const originalSegments = [{ text: priorTranscript, start: 0, end: 5 }];
const normalizedSegments = [{ text: normalizedTranscript, start: 0, end: 5 }];
const originalSummary = { resumo: "Síntese fictícia anterior." };

function setup(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: sessionId,
    client_id: clientId,
    user_id: userId,
    audio_path: audioPath,
    updated_at: "2026-11-21T00:00:00.000Z",
    status: "ready",
    clinical_status: "completed",
    transcript: priorTranscript,
    transcript_segments: originalSegments,
    transcript_reviews: {},
    structured_note: originalSummary,
    summary_stale: false,
    ai_reviewed_at: null,
    manual_notes: "Nota manual fictícia",
    recording_consent_id: recordingGrantId,
    processing_consent_id: consentId,
    processing_attempt_id: null,
    processing_started_at: null,
    ...overrides,
  };
  const patches: {
    filters: [string, unknown][];
    values: Record<string, unknown>;
  }[] = [];
  const download = vi.fn(async (_path: string) => ({
    data: new Blob(["áudio fictício"], { type: "audio/webm" }),
    error: null,
  }));
  const storageFrom = vi.fn((_bucket: string) => ({ download }));
  const supabase = {
    from: vi.fn((table: string) => {
      expect(table).toBe("clinical_sessions");
      const filters: [string, unknown][] = [];
      let columns: string[] = [];
      let patch: Record<string, unknown> | undefined;
      const query = {
        select: (selection: string) => {
          columns = selection.split(",").map((column) => column.trim());
          return query;
        },
        update: (values: Record<string, unknown>) => {
          patch = values;
          return query;
        },
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        maybeSingle: async () => {
          if (!filters.every(([key, value]) => row[key] === value))
            return { data: null, error: null };
          if (patch) {
            patches.push({ filters: [...filters], values: patch });
            Object.assign(row, patch);
          }
          return {
            data: Object.fromEntries(columns.map((column) => [column, row[column]])),
            error: null,
          };
        },
      };
      return query;
    }),
    storage: { from: storageFrom },
  };
  const run = (retranscribe?: boolean) => {
    if (!server.run) throw new Error("Servidor de teste indisponível");
    return server.run({ data: { sessionId, retranscribe }, context: { supabase, userId } });
  };
  return { row, patches, download, storageFrom, run };
}

function gateway() {
  const fetch = vi
    .fn<(url: string, options: RequestInit) => Promise<Response>>()
    .mockResolvedValueOnce(
      Response.json({ text: normalizedTranscript, segments: normalizedSegments }),
    )
    .mockResolvedValueOnce(
      Response.json({
        choices: [{ message: { content: JSON.stringify({ resumo: normalizedTranscript }) } }],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  server.authorize.mockReset().mockResolvedValue({ id: consentId });
  vi.stubEnv("LOVABLE_API_KEY", "chave-ficticia-sem-acesso-externo");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("retranscrição de uma sessão sem revisão", () => {
  it("usa o áudio original, orienta a grafia da marca e grava os resultados juntos na mesma sessão", async () => {
    const { row, patches, run, download, storageFrom } = setup();
    const fetch = gateway();
    await expect(run(true)).resolves.toEqual({ ok: true });
    expect(storageFrom).toHaveBeenCalledWith("session-audio");
    expect(download).toHaveBeenCalledExactlyOnceWith(audioPath);
    expect(fetch).toHaveBeenCalledTimes(2);

    const [[transcriptionUrl, recognition], [summaryUrl, structure]] = fetch.mock.calls;
    expect(transcriptionUrl).toMatch(/\/audio\/transcriptions$/);
    expect(summaryUrl).toMatch(/\/chat\/completions$/);
    expect(recognition.body).toBeInstanceOf(FormData);
    const form = recognition.body as FormData;
    expect(form.get("language")).toBe("pt");
    expect(form.get("prompt")).toEqual(expect.stringContaining("Genealiz"));
    expect(form.get("file")).toMatchObject({ name: "fala.webm", size: expect.any(Number) });
    const { messages } = JSON.parse(String(structure.body)) as {
      messages: { role: string; content: string }[];
    };
    expect(messages.find(({ role }) => role === "user")?.content).toContain(normalizedTranscript);
    expect(messages.find(({ role }) => role === "user")?.content).not.toContain(priorTranscript);
    expect(server.authorize).toHaveBeenLastCalledWith(
      expect.anything(),
      clientId,
      "external_processing",
      consentId,
      sessionId,
    );

    expect(patches.map(({ values }) => values.status)).toEqual([
      "transcribing",
      "structuring",
      "ready",
    ]);
    expect(
      patches.every(({ filters }) => filters.some(([key, id]) => key === "id" && id === sessionId)),
    ).toBe(true);
    expect(patches[1].values).not.toHaveProperty("transcript");
    expect(patches[1].values).not.toHaveProperty("transcript_segments");
    expect(patches[2].values).toMatchObject({
      transcript: normalizedTranscript,
      transcript_segments: normalizedSegments,
      structured_note: { resumo: normalizedTranscript },
    });
    expect(row).toMatchObject({
      id: sessionId,
      client_id: clientId,
      status: "ready",
      audio_path: audioPath,
      clinical_status: "completed",
      manual_notes: "Nota manual fictícia",
      recording_consent_id: recordingGrantId,
      processing_consent_id: consentId,
      ai_reviewed_at: null,
      transcript_reviews: {},
    });
  });

  it("mantém a transcrição, a síntese e as notas anteriores se a segunda chamada falhar", async () => {
    const { row, run } = setup();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ text: normalizedTranscript, segments: normalizedSegments }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 502 }));
    vi.stubGlobal("fetch", fetch);
    await expect(run(true)).rejects.toThrow(/502/);
    expect(row).toMatchObject({
      id: sessionId,
      status: "error",
      transcript: priorTranscript,
      transcript_segments: originalSegments,
      structured_note: originalSummary,
      manual_notes: "Nota manual fictícia",
      recording_consent_id: recordingGrantId,
      processing_consent_id: consentId,
      processing_attempt_id: null,
    });
  });

  it.each([
    { ai_reviewed_at: "2026-11-21T00:01:00.000Z" },
    {
      transcript_reviews: {
        0: {
          decision: "confirmed",
          correction: "",
          audio_second: 0,
          reviewed_at: "2026-11-21T00:01:00.000Z",
        },
      },
    },
  ])("bloqueia a substituição quando há revisão humana", async (overrides) => {
    const { run, patches, download } = setup(overrides);
    const fetch = gateway();
    await expect(run(true)).rejects.toThrow(/áudio não está disponível/i);
    expect(fetch).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(patches).toEqual([]);
  });
});
