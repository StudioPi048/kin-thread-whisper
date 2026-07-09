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

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

/* ─── ATOMS ──────────────────────────────────────────────── */

/** Fita adesiva CSS pura para simular documentos colados */
function Tape({ rotate = "0deg", w = "64px", top = "-10px", left = "50%" }: { rotate?: string; w?: string; top?: string; left?: string; }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: `translateX(-50%) rotate(${rotate})`,
        width: w,
        height: "22px",
        background: "rgba(210,190,155,0.75)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        zIndex: 20,
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
    <div className="min-h-screen bg-[#1B211A] pb-24 font-serif text-white selection:bg-gold-soft relative overflow-x-hidden">
      
      {/* ═══════════════════════════════════════════════════
          FUNDO E TEXTURAS
      ════════════════════════════════════════════════════ */}
      <div className="absolute right-0 top-0 w-[80%] h-[700px] opacity-10 pointer-events-none">
        <img src="/assets/photos/section2_botanicals.jpg" alt="" className="w-full h-full object-cover mix-blend-screen" />
      </div>
      <div className="absolute left-0 bottom-0 w-[50%] h-[500px] opacity-[0.03] pointer-events-none rotate-180">
        <img src="/assets/photos/section2_botanicals.jpg" alt="" className="w-full h-full object-cover mix-blend-screen" />
      </div>

      {/* ═══════════════════════════════════════════════════
          CABEÇALHO DA MESA
      ════════════════════════════════════════════════════ */}
      <header className="pt-24 pb-16 relative z-10">
        <div className="container-liz">
          <p className="font-sans text-[13px] font-bold tracking-[0.2em] text-[#D4AF37] uppercase mb-4">
            Mesa de Investigação
          </p>
          <h1 className="font-serif text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight mb-4">
            Bom dia, <em className="italic text-[#D4AF37]">{firstName}</em>.
          </h1>
          <p className="text-xl text-white/60 font-serif italic max-w-xl leading-relaxed">
            Você tem <strong className="text-[#D4AF37] font-semibold not-italic">{clients.length} arquivos ativos</strong> no seu acervo. 
            Os padrões aguardam para serem descobertos.
          </p>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          DOSSIÊ EM DESTAQUE (PAPEL SOBRE A MESA)
      ════════════════════════════════════════════════════ */}
      <div className="container-liz relative z-20 mb-20">
        
        {/* Documento Físico */}
        <div className="relative bg-[#FCF9F4] text-[#3B2F2F] p-10 md:p-14 shadow-[0_32px_80px_rgba(0,0,0,0.6)] rotate-[-0.5deg] border border-[#E6DDD0]">
          
          <Tape rotate="-1deg" w="80px" />
          
          {/* Caneta Fotorrealista sobre o papel */}
          <div className="absolute -right-8 top-16 w-[280px] z-30 pointer-events-none hidden xl:block">
            <img src="/assets/objects/pen_clean.jpg" alt="" className="w-full mix-blend-multiply rotate-[22deg] drop-shadow-2xl" />
          </div>

          <div className="flex flex-col lg:flex-row gap-12 relative z-10">
            
            {/* Esquerda: Dados do Paciente e IA */}
            <div className="flex-1 space-y-8">
              <div className="flex flex-wrap items-center justify-between border-b border-[#E6DDD0] pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-[11px] font-bold tracking-[0.2em] uppercase text-[#8B7355]">
                    Ficha Principal
                  </span>
                </div>
                <span className="font-sans text-[13px] text-[#8B7355]/70 italic flex items-center gap-1.5 mt-2 sm:mt-0">
                  <Paperclip className="size-4" /> Anexado recentemente
                </span>
              </div>

              <div>
                <h2 className="text-4xl md:text-5xl font-bold font-serif text-[#2B2018] mb-3">
                  {lastActiveClient?.preferred_name || lastActiveClient?.full_name || "Nenhum dossiê ativo"}
                </h2>
                <p className="text-[19px] text-[#5A4A3A] font-serif leading-relaxed">
                  Iniciando investigação transgeracional de padrões de repetição e lealdades invisíveis.
                </p>
              </div>

              {/* Anotação Marginal da IA */}
              <div className="relative bg-[#F5F0E8] p-6 border-l-2 border-[#D4AF37] italic font-serif text-[#4A3B3B] text-lg leading-relaxed shadow-sm">
                <ShieldCheck className="absolute -left-3.5 -top-3.5 size-7 text-[#D4AF37] bg-[#FCF9F4] p-1 rounded-full shadow-sm" />
                <span className="block font-sans text-[11px] font-bold uppercase tracking-widest text-[#D4AF37] not-italic mb-2">
                  Nota do Supervisor Clínico
                </span>
                "Fique atento às datas de aniversário. A repetição de eventos traumáticos pode estar espelhada na terceira geração."
              </div>

              <div className="pt-6">
                {lastActiveClient ? (
                  <Link to="/app/clientes/$clientId" params={{ clientId: lastActiveClient.id }}>
                    <button className="bg-[#1B211A] text-white font-sans text-[13px] font-bold uppercase tracking-widest px-8 py-5 rounded-none hover:bg-[#2B312A] transition-colors shadow-lg cursor-pointer">
                      Abrir Dossiê Físico →
                    </button>
                  </Link>
                ) : (
                  <Link to="/app/clientes">
                    <button className="bg-[#1B211A] text-white font-sans text-[13px] font-bold uppercase tracking-widest px-8 py-5 rounded-none hover:bg-[#2B312A] transition-colors shadow-lg cursor-pointer">
                      Acessar Arquivo →
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Direita: Referência e Selo */}
            <div className="lg:w-[320px] shrink-0 border-l border-dashed border-[#E6DDD0] pl-10 flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B7355]">
                  Referência Bibliográfica
                </h3>
                <div>
                  <p className="font-serif font-bold text-[26px] text-[#2B2018] leading-tight">
                    "Ai, meus ancestrais!"
                  </p>
                  <p className="font-serif italic text-[#5A4A3A] mt-2 text-[18px]">
                    Anne A. Schützenberger
                  </p>
                </div>
                <div className="pt-5 border-t border-[#E6DDD0]">
                  <span className="block font-sans text-[11px] uppercase tracking-widest text-[#8B7355] mb-1.5">Tópico Ativo</span>
                  <span className="font-serif font-bold text-[#2B2018] text-[20px]">Síndrome de Aniversário</span>
                </div>
              </div>
              
              <div className="mt-12 self-center opacity-85 hover:opacity-100 transition-opacity">
                <img src="/assets/objects/wax_seal_tree.jpg" alt="" className="size-24 rounded-full mix-blend-multiply filter contrast-125 sepia-[0.3]" />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MESA SECUNDÁRIA (RADAR E AGENDA)
      ════════════════════════════════════════════════════ */}
      <main className="container-liz grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        
        {/* Esquerda: Radar Sistêmico e Registro */}
        <div className="lg:col-span-8 space-y-16">
          
          <section>
            <div className="flex items-center gap-3 mb-8">
              <Search className="size-6 text-[#D4AF37]" />
              <h3 className="font-serif text-[28px] font-bold text-white">Radar Sistêmico Global</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#151A15] border border-white/10 p-8 shadow-xl relative overflow-hidden group cursor-default">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37] opacity-40 group-hover:opacity-100 transition-opacity" />
                <FolderOpen className="size-7 text-[#D4AF37] mb-5" strokeWidth={1.5} />
                <h4 className="font-serif font-bold text-white text-[22px] mb-2">Padrão de Exclusão</h4>
                <p className="font-sans text-white/50 text-[15px] leading-relaxed">
                  Detectado em 3 linhagens ativas atualmente no acervo da clínica.
                </p>
              </div>
              
              <div className="bg-[#151A15] border border-white/10 p-8 shadow-xl relative overflow-hidden group cursor-default">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37] opacity-40 group-hover:opacity-100 transition-opacity" />
                <BookOpen className="size-7 text-[#D4AF37] mb-5" strokeWidth={1.5} />
                <h4 className="font-serif font-bold text-white text-[22px] mb-2">Repetição de Nomes</h4>
                <p className="font-sans text-white/50 text-[15px] leading-relaxed">
                  Conflitos de identidade identificados em 2 casos recentes abertos.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-8">
              <History className="size-6 text-[#D4AF37]" />
              <h3 className="font-serif text-[28px] font-bold text-white">Registro do Acervo</h3>
            </div>

            <div className="bg-[#151A15] border border-white/10 p-8 shadow-xl">
              <div className="space-y-10 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px before:h-full before:w-px before:bg-white/10">
                
                <div>
                  <h4 className="font-sans text-[12px] font-bold uppercase tracking-widest text-[#D4AF37] bg-[#151A15] inline-block pr-5 relative z-10 mb-8">
                    Hoje
                  </h4>
                  <div className="space-y-8">
                    <FeedItem time="09:10" action="Anexou documento a" target="Dossiê 001" icon={<FileText className="size-5 text-white/80" />} />
                    <FeedItem time="10:45" action="Sessão registrada" target="Dossiê 042" icon={<Stamp className="size-5 text-white/80" />} />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="font-sans text-[12px] font-bold uppercase tracking-widest text-[#D4AF37] bg-[#151A15] inline-block pr-5 relative z-10 mb-8">
                    Ontem
                  </h4>
                  <div className="space-y-8">
                    <FeedItem time="18:42" action="Gerou hipótese sistêmica para" target="Dossiê 023" icon={<Search className="size-5 text-white/80" />} />
                  </div>
                </div>

              </div>
            </div>
          </section>

        </div>

        {/* Direita: Fichas Pendentes e Agenda */}
        <div className="lg:col-span-4 space-y-16">
          
          <section>
            <div className="flex items-center gap-3 mb-8">
              <AlertCircle className="size-6 text-[#D4AF37]" />
              <h3 className="font-serif text-[28px] font-bold text-white">Fichas Soltas</h3>
            </div>
            
            <div className="space-y-6 flex flex-col items-center sm:items-stretch">
              {/* Cartões como bilhetes físicos */}
              <div className="bg-[#FAF8F5] p-6 shadow-xl rotate-[2deg] relative border border-[#E6DDD0] w-full max-w-sm self-center sm:self-auto hover:rotate-[0deg] hover:z-10 transition-transform">
                <Tape rotate="4deg" w="45px" top="-10px" left="50%" />
                <p className="font-serif text-[#8B3A3A] font-bold text-[22px] mb-1">Árvore sem avós</p>
                <p className="font-serif italic text-[#5A4A3A] text-[16px]">Sinalizado no Dossiê A</p>
              </div>
              <div className="bg-[#FAF8F5] p-6 shadow-xl rotate-[-2deg] relative border border-[#E6DDD0] w-full max-w-sm self-center sm:self-auto hover:rotate-[0deg] hover:z-10 transition-transform">
                <Tape rotate="-3deg" w="45px" top="-10px" left="50%" />
                <p className="font-serif text-[#B8860B] font-bold text-[22px] mb-1">Prontuário incompleto</p>
                <p className="font-serif italic text-[#5A4A3A] text-[16px]">Sinalizado no Dossiê B</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-8">
              <History className="size-6 text-[#D4AF37]" />
              <h3 className="font-serif text-[28px] font-bold text-white">Agenda do Dia</h3>
            </div>

            <div className="bg-[#151A15] border border-white/10 p-8 shadow-xl space-y-8">
              <AgendaItem time="09:00" name="Dossiê 015" state="past" />
              <AgendaItem time="14:30" name={lastActiveClient?.preferred_name || "Dossiê 042"} state="current" />
              <AgendaItem time="17:00" name="Dossiê 088" state="future" />
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ────────────────────────────────────────────────────────────

function FeedItem({ time, action, target, icon }: { time: string, action: string, target: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 relative z-10">
      <div className="mt-1 bg-[#1A201A] border border-white/20 p-2.5 rounded-full shadow-md">
        {icon}
      </div>
      <div>
        <div className="flex flex-col xl:flex-row xl:items-baseline gap-1 xl:gap-2">
          <span className="font-sans text-[15px] text-white/70">{action}</span>
          <span className="font-serif font-bold text-white text-[20px] border-b border-[#D4AF37]/40 pb-0.5">{target}</span>
        </div>
        <span className="font-sans text-[13px] text-white/40 mt-1.5 block">{time}</span>
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
        <div className={`w-3.5 h-3.5 rounded-full ${isCurrent ? 'bg-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.8)]' : 'border border-white/30 bg-transparent'}`} />
      </div>
      <div className="flex-1 pb-6 border-b border-white/10 last:border-0 last:pb-0">
        <div className="flex justify-between items-baseline">
          <span className={`font-serif font-bold text-[22px] ${isCurrent ? 'text-[#D4AF37]' : 'text-white'}`}>{name}</span>
          <span className="font-sans text-[14px] text-white/50 tracking-wider">{time}</span>
        </div>
        {isCurrent && (
          <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-[#D4AF37] mt-1.5 block">
            Em Sessão
          </span>
        )}
      </div>
    </div>
  );
}
