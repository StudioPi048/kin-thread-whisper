import { useEffect, useMemo, useRef, useState } from "react";
import { readPref, writePref } from "@/lib/recent-activity";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, ChevronRight, Copy, Link2 } from "lucide-react";
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
import { DocumentHeader } from "@/components/ui/document-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
    <div className="pb-14">
      <DocumentHeader
        breadcrumb="Biblioteca"
        title="Referências para o seu trabalho."
        subtitle="Consulte autores, obras, conceitos e materiais do acervo."
      />
      <div className="container-liz mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-3.5 size-4 text-muted-foreground" />
          <input
            ref={searchRef}
            aria-label="Buscar na biblioteca"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conceito, autor, obra ou termo"
            className="h-11 w-full rounded-md border border-input bg-background pl-11 pr-4 text-[15px] placeholder:text-muted-foreground"
          />
        </div>
        {lastItem && !selected && (
          <button
            type="button"
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setSelected(lastItem);
            }}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Voltar ao último trecho: {lastItem.title}
          </button>
        )}
      </div>
      <div className="container-liz atlas-library">
        <aside>
          <nav aria-label="Categorias da biblioteca">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className="atlas-library-category"
              >
                {c}
                <span>
                  {c === "Todos" ? items.length : items.filter((x) => x.category === c).length}
                </span>
              </button>
            ))}
          </nav>
          <div className="mt-7 border-t border-border pt-5">
            <h2 className="font-serif text-xl">Temas</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setQ(t.name);
                    setCategory("Todos");
                  }}
                  className="atlas-chip"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="min-w-0">
          <div className="flex justify-between items-center py-6">
            <h2 className="font-serif text-3xl font-semibold">{category}</h2>
            <span className="text-xs text-muted-foreground">{shown.length} resultados</span>
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
          <div className="atlas-library-list">
            {shown.map((x) => (
              <button
                key={x.key}
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelected(x);
                }}
                className="atlas-library-item"
              >
                <BookOpen size={20} strokeWidth={1.4} />
                <div>
                  <span className="text-xs text-muted-foreground">{x.category}</span>
                  <h3>{x.title}</h3>
                  <p>{x.meta}</p>
                  <p className="line-clamp-2">{x.body}</p>
                </div>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {!shown.length && !isLoading && !(isError && category === "Meu acervo") && (
            <div className="atlas-empty">
              <Search size={28} />
              <h2>Nenhum resultado encontrado</h2>
              <p>Tente outro termo ou escolha uma categoria diferente.</p>
              <button
                onClick={() => {
                  setQ("");
                  setCategory("Todos");
                }}
                className="mt-5 text-sm underline"
              >
                Limpar busca
              </button>
            </div>
          )}
        </section>
      </div>
      {!q && category === "Todos" && (
        <div className="container-liz mt-8">
          <div className="gv-library-banner">
            <img
              src="/assets/genealiz/archive-library.jpg"
              loading="lazy"
              decoding="async"
              alt="Livros e fotografias, composição de acervo ilustrativa"
            />
            <div>
              <p className="gv-category">Acervo de consulta</p>
              <h2>
                Conhecimento que
                <br />
                acompanha a prática.
              </h2>
              <p>Conceitos, autores e leituras para voltar sempre que precisar.</p>
            </div>
          </div>
        </div>
      )}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[520px] overflow-y-auto p-0"
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
                <SheetHeader className="bg-forest text-white p-8">
                  <SheetTitle
                    ref={titleRef}
                    tabIndex={-1}
                    className="font-serif text-3xl text-white"
                  >
                    {selected.title}
                  </SheetTitle>
                  <p className="text-sm text-white/85">{selected.meta}</p>
                </SheetHeader>
                <div className="p-8">
                  {selected.illustrative && (
                    <p className="mb-4 rounded-md border border-clinical-warning/40 bg-clinical-warning/10 p-3 text-[14px] font-semibold">
                      Conteúdo ilustrativo
                    </p>
                  )}
                  <p className="mb-4 text-[14px] text-muted-foreground">
                    <strong>Fonte:</strong> {selected.source ?? EDITORIAL_SOURCE}
                  </p>
                  <p className="text-sm leading-7 whitespace-pre-wrap">{selected.body}</p>
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
                      className="mt-7 flex items-center gap-2 text-sm font-semibold"
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
      <div className="block-forest p-8 relative overflow-hidden">
        <SheetHeader className="space-y-3 p-0">
          <SheetTitle
            ref={titleRef}
            tabIndex={-1}
            className="font-serif text-3xl font-bold text-white leading-tight text-left"
          >
            {item.term}
          </SheetTitle>
          <p className="text-[14px] leading-relaxed text-white/80 text-left">{item.short}</p>
        </SheetHeader>
      </div>

      <div className="p-8 space-y-8">
        <DetailBlock label="Definição completa">
          <p className="text-[14px] leading-relaxed text-foreground/85">{item.full}</p>
        </DetailBlock>

        <DetailBlock label="História do conceito">
          <p className="text-[13px] leading-relaxed text-foreground/70 italic font-serif">
            {item.history}
          </p>
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
