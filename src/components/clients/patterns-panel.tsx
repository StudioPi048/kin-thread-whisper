import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";

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
        supabase
          .from("genogram_relationships")
          .select("*")
          .eq("client_id", clientId),
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
    (data?.persons ?? []).forEach((p) =>
      m.set(p.id, p.preferred_name || p.full_name),
    );
    return m;
  }, [data]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-gold">
            Motor de padrões v1
          </p>
          <h3 className="mt-1 font-serif text-2xl text-primary">
            Repetições transgeracionais detectadas
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Leitura automática do genossociograma. Sempre uma hipótese clínica —
            nunca uma conclusão.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </div>

      {patterns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 p-12 text-center">
          <Sparkles className="mx-auto size-8 text-lilac" />
          <p className="mt-3 font-serif text-xl text-primary">
            Nenhum padrão detectado ainda
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Adicione mais pessoas, datas de nascimento/falecimento, causas de
            morte, condições de saúde e ocupações no genossociograma.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {patterns.map((p) => {
            const s = severityStyles[p.severity];
            return (
              <li
                key={p.id}
                className={`rounded-lg border ${s.ring} bg-card p-4`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-serif text-lg text-primary">{p.title}</h4>
                  <Badge className={`${s.badge} border-0 uppercase tracking-wide`}>
                    <AlertCircle className="size-3" /> {s.label}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  {p.description}
                </p>
                {p.personIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.personIds.map((id) => (
                      <Badge key={id} variant="secondary" className="font-normal">
                        {nameById.get(id) ?? "—"}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
