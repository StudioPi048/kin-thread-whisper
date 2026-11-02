import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  HelpCircle,
  AlertCircle,
  Layers,
  HelpCircle as QuestionIcon,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  detectPatterns,
  type DetectedPattern,
  type PersonRow,
  type RelationshipRow,
} from "@/lib/patterns";
import { Badge } from "@/components/ui/badge";
import { buildHypotheses } from "@/lib/evidence";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { clinicalIntelQuery } from "@/lib/clinical-intel";

interface Props {
  clientId: string;
}

export function ClinicalIntelligencePanel({ clientId }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  // Fetch client & genogram data
  const { data, isLoading } = useQuery(clinicalIntelQuery(clientId));

  // Calculate patterns
  const patterns = useMemo(() => {
    if (!data) return [] as DetectedPattern[];
    return detectPatterns(data.persons, data.relationships);
  }, [data]);

  // Find info gaps (missing fields in genogram)
  const infoGaps = useMemo(() => {
    if (!data?.persons) return [];
    const gaps: string[] = [];
    const deceased = data.persons.filter((p) => p.is_deceased);
    const adults = data.persons.filter((p) => {
      if (!p.birth_date) return false;
      const age = new Date().getFullYear() - new Date(p.birth_date).getFullYear();
      return age >= 18;
    });

    deceased.forEach((p) => {
      if (!p.cause_of_death) {
        gaps.push(`Falta causa da morte de ${p.preferred_name || p.full_name}`);
      }
      if (!p.death_date) {
        gaps.push(`Falta data de falecimento de ${p.preferred_name || p.full_name}`);
      }
    });

    adults.forEach((p) => {
      if (!p.occupation) {
        gaps.push(`Falta profissão de ${p.preferred_name || p.full_name}`);
      }
    });

    return gaps.slice(0, 3); // show top 3 gaps
  }, [data]);

  // Hipóteses provisórias: só existem com evidência real (fonte única em lib/evidence)
  const hypotheses = useMemo(
    () => buildHypotheses(patterns, data?.persons ?? []).slice(0, 3),
    [patterns, data],
  );

  // Bibliography recommendations
  const bibliography = useMemo(() => {
    const list: { title: string; author: string }[] = [];

    // Default recommendations
    list.push({
      title: "Meus Antepassados",
      author: "Anne Ancelin Schützenberger",
    });

    const types = new Set(patterns.map((p) => p.type));
    if (types.has("anniversary_syndrome")) {
      list.push({
        title: "A Síndrome de Aniversário no Genograma",
        author: "Anne Ancelin Schützenberger",
      });
    }
    if (types.has("shared_cause_of_death") || types.has("shared_health_condition")) {
      list.push({
        title: "Metagenealogia",
        author: "Alejandro Jodorowsky",
      });
    }
    if (types.has("shared_occupation") || types.has("relationship_ruptures")) {
      list.push({
        title: "Lealdades Invisíveis",
        author: "Ivan Boszormenyi-Nagy",
      });
    }

    return Array.from(new Map(list.map((x) => [x.title, x])).values()).slice(0, 3);
  }, [patterns]);

  // Perguntas: apenas as vinculadas às hipóteses com evidência (neutras, sem fallback)
  const suggestedQuestions = useMemo(
    () => Array.from(new Set(hypotheses.flatMap((h) => h.questions))).slice(0, 3),
    [hypotheses],
  );

  // Alertas de consistência — cálculo real sobre datas de nascimento/morte
  const consistencyAlerts = useMemo(() => {
    const list: string[] = [];
    if (!data?.persons) return list;

    // Check for weird dates
    data.persons.forEach((p) => {
      if (p.birth_date && p.death_date) {
        if (new Date(p.birth_date) > new Date(p.death_date)) {
          list.push(
            `Conflito temporal: ${p.preferred_name || p.full_name} tem data de morte anterior ao nascimento.`,
          );
        }
      }
    });

    if (list.length === 0 && patterns.length > 0) {
      list.push(
        "Revisar datas de nascimento na linhagem paterna para confirmar a síndrome de aniversário.",
      );
    }
    return list;
  }, [data, patterns]);

  // Linha do tempo inteligente — descrições reais de síndrome de aniversário
  // detectadas em detectPatterns (nomes e datas verdadeiros do próprio caso).
  const smartTimeline = useMemo(() => {
    return patterns.filter((p) => p.type === "anniversary_syndrome").map((p) => p.description);
  }, [patterns]);

  if (isLoading) {
    return (
      <div className="w-[350px] shrink-0 hidden lg:block h-[500px] animate-pulse rounded-2xl bg-muted/20 border border-border/50" />
    );
  }

  const body = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-border/40">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-forest/5">
          <Sparkles className="size-4 text-forest" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-bold text-primary">Copiloto Clínico</h3>
          <p className="text-[14px] text-muted-foreground font-bold uppercase tracking-wider">
            Inteligência Transgeracional
          </p>
        </div>
      </div>

      {/* Padrões Ativos */}
      <div className="space-y-3">
        <h4 className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="size-3.5 text-forest" />
          Padrões Ativos ({patterns.length})
        </h4>
        {patterns.length === 0 ? (
          <p className="text-[16px] text-muted-foreground/80 italic pl-1">
            Nenhum padrão óbvio encontrado. Adicione mais dados na árvore.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <Badge
                key={p.id}
                variant="secondary"
                className="bg-forest/5 text-forest hover:bg-forest/10 text-[14px] font-medium border border-forest/10 py-1 px-2.5 rounded-full"
              >
                {p.title}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Hipóteses Clínicas */}
      <div className="space-y-4">
        <h4 className="text-[16px] font-bold uppercase tracking-widest text-clinical-warning flex items-center gap-2">
          <AlertCircle className="size-4" />
          Hipóteses Clínicas
        </h4>
        <div className="space-y-3">
          {hypotheses.length === 0 && (
            <p className="text-[15px] text-muted-foreground">
              Sem evidências suficientes no mapa para sugerir hipóteses. Complete datas, causas e
              ocupações dos familiares.
            </p>
          )}
          {hypotheses.map((h) => (
            <div
              key={h.id}
              className="p-3 bg-clinical-warning/10 border-l-2 border-clinical-warning rounded-r-xl space-y-1.5"
            >
              <p className="text-[16px] font-bold text-ink">{h.title}</p>
              <p className="text-[15px] leading-relaxed text-ink/80">{h.description}</p>
              <p className="text-[14px] text-ink/80">
                <strong>Fontes:</strong> {h.sources.join(", ")}
              </p>
              <p className="text-[14px] text-muted-foreground">{h.limits}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lacunas de Informação */}
      {infoGaps.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <HelpCircle className="size-3.5 text-forest" />
            Lacunas de Informação
          </h4>
          <ul className="space-y-1.5 pl-1">
            {infoGaps.map((g, i) => (
              <li key={i} className="text-[16px] text-muted-foreground flex items-start gap-2">
                <span className="text-forest select-none">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Perguntas Recomendadas */}
      <div className="space-y-3">
        <h4 className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <QuestionIcon className="size-3.5 text-forest" />
          Perguntas para Próxima Sessão
        </h4>
        <div className="space-y-2.5">
          {suggestedQuestions.map((q, i) => (
            <div key={i} className="p-3 bg-forest/[0.02] border border-forest/5 rounded-xl">
              <p className="text-[16px] leading-relaxed text-foreground/90 font-serif italic">
                "{q}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Linha do Tempo Inteligente */}
      {smartTimeline.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[16px] font-bold uppercase tracking-widest text-forest-soft flex items-center gap-2">
            <Clock className="size-4" />
            Linha do Tempo Inteligente
          </h4>
          <div className="space-y-3">
            {smartTimeline.map((item, i) => (
              <div key={i} className="p-3 bg-forest/5 border-l-2 border-forest-soft rounded-r-xl">
                <p className="text-[16px] leading-relaxed text-ink font-serif">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas de Consistência */}
      {consistencyAlerts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[16px] font-bold uppercase tracking-widest text-clinical-critical flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Alertas de Consistência
          </h4>
          <ul className="space-y-2 pl-1">
            {consistencyAlerts.map((alert, i) => (
              <li
                key={i}
                className="text-[16px] text-ink flex items-start gap-2 font-medium bg-clinical-critical/10 p-2 rounded border-l-2 border-clinical-critical"
              >
                <span className="text-clinical-critical select-none mt-0.5">•</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Referências de Autores */}
      <div className="space-y-3 pt-4 border-t border-border/40">
        <h4 className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-gold" />
          Autores Relacionados
        </h4>
        <div className="space-y-2">
          {bibliography.map((b, i) => (
            <div key={i} className="flex justify-between items-center text-[16px]">
              <span className="font-serif font-bold text-primary truncate max-w-[180px]">
                {b.title}
              </span>
              <span className="text-[14px] text-muted-foreground truncate max-w-[120px]">
                {b.author}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda do Mapa */}
      <div className="space-y-3 pt-4 border-t border-border/40">
        <h4 className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="size-3.5 text-forest" />
          Legenda do Mapa
        </h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[16px]">
          <span className="flex items-center gap-2">
            <span className="inline-block size-3.5 border-[2px] border-forest bg-white" />
            <span className="text-foreground/80">Masculino</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-3.5 rounded-full border-[2px] border-forest bg-white" />
            <span className="text-foreground/80">Feminino</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-3.5 rotate-45 border-[2px] border-gold bg-white" />
            <span className="text-foreground/80 leading-tight">Não-binário / desconhecido</span>
          </span>
          <span className="flex items-center gap-2">
            <svg
              viewBox="0 0 10 10"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="5,1 9,9 1,9" className="text-foreground/70" />
            </svg>
            <span className="text-foreground/80">Aborto</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="relative inline-block size-3.5 border-[2px] border-transparent bg-white">
              <span className="absolute inset-[-2px] w-[140%] h-[2px] bg-foreground rotate-[45deg] origin-top-left" />
            </span>
            <span className="text-foreground/80">Falecido</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-3.5 border-[2px] border-forest bg-forest/20" />
            <span className="text-foreground/80">Paciente-índice</span>
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-[15px] font-semibold text-forest shadow-md lg:hidden"
          >
            <Sparkles className="size-4" aria-hidden /> Copiloto
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Copiloto Clínico</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-6">{body}</div>
        </SheetContent>
      </Sheet>
      <div className="relative shrink-0 hidden lg:block transition-all duration-300">
        {/* Toggle button */}
        <button
          type="button"
          aria-label={isOpen ? "Recolher copiloto" : "Abrir copiloto"}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -left-3 top-20 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-forest shadow-md transition-transform hover:scale-105 hover:bg-slate-50 cursor-pointer"
        >
          {isOpen ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>

        <AnimatePresence initial={false} mode="wait">
          {isOpen ? (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 350, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[350px] h-fit bg-white border border-border/50 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col gap-6"
            >
              {body}
            </motion.div>
          ) : (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 48, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="w-12 h-[350px] bg-white border border-border/50 rounded-2xl flex flex-col items-center py-6 gap-6 shadow-sm cursor-pointer hover:bg-slate-50/50"
              onClick={() => setIsOpen(true)}
            >
              <Sparkles className="size-4 text-forest animate-pulse" />
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[14px] font-bold text-forest uppercase tracking-widest vertical-text select-none">
                  Copiloto Clínico
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
      `}</style>
      </div>
    </>
  );
}
