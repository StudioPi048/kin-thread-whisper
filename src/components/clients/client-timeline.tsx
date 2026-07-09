import { useQuery } from "@tanstack/react-query";
import { CalendarClock, HeartPulse, Sparkles, Baby, Cross } from "lucide-react";
import { motion } from "framer-motion";

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
    return <div className="h-40 animate-pulse rounded-lg bg-muted/30" />;
  }

  const items = data ?? [];
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-sm border border-dashed border-border bg-forest-soft/40 p-16 text-center"
      >
        <CalendarClock className="mx-auto size-10 text-forest opacity-60" />
        <p className="mt-4 font-serif text-2xl font-bold text-primary">
          A linha do tempo se desenha a partir do genograma
        </p>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          Adicione nascimentos, mortes e eventos biográficos às pessoas do sistema. Eles aparecerão
          aqui em ordem cronológica, revelando sincronicidades.
        </p>
      </motion.div>
    );
  }

  // Group by year
  const byYear = new Map<number, TimelineItem[]>();
  for (const it of items) {
    const list = byYear.get(it.year) ?? [];
    list.push(it);
    byYear.set(it.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  return (
    <div className="relative pt-6 pb-12">
      {/* Editorial subtle timeline gradient line */}
      <div className="pointer-events-none absolute inset-y-0 left-[8rem] w-px bg-gradient-to-b from-mahogany/50 via-forest/30 to-transparent" />

      <motion.ol
        className="space-y-12"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
        }}
      >
        {years.map((year) => (
          <motion.li
            key={year}
            className="grid grid-cols-[8rem_auto_1fr] items-start gap-6"
            variants={{
              hidden: { opacity: 0, x: -15 },
              visible: {
                opacity: 1,
                x: 0,
                transition: { type: "spring", stiffness: 300, damping: 24 },
              },
            }}
          >
            {/* Year Column */}
            <div className="pt-0.5 text-right relative pr-4">
              <span className="font-serif text-4xl font-bold text-mahogany/90">{year || "?"}</span>
            </div>

            {/* Timeline Dot */}
            <div className="relative mt-3.5 z-10 flex size-3.5 items-center justify-center rounded-full bg-white border-[3px] border-mahogany shadow-sm" />

            {/* Cards Column */}
            <div className="space-y-4 pt-1">
              {byYear.get(year)!.map((it, idx) => (
                <TimelineCard key={`${it.personId}-${idx}`} item={it} />
              ))}
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const Icon = item.kind === "birth" ? Baby : item.kind === "death" ? Cross : Sparkles;
  const isDeath = item.kind === "death";
  const isBirth = item.kind === "birth";

  // Editorial tones based on event
  const accentClass = isDeath
    ? "accent-bar-mahogany bg-white"
    : isBirth
      ? "accent-bar-gold bg-white"
      : "accent-bar-forest bg-forest-soft/20";

  const iconColor = isDeath ? "text-mahogany" : isBirth ? "text-gold" : "text-forest";

  return (
    <div
      className={`rounded-sm border border-border shadow-sm px-5 py-4 transition-shadow hover:shadow-md ${accentClass}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-md bg-background border border-border ${iconColor}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              {item.label}
            </span>
            <span className="font-mono text-[14px] font-bold text-muted-foreground/70 bg-background px-1.5 py-0.5 rounded border border-border">
              {item.date}
            </span>
          </div>
          <p className="mt-1 font-serif text-xl font-bold text-primary truncate leading-tight">
            {item.personName}
          </p>
        </div>
      </div>

      {item.meta && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="flex items-start gap-2 text-[14px] leading-relaxed text-foreground/80 font-serif">
            {isDeath && <HeartPulse className="size-4 text-mahogany mt-0.5 shrink-0" />}
            {item.meta}
          </p>
        </div>
      )}
    </div>
  );
}
