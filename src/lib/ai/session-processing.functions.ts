import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { requireAudioConsent } from "@/lib/audio-consent";
import {
  parseTimedTranscript,
  prepareSessionTranscript,
  transcriptForSummary,
} from "@/lib/transcript";
import { canRetryAudioProcessing } from "@/lib/session-state";
import type { TablesUpdate } from "@/integrations/supabase/types";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe";
const STRUCTURE_MODEL = "google/gemini-2.5-flash";
const TRANSCRIPTION_PROMPT =
  "Genealiz é a plataforma de psicogenealogia do Instituto Liz. Use a grafia Genealiz quando o áudio mencionar a plataforma. Preserve os demais nomes e transcreva apenas o que foi dito.";

const structureSchema = z
  .object({
    resumo: z.string().default(""),
    queixa_principal: z.string().default(""),
    fatos_relatados: z.array(z.string()).default([]),
    hipoteses_sistemicas: z.array(z.string()).default([]),
    padroes_observados: z.array(z.string()).default([]),
    figuras_do_cla_mencionadas: z.array(z.string()).default([]),
    eventos_significativos: z.array(z.string()).default([]),
    encaminhamentos: z.array(z.string()).default([]),
    proxima_sessao: z.string().default(""),
  })
  .refine((value) => Object.values(value).some((part) => part.length > 0));

const STRUCTURE_SYSTEM = `Você é assistente clínica de uma psicogenealogista.
A partir da transcrição bruta de uma sessão, produza um prontuário estruturado
em JSON com humildade epistêmica: separe SEMPRE o que é FATO relatado do que
é HIPÓTESE clínica. Nunca invente dados. Se algo não foi dito, deixe vazio.
Preserve a grafia dos nomes próprios e das marcas presente na transcrição.

Formato de saída obrigatório (JSON válido, nada além):
{
  "resumo": "1-3 frases",
  "queixa_principal": "",
  "fatos_relatados": ["..."],
  "hipoteses_sistemicas": ["... (marcada como hipótese)"],
  "padroes_observados": ["..."],
  "figuras_do_cla_mencionadas": ["nome — relação"],
  "eventos_significativos": ["..."],
  "encaminhamentos": ["..."],
  "proxima_sessao": ""
}`;

async function callGateway(path: string, init: RequestInit): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  const res = await fetch(`${AI_GATEWAY}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    if (res.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA insuficientes na workspace.");
    throw new Error(`O serviço de processamento retornou um erro (${res.status}).`);
  }
  return res;
}

export const processSessionAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("clinical_sessions")
      .select(
        "id, client_id, audio_path, user_id, status, updated_at, processing_started_at, transcript, transcript_segments, transcript_reviews, summary_stale",
      )
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Sessão não encontrada");
    if (session.user_id !== userId) throw new Error("Sem permissão");
    if (!session.audio_path) throw new Error("Sessão sem áudio");

    if (
      !canRetryAudioProcessing(
        session.status,
        session.processing_started_at,
        session.updated_at,
        Date.now(),
        session.summary_stale,
      )
    ) {
      throw new Error("O áudio não está disponível para processamento.");
    }

    const checkpoint = session.transcript?.trim()
      ? { text: session.transcript, segments: parseTimedTranscript(session.transcript_segments) }
      : null;
    if (
      checkpoint &&
      !transcriptForSummary(checkpoint.text, checkpoint.segments, session.transcript_reviews)
    ) {
      throw new Error(
        "Todos os trechos foram descartados. Revise a transcrição para gerar uma síntese.",
      );
    }
    const consent = await requireAudioConsent(
      supabase,
      session.client_id,
      "external_processing",
      undefined,
      session.id,
    );
    const attempt = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabase
      .from("clinical_sessions")
      .update({
        status: checkpoint ? "structuring" : "transcribing",
        error_message: null,
        processing_consent_id: consent.id,
        processing_attempt_id: attempt,
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("status", session.status)
      .eq("updated_at", session.updated_at)
      .eq("audio_path", session.audio_path)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) throw new Error("O estado do áudio mudou. Atualize a sessão.");

    const updateAttempt = (patch: TablesUpdate<"clinical_sessions">) =>
      supabase
        .from("clinical_sessions")
        .update(patch)
        .eq("id", session.id)
        .eq("processing_attempt_id", attempt)
        .select("id")
        .maybeSingle();

    const checkConsent = () =>
      requireAudioConsent(
        supabase,
        session.client_id,
        "external_processing",
        consent.id,
        session.id,
      );
    const audioPath = session.audio_path;
    try {
      const transcript = await prepareSessionTranscript(
        checkpoint,
        async () => {
          const { data: file, error: dlErr } = await supabase.storage
            .from("session-audio")
            .download(audioPath);
          if (dlErr || !file) throw new Error(dlErr?.message ?? "Falha ao baixar áudio");

          const form = new FormData();
          form.append("file", file, audioPath.split("/").pop() ?? "audio.webm");
          form.append("model", TRANSCRIBE_MODEL);
          form.append("language", "pt");
          form.append("prompt", TRANSCRIPTION_PROMPT);
          await checkConsent();
          const response = await callGateway("/audio/transcriptions", {
            method: "POST",
            body: form,
          });
          const raw = (await response.json()) as { text?: string; segments?: unknown };
          return {
            text: typeof raw.text === "string" ? raw.text.trim() : "",
            segments: parseTimedTranscript(raw.segments),
          };
        },
        async ({ text, segments }) => {
          await checkConsent();
          const { data: transcribed, error: transcriptError } = await updateAttempt({
            status: "structuring",
            transcript: text,
            transcript_segments: segments,
          });
          if (transcriptError || !transcribed)
            throw new Error("Não foi possível guardar a transcrição.");
        },
      );
      const confirmedText = transcriptForSummary(
        transcript.text,
        transcript.segments,
        session.transcript_reviews,
      );
      await checkConsent();
      const chatRes = await callGateway("/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: STRUCTURE_MODEL,
          messages: [
            { role: "system", content: STRUCTURE_SYSTEM },
            { role: "user", content: `Transcrição da sessão:\n\n${confirmedText}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      const chatJson = (await chatRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = chatJson.choices?.[0]?.message?.content ?? "{}";
      let structured: z.infer<typeof structureSchema>;
      try {
        structured = structureSchema.parse(JSON.parse(raw));
      } catch {
        throw new Error(
          "A síntese gerada não pôde ser validada. A transcrição está disponível para nova tentativa.",
        );
      }

      await checkConsent();
      const { data: saved, error: noteError } = await updateAttempt({
        structured_note: structured,
        summary_stale: false,
        ai_reviewed_at: null,
        status: "ready",
        processing_attempt_id: null,
        processing_started_at: null,
      });
      if (noteError || !saved) throw new Error("Falha ao guardar o texto gerado.");

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      await updateAttempt({
        status: "error",
        error_message: message,
        processing_attempt_id: null,
        processing_started_at: null,
      });
      throw err;
    }
  });
