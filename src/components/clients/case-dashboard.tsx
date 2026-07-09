import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

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
  const unknown = persons.length - (female + male);

  const deceased = persons.filter((p) => p.is_deceased).length;
  const withDisease = persons.filter((p) => (p.health_conditions ?? []).length > 0).length;
  const withCause = persons.filter((p) => p.cause_of_death && p.cause_of_death.trim()).length;

  const pieData = [
    { name: "Mulheres", value: female, color: "oklch(0.65 0.20 295)" }, // Forest
    { name: "Homens", value: male, color: "oklch(0.25 0.10 295)" }, // Mahogany mid
  ];
  if (unknown > 0)
    pieData.push({ name: "Outros/S/N", value: unknown, color: "oklch(0.95 0.03 295)" });

  return (
    <div className="rounded-[1rem] glass-card shadow-sm accent-bar-forest overflow-hidden hover-lift">
      <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <h3 className="text-[14px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Estatísticas do Clã
        </h3>
      </div>

      {persons.length > 0 && (
        <div className="p-4 border-b border-border/40">
          <p className="text-[14px] font-semibold text-muted-foreground mb-4 uppercase tracking-[0.1em]">
            Composição de Gênero
          </p>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "2px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    fontSize: "12px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                  }}
                  itemStyle={{ color: "var(--color-mahogany)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-border/40">
        <Stat label="Pessoas no clã" value={persons.length} />
        <Stat label="Vínculos" value={relationships} />
        <Stat label="Padrões" value={patterns} />
        <Stat label="Falecidos" value={deceased} />
        <Stat label="Doenças" value={withDisease} full />
      </div>
    </div>
  );
}

function Stat({ label, value, full }: { label: string; value: number; full?: boolean }) {
  return (
    <div
      className={`bg-white/50 backdrop-blur-sm p-4 transition-colors hover:bg-white/80 ${full ? "col-span-2" : ""}`}
    >
      <p className="text-[14px] font-bold text-muted-foreground uppercase tracking-[0.05em]">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
