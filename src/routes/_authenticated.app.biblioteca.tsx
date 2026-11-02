import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  BookOpen,
  ChevronRight,
  Copy,
  Link2,
} from "lucide-react";
import { buildLibraryItems } from "@/components/library/catalog";
import { searchLibrary } from "@/lib/library-search";
import {
  LETICIA,
  LETICIA_WORKS,
  Entry,
  AUTHORS,
  THEMES,
  ESSENTIAL_BOOKS,
  QUOTES,
  GLOSSARY,
  PROTOCOLS,
  LibraryItem,
  categories,
} from "@/components/library/catalog";
import { motion, AnimatePresence } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DocumentHeader } from "@/components/ui/document-header";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/biblioteca")({
  component: BibliotecaPage,
});

function BibliotecaPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const {
    data: entries = [],
    isLoading,
    isError,
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
  const items = useMemo(() => buildLibraryItems(entries), [entries]);
  const shown = searchLibrary(items, q, category);
  return (
    <div className="pb-14">
      <DocumentHeader
        breadcrumb="Biblioteca"
        title="Referências para o seu trabalho."
        subtitle="Consulte autores, obras, conceitos e materiais do acervo."
      />
      <div className="container-liz">
        <div className="gv-library-banner">
          <img
            src="/assets/genealiz/archive-library.jpg"
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
          <div className="relative">
            <Search className="absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <input
              aria-label="Buscar na biblioteca"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar autor, obra ou conceito"
              className="h-11 w-full rounded-md border border-input bg-white pl-11 pr-4 text-sm"
            />
          </div>
          <div className="flex justify-between items-center py-6">
            <h2 className="font-serif text-3xl font-semibold">{category}</h2>
            <span className="text-xs text-muted-foreground">{shown.length} resultados</span>
          </div>
          {isLoading && category === "Meu acervo" && <div className="skeleton h-32" />}
          {isError && (
            <p role="alert" className="text-sm text-destructive mb-4">
              Não foi possível carregar seu acervo. Atualize a página para tentar novamente.
            </p>
          )}
          <div className="atlas-library-list">
            {shown.map((x) => (
              <button key={x.key} onClick={() => setSelected(x)} className="atlas-library-item">
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
          {!shown.length && !isLoading && (
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
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto p-0">
          {selected?.term ? (
            <GlossaryDetail item={selected.term} />
          ) : (
            selected && (
              <>
                <SheetHeader className="bg-forest text-white p-8">
                  <SheetTitle className="font-serif text-3xl text-white">
                    {selected.title}
                  </SheetTitle>
                  <p className="text-sm text-slate-300">{selected.meta}</p>
                </SheetHeader>
                <div className="p-8">
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
                  {selected.category === "Citações" && (
                    <button
                      className="mt-7 flex items-center gap-2 text-sm font-semibold"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${selected.body} — ${selected.meta}`,
                          );
                          toast.success("Citação copiada");
                        } catch {
                          toast.error(
                            "Não foi possível copiar. Selecione o texto para copiar manualmente.",
                          );
                        }
                      }}
                    >
                      <Copy size={16} />
                      Copiar citação
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

function GlossaryDetail({ item }: { item: (typeof GLOSSARY)[number] }) {
  const Icon = item.icon;
  return (
    <div>
      <div className="block-forest p-8 relative overflow-hidden">
        <span className="section-number absolute -right-4 -bottom-8 opacity-[0.06] text-white select-none">
          {item.term.charAt(0)}
        </span>
        <SheetHeader className="relative z-10 space-y-4 p-0">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm text-gold">
            <Icon className="size-6" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
            Verbete clínico
          </p>
          <SheetTitle className="font-serif text-3xl font-bold italic text-white leading-tight text-left">
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
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-md border border-forest/15 bg-white px-2.5 py-1 text-[12px] font-medium text-forest hover:bg-forest hover:text-white transition-colors cursor-pointer"
              >
                <Link2 className="size-3" /> {r}
              </span>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest mb-2">{label}</p>
      {children}
    </div>
  );
}
