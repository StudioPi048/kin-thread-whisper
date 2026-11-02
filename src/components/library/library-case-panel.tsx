import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  EDITORIAL_SOURCE,
  buildLibraryItems,
  type Entry,
  type LibraryItem,
} from "@/components/library/catalog";
import { searchLibrary } from "@/lib/library-search";

/** Consulta à Biblioteca sem sair do caso (painel lateral; tela cheia no celular). */
export function LibraryCasePanel() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const entriesQ = useQuery({
    queryKey: ["library-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_entries").select("*").order("author");
      if (error) throw error;
      return data as Entry[];
    },
  });
  const items = useMemo(() => buildLibraryItems(entriesQ.data ?? []), [entriesQ.data]);
  const shown = q.trim() ? searchLibrary(items, q).slice(0, 30) : [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <BookOpen className="mr-2 size-4" aria-hidden /> Biblioteca
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Consultar biblioteca</SheetTitle>
        </SheetHeader>
        {open ? (
          <div className="mt-4 space-y-3">
            <Button variant="ghost" className="min-h-11" onClick={() => setOpen(null)}>
              <ChevronLeft className="mr-1 size-4" /> Voltar aos resultados
            </Button>
            <p className="text-[13px] font-semibold text-muted-foreground">{open.category}</p>
            <h3 className="font-serif text-2xl font-semibold">{open.title}</h3>
            <p className="text-[14px] text-muted-foreground">{open.meta}</p>
            {open.illustrative && (
              <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning/10 p-2 text-[14px] font-semibold">
                Conteúdo ilustrativo
              </p>
            )}
            <p className="whitespace-pre-wrap text-[15px] leading-7">
              {open.term?.full ?? open.body}
            </p>
            {open.details && (
              <ul className="list-disc space-y-1 pl-5 text-[15px]">
                {open.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            <p className="text-[14px] text-muted-foreground">
              <strong>Fonte:</strong> {open.source ?? EDITORIAL_SOURCE}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label htmlFor="case-lib-q" className="text-[15px] font-semibold">
              Conceito, autor ou termo
            </label>
            <input
              id="case-lib-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex.: lealdade, Schützenberger"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] placeholder:text-muted-foreground"
            />
            {entriesQ.isError && (
              <p role="alert" className="text-[14px] text-destructive">
                Seu acervo não carregou; o acervo editorial continua disponível.{" "}
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => entriesQ.refetch()}
                >
                  <RefreshCw className="mr-1 size-4" /> Tentar de novo
                </Button>
              </p>
            )}
            {q.trim() && (
              <p role="status" className="text-[14px] text-muted-foreground">
                {shown.length ? `${shown.length} resultado(s)` : "Nenhum resultado."}
              </p>
            )}
            <ul className="space-y-2">
              {shown.map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(x)}
                    className="w-full rounded-md border border-border p-3 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="text-[13px] text-muted-foreground">{x.category}</span>
                    <span className="block text-[15px] font-semibold">{x.title}</span>
                    <span className="line-clamp-2 block text-[14px] text-muted-foreground">
                      {x.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
