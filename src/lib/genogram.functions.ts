import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeCaseGenogram, type ClientGenogramDTO } from "@/lib/genogram-summary";
import { z } from "zod";

export type { ClientGenogramDTO, GenogramAlert, GenogramPersonDTO } from "@/lib/genogram-summary";

export const getClientGenogram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ClientGenogramDTO> => {
    const { supabase } = context;
    const [persons, relationships] = await Promise.all([
      supabase.from("genogram_persons").select("*").eq("client_id", data.clientId),
      supabase.from("genogram_relationships").select("*").eq("client_id", data.clientId),
    ]);
    if (persons.error) throw new Error(persons.error.message);
    if (relationships.error) throw new Error(relationships.error.message);
    return summarizeCaseGenogram(persons.data ?? [], relationships.data ?? []);
  });
