import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ArrowRight, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  History, 
  Users, 
  FileText, 
  HeartCrack,
  BadgeAlert,
  HelpCircle,
  Play
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
      // 1. Fetch active clients
      const { data: clientsRes } = await supabase
        .from("clients")
        .select("*")
        .eq("status", "active")
        .order("updated_at", { ascending: false });
      
      const activeClients = clientsRes ?? [];

      // 2. Fetch recent sessions
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

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "terapeuta";

  const clients = dashboardData?.clients ?? [];
  const sessions = dashboardData?.sessions ?? [];

  // Recentes/Mais ativo
  const lastActiveClient = clients[0] ?? null;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Dashboard
        </p>
      </div>

      <div className="container-liz py-8 space-y-8">
        {/* Editorial Greeting Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50 pb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender">
              Consultório Clínico
            </p>
            <h1 className="mt-2 font-serif text-4xl font-bold text-primary">
              Bom dia, <em className="italic text-lavender">{firstName}</em>.
            </h1>
          </div>
          {/* Resumo Rápido (Bloco 1) */}
          <div className="flex flex-wrap gap-4 text-[13px]">
            <div className="flex items-center gap-2 rounded-full bg-slate-50 border border-border px-4 py-1.5 font-semibold text-primary/80">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>2 sessões hoje</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-50 border border-border px-4 py-1.5 font-semibold text-primary/80">
              <Clock className="size-4 text-amber-500" />
              <span>1 prontuário pendente</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-50 border border-border px-4 py-1.5 font-semibold text-primary/80">
              <Sparkles className="size-4 text-plum" />
              <span>4 padrões ativos</span>
            </div>
          </div>
        </div>

        {/* Notion / Linear Layout Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Coluna 1 & 2 (Principal) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Bloco 2: Continue de Onde Parou */}
            {lastActiveClient ? (
              <div className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lavender-mid">
                    Continue de Onde Parou
                  </p>
                  <h3 className="font-serif text-2xl font-bold text-primary">
                    {lastActiveClient.preferred_name || lastActiveClient.full_name}
                  </h3>
                  <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                    <span>Genossociograma: <strong className="text-plum">74% completo</strong></span>
                    <span>•</span>
                    <span>Última edição: Ontem</span>
                  </div>
                </div>
                <Link
                  to="/app/clientes/$clientId"
                  params={{ clientId: lastActiveClient.id }}
                  preload="intent"
                >
                  <Button variant="lavender" className="h-10 gap-2 shrink-0">
                    <Play className="size-4 fill-white" />
                    Continuar Caso
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center space-y-2">
                <Users className="size-8 text-lavender/50 mx-auto" />
                <p className="font-serif text-lg font-bold text-primary">Nenhum cliente ativo no consultório</p>
                <Link to="/app/clientes">
                  <Button variant="outline" size="sm" className="mt-2 font-bold">Ver Clientes</Button>
                </Link>
              </div>
            )}

            {/* Bloco 4: Alertas Clínicos IA */}
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-plum" />
                  Alertas Clínicos da IA
                </h3>
                <span className="rounded-full bg-plum/5 px-2 py-0.5 text-[11px] font-bold text-plum border border-plum/10">
                  Transgeracional
                </span>
              </div>
              <div className="p-6 divide-y divide-border/40">
                <AlertItem 
                  title="Repetição de trauma detectada"
                  description="A IA encontrou padrões de abandono emocional repetidos em 3 gerações do clã de Pietro."
                  severity="critical"
                />
                <AlertItem 
                  title="Coincidência da Síndrome de Aniversário"
                  description="A data de casamento da mãe coincide exatamente com o aniversário de falecimento do avô materno."
                  severity="attention"
                />
                <AlertItem 
                  title="Conflito de Consistência Sistêmica"
                  description="Existem idades inconsistentes no casamento dos bisavós paternos na árvore genealógica."
                  severity="info"
                />
              </div>
            </div>

            {/* Bloco 5: Atividade Recente */}
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-border/40 px-6 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <History className="size-4 text-lavender" />
                  Feed de Atividade Recente
                </h3>
              </div>
              <div className="p-6">
                <div className="flow-root">
                  <ul className="-mb-8">
                    <ActivityTimelineItem 
                      action="Dossiê editado"
                      target="Pietro Vinicius Baccin"
                      time="há 2 horas"
                      desc="Você atualizou a queixa do caso e adicionou a profissão do pai."
                    />
                    <ActivityTimelineItem 
                      action="Vínculo criado"
                      target="Letícia Baccin"
                      time="Ontem"
                      desc="Adicionou relacionamento de conflito emocional na subárvore materna."
                    />
                    <ActivityTimelineItem 
                      action="Árvore gerada"
                      target="Daniel Baccin"
                      time="2 dias atrás"
                      desc="Esboço inicial do genossociograma construído com 3 gerações."
                    />
                  </ul>
                </div>
              </div>
            </div>

          </div>

          {/* Coluna 3 (Lateral) */}
          <div className="space-y-6">
            
            {/* Bloco 3: Agenda do Dia */}
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-border/40 px-6 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Calendar className="size-4 text-gold" />
                  Agenda de Hoje
                </h3>
              </div>
              <div className="p-6 divide-y divide-border/40">
                <AgendaItem 
                  time="09:00"
                  clientName="Pietro Vinicius"
                  type="Sessão 3 / Genograma"
                  active
                />
                <AgendaItem 
                  time="11:30"
                  clientName="Leticia Baccin"
                  type="Anamnese Sistêmica"
                />
                <AgendaItem 
                  time="15:00"
                  clientName="Anapaula Farhat"
                  type="Primeira Consulta"
                />
              </div>
            </div>

            {/* Atendimento e Pendências */}
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm p-6 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Prontuários Pendentes
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-border/50 p-3">
                  <div>
                    <p className="text-[13px] font-bold text-primary">Gravação da Sessão 2</p>
                    <p className="text-[11px] text-muted-foreground">Pietro Vinicius · transcrito</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 font-bold">Estruturar</Button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

function AlertItem({ title, description, severity }: { title: string; description: string; severity: "critical" | "attention" | "info" }) {
  const iconMap = {
    critical: <HeartCrack className="size-4 text-plum" />,
    attention: <BadgeAlert className="size-4 text-gold" />,
    info: <HelpCircle className="size-4 text-lavender" />,
  };
  const colorMap = {
    critical: "bg-plum/5 text-plum border-plum/10",
    attention: "bg-gold/10 text-amber-900 border-gold/20",
    info: "bg-lavender-soft text-primary border-border/60",
  };

  return (
    <div className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colorMap[severity]}`}>
        {iconMap[severity]}
      </div>
      <div className="space-y-1">
        <h4 className="text-[13px] font-bold text-primary leading-tight">{title}</h4>
        <p className="text-[13px] text-muted-foreground leading-relaxed font-serif">{description}</p>
      </div>
    </div>
  );
}

function ActivityTimelineItem({ action, target, time, desc }: { action: string; target: string; time: string; desc: string }) {
  return (
    <li className="relative pb-8 last:pb-0">
      <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border/50" aria-hidden="true" />
      <div className="relative flex space-x-3">
        <div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-soft text-lavender border border-border/40">
            <Clock className="size-3.5" />
          </span>
        </div>
        <div className="flex-1 min-w-0 pt-0.5 space-y-1">
          <div className="flex items-center justify-between gap-4 text-[13px]">
            <p className="font-semibold text-primary">
              {action} <strong className="text-lavender font-bold">{target}</strong>
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0">{time}</span>
          </div>
          <p className="text-[12px] text-muted-foreground font-serif leading-relaxed">{desc}</p>
        </div>
      </div>
    </li>
  );
}

function AgendaItem({ time, clientName, type, active }: { time: string; clientName: string; type: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4.5 first:pt-0 last:pb-0">
      <div className="flex gap-3 min-w-0">
        <div className={`text-[12px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded ${active ? "bg-plum text-white" : "bg-slate-100 text-muted-foreground"}`}>
          {time}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-primary truncate">{clientName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{type}</p>
        </div>
      </div>
      {active && (
        <span className="flex h-2 w-2 rounded-full bg-plum" />
      )}
    </div>
  );
}
