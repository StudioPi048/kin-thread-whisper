import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clientId: string;
}

type Person = {
  gender: string | null;
  is_deceased: boolean;
  health_conditions: string[];
  cause_of_death: string | null;
};

export function CaseDashboard({ clientId }: Props) {
  const { data } = useQuery({
    queryKey: ["case-dashboard", clientId],
    queryFn: async () => {
      const [persons, rels, patterns, sessions] = await Promise.all([
        supabase
          .from("genogram_persons")
          .select("gender, is_deceased, health_conditions, cause_of_death")
          .eq("client_id", clientId),
        supabase
          .from("genogram_relationships")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
        supabase
          .from("patterns_detected")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
        supabase
          .from("clinical_sessions")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId),
      ]);
      return {
        persons: (persons.data ?? []) as Person[],
        relationships: rels.count ?? 0,
        patterns: patterns.count ?? 0,
        sessions: sessions.count ?? 0,
      };
    },
  });

  if (!data) return null;

  const { persons, relationships, patterns, sessions } = data;
  const female = persons.filter((p) => p.gender === "female").length;
  const male = persons.filter((p) => p.gender === "male").length;
  const deceased = persons.filter((p) => p.is_deceased).length;
  const withDisease = persons.filter((p) => (p.health_conditions ?? []).length > 0).length;
  const withCause = persons.filter((p) => p.cause_of_death && p.cause_of_death.trim()).length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-serif text-sm text-primary">Dashboard sistêmico</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        <Stat label="Pessoas no clã" value={persons.length} />
        <Stat label="Vínculos" value={relationships} />
        <Stat label="Padrões detectados" value={patterns} />
        <Stat label="Sessões gravadas" value={sessions} />
        <Stat label="Falecidos" value={deceased} />
        <Stat label="Causa de morte" value={withCause} />
        <Stat label="Femininos" value={female} />
        <Stat label="Masculinos" value={male} />
        <Stat label="Com doença registrada" value={withDisease} full />
      </div>
    </div>
  );
}

function Stat({ label, value, full }: { label: string; value: number; full?: boolean }) {
  return (
    <div
      className={`rounded-md border border-border bg-background/60 p-3 ${full ? "col-span-2" : ""}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl text-primary">{value}</p>
    </div>
  );
}
