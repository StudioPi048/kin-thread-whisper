import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  EDITORIAL_SOURCE,
  buildLibraryItems,
  libraryProvenance,
  type Entry,
  type LibraryItem,
} from "@/components/library/catalog";
import { relatedLibraryItem, searchLibrary } from "@/lib/library-search";

/** Consulta à Biblioteca sem sair do caso (painel lateral; tela cheia no celular). */
export function LibraryCasePanel({ reference }: { reference?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [trail, setTrail] = useState<LibraryItem[]>([]);
  const [visible, setVisible] = useState(false);
  const articleRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const originKey = useRef<string | null>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
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
  const openRelated = (term: string) => {
    const related = relatedLibraryItem(items, term);
    if (related) {
      if (!open || related.key === open.key) return;
      setTrail((current) => [...current, open]);
      setOpen(related);
    } else {
      setTrail([]);
      originKey.current = null;
      setQ(term);
      setOpen(null);
    }
  };
  useEffect(() => {
    if (!visible) return;
    if (open) articleRef.current?.focus();
    else {
      const result = Array.from(resultsRef.current?.querySelectorAll("button") ?? []).find(
        (button) => button.dataset.libraryKey === originKey.current,
      );
      (result ?? searchRef.current)?.focus();
    }
  }, [visible, open]);

  return (
    <Sheet
      open={visible}
      onOpenChange={(visible) => {
        setVisible(visible);
        if (visible) {
          setTrail([]);
          originKey.current = null;
          setOpen(items.find((item) => item.key === reference) ?? null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <BookOpen className="mr-2 size-4" aria-hidden />{" "}
          {reference ? "Manual e biblioteca" : "Biblioteca"}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[480px]"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (open ? articleRef.current : searchRef.current)?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Consultar biblioteca</SheetTitle>
        </SheetHeader>
        {open ? (
          <div className="mt-4 space-y-3">
            <Button
              variant="ghost"
              className="min-h-11 whitespace-normal text-left"
              onClick={() => {
                setOpen(trail.at(-1) ?? null);
                setTrail((current) => current.slice(0, -1));
              }}
            >
              <ChevronLeft className="mr-1 size-4" />{" "}
              {trail.length ? `Voltar a ${trail.at(-1)?.title}` : "Voltar aos resultados"}
            </Button>
            <p className="text-[13px] font-semibold text-muted-foreground">{open.category}</p>
            <h3 ref={articleRef} tabIndex={-1} className="font-serif text-2xl font-semibold">
              {open.title}
            </h3>
            <p className="text-[14px] text-muted-foreground">{open.meta}</p>
            <p className="text-[14px] text-muted-foreground">
              <strong>Fonte</strong> · {open.source ?? EDITORIAL_SOURCE}
            </p>
            {open.illustrative && (
              <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning/10 p-2 text-[14px] font-semibold">
                Paráfrase ilustrativa
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
            {open.term && (
              <section className="border-t border-border pt-4">
                <h4 className="mb-2 text-[15px] font-semibold">Conceitos relacionados</h4>
                <div className="flex flex-wrap gap-2">
                  {open.term.related.map((term) => (
                    <Button
                      key={term}
                      type="button"
                      variant="outline"
                      className="min-h-11 h-auto whitespace-normal"
                      onClick={() => openRelated(term)}
                    >
                      {relatedLibraryItem(items, term) ? term : `Buscar por ${term}`}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label htmlFor="case-lib-q" className="text-[15px] font-semibold">
              Conceito, autor ou termo
            </label>
            <input
              ref={searchRef}
              id="case-lib-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex.: lealdade, Schützenberger"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-[15px] placeholder:text-muted-foreground"
            />
            {entriesQ.isError && (
              <div className="text-[14px] text-destructive">
                <p role="alert">
                  Falha ao consultar seu acervo. As referências editoriais estão disponíveis.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void entriesQ.refetch()}
                  disabled={entriesQ.isFetching}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {entriesQ.isFetching ? "Carregando…" : "Tentar novamente"}
                </Button>
              </div>
            )}
            {q.trim() && (
              <p role="status" className="text-[14px] text-muted-foreground">
                {shown.length
                  ? `${shown.length} ${shown.length === 1 ? "resultado" : "resultados"}`
                  : entriesQ.isPending
                    ? "Consultando seu acervo…"
                    : entriesQ.isError
                      ? "Nenhum resultado no acervo editorial."
                      : "Nenhum resultado."}
              </p>
            )}
            <ul className="space-y-2" ref={resultsRef}>
              {shown.map((x) => (
                <li key={x.key}>
                  <button
                    type="button"
                    data-library-key={x.key}
                    onClick={() => {
                      originKey.current = x.key;
                      setTrail([]);
                      setOpen(x);
                    }}
                    className="w-full rounded-md border border-border p-3 text-left hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="text-[13px] text-muted-foreground">{x.category}</span>
                    <span className="block text-[15px] font-semibold">{x.title}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {libraryProvenance(x)}
                    </span>
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
