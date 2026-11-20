import { useEffect, useMemo, useRef, useState } from "react";
import { readPref, writePref } from "@/lib/recent-activity";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ChevronDown, Copy, History, Link2, Search } from "lucide-react";
import {
  EDITORIAL_SOURCE,
  buildLibraryItems,
  type Entry,
  THEMES,
  GLOSSARY,
  type LibraryItem,
  categories,
} from "@/components/library/catalog";
import { relatedLibraryItem, searchLibrary } from "@/lib/library-search";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import "@/components/library/library-page.css";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  validateSearch: (s: Record<string, unknown>): { item?: string } =>
    typeof s.item === "string" && /^[\w-]{1,64}$/.test(s.item) ? { item: s.item } : {},
  head: () => ({
    meta: [
      { title: "Biblioteca — GENEALIZ" },
      {
        name: "description",
        content: "Conceitos, autores e obras de psicogenealogia com fonte indicada.",
      },
      { property: "og:title", content: "Biblioteca — GENEALIZ" },
      {
        property: "og:description",
        content: "Consulta de conceitos, autores e obras com fonte indicada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todos");
  const openerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { item: itemKey } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = Route.useRouteContext();
  const [lastKey, setLastKey] = useState<string | null>(null);
  useEffect(() => setLastKey(readPref<string | null>(user.id, "library-last", null)), [user.id]);
  const {
    data: entries,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
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
  const items = useMemo(() => buildLibraryItems(entries ?? []), [entries]);
  const shown = searchLibrary(items, q, category);
  // Trecho aberto vive na URL (?item=ID) — dá para voltar a ele; só o ID é lembrado.
  const selected = itemKey ? (items.find((x) => x.key === itemKey) ?? null) : null;
  const setSelected = (x: LibraryItem | null) => {
    if (x) {
      writePref(user.id, "library-last", x.key);
      setLastKey(x.key);
    }
    navigate({ search: x ? { item: x.key } : {}, replace: !x });
  };
  const manualEntry = items.find((item) => item.key === "manual-genossociograma");
  const lastItem = lastKey ? items.find((x) => x.key === lastKey) : undefined;
  const openRelatedTerm = (term: string) => {
    const related = relatedLibraryItem(items, term);
    if (related) {
      setSelected(related);
      return;
    }
    openerRef.current = null;
    setQ(term);
    setCategory("Todos");
    setSelected(null);
  };
  useEffect(() => {
    if (selected) titleRef.current?.focus();
  }, [selected]);
  return (
    <div className="reference-library">
      <header className="reference-library-hero">
        <div className="container-liz reference-library-spread">
          <div className="reference-library-intro">
            <h1>Biblioteca</h1>
            <p>Conceitos, autores e leituras para consultar durante o atendimento.</p>
            <label className="reference-library-search">
              <Search size={18} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                aria-label="Buscar na biblioteca"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar conceito, autor ou obra"
              />
            </label>
            {lastItem && !selected && (
              <button
                type="button"
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelected(lastItem);
                }}
                className="reference-library-resume"
              >
                <History size={16} aria-hidden />
                <span>Retomar · {lastItem.title}</span>
              </button>
            )}
          </div>
          {manualEntry && (
            <aside className="reference-library-feature" aria-labelledby="manual-feature-title">
              <img
                src="/assets/genealiz/manual-edicao-portuguesa.webp"
                alt=""
                width={560}
                height={848}
                decoding="async"
              />
              <div>
                <h2 id="manual-feature-title">Manual da Psicogenealogia</h2>
                <p>Letícia Kuchockowolec Baccin</p>
                <button
                  type="button"
                  className="reference-library-feature-link"
                  onClick={(event) => {
                    openerRef.current = event.currentTarget;
                    setSelected(manualEntry);
                  }}
                >
                  Ler sobre o genossociograma <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            </aside>
          )}
        </div>
      </header>

      <div className="container-liz reference-library-layout">
        <aside className="reference-library-index">
          <nav aria-label="Categorias da biblioteca">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className="reference-library-category"
              >
                {c}
                <span>
                  {c === "Todos"
                    ? items.length
                    : items.filter((item) => item.category === c).length}
                </span>
              </button>
            ))}
          </nav>
          <details className="reference-library-themes">
            <summary>
              Buscar por tema <ChevronDown size={16} aria-hidden />
            </summary>
            <div className="mt-1 flex flex-wrap gap-x-3">
              {THEMES.map((topic) => (
                <button
                  key={topic.name}
                  type="button"
                  onClick={() => {
                    setQ(topic.name);
                    setCategory("Todos");
                  }}
                  className="reference-library-theme"
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </details>
        </aside>
        <section className="min-w-0" aria-labelledby="library-catalog-heading">
          <div className="reference-library-catalog-header">
            <h2 id="library-catalog-heading">{category === "Todos" ? "Catálogo" : category}</h2>
            <span aria-live="polite" className="text-sm text-ink-soft">
              {shown.length} {shown.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
          {isLoading && category === "Meu acervo" && (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando seu acervo…
            </p>
          )}
          {isError && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-destructive">
              <p role="alert">Não foi possível carregar seu acervo.</p>
              <Button
                variant="link"
                className="min-h-11"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? "Carregando…" : "Tentar novamente"}
              </Button>
            </div>
          )}
          <div className="reference-library-list">
            {shown.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelected(x);
                }}
                className="reference-library-record"
              >
                <span className="reference-library-record-identity">
                  <strong>{x.title}</strong>
                  <span className="reference-library-record-meta">{x.meta}</span>
                  <span className="reference-library-record-excerpt line-clamp-2">{x.body}</span>
                </span>
                <span className="reference-library-record-kind">{x.category}</span>
                <ArrowRight size={17} aria-hidden />
              </button>
            ))}
          </div>
          {!shown.length && !isLoading && !(isError && category === "Meu acervo") && (
            <div className="reference-library-empty">
              <Search size={24} aria-hidden />
              <h3>Nenhum resultado encontrado</h3>
              <p>Tente outro termo ou escolha uma categoria diferente.</p>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setQ("");
                  setCategory("Todos");
                  searchRef.current?.focus();
                }}
                className="min-h-11 px-0"
              >
                Limpar busca
              </Button>
            </div>
          )}
        </section>
      </div>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side="right"
          className="reference-reading w-full overflow-y-auto p-0 sm:max-w-[570px]"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (openerRef.current?.isConnected ? openerRef.current : searchRef.current)?.focus();
          }}
        >
          {selected?.term ? (
            <GlossaryDetail item={selected.term} titleRef={titleRef} onRelated={openRelatedTerm} />
          ) : (
            selected && (
              <>
                <SheetHeader className="reference-reading-header">
                  <SheetTitle ref={titleRef} tabIndex={-1} className="reference-reading-title">
                    {selected.title}
                  </SheetTitle>
                  <p className="reference-reading-meta">{selected.meta}</p>
                </SheetHeader>
                <div className="reference-reading-content">
                  {selected.illustrative && (
                    <p className="mb-4 rounded-md border border-clinical-warning/40 bg-clinical-warning/10 p-3 text-[14px] font-semibold">
                      Conteúdo ilustrativo
                    </p>
                  )}
                  <p className="reference-reading-body">{selected.body}</p>
                  <p className="reference-reading-source">
                    <strong>Fonte</strong>
                    <cite>{selected.source ?? EDITORIAL_SOURCE}</cite>
                  </p>
                  {selected.details && (
                    <ul className="mt-6 space-y-4 text-sm leading-7">
                      {selected.details.map((d, i) => (
                        <li key={i} className="border-t border-border pt-4">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.category === "Paráfrases" && (
                    <button
                      className="mt-4 flex min-h-11 items-center gap-2 text-sm font-semibold"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${selected.body} — paráfrase ilustrativa (${selected.meta}); não é citação literal.`,
                          );
                          toast.success("Paráfrase copiada com o aviso de fonte");
                        } catch {
                          toast.error(
                            "Não foi possível copiar. Selecione o texto para copiar manualmente.",
                          );
                        }
                      }}
                    >
                      <Copy size={16} />
                      Copiar com aviso de fonte
                    </button>
                  )}
                </div>
              </>
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GlossaryDetail({
  item,
  titleRef,
  onRelated,
}: {
  item: (typeof GLOSSARY)[number];
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  onRelated: (term: string) => void;
}) {
  return (
    <div>
      <div>
        <SheetHeader className="reference-reading-header">
          <SheetTitle ref={titleRef} tabIndex={-1} className="reference-reading-title">
            {item.term}
          </SheetTitle>
          <p className="reference-reading-meta">{item.short}</p>
        </SheetHeader>
      </div>

      <div className="reference-reading-content space-y-8">
        <DetailBlock label="Definição completa">
          <p className="reference-reading-body">{item.full}</p>
        </DetailBlock>

        <DetailBlock label="História do conceito">
          <p className="text-[15px] leading-relaxed text-ink-soft">{item.history}</p>
        </DetailBlock>

        <DetailBlock label="Autores">
          <div className="flex flex-wrap gap-2">
            {item.authors.map((a) => (
              <span key={a} className="atlas-chip">
                {a}
              </span>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock label="Conceitos relacionados">
          <div className="flex flex-wrap gap-2">
            {item.related.map((r) => (
              <Button
                type="button"
                key={r}
                variant="outline"
                className="min-h-11 h-auto whitespace-normal"
                onClick={() => onRelated(r)}
              >
                <Link2 className="size-4" aria-hidden /> {r}
              </Button>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock label="Bibliografia">
          <ul className="space-y-2">
            {item.books.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[13px] text-foreground/80">
                <BookOpen className="size-3.5 text-gold shrink-0" />
                <span className="font-serif italic">{b}</span>
              </li>
            ))}
          </ul>
        </DetailBlock>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{label}</h3>
      {children}
    </div>
  );
}
