import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { requireAudioConsent } from "@/lib/audio-consent";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe";
const STRUCTURE_MODEL = "google/gemini-2.5-flash";

const STRUCTURE_SYSTEM = `Você é assistente clínica de uma psicogenealogista.
A partir da transcrição bruta de uma sessão, produza um prontuário estruturado
em JSON com humildade epistêmica: separe SEMPRE o que é FATO relatado do que
é HIPÓTESE clínica. Nunca invente dados. Se algo não foi dito, deixe vazio.

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
      .select("id, client_id, audio_path, user_id, status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Sessão não encontrada");
    if (session.user_id !== userId) throw new Error("Sem permissão");
    if (!session.audio_path) throw new Error("Sessão sem áudio");

    if (session.status !== "draft" && session.status !== "error") {
      throw new Error("O áudio não está disponível para processamento.");
    }

    const consent = await requireAudioConsent(supabase, session.client_id, "external_processing");
    const { data: claimed, error: claimError } = await supabase
      .from("clinical_sessions")
      .update({
        status: "transcribing",
        error_message: null,
        processing_consent_id: consent.id,
      })
      .eq("id", session.id)
      .eq("status", session.status)
      .eq("audio_path", session.audio_path)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) throw new Error("O estado do áudio mudou. Atualize a sessão.");

    try {
      const { data: file, error: dlErr } = await supabase.storage
        .from("session-audio")
        .download(session.audio_path);
      if (dlErr || !file) throw new Error(dlErr?.message ?? "Falha ao baixar áudio");

      // Transcribe via OpenAI-compatible multipart endpoint
      const form = new FormData();
      form.append("file", file, session.audio_path.split("/").pop() ?? "audio.webm");
      form.append("model", TRANSCRIBE_MODEL);
      form.append("language", "pt");

      await requireAudioConsent(supabase, session.client_id, "external_processing", consent.id);
      const trRes = await callGateway("/audio/transcriptions", { method: "POST", body: form });
      const trJson = (await trRes.json()) as { text?: string };
      const transcript = (trJson.text ?? "").trim();
      if (!transcript) throw new Error("Transcrição vazia");

      const { error: transcriptError } = await supabase
        .from("clinical_sessions")
        .update({ status: "structuring" })
        .eq("id", session.id);
      if (transcriptError) throw new Error("Falha ao atualizar o estado do processamento.");

      // Structure into JSON note
      await requireAudioConsent(supabase, session.client_id, "external_processing", consent.id);
      const chatRes = await callGateway("/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: STRUCTURE_MODEL,
          messages: [
            { role: "system", content: STRUCTURE_SYSTEM },
            { role: "user", content: `Transcrição da sessão:\n\n${transcript}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      const chatJson = (await chatRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = chatJson.choices?.[0]?.message?.content ?? "{}";
      let structured: Record<string, unknown>;
      try {
        structured = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        structured = { resumo: raw };
      }

      const { error: noteError } = await supabase
        .from("clinical_sessions")
        .update({
          transcript,
          structured_note: structured as never,
          ai_reviewed_at: null,
          status: "ready",
        })
        .eq("id", session.id);
      if (noteError) throw new Error("Falha ao guardar o texto gerado.");

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      await supabase
        .from("clinical_sessions")
        .update({ status: "error", error_message: message })
        .eq("id", session.id);
      throw err;
    }
  });
