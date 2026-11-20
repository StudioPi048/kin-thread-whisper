import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

export type AudioConsentScope = "recording" | "external_processing";
export type AudioConsentEvent = Tables<"audio_consent_events">;

export const AUDIO_CONSENT_SCOPE: Record<AudioConsentScope, string> = {
  recording: "Gravar áudio",
  external_processing: "Processar áudio com IA",
};

export const AUDIO_CONSENT_SOURCE = {
  verbal: "Autorização verbal",
  written: "Documento assinado",
  documented: "Outro registro no prontuário",
} as const;

export type AudioConsentSource = keyof typeof AUDIO_CONSENT_SOURCE;

export const audioConsentsKey = (clientId: string) => ["audio-consent", clientId] as const;

export async function readAudioConsents(db: SupabaseClient<Database>, clientId: string) {
  const { data, error } = await db
    .from("audio_consent_events")
    .select("*")
    .eq("client_id", clientId)
    .order("revision", { ascending: false });
  if (error) throw new Error("Não foi possível consultar as autorizações de áudio.");
  return data;
}

export function activeAudioConsent(events: AudioConsentEvent[], scope: AudioConsentScope) {
  const latest = events.find((event) => event.scope === scope);
  return latest?.granted ? latest : undefined;
}

export async function requireAudioConsent(
  db: SupabaseClient<Database>,
  clientId: string,
  scope: AudioConsentScope,
  expectedGrant?: string,
) {
  const { data, error } = await db
    .from("audio_consent_events")
    .select("*")
    .eq("client_id", clientId)
    .eq("scope", scope)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Não foi possível confirmar a autorização de áudio.");
  if (!data?.granted || (expectedGrant && data.id !== expectedGrant)) {
    throw new Error(
      scope === "recording"
        ? "A gravação requer autorização vigente."
        : "O processamento externo requer autorização vigente.",
    );
  }
  return data;
}
