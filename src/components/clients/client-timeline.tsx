import { useQuery } from "@tanstack/react-query";
import { CalendarClock, HeartPulse, Sparkles, Baby, Cross } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { buildTimeline, type TimelineItem } from "@/lib/patterns";

interface Props {
  clientId: string;
}

export function ClientTimeline({ clientId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["genogram", clientId, "timeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genogram_persons")
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return buildTimeline(data ?? []);
    },
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />;
  }

  const items = data ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/60 p-16 text-center">
        <CalendarClock className="mx-auto size-8 text-lilac" />
        <p className="mt-4 font-serif text-2xl text-primary">
          A linha do tempo se desenha a partir do genograma
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Adicione nascimentos, mortes e eventos biográficos às pessoas do
          sistema. Eles aparecerão aqui em ordem cronológica.
        </p>
      </div>
    );
  }

  // Agrupa por ano
  const byYear = new Map<number, TimelineItem[]>();
  for (const it of items) {
    const list = byYear.get(it.year) ?? [];
    list.push(it);
    byYear.set(it.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-[7.5rem] w-px bg-gradient-to-b from-lilac/40 via-lilac/20 to-transparent" />

      <ol className="space-y-8">
        {years.map((year) => (
          <li key={year} className="grid grid-cols-[7rem_auto_1fr] items-start gap-4">
            <div className="pt-1 text-right">
              <span className="font-serif text-3xl text-primary">{year || "?"}</span>
            </div>
            <div className="mt-3 size-3 rounded-full border-2 border-lilac bg-background" />
            <div className="space-y-3">
              {byYear.get(year)!.map((it, idx) => (
                <TimelineCard key={`${it.personId}-${idx}`} item={it} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const Icon =
    item.kind === "birth" ? Baby : item.kind === "death" ? Cross : Sparkles;
  const tone =
    item.kind === "death"
      ? "border-destructive/30 bg-destructive/5"
      : item.kind === "birth"
        ? "border-emerald-300/50 bg-emerald-50/50"
        : "border-lilac/30 bg-lilac-soft/50";

  return (
    <div className={`rounded-lg border ${tone} px-4 py-3`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-xs uppercase tracking-[0.2em] text-gold">
          {item.label}
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {item.date}
        </span>
      </div>
      <p className="mt-1 font-serif text-lg text-primary">{item.personName}</p>
      {item.meta && (
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          {item.kind === "death" && <HeartPulse className="size-3.5" />}
          {item.meta}
        </p>
      )}
    </div>
  );
}
