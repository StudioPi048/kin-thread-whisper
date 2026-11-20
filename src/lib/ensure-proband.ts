import { supabase } from "@/integrations/supabase/client";

/** Garante a pessoa consultante com o mesmo ID e a identidade do cadastro do dossiê. */
export async function ensureProband(clientId: string): Promise<{ probandId: string } | null> {
  const { data, error } = await supabase.rpc("ensure_genogram_proband", { _client_id: clientId });
  return error || !data ? null : { probandId: data };
}
