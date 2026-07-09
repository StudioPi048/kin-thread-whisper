import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  BookOpen,
  History,
  AlertCircle,
  FileText,
  Stamp,
  FolderOpen,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Importando o novo Design System
import { SectionTitle } from "@/components/archive/section-title";
import { ArchiveCard, ArchiveCardContent, ArchiveCardHeader, ArchiveCardTitle, ArchiveCardDescription } from "@/components/archive/archive-card";
import { ClinicalPanel, ClinicalPanelContent, ClinicalPanelHeader, ClinicalPanelTitle } from "@/components/archive/clinical-panel";
import { StatusBadge } from "@/components/archive/status-badge";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

/* ─── ATOMS ──────────────────────────────────────────────── */
function Tape({ rotate = "0deg", w = "64px", top = "-10px", left = "50%" }: { rotate?: string; w?: string; top?: string; left?: string; }) {
  return (
    <div
      className="absolute z-20 shadow-sm"
      style={{
        top,
        left,
        transform: `translateX(-50%) rotate(${rotate})`,
        width: w,
        height: "22px",
        background: "rgba(210,190,155,0.75)",
      }}
    />
  );
}

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

      return {
        clients: clientsRes ?? [],
      };
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisador";
  const clients = dashboardData?.clients ?? [];
  const lastActiveClient = clients[0] ?? null;

  return (
    <div className="min-h-screen text-foreground pb-24">
      
      {/* ═══════════════════════════════════════════════════
          CABEÇALHO
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-12">
        <SectionTitle
          eyebrow="Mesa de Investigação"
          title={`Bom dia, ${firstName}.`}
          subtitle={`Você tem ${clients.length} arquivos ativos no seu acervo. Os padrões aguardam para serem descobertos.`}
        />
      </header>

      {/* ═══════════════════════════════════════════════════
          DOSSIÊ EM DESTAQUE (Workspace Ativo)
      ════════════════════════════════════════════════════ */}
      <section className="mb-20">
        <ArchiveCard variant="paper" elevation="lg" className="rotate-[-0.5deg] border-border mx-auto relative overflow-hidden">
          <Tape rotate="-1deg" w="80px" />
          
          <ArchiveCardContent className="p-10 md:p-14 flex flex-col lg:flex-row gap-12">
            
            {/* Esquerda: Resumo do Paciente e Ações */}
            <div className="flex-1 space-y-8">
              <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-4">
                <span className="font-sans text-sm font-bold tracking-widest uppercase text-muted-foreground">
                  Ficha Principal
                </span>
                <span className="font-sans text-sm text-muted-foreground italic flex items-center gap-1.5">
                  <Paperclip className="size-4" /> Anexado recentemente
                </span>
              </div>

              <div>
                <h2 className="text-4xl md:text-5xl font-bold font-serif text-primary mb-3">
                  {lastActiveClient?.preferred_name || lastActiveClient?.full_name || "Nenhum dossiê ativo"}
                </h2>
                <p className="text-lg text-muted-foreground font-serif leading-relaxed">
                  Investigação transgeracional de padrões de repetição e lealdades invisíveis.
                </p>
              </div>

              {/* Anotação Marginal da IA (Estilo Nota Clínica) */}
              <ClinicalPanel accent="gold" className="bg-amber-50/50 dark:bg-amber-900/10 border-gold/30">
                <ClinicalPanelContent className="p-6 relative">
                  <ShieldCheck className="absolute -left-3.5 -top-3.5 size-7 text-gold bg-archive p-1 rounded-full shadow-sm" />
                  <span className="block font-sans text-sm font-bold uppercase tracking-widest text-gold mb-2">
                    Nota do Copiloto
                  </span>
                  <p className="font-serif italic text-lg leading-relaxed text-foreground">
                    "Fique atento às datas de aniversário. A repetição de eventos traumáticos pode estar espelhada na terceira geração."
                  </p>
                </ClinicalPanelContent>
              </ClinicalPanel>

              <div className="pt-6">
                {lastActiveClient ? (
                  <Link to="/app/clientes/$clientId" params={{ clientId: lastActiveClient.id }}>
                    <button className="bg-primary text-primary-foreground font-sans text-sm font-bold uppercase tracking-widest px-8 py-5 rounded hover:opacity-90 transition-opacity shadow-md cursor-pointer">
                      Abrir Dossiê Físico →
                    </button>
                  </Link>
                ) : (
                  <Link to="/app/clientes">
                    <button className="bg-primary text-primary-foreground font-sans text-sm font-bold uppercase tracking-widest px-8 py-5 rounded hover:opacity-90 transition-opacity shadow-md cursor-pointer">
                      Acessar Arquivo →
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Direita: Referências e Contexto */}
            <div className="lg:w-[320px] shrink-0 border-l border-dashed border-border pl-10 flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Referência Bibliográfica
                </h3>
                <div>
                  <p className="font-serif font-bold text-2xl text-primary leading-tight">
                    "Ai, meus ancestrais!"
                  </p>
                  <p className="font-serif italic text-muted-foreground mt-2 text-lg">
                    Anne A. Schützenberger
                  </p>
                </div>
                <div className="pt-5 border-t border-border">
                  <span className="block font-sans text-sm uppercase tracking-widest text-muted-foreground mb-1.5 font-bold">
                    Tópico Ativo
                  </span>
                  <StatusBadge status="warning" variant="outline">Síndrome de Aniversário</StatusBadge>
                </div>
              </div>
            </div>

          </ArchiveCardContent>
        </ArchiveCard>
      </section>

      {/* ═══════════════════════════════════════════════════
          MESA SECUNDÁRIA (RADAR E AGENDA)
      ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Esquerda: Radar Sistêmico e Registro */}
        <div className="lg:col-span-8 space-y-16">
          
          <section>
            <SectionTitle 
              title="Radar Sistêmico Global" 
              action={<Search className="size-6 text-gold" />}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <ArchiveCard variant="solid" elevation="sm" className="hover-lift cursor-default border-l-4 border-l-gold">
                <ArchiveCardContent className="p-8">
                  <FolderOpen className="size-7 text-gold mb-5" strokeWidth={1.5} />
                  <ArchiveCardTitle className="text-xl mb-2">Padrão de Exclusão</ArchiveCardTitle>
                  <ArchiveCardDescription>
                    Detectado em 3 linhagens ativas atualmente no acervo da clínica.
                  </ArchiveCardDescription>
                </ArchiveCardContent>
              </ArchiveCard>
              
              <ArchiveCard variant="solid" elevation="sm" className="hover-lift cursor-default border-l-4 border-l-gold">
                <ArchiveCardContent className="p-8">
                  <BookOpen className="size-7 text-gold mb-5" strokeWidth={1.5} />
                  <ArchiveCardTitle className="text-xl mb-2">Repetição de Nomes</ArchiveCardTitle>
                  <ArchiveCardDescription>
                    Conflitos de identidade identificados em 2 casos recentes abertos.
                  </ArchiveCardDescription>
                </ArchiveCardContent>
              </ArchiveCard>
            </div>
          </section>

          <section>
            <SectionTitle 
              title="Registro do Acervo" 
              action={<History className="size-6 text-gold" />}
            />

            <ArchiveCard variant="solid" elevation="none" className="mt-8 bg-transparent border-none">
              <div className="space-y-10 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px before:h-full before:w-px before:bg-border">
                
                <div>
                  <StatusBadge status="neutral" variant="outline" className="bg-archive relative z-10 mb-6">
                    Hoje
                  </StatusBadge>
                  <div className="space-y-8">
                    <FeedItem time="09:10" action="Anexou documento a" target="Dossiê 001" icon={<FileText className="size-5 text-muted-foreground" />} />
                    <FeedItem time="10:45" action="Sessão registrada" target="Dossiê 042" icon={<Stamp className="size-5 text-muted-foreground" />} />
                  </div>
                </div>

                <div className="pt-2">
                  <StatusBadge status="neutral" variant="outline" className="bg-archive relative z-10 mb-6">
                    Ontem
                  </StatusBadge>
                  <div className="space-y-8">
                    <FeedItem time="18:42" action="Gerou hipótese sistêmica para" target="Dossiê 023" icon={<Search className="size-5 text-muted-foreground" />} />
                  </div>
                </div>

              </div>
            </ArchiveCard>
          </section>

        </div>

        {/* Direita: Fichas Pendentes e Agenda */}
        <div className="lg:col-span-4 space-y-16">
          
          <section>
            <SectionTitle 
              title="Fichas Soltas" 
              action={<AlertCircle className="size-6 text-gold" />}
            />
            
            <div className="space-y-6 mt-8 flex flex-col items-center sm:items-stretch">
              {/* Cartões como bilhetes físicos */}
              <ArchiveCard variant="paper" elevation="md" className="rotate-[2deg] hover:rotate-[0deg] hover:z-10 transition-transform w-full max-w-sm self-center sm:self-auto p-6 bg-[#FAF8F5] dark:bg-[#1C201B]">
                <Tape rotate="4deg" w="45px" top="-10px" left="50%" />
                <p className="font-serif text-clinical-critical font-bold text-xl mb-1">Árvore sem avós</p>
                <p className="font-serif italic text-muted-foreground text-md">Sinalizado no Dossiê A</p>
              </ArchiveCard>
              
              <ArchiveCard variant="paper" elevation="md" className="rotate-[-2deg] hover:rotate-[0deg] hover:z-10 transition-transform w-full max-w-sm self-center sm:self-auto p-6 bg-[#FAF8F5] dark:bg-[#1C201B]">
                <Tape rotate="-3deg" w="45px" top="-10px" left="50%" />
                <p className="font-serif text-clinical-warning font-bold text-xl mb-1">Prontuário incompleto</p>
                <p className="font-serif italic text-muted-foreground text-md">Sinalizado no Dossiê B</p>
              </ArchiveCard>
            </div>
          </section>

          <section>
            <SectionTitle 
              title="Agenda do Dia" 
              action={<History className="size-6 text-gold" />}
            />

            <ClinicalPanel accent="forest" className="mt-8">
              <ClinicalPanelContent className="space-y-8 p-8">
                <AgendaItem time="09:00" name="Dossiê 015" state="past" />
                <AgendaItem time="14:30" name={lastActiveClient?.preferred_name || "Dossiê 042"} state="current" />
                <AgendaItem time="17:00" name="Dossiê 088" state="future" />
              </ClinicalPanelContent>
            </ClinicalPanel>
          </section>

        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES LOCAIS
// ────────────────────────────────────────────────────────────

function FeedItem({ time, action, target, icon }: { time: string, action: string, target: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 relative z-10">
      <div className="mt-1 bg-card border border-border p-2.5 rounded-full shadow-sm">
        {icon}
      </div>
      <div>
        <div className="flex flex-col xl:flex-row xl:items-baseline gap-1 xl:gap-2">
          <span className="font-sans text-[16px] text-muted-foreground">{action}</span>
          <span className="font-serif font-bold text-primary text-[20px] border-b border-gold/40 pb-0.5">{target}</span>
        </div>
        <span className="font-sans text-[16px] text-muted-foreground/60 mt-1.5 block">{time}</span>
      </div>
    </div>
  );
}

function AgendaItem({ time, name, state }: { time: string, name: string, state: "past" | "current" | "future" }) {
  const isCurrent = state === "current";
  const isPast = state === "past";
  
  return (
    <div className={`flex items-start gap-5 ${isPast ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex flex-col items-center mt-2">
        <div className={`w-3.5 h-3.5 rounded-full ${isCurrent ? 'bg-gold shadow-[0_0_15px_rgba(212,175,55,0.8)]' : 'border border-border bg-transparent'}`} />
      </div>
      <div className="flex-1 pb-6 border-b border-border/50 last:border-0 last:pb-0">
        <div className="flex justify-between items-baseline">
          <span className={`font-serif font-bold text-2xl ${isCurrent ? 'text-gold' : 'text-primary'}`}>{name}</span>
          <span className="font-sans text-[16px] font-bold text-muted-foreground tracking-wider">{time}</span>
        </div>
        {isCurrent && (
          <StatusBadge status="warning" variant="soft" className="mt-2">
            Em Sessão
          </StatusBadge>
        )}
      </div>
    </div>
  );
}
