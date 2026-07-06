import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Calendar,
  Clock,
  History,
  BadgeAlert,
  Play,
  BookOpen,
  Activity,
  Target,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  BrainCircuit,
  Users
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

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Terapeuta";
  const clients = dashboardData?.clients ?? [];
  const lastActiveClient = clients[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans">
      {/* 1. O Cabeçalho Inesquecível & Missão do Dia */}
      <header className="bg-[#0f172a] text-white pt-16 pb-12 rounded-b-[40px] shadow-2xl relative overflow-hidden">
        {/* Efeito de brilho de fundo */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-plum/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container-liz relative z-10 space-y-10">
          <div className="max-w-3xl space-y-4">
            <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Bom dia, <span className="text-lavender-200 italic">{firstName}</span>.
            </h1>
            <p className="text-lg text-slate-300 font-medium">
              Hoje você acompanhará <strong className="text-white">3 histórias familiares</strong>.
            </p>
            
            {/* Indicadores estilo pílula */}
            <div className="flex flex-wrap gap-3 pt-2">
              <IndicatorBadge icon={<AlertCircle className="size-3.5 text-amber-400" />} text="1 paciente em data de Síndrome de Aniversário" />
              <IndicatorBadge icon={<Sparkles className="size-3.5 text-plum-300" />} text="A IA encontrou 4 padrões relevantes" />
              <IndicatorBadge icon={<Clock className="size-3.5 text-rose-400" />} text="1 prontuário pendente de ontem" />
              <IndicatorBadge icon={<Activity className="size-3.5 text-emerald-400" />} text="Tempo disponível: 3h40" />
            </div>
          </div>

          {/* Missão do Dia (Centro de Comando) */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 flex flex-col xl:flex-row gap-8 items-start xl:items-center shadow-2xl ring-1 ring-white/10">
            <div className="flex-1 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center bg-plum text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Missão do Dia
                </span>
                <span className="text-slate-400 text-sm font-medium">Foco Clínico</span>
              </div>
              
              <h2 className="text-3xl font-serif font-bold text-white">
                {lastActiveClient?.preferred_name || lastActiveClient?.full_name || "Paciente Exemplo"}
              </h2>
              
              <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/50 text-sm md:text-base text-slate-200 font-medium leading-relaxed">
                <strong className="text-plum-300 font-bold block mb-1">Objetivo sugerido pela IA:</strong>
                Investigar a relação entre a data de nascimento e o falecimento do avô paterno, aprofundando possíveis lealdades invisíveis e o contexto do Projeto Sentido.
              </div>
            </div>

            <div className="w-full xl:w-80 bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 space-y-4 shrink-0">
              <h3 className="text-[11px] font-bold text-lavender-300 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="size-4" />
                Material Sugerido
              </h3>
              <div>
                <p className="font-bold text-white text-base">"Ai, meus ancestrais!"</p>
                <p className="text-slate-400 text-sm">Anne Ancelin Schützenberger</p>
              </div>
              <div className="pt-4 border-t border-slate-700/50 flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Conceito:</span>
                  <span className="text-white font-medium">Síndrome de Aniversário</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Protocolo:</span>
                  <span className="text-white font-medium">Mapa de Segredos</span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto shrink-0 flex justify-center">
               {lastActiveClient ? (
                  <Link to="/app/clientes/$clientId" params={{ clientId: lastActiveClient.id }} className="w-full">
                    <Button variant="lavender" className="w-full xl:w-auto h-16 px-10 text-lg font-bold shadow-plum-glow group rounded-2xl">
                      <Play className="size-5 mr-3 fill-white group-hover:scale-110 transition-transform" />
                      Próximo Paciente
                    </Button>
                  </Link>
               ) : (
                  <Link to="/app/clientes" className="w-full">
                    <Button variant="lavender" className="w-full xl:w-auto h-16 px-10 text-lg font-bold shadow-plum-glow group rounded-2xl">
                      <Play className="size-5 mr-3 fill-white group-hover:scale-110 transition-transform" />
                      Ver Pacientes
                    </Button>
                  </Link>
               )}
            </div>
          </div>
        </div>
      </header>

      {/* Grid Principal (O Dashboard Vivo) */}
      <div className="container-liz py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Coluna Esquerda: Ações e IA (8 colunas) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 2. Continue de Onde Parou */}
            <section className="space-y-4">
              <SectionHeader title="Continuar Caso" icon={<Target className="size-5 text-slate-400" />} />
              {lastActiveClient ? (
                <div className="group bg-white rounded-3xl p-2 pr-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between cursor-pointer ring-1 ring-transparent hover:ring-lavender/30">
                  <div className="flex items-center gap-5 p-2 md:p-0">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-lavender/20 to-plum/10 flex items-center justify-center border border-lavender/20 shrink-0 text-2xl font-serif text-primary">
                      {lastActiveClient.preferred_name?.[0] || lastActiveClient.full_name[0]}
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-serif text-xl font-bold text-primary group-hover:text-plum transition-colors">
                        {lastActiveClient.preferred_name || lastActiveClient.full_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500">
                        <span className="flex items-center gap-1.5"><BadgeAlert className="size-3.5 text-lavender" /> Primeira consulta</span>
                        <span className="hidden md:inline text-slate-300">•</span>
                        <span className="flex items-center gap-1.5"><Users className="size-3.5 text-emerald-500" /> Genossociograma: 74%</span>
                        <span className="hidden md:inline text-slate-300">•</span>
                        <span className="flex items-center gap-1.5"><History className="size-3.5 text-amber-500" /> Modificado ontem às 18:42</span>
                      </div>
                      <p className="text-[13px] text-slate-600 font-medium">
                        <strong className="text-primary">Hipótese principal:</strong> Lealdade Invisível
                      </p>
                    </div>
                  </div>
                  <Link to="/app/clientes/$clientId" params={{ clientId: lastActiveClient.id }} className="w-full md:w-auto p-4 md:p-0">
                    <Button variant="ghost" className="w-full md:rounded-full h-12 md:w-12 p-0 bg-slate-50 hover:bg-lavender/10 text-primary hover:text-plum transition-colors flex items-center justify-center">
                      <span className="md:hidden font-bold mr-2">Continuar</span>
                      <ChevronRight className="size-6" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-dashed border-slate-300 text-center text-slate-500">
                  Nenhum cliente ativo no momento.
                </div>
              )}
            </section>

            {/* 3 & 13. Radar Sistêmico & IA Clínica */}
            <section className="space-y-4">
              <SectionHeader title="IA Clínica & Radar Sistêmico" icon={<BrainCircuit className="size-5 text-plum" />} />
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {/* Radar Global */}
                  <div className="p-6 md:p-8 space-y-6 bg-slate-50/50">
                    <div>
                      <h4 className="text-sm font-bold text-primary mb-1">Radar Sistêmico Global</h4>
                      <p className="text-[13px] text-slate-500">Hoje detectei nos seus casos ativos:</p>
                    </div>
                    <div className="space-y-3">
                      <RadarItem count={4} label="padrões de repetição" color="bg-rose-100 text-rose-700" />
                      <RadarItem count={2} label="Síndromes de Aniversário" color="bg-amber-100 text-amber-700" />
                      <RadarItem count={3} label="exclusões maternas" color="bg-plum/10 text-plum" />
                      <RadarItem count={5} label="lealdades invisíveis" color="bg-indigo-100 text-indigo-700" />
                      <RadarItem count={1} label="repetição de profissão" color="bg-emerald-100 text-emerald-700" />
                    </div>
                    <Button variant="outline" className="w-full mt-4 font-bold rounded-xl h-10 border-slate-200 text-xs uppercase tracking-wider text-slate-500 hover:text-primary">
                      Abrir Análise Completa
                    </Button>
                  </div>
                  
                  {/* Alertas & Sugestões */}
                  <div className="p-6 md:p-8 space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-primary mb-1">Alertas Específicos</h4>
                      <p className="text-[13px] text-slate-500">Insight dinâmico gerado agora</p>
                    </div>
                    
                    <div className="bg-lavender-soft/50 rounded-2xl p-4 border border-lavender/20 space-y-3">
                      <p className="text-[13px] font-medium text-primary italic leading-relaxed">
                        "A maioria dos seus pacientes ativos recentes possui padrões fortemente relacionados à exclusão da linhagem materna."
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perguntas Sugeridas para Hoje</h5>
                       <div className="bg-white border border-slate-100 rounded-xl p-3 text-[13px] font-medium text-slate-600 shadow-sm hover:border-plum/30 transition-colors cursor-pointer group flex gap-3">
                         <div className="mt-0.5"><Sparkles className="size-3.5 text-plum opacity-50 group-hover:opacity-100" /></div>
                         "O que aconteceu com a primeira filha do seu avô materno?"
                       </div>
                       <div className="bg-white border border-slate-100 rounded-xl p-3 text-[13px] font-medium text-slate-600 shadow-sm hover:border-plum/30 transition-colors cursor-pointer group flex gap-3">
                         <div className="mt-0.5"><Sparkles className="size-3.5 text-plum opacity-50 group-hover:opacity-100" /></div>
                         "Alguém na família foi proibido de exercer a profissão?"
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 8. Feed de Atividades Estilo GitHub */}
            <section className="space-y-4">
              <SectionHeader title="Feed Clínico" icon={<History className="size-5 text-slate-400" />} />
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 md:p-8">
                <div className="space-y-8">
                  {/* Hoje */}
                  <div className="relative">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white pr-4 inline-block relative z-10">Hoje</h4>
                    <div className="absolute left-0 top-1/2 w-full h-px bg-slate-100 z-0"></div>
                  </div>
                  <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-2">
                    <FeedItem time="09:10" action="Você adicionou" target="Paciente A" icon={<Users className="size-4" />} />
                    <FeedItem time="10:45" action="Sessão concluída com" target="Paciente B" icon={<CheckCircle2 className="size-4" />} />
                    <FeedItem time="11:00" action="Resumo atualizado via IA para" target="Paciente B" icon={<Sparkles className="size-4" />} />
                  </div>
                  
                  {/* Ontem */}
                  <div className="relative pt-4">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white pr-4 inline-block relative z-10">Ontem</h4>
                    <div className="absolute left-0 top-1/2 w-full h-px bg-slate-100 z-0 pt-4"></div>
                  </div>
                  <div className="space-y-5 pl-2 border-l-2 border-slate-100 ml-2">
                    <FeedItem time="18:42" action="Gerou hipótese de Lealdade para" target="Paciente C" icon={<BrainCircuit className="size-4" />} />
                    <FeedItem time="15:30" action="Criou vínculo de conflito para" target="Paciente D" icon={<ArrowRight className="size-4" />} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Coluna Direita: Dashboard Vivo, Agenda e Status (4 colunas) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* 7. Casos Críticos */}
            <section className="space-y-4">
              <SectionHeader title="Atenção Necessária" icon={<AlertCircle className="size-5 text-rose-500" />} />
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-3">
                <ActionItem color="yellow" label="Genograma incompleto" patient="Paciente A" />
                <ActionItem color="red" label="Prontuário pendente" patient="Paciente B" />
                <ActionItem color="purple" label="Árvore sem avós" patient="Paciente C" />
                <ActionItem color="orange" label="Linha do Tempo vazia" patient="Paciente D" />
                <ActionItem color="black" label="Sessão sem evolução" patient="Paciente E" />
              </div>
            </section>

            {/* 5. Agenda Visual */}
            <section className="space-y-4">
              <SectionHeader title="Agenda Visual" icon={<Calendar className="size-5 text-slate-400" />} />
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 overflow-x-hidden">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.2rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                   <AgendaVisualItem time="09:00" name="Paciente E" state="past" initials="PE" />
                   <AgendaVisualItem time="11:30" name="Paciente B" state="current" initials="PB" />
                   <AgendaVisualItem time="15:00" name="Paciente D" state="future" initials="PD" />
                </div>
              </div>
            </section>

            {/* 10. Biblioteca Viva */}
            <section className="space-y-4">
              <SectionHeader title="Biblioteca Viva" icon={<BookOpen className="size-5 text-slate-400" />} />
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-800 shadow-xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-plum/20 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="size-4 text-plum-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Recomendação do Dia</span>
                  </div>
                  <div>
                    <h4 className="font-serif text-xl font-bold text-white leading-tight mb-1">A Síndrome do Jacente</h4>
                    <p className="text-slate-300 text-sm font-medium">Salomon Sellam</p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-4 border border-white/10 mt-4">
                    <p className="text-[13px] text-slate-200 font-medium leading-relaxed">
                      <strong className="text-lavender-200">Por que ler hoje?</strong> Você está atendendo 2 pacientes com histórico de luto infantil mal resolvido na linhagem paterna.
                    </p>
                  </div>
                  <Button variant="lavender" size="sm" className="w-full mt-2 font-bold rounded-xl h-10 border-0 bg-white/10 hover:bg-white/20 text-white transition-colors">
                    Abrir Resumo Clínico
                  </Button>
                </div>
              </div>
            </section>

            {/* 11. Evolução Clínica (Status Global) */}
            <section className="space-y-4">
              <SectionHeader title="Evolução Clínica" icon={<Activity className="size-5 text-slate-400" />} />
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
                <div className="grid grid-cols-2 gap-4">
                  <StatCard value="43" label="Pacientes ativos" />
                  <StatCard value="39" label="Genogramas" />
                  <StatCard value="61" label="Sessões no mês" />
                  <StatCard value="182" label="Hipóteses" />
                  <div className="col-span-2">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">Protocolos aplicados</span>
                      <span className="text-xl font-black text-primary font-serif">97</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Subcomponentes de UI (Auxiliares)
// ----------------------------------------------------------------------

function IndicatorBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm">
      {icon}
      <span className="text-[12px] font-semibold text-slate-200">{text}</span>
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2">
      {icon}
      <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">{title}</h3>
    </div>
  );
}

function RadarItem({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center justify-center h-7 w-7 rounded-lg font-black text-xs ${color}`}>
        {count}
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
}

function FeedItem({ time, action, target, icon }: { time: string; action: string; target: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 relative">
      <div className="absolute -left-5 sm:top-1/2 sm:-translate-y-1/2 top-[10px] h-2 w-2 rounded-full bg-slate-200 border-2 border-white z-10"></div>
      <div className="w-10 text-[11px] font-bold text-slate-400 sm:text-right shrink-0">{time}</div>
      <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 flex-1 hover:border-slate-200 transition-colors">
        <div className="text-slate-400">{icon}</div>
        <p className="text-[13px] font-medium text-slate-600">
          {action} <strong className="text-primary">{target}</strong>
        </p>
      </div>
    </div>
  );
}

function ActionItem({ color, label, patient }: { color: "yellow" | "red" | "purple" | "orange" | "black", label: string, patient: string }) {
  const dotClasses = {
    yellow: "bg-amber-400",
    red: "bg-rose-500",
    purple: "bg-plum",
    orange: "bg-orange-500",
    black: "bg-slate-700",
  };
  
  return (
    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 hover:bg-slate-100/50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${dotClasses[color]} shadow-sm`}></div>
        <div>
          <p className="text-[13px] font-bold text-slate-700">{label}</p>
          <p className="text-[11px] font-medium text-slate-400">{patient}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full bg-white border border-slate-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
        <ArrowRight className="size-3.5 text-slate-500" />
      </Button>
    </div>
  );
}

function AgendaVisualItem({ time, name, state, initials }: { time: string; name: string; state: "past" | "current" | "future", initials: string }) {
  const isCurrent = state === "current";
  const isPast = state === "past";
  
  return (
    <div className={`relative flex items-center gap-4 md:justify-normal md:odd:flex-row-reverse group py-2 z-10`}>
       {/* Icon/Dot in center */}
       <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-sm shrink-0 md:absolute md:left-1/2 md:-ml-5 ${isCurrent ? 'bg-plum text-white scale-110 z-20' : isPast ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
          <span className="text-[10px] font-black">{initials}</span>
       </div>
       
       {/* Content */}
       <div className="flex-1 md:w-[calc(50%-2rem)] md:flex-none bg-slate-50 border border-slate-100 p-3.5 rounded-2xl hover:border-slate-300 transition-colors cursor-pointer">
          <div className="flex items-center justify-between mb-1">
             <span className={`text-[11px] font-black uppercase tracking-widest ${isCurrent ? 'text-plum' : 'text-slate-400'}`}>{time}</span>
             {isCurrent && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm" />}
          </div>
          <h4 className={`text-[14px] font-bold ${isCurrent ? 'text-primary' : 'text-slate-600'}`}>{name}</h4>
       </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-center items-center text-center hover:bg-slate-100/50 transition-colors">
      <span className="font-serif text-3xl font-black text-primary mb-1">{value}</span>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    </div>
  );
}
