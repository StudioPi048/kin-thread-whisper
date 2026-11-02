import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonRow, RelationshipRow } from "@/lib/patterns";

export interface ClinicalIntelData {
  client: { full_name: string; presenting_complaint: string | null } | null;
  persons: PersonRow[];
  relationships: RelationshipRow[];
}

/** Única queryFn/queryKey para evidências de um caso — mesmo formato em todas as telas. */
export const clinicalIntelQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["clinical-intel", clientId] as const,
    enabled: !!clientId,
    queryFn: async (): Promise<ClinicalIntelData> => {
      const [clientRes, personsRes, relsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("full_name, presenting_complaint")
          .eq("id", clientId)
          .maybeSingle(),
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
      ]);
      if (clientRes.error) throw clientRes.error;
      if (personsRes.error) throw personsRes.error;
      if (relsRes.error) throw relsRes.error;
      return {
        client: clientRes.data,
        persons: (personsRes.data ?? []) as PersonRow[],
        relationships: (relsRes.data ?? []) as RelationshipRow[],
      };
    },
  });
