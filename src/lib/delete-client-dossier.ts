import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const manifestSchema = z.object({
  audio_paths: z.array(z.string()),
  avatar_paths: z.array(z.string()),
  completed_at: z.string().nullable(),
});

export const pendingDossierDeletionsKey = (userId: string) => ["dossier-deletions", userId];

export async function listPendingDossierDeletions() {
  const { data, error } = await supabase.rpc("list_dossier_deletions");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function resumeDossierDeletion(clientId: string) {
  const { data, error } = await supabase.rpc("dossier_deletion_manifest", { _client_id: clientId });
  if (error) throw new Error(error.message);
  const manifest = manifestSchema.safeParse(data);
  if (!manifest.success) throw new Error("Exclusão indisponível.");
  if (manifest.data.completed_at) return;

  const objects = [
    ["session-audio", manifest.data.audio_paths],
    ["client-avatars", manifest.data.avatar_paths],
  ] as const;
  let removalFailed = false;
  for (const [bucket, paths] of objects) {
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await supabase.storage.from(bucket).remove(paths.slice(start, start + 100));
      if (error) removalFailed = true;
    }
  }

  const { data: finished, error: finishError } = await supabase.rpc("finish_dossier_deletion", {
    _client_id: clientId,
  });
  if (finishError) throw new Error(finishError.message);
  if (!finished)
    throw new Error(
      removalFailed
        ? "O armazenamento recusou a limpeza. Tente novamente."
        : "Alguns arquivos ainda estão no armazenamento. Tente novamente.",
    );
}

export async function deleteClientDossier(clientId: string) {
  const { data, error } = await supabase.rpc("begin_dossier_deletion", { _client_id: clientId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("A exclusão do dossiê não foi confirmada.");
  try {
    await resumeDossierDeletion(clientId);
    return "complete" as const;
  } catch {
    return "media_pending" as const;
  }
}
