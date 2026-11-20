import { supabase } from "@/integrations/supabase/client";

export async function deleteClientDossier(clientId: string, professionalId: string) {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, avatar_url")
    .eq("id", clientId)
    .eq("professional_id", professionalId)
    .maybeSingle();
  if (clientError || !client) throw new Error("O dossiê está indisponível.");

  const { data: audioRows, error: audioError } = await supabase
    .from("clinical_sessions")
    .select("audio_path")
    .eq("client_id", clientId)
    .eq("user_id", professionalId)
    .not("audio_path", "is", null);
  if (audioError) throw new Error("Não foi possível verificar os áudios do dossiê.");
  const paths = [
    ...new Set(audioRows.flatMap(({ audio_path }) => (audio_path ? [audio_path] : []))),
  ];
  if (paths.length) {
    const { error } = await supabase.storage.from("session-audio").remove(paths);
    if (error)
      throw new Error("O dossiê permanece aberto. Não foi possível remover todos os áudios.");
  }
  if (client.avatar_url) {
    const { error } = await supabase.storage.from("client-avatars").remove([client.avatar_url]);
    if (error) throw new Error("O dossiê permanece aberto. Não foi possível remover a foto.");
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("professional_id", professionalId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      "A exclusão do dossiê não foi confirmada. Arquivos já removidos não foram restaurados. Tente novamente.",
    );
  }
}
