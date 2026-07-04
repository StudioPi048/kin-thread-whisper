import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Bookmark, BookText } from "lucide-react";
import { motion } from "framer-motion";

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

const ESSENTIAL_BOOKS = [
  {
    title: "A Síndrome dos Ancestrais",
    author: "Anne Ancelin Schützenberger",
    desc: "A bíblia da psicogenealogia. Introduz a síndrome de aniversário e a transmissão transgeracional do trauma.",
    color: "bg-[#1E0A3C]",
    textColor: "text-white"
  },
  {
    title: "Metagenealogia",
    author: "Alejandro Jodorowsky",
    desc: "A árvore como arte e cura. A visão psicomágica e os 4 centros do indivíduo na leitura do sistema.",
    color: "bg-[#A78BFA]",
    textColor: "text-[#1E0A3C]"
  },
  {
    title: "O Casca de Noz",
    author: "Nicolas Abraham & Maria Torok",
    desc: "A teoria do 'Fantasma' e da 'Cripta'. Segredos de família não ditos que assombram as gerações futuras.",
    color: "bg-[#D4A843]",
    textColor: "text-[#1E0A3C]"
  },
];

const KEY_CONCEPTS = [
  { term: "Síndrome de Aniversário", desc: "Repetição de traumas ou adoecimentos na mesma data ou idade de um ancestral." },
  { term: "Criança de Substituição", desc: "Filho concebido após a morte de um irmão (ou aborto), encarregado inconscientemente de 'substituí-lo'." },
  { term: "Lealdade Invisível", desc: "Obrigação inconsciente de repetir o destino familiar (fidelidade ao sistema) elaborada por Boszormenyi-Nagy." },
  { term: "Fantasma Transgeracional", desc: "Um segredo inconfessável de uma geração (cripta) que se manifesta como sintoma na segunda ou terceira geração." },
];

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
    <div className="pb-12">
      {/* HEADER EDITORIAL COM ILUSTRAÇÃO */}
      <div className="relative bg-lavender-soft/30 pt-16 pb-12 overflow-hidden border-b-2 border-border/60">
        <div className="absolute right-0 top-0 w-1/3 h-full hidden lg:block opacity-90 mix-blend-multiply">
          <img 
            src="/library_hero.png" 
            alt="Ilustração da Biblioteca" 
            className="w-full h-full object-cover object-left"
          />
        </div>
        <div className="container-liz relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-plum mb-2">
            Hub de Conhecimento
          </p>
          <h1 className="font-serif text-5xl font-bold text-primary">Biblioteca</h1>
          <p className="mt-4 text-[15px] max-w-xl leading-relaxed text-muted-foreground">
            A espinha dorsal teórica da psicogenealogia. Explore os grandes autores, 
            conceitos fundadores e a bibliografia indispensável para a prática clínica.
          </p>
        </div>
      </div>

      <div className="container-liz mt-12 space-y-16">
        
        {/* LEITURAS OBRIGATÓRIAS */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="size-5 text-gold" />
            <h2 className="font-serif text-2xl font-bold text-primary">Leituras Fundamentais</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ESSENTIAL_BOOKS.map((book) => (
              <article 
                key={book.title} 
                className={`relative flex flex-col p-6 rounded-sm shadow-sm transition-transform hover:-translate-y-1 ${book.color} ${book.textColor}`}
              >
                <div className="mb-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-2">
                    {book.author}
                  </p>
                  <h3 className="font-serif text-2xl font-bold leading-tight">
                    {book.title}
                  </h3>
                </div>
                <div className="mt-auto">
                  <p className="text-[13px] opacity-90 leading-relaxed">
                    {book.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CONCEITOS-CHAVE */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <Bookmark className="size-5 text-lavender" />
            <h2 className="font-serif text-2xl font-bold text-primary">Glossário Clínico Rápido</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {KEY_CONCEPTS.map((concept) => (
              <div key={concept.term} className="border-l-[4px] border-l-lavender bg-white p-5 shadow-sm">
                <h4 className="font-bold text-primary text-[15px]">{concept.term}</h4>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  {concept.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ACERVO COMPLETO (BUSCA) */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pt-8 border-t border-border">
            <div className="flex items-center gap-2">
              <BookText className="size-5 text-plum" />
              <h2 className="font-serif text-2xl font-bold text-primary">Acervo e Verbetes</h2>
            </div>
            
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar (ex: lealdade, luto, Hellinger)"
                className="pl-9 h-10 bg-white"
              />
            </div>
          </div>

          <div className="min-h-[300px]">
            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 rounded-sm" />)}
              </div>
            )}
            
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-sm">
                <Search className="size-8 mx-auto opacity-20 mb-3" />
                <p>Nenhum verbete encontrado para "{q}"</p>
              </div>
            )}

            <motion.div 
              className="grid gap-4 md:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
              }}
            >
              {filtered.map((e) => (
                <motion.article
                  key={e.id}
                  variants={{
                    hidden: { opacity: 0, y: 15 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                  }}
                  className="rounded-sm border border-border bg-white p-6 transition-all hover:border-lavender hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <h3 className="font-serif text-xl font-bold text-primary">{e.author}</h3>
                    {e.school && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-sm">
                        {e.school}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] font-bold text-foreground">
                    {e.title}
                    {e.topic && <span className="text-muted-foreground font-normal"> — {e.topic}</span>}
                  </p>
                  
                  {e.summary && (
                    <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground/90">
                      {e.summary}
                    </p>
                  )}
                  {e.content && (
                    <div className="mt-3 p-3 bg-lavender-soft/20 border-l-2 border-lavender-mid text-[13px] leading-relaxed text-foreground">
                      {e.content}
                    </div>
                  )}
                  
                  {e.tags && e.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {e.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="font-semibold text-[10px] rounded-sm bg-muted/50">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.article>
              ))}
            </motion.div>
          </div>
        </section>

      </div>
    </div>
  );
}
