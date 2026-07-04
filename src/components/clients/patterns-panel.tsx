import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Sparkles, Activity } from "lucide-react";
import { motion } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  detectPatterns,
  severityStyles,
  type DetectedPattern,
  type PersonRow,
  type RelationshipRow,
} from "@/lib/patterns";

interface Props {
  clientId: string;
}

export function PatternsPanel({ clientId }: Props) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["patterns", clientId],
    queryFn: async () => {
      const [personsRes, relsRes] = await Promise.all([
        supabase.from("genogram_persons").select("*").eq("client_id", clientId),
        supabase.from("genogram_relationships").select("*").eq("client_id", clientId),
      ]);
      if (personsRes.error) throw personsRes.error;
      if (relsRes.error) throw relsRes.error;
      return {
        persons: (personsRes.data ?? []) as PersonRow[],
        relationships: (relsRes.data ?? []) as RelationshipRow[],
      };
    },
  });

  const patterns = useMemo(() => {
    if (!data) return [] as DetectedPattern[];
    return detectPatterns(data.persons, data.relationships);
  }, [data]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (data?.persons ?? []).forEach((p) => m.set(p.id, p.preferred_name || p.full_name));
    return m;
  }, [data]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/30" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="size-4 text-gold" />
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
              Motor de Padrões v1
            </p>
          </div>
          <h3 className="font-serif text-3xl font-bold text-primary">Repetições detectadas</h3>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl leading-relaxed">
            Leitura automática do genossociograma através de inteligência heurística. Sempre uma
            hipótese clínica — nunca uma conclusão definitiva.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 font-bold"
        >
          <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Recalcular Análise
        </Button>
      </div>

      {patterns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-sm border border-dashed border-border bg-lavender-soft/40 p-16 text-center"
        >
          <Sparkles className="mx-auto size-10 text-lavender opacity-60" />
          <p className="mt-4 font-serif text-2xl font-bold text-primary">
            Nenhum padrão detectado ainda
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Alimente a árvore genealógica. Adicione ocupações, causas de morte, idades e condições
            de saúde. O motor cruzará os dados automaticamente.
          </p>
        </motion.div>
      ) : (
        <motion.ul
          className="grid gap-4 md:grid-cols-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
          }}
        >
          {patterns.map((p) => {
            const isHigh = p.severity === "critical";
            const borderAccent = isHigh ? "accent-bar-plum" : "accent-bar-lavender";
            const badgeClass = isHigh ? "bg-plum text-white" : "bg-lavender text-white";

            return (
              <motion.li
                key={p.id}
                variants={{
                  hidden: { opacity: 0, scale: 0.96 },
                  visible: {
                    opacity: 1,
                    scale: 1,
                    transition: { type: "spring", stiffness: 300, damping: 24 },
                  },
                }}
                className={`rounded-sm border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow ${borderAccent}`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-serif text-xl font-bold text-primary leading-tight">
                      {p.title}
                    </h4>
                    <Badge
                      className={`${badgeClass} border-0 uppercase tracking-[0.1em] text-[10px] font-bold shrink-0`}
                    >
                      <AlertCircle className="size-3 mr-1" /> Nível {p.severity}
                    </Badge>
                  </div>
                  <p className="text-[14px] leading-relaxed text-foreground/80 font-serif">
                    {p.description}
                  </p>
                  {p.personIds.length > 0 && (
                    <div className="mt-2 pt-4 border-t border-border/50 flex flex-wrap gap-2 items-center">
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mr-1">
                        Membros afetados:
                      </span>
                      {p.personIds.map((id) => (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="font-semibold text-[12px] bg-background border border-border"
                        >
                          {nameById.get(id) ?? "—"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
