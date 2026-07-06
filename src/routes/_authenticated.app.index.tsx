import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  BookOpen,
  History,
  AlertCircle,
  FileText,
  Mail,
  Stamp,
  FolderOpen,
  PenTool,
  Bookmark,
  Library,
  Paperclip
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard-data", user.id],
    queryFn: async () => {
      const { data: clientsRes } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .order("updated_at", { ascending: false });

      const activeClients = clientsRes ?? [];

      const { data: sessionsRes } = await supabase
        .from("clinical_sessions")
        .select("*, clients(full_name, preferred_name)")
        .order("session_date", { ascending: false })
        .limit(10);

      return {
        clients: activeClients,
        sessions: sessionsRes ?? [],
      };
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisador";
  const clients = dashboardData?.clients ?? [];
  const lastActiveClient = clients[0] ?? null;

  return (
    <div className="min-h-screen bg-transparent pb-20 font-serif text-ink selection:bg-gold-soft">
      {/* 1. O Cabeçalho (Mesa do Pesquisador) */}
      <header className="pt-16 pb-12 relative">
        <div className="container-liz relative z-10 space-y-10">
          <div className="max-w-3xl space-y-2 border-b-2 border-archive-old pb-6">
            <h1 className="font-serif text-5xl font-bold tracking-tight text-ink leading-tight">
              Bom dia, <span className="italic text-plum-mid">{firstName}</span>.
            </h1>
            <p className="text-lg text-ink/70 font-medium font-sans">
              Você tem <strong className="text-plum-mid">3 arquivos abertos</strong> sobre a mesa hoje.
            </p>
          </div>

          {/* Dossiê em Destaque (Missão do Dia) */}
          <div className="bg-archive-doc border border-[#E6DDD0] rounded-sm p-6 md:p-8 flex flex-col xl:flex-row gap-8 items-start xl:items-center shadow-[0_4px_20px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] relative before:absolute before:top-0 before:left-0 before:w-1 before:h-full before:bg-plum-mid before:rounded-l-sm">
            
            <div className="flex-1 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center border border-plum-mid text-plum-mid text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-archive-old">
                  Ficha de Investigação
                </span>
                <span className="text-ink/50 text-sm font-sans italic flex items-center gap-1">
                  <Paperclip className="size-3" /> Anexado hoje
                </span>
              </div>
              
              <h2 className="text-3xl font-serif font-bold text-ink border-b border-dashed border-archive-old pb-2 inline-block">
                {lastActiveClient?.preferred_name || lastActiveClient?.full_name || "Paciente Exemplo"}
              </h2>
              
              <div className="bg-archive-old/50 rounded-sm p-5 border border-[#E6DDD0] text-sm md:text-base text-ink/80 font-serif leading-relaxed italic">
                <strong className="text-plum font-bold block mb-1 font-sans not-italic text-xs uppercase tracking-widest">Anotação da IA Clínica:</strong>
                "Investigar a relação entre a data de nascimento e o falecimento do avô paterno. Há indícios de lealdades invisíveis e repetição no Projeto Sentido."
              </div>
            </div>

            <div className="w-full xl:w-80 bg-archive-old rounded-sm p-6 border border-[#E6DDD0] space-y-4 shrink-0 shadow-inner">
              <h3 className="text-[11px] font-bold text-ink/60 uppercase tracking-widest flex items-center gap-2 font-sans border-b border-archive-doc pb-2">
                <BookOpen className="size-4" />
                Referência Bibliográfica
              </h3>
              <div className="font-serif">
                <p className="font-bold text-ink text-lg leading-tight">"Ai, meus ancestrais!"</p>
                <p className="text-ink/70 text-sm italic mt-1">Anne Ancelin Schützenberger</p>
              </div>
              <div className="pt-3 border-t border-archive-doc flex flex-col gap-1 text-sm font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-ink/60">Tópico:</span>
                  <span className="text-ink font-medium">Síndrome de Aniversário</span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto shrink-0 flex justify-center">
               {lastActiveClient ? (
                  <Link to="/app/clientes/$clientId" params={{ clientId: lastActiveClient.id }} className="w-full">
                    <Button variant="outline" className="w-full xl:w-auto h-16 px-10 text-lg font-serif border-[#E6DDD0] hover:bg-archive-old text-ink group rounded-sm shadow-sm">
                      <FolderOpen className="size-5 mr-3 text-plum-mid group-hover:scale-110 transition-transform" />
                      Abrir Dossiê
                    </Button>
                  </Link>
               ) : (
                  <Link to="/app/clientes" className="w-full">
                    <Button variant="outline" className="w-full xl:w-auto h-16 px-10 text-lg font-serif border-[#E6DDD0] hover:bg-archive-old text-ink group rounded-sm shadow-sm">
                      <FolderOpen className="size-5 mr-3 text-plum-mid group-hover:scale-110 transition-transform" />
                      Ver Arquivo Completo
                    </Button>
                  </Link>
               )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Grid Principal da Mesa */}
      <main className="container-liz grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna Esquerda: Documentos e Histórico (8 colunas) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Radar Sistêmico */}
          <section className="space-y-4">
            <SectionHeader title="Radar Sistêmico Global" icon={<Search className="size-5 text-ink/70" />} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RadarCard 
                title="Padrão de Exclusão" 
                desc="Detectado em 3 linhagens ativas." 
                icon={<FolderOpen className="size-5 text-plum-mid" />} 
              />
              <RadarCard 
                title="Repetição de Nomes" 
                desc="Conflitos de identidade identificados." 
                icon={<BookOpen className="size-5 text-gold" />} 
              />
            </div>
          </section>

          {/* Registro de Atividades (Linha do Tempo Documental) */}
          <section className="space-y-4">
            <SectionHeader title="Registro de Arquivo" icon={<History className="size-5 text-ink/70" />} />
            
            <div className="bg-archive-doc rounded-sm border border-[#E6DDD0] shadow-sm p-6 relative">
              <div className="absolute left-[39px] top-6 bottom-6 w-px bg-archive-old"></div>
              
              <div className="space-y-8 relative z-10">
                <div className="space-y-6">
                  <h4 className="text-[11px] font-bold font-sans uppercase tracking-widest text-ink/50 bg-archive-doc inline-block pr-4">Hoje, 12 de Outubro</h4>
                  
                  <FeedItem time="09:10" action="Anexou documento para" target="Paciente A" icon={<FileText className="size-4 text-ink/60" />} />
                  <FeedItem time="10:45" action="Carimbou conclusão de sessão" target="Paciente B" icon={<Stamp className="size-4 text-ink/60" />} />
                  <FeedItem time="11:00" action="Anotação transcrita para" target="Paciente B" icon={<PenTool className="size-4 text-ink/60" />} />
                </div>
                
                <div className="space-y-6 pt-2">
                  <h4 className="text-[11px] font-bold font-sans uppercase tracking-widest text-ink/50 bg-archive-doc inline-block pr-4">Ontem</h4>
                  
                  <FeedItem time="18:42" action="Gerou hipótese investigativa para" target="Paciente C" icon={<Search className="size-4 text-ink/60" />} />
                  <FeedItem time="15:30" action="Descobriu vínculo oculto em" target="Paciente D" icon={<Bookmark className="size-4 text-ink/60" />} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Coluna Direita: Fichas Críticas e Agenda (4 colunas) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Fichas de Atenção */}
          <section className="space-y-4">
            <SectionHeader title="Fichas Pendentes" icon={<AlertCircle className="size-5 text-ink/70" />} />
            <div className="bg-archive-doc rounded-sm border border-[#E6DDD0] shadow-sm p-6 space-y-3">
              <ActionItem type="warning" label="Árvore sem avós" patient="Paciente A" />
              <ActionItem type="urgent" label="Prontuário ausente" patient="Paciente B" />
              <ActionItem type="info" label="Revisar anotações" patient="Paciente C" />
            </div>
          </section>

          {/* Agenda de Pesquisa */}
          <section className="space-y-4">
            <SectionHeader title="Sessões Agendadas" icon={<History className="size-5 text-ink/70" />} />
            <div className="bg-archive-doc rounded-sm border border-[#E6DDD0] shadow-sm p-6">
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.2rem] before:-translate-x-px before:h-full before:w-px before:bg-[#E6DDD0]">
                 <AgendaVisualItem time="09:00" name="Paciente E" state="past" />
                 <AgendaVisualItem time="11:30" name="Paciente B" state="current" />
                 <AgendaVisualItem time="15:00" name="Paciente D" state="future" />
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES (Design: Arquivo Vivo)
// ────────────────────────────────────────────────────────────

function IndicatorBadge({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-2 bg-archive-doc border border-[#E6DDD0] px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {icon}
      <span className="text-xs font-sans font-medium text-ink/80">{text}</span>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E6DDD0] pb-2">
      {icon}
      <h3 className="text-lg font-serif font-bold text-ink">{title}</h3>
    </div>
  );
}

function RadarCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <div className="bg-archive-doc border border-[#E6DDD0] p-5 hover:bg-archive-old transition-colors cursor-pointer group shadow-sm flex flex-col gap-3">
      <div className="bg-archive-old p-2 w-fit border border-[#E6DDD0] group-hover:bg-archive-doc transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="font-serif font-bold text-ink text-lg">{title}</h4>
        <p className="text-sm font-sans text-ink/60 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function FeedItem({ time, action, target, icon }: { time: string, action: string, target: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="mt-1 bg-archive-doc border-2 border-archive-old p-1.5 z-10 group-hover:border-plum-mid transition-colors">
        {icon}
      </div>
      <div className="flex-1 bg-transparent pt-1.5">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
          <span className="text-sm font-sans font-medium text-ink/80">{action}</span>
          <span className="text-sm font-serif font-bold text-plum-mid underline decoration-plum-mid/30 underline-offset-2">{target}</span>
        </div>
        <span className="text-xs font-sans text-ink/40 mt-1 block">{time}</span>
      </div>
    </div>
  );
}

function ActionItem({ type, label, patient }: { type: "urgent" | "warning" | "info", label: string, patient: string }) {
  const colors = {
    urgent: "border-l-4 border-l-[#8B3A3A] bg-[#FCF9F4]",
    warning: "border-l-4 border-l-[#B8860B] bg-[#FCF9F4]",
    info: "border-l-4 border-l-[#4A5D23] bg-[#FCF9F4]",
  };

  return (
    <div className={`p-3 border border-[#E6DDD0] ${colors[type]} flex justify-between items-center`}>
      <span className="text-sm font-sans font-medium text-ink">{label}</span>
      <span className="text-xs font-serif italic text-ink/60">{patient}</span>
    </div>
  );
}

function AgendaVisualItem({ time, name, state }: { time: string, name: string, state: "past" | "current" | "future" }) {
  const isCurrent = state === "current";
  const isPast = state === "past";
  
  return (
    <div className={`flex items-start gap-4 relative z-10 ${isPast ? 'opacity-50' : 'opacity-100'}`}>
      <div className="flex flex-col items-center mt-1">
        <div className={`w-3 h-3 border-2 ${isCurrent ? 'border-plum-mid bg-plum-mid' : 'border-archive-old bg-archive-doc'} rounded-none rotate-45`}></div>
      </div>
      <div className="flex-1 pb-4 border-b border-[#E6DDD0] border-dashed last:border-0 last:pb-0">
        <div className="flex justify-between items-baseline">
          <span className={`text-lg font-serif font-bold ${isCurrent ? 'text-plum-mid' : 'text-ink'}`}>{name}</span>
          <span className="text-sm font-sans text-ink/50">{time}</span>
        </div>
        {isCurrent && (
          <span className="text-[10px] uppercase font-sans tracking-widest text-plum-mid font-bold mt-1 block">Em andamento</span>
        )}
      </div>
    </div>
  );
}
