import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ParentageVersion } from "@/lib/parentage-review";

export type RemovalImpact = {
  people: number;
  relationships: number;
  reviews: number;
  personVersions: [string, string][];
  relationshipVersions: [string, string][];
};

type EditorCalls = {
  save_genogram_arrangement: {
    args: {
      _client_id: string;
      _layout_id: string | null;
      _expected: string | null;
      _positions: { id: string; x: number; y: number }[];
    };
    result: Tables<"genogram_layouts">;
  };
  remove_genogram_selection: {
    args: {
      _client_id: string;
      _people: string[];
      _relationships: string[];
      _expected?: RemovalImpact;
    };
    result: RemovalImpact;
  };
  create_genogram_relative: {
    args: {
      _client_id: string;
      _person: TablesInsert<"genogram_persons">;
      _target_id: string;
      _direction: "parent" | "child" | "sibling";
      _kind: string;
      _expected?: ParentageVersion[];
      _replaces?: string;
    };
    result: string;
  };
};

/** Narrows the JSONB replies to the editor's three contracts. */
export async function editGenogram<K extends keyof EditorCalls>(
  name: K,
  args: EditorCalls[K]["args"],
): Promise<EditorCalls[K]["result"]> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("O servidor não confirmou a alteração do mapa.");
  return data as EditorCalls[K]["result"];
}
