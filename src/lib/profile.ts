import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PROFILE_FIELDS = "full_name, email, avatar_url, formation, city, bio";

export function profileQuery(userId: string) {
  return queryOptions({
    queryKey: ["profile", userId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
