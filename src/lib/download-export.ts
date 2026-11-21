import { supabase } from "@/integrations/supabase/client";
import { requireAudioConsent } from "@/lib/audio-consent";
import type { ExportPageReader, ExportRow } from "@/lib/data-export";

export const readExportPage: ExportPageReader = async ({ table, filter, from, to, columns }) => {
  const { data, error } = await supabase
    .from(table)
    .select(columns ?? "*")
    .in(filter.column, filter.values)
    .order("id")
    .range(from, to);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as unknown as ExportRow[];
};

export function downloadJson(content: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readDossierAudio(
  clientId: string,
  path: string,
  sessionId: string,
  grantId: string,
) {
  await requireAudioConsent(supabase, clientId, "recording", grantId, sessionId);
  const { data, error } = await supabase.storage.from("session-audio").download(path);
  if (error || !data?.size) throw new Error("Gravação indisponível.");
  const data_url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(data);
  });
  await requireAudioConsent(supabase, clientId, "recording", grantId, sessionId);
  return { bytes: data.size, mime_type: data.type, data_url };
}
