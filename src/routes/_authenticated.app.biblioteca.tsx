import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  component: BibliotecaPage,
});

type Entry = {
  id: string;
  author: string;
  title: string;
  topic: string | null;
  school: string | null;
  summary: string | null;
  content: string | null;
  tags: string[];
};

function BibliotecaPage() {
  const [q, setQ] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["library-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_entries")
        .select("*")
        .order("author", { ascending: true });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => {
      const hay = [e.author, e.title, e.topic, e.school, e.summary, e.content, ...(e.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [entries, q]);

  return (
    <div className="container-liz py-12">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Conhecimento</p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Biblioteca sistêmica</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Verbetes dos autores-base da psicogenealogia. Busque por autor, tema, conceito ou tag.
      </p>

      <div className="mt-8 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (ex: aniversário, lealdade, luto, Hellinger)"
            className="pl-9"
          />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum verbete encontrado.</p>
        )}
        {filtered.map((e) => (
          <article
            key={e.id}
            className="rounded-lg border border-border bg-card p-6 transition-colors hover:border-gold"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif text-xl text-primary">{e.author}</h3>
              {e.school && (
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {e.school}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">
              {e.title}
              {e.topic && <span className="text-muted-foreground"> — {e.topic}</span>}
            </p>
            {e.summary && (
              <p className="mt-3 text-sm leading-relaxed text-foreground">{e.summary}</p>
            )}
            {e.content && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.content}</p>
            )}
            {e.tags && e.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
