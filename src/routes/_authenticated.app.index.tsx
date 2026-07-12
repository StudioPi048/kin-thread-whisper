import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderOpen,
  History,
  AlertCircle,
  FileText,
  Stamp,
  Sparkles,
  ArrowRight,
  Brain,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { GenealogyDivider } from "@/components/ui/narrative-connector";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisadora";
  
  return (
    <div className="min-h-screen bg-transparent pb-20 font-serif text-ink selection:bg-gold-soft">
      {/* 1. Header Contextual (Mesa Clínica) */}
      <DocumentHeader 
        breadcrumb="Instituto Liz / Mesa Clínica"
        title={`Bom dia, ${firstName}.`}
        subtitle="Você possui 1 prioridade clínica que demanda sua atenção nesta manhã."
      />

      <main className="container-liz grid grid-cols-1 lg:grid-cols-12 gap-8 py-8">
        
        {/* Coluna Principal: Protagonista e IA (8 colunas) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* O Protagonista (Paciente Prioritário) */}
          <section className="bg-white border border-[#E5E2DC] shadow-[0_8px_30px_rgba(22,51,38,0.04)] relative before:absolute before:top-0 before:left-0 before:w-1.5 before:h-full before:bg-forest-mid rounded-sm p-8">
            <div className="flex flex-col mb-6">
               <div className="space-y-1 mb-4">
                 <span className="text-[10px] uppercase font-sans tracking-widest text-forest-mid font-bold border border-forest/20 px-2 py-0.5 rounded-sm bg-forest/5 inline-block">
                   Prioridade Clínica
                 </span>
                 <h2 className="text-3xl font-serif font-bold text-ink mt-2">Maria Helena</h2>
               </div>

               <div className="bg-archive-old/50 p-4 border border-[#E5E2DC]/50 rounded-sm">
                 <h3 className="text-xs uppercase font-sans tracking-widest text-ink/60 font-bold mb-3 border-b border-archive-doc pb-2">Motivos</h3>
                 <ul className="space-y-2 text-sm font-sans text-ink/80">
                   <li className="flex gap-2 items-start"><ArrowRight className="size-4 text-forest-mid mt-0.5 shrink-0" /> Próxima sessão em 2 horas</li>
                   <li className="flex gap-2 items-start"><ArrowRight className="size-4 text-forest-mid mt-0.5 shrink-0" /> Hipótese ainda não validada</li>
                   <li className="flex gap-2 items-start"><ArrowRight className="size-4 text-clinical-warning mt-0.5 shrink-0" /> Síndrome de Aniversário em 3 dias</li>
                   <li className="flex gap-2 items-start"><ArrowRight className="size-4 text-clinical-critical mt-0.5 shrink-0" /> Nenhuma evolução registrada há 48 dias</li>
                 </ul>
               </div>
            </div>

            {/* Ação Principal Única (CTA Dominante) */}
            <div className="pt-6 mt-6 border-t border-dashed border-[#E5E2DC]">
               <Link to="/app/clientes">
                 <Button className="w-full md:w-auto h-12 px-8 bg-forest hover:bg-forest-mid text-white font-serif text-base shadow-sm transition-all group">
                   <FolderOpen className="size-4 mr-2 group-hover:scale-110 transition-transform" />
                   Preparar Sessão de Hoje
                 </Button>
               </Link>
            </div>
          </section>

          {/* O Segundo Cérebro (Memória Narrativa da IA) */}
          <section className="bg-archive-old/30 border border-archive-doc rounded-sm p-6 shadow-inner relative">
            <div className="flex items-center gap-2 mb-4 border-b border-archive-doc pb-3">
              <Brain className="size-5 text-forest-mid" />
              <h3 className="font-serif font-bold text-lg text-ink">Raciocínio Clínico em Andamento</h3>
            </div>
            
            <div className="space-y-5 font-serif">
              {/* Contexto */}
              <div>
                <h4 className="text-[10px] uppercase font-sans tracking-widest text-forest/70 font-bold mb-1">Contexto</h4>
                <p className="text-[14px] leading-relaxed text-ink/80">
                  A investigação sobre a repetição das datas na linhagem paterna de Maria Helena foi iniciada após a última sessão.
                </p>
              </div>

              {/* Hipótese */}
              <div>
                <h4 className="text-[10px] uppercase font-sans tracking-widest text-forest/70 font-bold mb-1">Hipótese</h4>
                <p className="text-[15px] leading-relaxed text-ink font-medium italic">
                  Identifiquei uma coincidência temporal que pode configurar um Padrão Sistêmico de Síndrome de Aniversário.
                </p>
              </div>

              {/* Evidências */}
              <div className="bg-white/60 p-4 border border-[#E5E2DC]/50 rounded-sm space-y-2">
                <h4 className="text-[10px] uppercase font-sans tracking-widest text-forest/70 font-bold mb-2">Evidências</h4>
                <ul className="space-y-2 text-sm font-sans text-ink/75">
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="size-4 text-forest mt-0.5 shrink-0" /> 
                    <span>Falecimento do Avô Paterno: <strong>15 de Novembro</strong> (1982)</span>
                  </li>
                  <li className="flex gap-2 items-start">
                    <ArrowRight className="size-4 text-forest mt-0.5 shrink-0" /> 
                    <span>Data do próximo atendimento: <strong>14 de Novembro</strong></span>
                  </li>
                </ul>
              </div>

              {/* Perguntas Sugeridas */}
              <div>
                <h4 className="text-[10px] uppercase font-sans tracking-widest text-forest/70 font-bold mb-1">Perguntas Sugeridas</h4>
                <p className="text-[14px] leading-relaxed text-ink/80 border-l-2 border-archive-old pl-3">
                  "O que aconteceu na sua família na semana em que seu avô faleceu, antes que você nascesse?"
                </p>
              </div>
              
              {/* Próxima Ação */}
              <div className="pt-4 border-t border-archive-doc">
                <Link to="/app/ia-clinica">
                  <Button variant="outline" className="w-full text-sm font-sans border-forest/30 text-forest hover:bg-forest hover:text-white h-10 px-4 rounded-sm shadow-sm transition-all group">
                    <Sparkles className="size-4 mr-2 group-hover:rotate-12 transition-transform" />
                    Aprofundar Hipótese no Segundo Cérebro
                  </Button>
                </Link>
              </div>
            </div>
          </section>

        </div>

        {/* Coluna Secundária: Pendências e Registros (4 colunas) */}
        <div className="lg:col-span-4 space-y-8">
           
          {/* Fichas Críticas */}
          <section className="space-y-4">
            <h3 className="font-serif font-bold text-lg text-ink flex items-center gap-2 border-b border-[#E5E2DC] pb-2">
              <AlertCircle className="size-5 text-ink/60" />
              Pendências Clínicas
            </h3>
            <div className="bg-archive-doc rounded-sm border border-[#E5E2DC] shadow-sm p-5 space-y-3">
              <ActionItem type="urgent" label="Prontuário sem evolução" patient="Marcelo A." />
              <ActionItem type="warning" label="Árvore incompleta (3ª ger.)" patient="Letícia F." />
              <ActionItem type="info" label="Revisar anotações" patient="Carolina T." />
            </div>
          </section>

          {/* Memória Documental Recente */}
          <section className="space-y-4">
            <h3 className="font-serif font-bold text-lg text-ink flex items-center gap-2 border-b border-[#E5E2DC] pb-2">
              <History className="size-5 text-ink/60" />
              Memória Recente
            </h3>
            <div className="bg-archive-doc rounded-sm border border-[#E5E2DC] shadow-sm p-6 relative">
              <div className="absolute left-[35px] top-6 bottom-6 w-px bg-archive-old"></div>
              <div className="space-y-6 relative z-10">
                <FeedItem time="Há 2h" action="Gerou hipótese" target="Geovanna N." icon={<Sparkles className="size-3 text-ink/60" />} />
                <FeedItem time="Ontem" action="Concluiu sessão" target="Marcelo A." icon={<Stamp className="size-3 text-ink/60" />} />
                <FeedItem time="Ontem" action="Anexou arquivo" target="Lúcia R." icon={<FileText className="size-3 text-ink/60" />} />
              </div>
            </div>
          </section>

        </div>
      </main>
      
      {/* Fechamento editorial */}
      <div className="container-liz pt-16 pb-8">
        <GenealogyDivider opacity={0.3} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES (Design: Arquivo Vivo)
// ────────────────────────────────────────────────────────────

function ActionItem({ type, label, patient }: { type: "urgent" | "warning" | "info", label: string, patient: string }) {
  const colors = {
    urgent: "border-l-4 border-l-clinical-critical bg-clinical-critical/5 text-ink",
    warning: "border-l-4 border-l-clinical-warning bg-clinical-warning/5 text-ink",
    info: "border-l-4 border-l-clinical-positive bg-clinical-positive/5 text-ink",
  };

  return (
    <div className={`p-3 border border-[#E5E2DC] ${colors[type]} flex justify-between items-center rounded-r-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)]`}>
      <span className="text-sm font-sans font-medium text-ink">{label}</span>
      <span className="text-xs font-serif italic text-ink/60">{patient}</span>
    </div>
  );
}

function FeedItem({ time, action, target, icon }: { time: string, action: string, target: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="mt-1 bg-archive-doc border-2 border-archive-old p-1.5 z-10 rounded-full group-hover:border-forest-mid transition-colors flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 bg-transparent pt-1">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-1.5">
          <span className="text-sm font-sans font-medium text-ink/80">{action}</span>
          <span className="text-sm font-serif font-bold text-forest-mid">{target}</span>
        </div>
        <span className="text-[11px] font-sans text-ink/50 mt-1 block tracking-wide">{time}</span>
      </div>
    </div>
  );
}
