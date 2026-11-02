import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parsePreferences, preferencesKey, type Preferences } from "@/lib/preferences";

export function usePreferences(userId: string) {
  return useQuery({
    queryKey: preferencesKey(userId),
    queryFn: async (): Promise<Preferences> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return parsePreferences(data?.preferences);
    },
    staleTime: 5 * 60_000,
  });
}

/** Aplica tamanho de texto e redução de movimento no documento. */
export function useApplyPreferences(prefs: Preferences | undefined) {
  useEffect(() => {
    const el = document.documentElement;
    if (!prefs) return;
    el.dataset.textSize = prefs.textSize;
    el.dataset.reduceMotion = prefs.reduceMotion ? "true" : "false";
    return () => {
      delete el.dataset.textSize;
      delete el.dataset.reduceMotion;
    };
  }, [prefs]);
}
