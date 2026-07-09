import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  Plus,
  Sparkles,
  AlertTriangle,
  FileText,
  Mic,
  BookOpen,
  Brain,
  Coffee,
  CheckCircle2,
  CircleDot,
  Play,
  Wand2,
  ClipboardList,
  GitBranch,
  Cake,
  Baby,
  Flame,
  Moon,
  Leaf,
  Waves,
  Sunrise,
  MessageSquare,
  DollarSign,
  TimerReset,
  Users,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAgendaData, type AgendaSessionDTO, type OrphanClientDTO } from "@/lib/agenda.functions";
import { getClientGenogram, type ClientGenogramDTO, type GenogramPersonDTO } from "@/lib/genogram.functions";


export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
});

/* ------------------------------- Mock Data ------------------------------- */

type Seal =
  | "primeira"
  | "retorno"
  | "crianca"
  | "prioridade"
  | "luto"
  | "evolucao"
  | "projeto"
  | "aniversario";

const SEAL_META: Record<Seal, { label: string; className: string; Icon: typeof CircleDot }> = {
  primeira: { label: "Primeira consulta", className: "bg-forest/10 text-forest border-forest/25", Icon: Sunrise },
  retorno: { label: "Retorno", className: "bg-forest/8 text-forest border-forest/20", Icon: TimerReset },
  crianca: { label: "Criança", className: "bg-amber-100/60 text-amber-700 border-amber-300/60", Icon: Baby },
  prioridade: { label: "Alta prioridade", className: "bg-rose-100/60 text-rose-700 border-rose-300/60", Icon: Flame },
  luto: { label: "Luto", className: "bg-slate-200/60 text-slate-700 border-slate-300/70", Icon: Moon },
  evolucao: { label: "Evolução concluída", className: "bg-emerald-100/60 text-emerald-700 border-emerald-300/60", Icon: Leaf },
  projeto: { label: "Projeto Sentido", className: "bg-sky-100/60 text-sky-700 border-sky-300/60", Icon: Waves },
  aniversario: { label: "Síndrome de Aniversário", className: "bg-orange-100/60 text-orange-700 border-orange-300/60", Icon: Cake },
};

type Session = {
  id: string;
  clientId: string | null;
  start: string;
  end: string;
  patient: string;
  initials: string;
  type: "Retorno" | "Anamnese Sistêmica" | "Primeira Consulta";
  sessionNumber?: string;
  daysSinceFirst?: number;
  lastEvolution?: string;
  seals: Seal[];
  aiAlerts: string[];
  protocols: string[];
  status: "upcoming" | "next" | "later";
  accent: "forest" | "forest" | "gold";
};

const FALLBACK_SESSIONS: Session[] = [
  {
    id: "s1",
    clientId: null,
    start: "09:00",
    end: "10:00",
    patient: "Paciente Exemplo A",
    initials: "PA",
    type: "Retorno",
    sessionNumber: "Sessão 12",
    daysSinceFirst: 84,
    lastEvolution: "Trabalhou resistência ao nome do pai. Identificada lealidade invisível com avô paterno.",
    seals: ["retorno", "aniversario", "projeto"],
    aiAlerts: [
      "Repetição de padrão detectada: separações aos 34 anos em 3 gerações consecutivas da linhagem materna.",
      "Coincidência de datas: data do divórcio (14/03) coincide com óbito do bisavô — investigar síndrome de aniversário.",
      "Lacuna no genossociograma: ramo paterno entre 1952–1961 sem dados. Sugerido: protocolo 'Mapa de Segredos'.",
    ],
    protocols: ["Mapa de Segredos", "Lealidade Invisível", "Entrevista Transgeracional"],
    status: "next",
    accent: "forest",
  },
  {
    id: "s2",
    clientId: null,
    start: "11:30",
    end: "12:30",
    patient: "Paciente Exemplo B",
    initials: "PB",
    type: "Anamnese Sistêmica",
    sessionNumber: "Sessão 3",
    daysSinceFirst: 21,
    lastEvolution: "Primeira mencão ao irmão falecido. Abertura emocional significativa na segunda hora.",
    seals: ["retorno", "luto"],
    aiAlerts: [
      "Luto não elaborado identificado: óbito do irmão (2019) ainda não integrado narrativamente.",
      "Padrão preliminar: figuras masculinas ausêntes em 2 gerações — pai emigrou, avô faleceu precocemente.",
    ],
    protocols: ["Entrevista Transgeracional", "Linha do Tempo", "Projeto Sentido"],
    status: "later",
    accent: "forest",
  },
  {
    id: "s3",
    clientId: null,
    start: "15:00",
    end: "16:00",
    patient: "Paciente Exemplo C",
    initials: "PC",
    type: "Primeira Consulta",
    sessionNumber: "Sessão 1",
    daysSinceFirst: 0,
    lastEvolution: "Primeiro contato. Queixa: dificuldade de vínculo afetivo recorrente desde os 20 anos.",
    seals: ["primeira", "prioridade"],
    aiAlerts: [
      "Cliente nova: genossociograma ainda vazio. Sugerido: coleta de 3 gerações na sessão de hoje.",
      "Queixa de vínculo recorrente pode indicar padrão de abandono — verificar histórico de adoes/separações na família.",
    ],
    protocols: ["Anamnese Sistêmica", "Coleta de 3 Gerações", "Mapa Inicial"],
    status: "later",
    accent: "gold",
  },
];

type TimelineItem =
  | { time: string; label: string; kind: "session"; sessionId: string }
  | { time: string; label: string; kind: "ritual" | "gap"; icon: typeof CircleDot };

function buildTimeline(sessions: Session[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const first = sessions[0]?.start ?? "09:00";
  const preTime = shiftTime(first, -30);
  items.push({ time: preTime, label: "Preparação do dia", kind: "ritual", icon: Sunrise });
  sessions.forEach((s, i) => {
    items.push({ time: s.start, label: s.patient, kind: "session", sessionId: s.id });
    const next = sessions[i + 1];
    if (next) {
      const gapMin = minutesBetween(s.end, next.start);
      if (gapMin >= 45) {
        items.push({
          time: s.end,
          label: gapMin >= 90 ? "Almoço / pausa" : "Espaço para evolução",
          kind: "gap",
          icon: gapMin >= 90 ? Coffee : FileText,
        });
      }
    }
  });
  const last = sessions[sessions.length - 1];
  if (last) {
    items.push({ time: shiftTime(last.end, 30), label: "Finalizar evoluções", kind: "gap", icon: CheckCircle2 });
  }
  return items;
}

function shiftTime(hm: string, minutes: number): string {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m + minutes);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}


const QUICK_ACTIONS = [
  { label: "Nova sessão", icon: Plus },
  { label: "Nova evolução", icon: FileText },
  { label: "Novo genograma", icon: GitBranch },
  { label: "Gravar sessão", icon: Mic },
  { label: "Preparar atendimento", icon: Wand2 },
  { label: "Abrir biblioteca", icon: BookOpen },
];

/* ------------------------------ Page Component ---------------------------- */

function AgendaPage() {
  const query = useQuery({
    queryKey: ["agenda-data"],
    queryFn: () => getAgendaData(),
    staleTime: 60_000,
  });

  const { sessions, isFallback, orphanClients, prontuariosPendentes } = useMemo(() => {
    const dto = query.data;
    if (dto && dto.today.length > 0) {
      return {
        sessions: mapDtosToSessions(dto.today),
        isFallback: false,
        orphanClients: dto.orphanClients,
        prontuariosPendentes: dto.stats.prontuariosPendentes,
      };
    }
    return {
      sessions: FALLBACK_SESSIONS,
      isFallback: true,
      orphanClients: [] as OrphanClientDTO[],
      prontuariosPendentes: 1,
    };
  }, [query.data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? sessions[0]?.id ?? "";
  const selected = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const timeline = useMemo(() => buildTimeline(sessions), [sessions]);

  const stats = {
    total: sessions.length,
    primeira: sessions.filter((s) => s.type === "Primeira Consulta").length,
    retornos: sessions.filter((s) => s.type !== "Primeira Consulta").length,
    aniversarios: sessions.filter((s) => s.seals.includes("aniversario")).length,
    ocupado: `${sessions.length}h`,
    livre: `${Math.max(0, 8 - sessions.length)}h`,
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-transparent">
      {/* Breadcrumb */}
      <div className="border-b border-border/60 bg-white/60 backdrop-blur-sm px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Centro de Comando Clínico
        </p>
        {query.isLoading && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-forest/70 flex items-center gap-1.5 whitespace-nowrap">
            <Loader2 className="size-3 animate-spin" /> Carregando agenda
          </span>
        )}
        {!query.isLoading && isFallback && (
          <span className="max-w-full text-[10px] font-bold uppercase tracking-[0.15em] text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full whitespace-nowrap">
            Dados de exemplo — nenhuma sessão hoje
          </span>
        )}
        {query.isError && (
          <span className="max-w-full text-[10px] font-bold uppercase tracking-[0.15em] text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full whitespace-nowrap">
            Falha ao carregar — exibindo exemplo
          </span>
        )}
      </div>

      {/* Contextual Header */}
      <ContextualHeader stats={stats} />

      {/* Quick Actions Bar */}
      <div className="container-liz -mt-6 relative z-10">
        <div className="rounded-2xl border border-border/50 bg-white/90 backdrop-blur shadow-[0_10px_40px_-20px_rgba(60,20,80,0.25)] px-3 py-2 flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-primary/80 hover:text-forest hover:bg-forest-soft/50 transition-colors"
            >
              <a.icon className="size-3.5" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three-column workspace */}
      <div className="container-liz py-6 grid gap-5 2xl:grid-cols-[260px_minmax(0,1fr)_320px] lg:grid-cols-[240px_minmax(0,1fr)] grid-cols-1">
        {/* LEFT — Timeline */}
        <TimelineColumn
          timeline={timeline}
          sessions={sessions}
          selectedId={activeId}
          onSelect={setSelectedId}
        />

        {/* CENTER — Featured session */}
        {selected ? (
          <FeaturedSession session={selected} sessions={sessions} />
        ) : (
          <EmptyCenter />
        )}

        {/* RIGHT — IA + Painel */}
        <div className="lg:col-span-2 2xl:col-span-1">
          <RightPanel
            session={selected}
            orphanClients={orphanClients}
            prontuariosPendentes={prontuariosPendentes}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyCenter() {
  return (
    <div className="rounded-3xl bg-white/70 border border-dashed border-border/60 p-12 text-center">
      <CalendarIcon className="size-10 text-muted-foreground/40 mx-auto mb-3" />
      <h3 className="font-serif text-xl font-bold text-primary">Nenhuma sessão agendada</h3>
      <p className="text-sm text-muted-foreground mt-2">
        Quando você criar uma nova sessão, ela aparecerá aqui com todos os detalhes clínicos.
      </p>
    </div>
  );
}


/* --------------------------------- Header --------------------------------- */

function ContextualHeader({ stats }: { stats: { total: number; primeira: number; retornos: number; aniversarios: number; ocupado: string; livre: string } }) {
  return (
    <div className="relative overflow-hidden">
      <div className="block-forest px-6 pt-10 pb-16 relative">
        {/* subtle grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "3px 3px",
          }}
        />
        <div className="container-liz relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-gold">
                <Sunrise className="size-4" />
                <p className="text-[11px] font-bold uppercase tracking-[0.35em]">
                  Segunda-feira · 6 de julho
                </p>
              </div>
              <h1 className="mt-3 font-serif text-4xl md:text-5xl font-bold text-archive leading-tight">
                Bom dia, <span className="text-gold">Letícia</span>.
              </h1>
              <p className="mt-3 text-[15px] text-archive/70 leading-relaxed">
                Hoje você acompanhará <strong className="text-archive">3 histórias familiares</strong>.
                Um dos pacientes está em <strong className="text-gold">data ativa de Síndrome de Aniversário</strong> —
                preparei hipóteses, protocolos e leituras para você.
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2 text-[12px] text-white/60 font-semibold">
                <Sparkles className="size-4 text-gold" />
                IA Clínica ativa
              </div>
              <Button size="lg" variant="hero" className="shadow-xl">
                <Play className="size-4 fill-current" />
                Iniciar dia
              </Button>
            </div>
          </div>

          {/* Stat pills */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-6 gap-2">
            <HeaderStat icon={Users} label="Atendimentos" value={stats.total.toString()} accent="forest" />
            <HeaderStat icon={Sunrise} label="Primeira consulta" value={stats.primeira.toString()} accent="gold" />
            <HeaderStat icon={TimerReset} label="Retornos" value={stats.retornos.toString()} accent="forest" />
            <HeaderStat icon={Cake} label="Aniversários" value={stats.aniversarios.toString()} accent="rose" />
            <HeaderStat icon={Clock} label="Ocupado" value={stats.ocupado} accent="forest" />
            <HeaderStat icon={Leaf} label="Tempo livre" value={stats.livre} accent="gold" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ icon: Icon, label, value, accent }: { icon: typeof Clock; label: string; value: string; accent: "forest" | "gold" | "rose" }) {
  const accentClass = {
    forest: "text-archive/70",
    gold: "text-gold",
    rose: "text-rose-300",
  }[accent];
  return (
    <div className="rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/10 px-4 py-3 shadow-inner">
      <div className={`flex items-center gap-1.5 ${accentClass}`}>
        <Icon className="size-3.5" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className="mt-2 font-serif text-2xl font-bold text-archive">{value}</p>
    </div>
  );
}

/* -------------------------------- Timeline -------------------------------- */

function TimelineColumn({
  timeline,
  sessions,
  selectedId,
  onSelect,
}: {
  timeline: TimelineItem[];
  sessions: Session[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <CalendarIcon className="size-3.5" /> Timeline do dia
        </h2>
        <span className="text-[10px] text-muted-foreground/70 font-semibold">Hoje</span>
      </div>

      <div className="relative rounded-2xl bg-white/70 backdrop-blur border border-border/50 shadow-sm p-4">
        {/* vertical line */}
        <div className="absolute left-[38px] top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

        <ul className="space-y-3 relative">
          {timeline.map((item, i) => {
            const isSession = item.kind === "session";
            const session = isSession ? sessions.find((s) => s.id === item.sessionId) : null;
            const isSelected = session?.id === selectedId;
            const Icon = isSession ? CircleDot : (item as { icon: typeof CircleDot }).icon;


            return (
              <li key={i}>
                <button
                  disabled={!isSession}
                  onClick={() => session && onSelect(session.id)}
                  className={`group w-full text-left flex items-start gap-3 rounded-xl px-2 py-2 transition-all ${
                    isSession
                      ? isSelected
                        ? "bg-forest/[0.06] ring-1 ring-forest/20"
                        : "hover:bg-forest-soft/40 cursor-pointer"
                      : "opacity-70"
                  }`}
                >
                  <span className="text-[10px] font-black tabular-nums text-muted-foreground w-8 pt-1 shrink-0">
                    {item.time}
                  </span>
                  <span
                    className={`size-6 rounded-full flex items-center justify-center shrink-0 border ${
                      isSession
                        ? isSelected
                          ? "bg-forest text-white border-forest"
                          : "bg-white border-forest/30 text-forest"
                        : "bg-cream border-border text-muted-foreground/70"
                    }`}
                  >
                    <Icon className="size-3" />
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p
                      className={`text-[13px] leading-tight truncate ${
                        isSession
                          ? "font-bold text-primary"
                          : "font-medium text-muted-foreground italic"
                      }`}
                    >
                      {item.label}
                    </p>
                    {isSession && session && (
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">
                        {session.type}
                        {session.sessionNumber ? ` · ${session.sessionNumber}` : ""}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mini weekly overview */}
      <div className="rounded-2xl bg-white/70 backdrop-blur border border-border/50 shadow-sm p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Semana
        </p>
        <div className="grid grid-cols-5 gap-1">
          {[
            { d: "S", n: 6, active: true, load: 3 },
            { d: "T", n: 7, load: 2 },
            { d: "Q", n: 8, load: 4 },
            { d: "Q", n: 9, load: 1 },
            { d: "S", n: 10, load: 3 },
          ].map((d) => (
            <div
              key={d.n}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-center ${
                d.active ? "bg-forest text-white" : "bg-cream text-primary"
              }`}
            >
              <span className="text-[9px] font-bold opacity-70">{d.d}</span>
              <span className="font-serif text-sm font-bold">{d.n}</span>
              <div className="flex gap-0.5 mt-0.5">
                {Array.from({ length: d.load }).map((_, i) => (
                  <span key={i} className={`size-1 rounded-full ${d.active ? "bg-white/70" : "bg-forest/40"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* --------------------------- Featured Session Card ------------------------ */

function FeaturedSession({ session, sessions }: { session: Session; sessions: Session[] }) {
  // Progressive genogram load — only fetches when a real client is attached.
  const genogramQuery = useQuery({
    queryKey: ["client-genogram", session.clientId],
    queryFn: () => getClientGenogram({ data: { clientId: session.clientId! } }),
    enabled: !!session.clientId,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const genogramAlerts = genogramQuery.data?.alerts ?? [];
  const mergedAlerts = [
    ...session.aiAlerts,
    ...genogramAlerts.map((a) => a.message),
  ];

  const accentBar = {
    forest: "bg-gradient-to-b from-forest to-forest",
    forest: "bg-gradient-to-b from-forest to-forest",
    gold: "bg-gradient-to-b from-gold to-gold/50",
  }[session.accent];

  const initialsBg = {
    forest: "bg-forest text-white",
    forest: "bg-forest text-white",
    gold: "bg-gold text-primary",
  }[session.accent];

  return (
    <main className="space-y-5">
      {/* Rich patient card */}
      <article className="relative rounded-3xl bg-white border border-border/60 shadow-[0_20px_60px_-30px_rgba(60,20,80,0.35)] overflow-hidden">
        {/* accent bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBar}`} />

        <div className="p-6 md:p-8 pl-8 md:pl-10">
          {/* Top row: time + status */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1 font-serif">
                <span className="text-3xl font-bold text-primary tabular-nums">{session.start}</span>
                <span className="text-muted-foreground text-sm">—</span>
                <span className="text-2xl font-semibold text-muted-foreground tabular-nums">{session.end}</span>
              </div>
              {session.status === "next" && (
                <Badge className="bg-forest text-white border-transparent text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse">
                  Próxima sessão
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {session.seals.map((s) => {
                const meta = SEAL_META[s];
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}
                  >
                    <meta.Icon className="size-2.5" />
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Patient identity */}
          <div className="flex items-start gap-5">
            <div
              className={`size-20 md:size-24 rounded-2xl ${initialsBg} flex items-center justify-center font-serif text-2xl md:text-3xl font-bold shadow-lg shrink-0 relative`}
            >
              {session.initials}
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-white border-2 border-cream flex items-center justify-center">
                <CircleDot className="size-3 text-forest" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary leading-tight">
                {session.patient}
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground font-semibold">
                {session.type}
                {session.sessionNumber && <> · {session.sessionNumber}</>}
                {session.daysSinceFirst !== undefined && (
                  <> · Primeira consulta há {session.daysSinceFirst} dias</>
                )}
              </p>

              {session.lastEvolution && (
                <div className="mt-4 rounded-xl bg-cream/70 border border-border/40 p-3.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">
                    Última evolução
                  </p>
                  <p className="font-serif italic text-[14px] text-primary/90 leading-relaxed">
                    "{session.lastEvolution}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AI alerts */}
          <div className="mt-6 rounded-2xl border border-forest/15 bg-gradient-to-br from-forest/[0.03] to-forest/[0.05] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-6 rounded-full bg-forest/10 flex items-center justify-center">
                <Sparkles className="size-3 text-forest" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest">
                IA Clínica detectou
              </p>
              {genogramQuery.isLoading && session.clientId && (
                <Loader2 className="size-3 animate-spin text-forest/60 ml-1" />
              )}
            </div>
            {mergedAlerts.length > 0 ? (
              <ul className="space-y-2">
                {mergedAlerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-primary/85 leading-relaxed">
                    <AlertTriangle className="size-3.5 text-gold shrink-0 mt-1" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            ) : genogramQuery.isLoading ? (
              <p className="text-[12px] text-muted-foreground italic">Analisando genossociograma…</p>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">
                Nenhum padrão detectado — genossociograma completo e sem alertas por regra.
              </p>
            )}
          </div>


          {/* Protocols */}
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2.5">
              Protocolos sugeridos
            </p>
            <div className="flex flex-wrap gap-2">
              {session.protocols.map((p) => (
                <button
                  key={p}
                  className="group inline-flex items-center gap-2 rounded-full border border-forest/30 bg-forest-soft/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-forest hover:bg-forest/15 hover:border-forest/50 transition-all"
                >
                  <ClipboardList className="size-3.5" />
                  {p}
                  <ChevronRight className="size-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-7 flex flex-wrap gap-2 pt-5 border-t border-border/40">
            <Button size="lg" className="font-bold shadow-md">
              <Play className="size-4 fill-current" />
              Iniciar sala
            </Button>
            <Button variant="outline" size="lg" className="font-bold">
              <Wand2 className="size-4" />
              Preparar sessão
            </Button>
            {session.clientId ? (
              <Link
                to="/app/paciente/$id"
                params={{ id: session.clientId }}
                className="inline-flex items-center gap-2 h-11 px-4 rounded-md text-[14px] font-semibold text-primary/80 hover:text-forest hover:bg-forest-soft/50 transition-colors"
              >
                <FileText className="size-4" />
                Abrir Dossiê
              </Link>
            ) : (
              <Button variant="ghost" size="lg" className="font-semibold" disabled title="Sessão sem cliente vinculado">
                <FileText className="size-4" />
                Prontuário
              </Button>
            )}
            <Link
              to="/app/genossociogramas"
              className="inline-flex items-center gap-2 h-11 px-4 rounded-md text-[14px] font-semibold text-primary/80 hover:text-forest hover:bg-forest-soft/50 transition-colors"
            >
              <GitBranch className="size-4" />
              Genossociograma
            </Link>
            <Button variant="ghost" size="lg" className="font-semibold">
              <ArrowRight className="size-4" />
              Agendar retorno
            </Button>
          </div>
        </div>
      </article>

      {/* Mini árvore preview + próximas */}
      <div className="grid md:grid-cols-2 gap-4">
        <MiniTreePreview session={session} genogram={genogramQuery.data} isLoading={genogramQuery.isLoading} />
        <UpcomingList currentId={session.id} sessions={sessions} />
      </div>
    </main>
  );
}

function MiniTreePreview({ session, genogram, isLoading }: { session: Session; genogram: ClientGenogramDTO | undefined; isLoading: boolean }) {
  const hasData = !!genogram && genogram.hasGenogram;
  const totalPersons = genogram?.totalPersons ?? 0;

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-border/50 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
          <GitBranch className="size-3.5" /> Genossociograma
        </p>
        <span className="text-[10px] text-muted-foreground">
          {hasData ? `${totalPersons} pessoas` : isLoading ? "carregando…" : "sem dados"}
        </span>
      </div>

      {isLoading && !genogram ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground/60">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : hasData ? (
        <RealMiniTree genogram={genogram!} session={session} />
      ) : (
        <div className="h-32 flex flex-col items-center justify-center text-center px-4">
          <GitBranch className="size-6 text-muted-foreground/40 mb-2" />
          <p className="text-[11.5px] text-muted-foreground italic leading-snug">
            {session.clientId
              ? "Genossociograma ainda não iniciado para este cliente."
              : "Sem cliente vinculado à sessão."}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1"><Circle className="size-2 fill-gold text-gold" /> Paciente</span>
          <span className="flex items-center gap-1"><Circle className="size-2 fill-forest text-forest" /> Masc.</span>
          <span className="flex items-center gap-1"><Circle className="size-2 fill-forest text-forest" /> Fem.</span>
        </div>
        <Link
          to="/app/genossociogramas"
          className="text-forest font-bold hover:underline flex items-center gap-1"
        >
          Abrir <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function RealMiniTree({ genogram, session }: { genogram: ClientGenogramDTO; session: Session }) {
  const { proband, parents, grandparents } = genogram.generations;
  const father = parents.find((p) => p.role === "father");
  const mother = parents.find((p) => p.role === "mother");
  const patGf = grandparents.find((p) => p.role === "grandfather");
  const patGm = grandparents.find((p) => p.role === "grandmother");
  const matGf = grandparents.filter((p) => p.role === "grandfather")[1] ?? null;
  const matGm = grandparents.filter((p) => p.role === "grandmother")[1] ?? null;

  const Node = ({
    person,
    x,
    y,
    highlight,
  }: {
    person: GenogramPersonDTO | null | undefined;
    x: number;
    y: number;
    highlight?: boolean;
  }) => {
    if (!person) {
      return (
        <circle cx={x} cy={y} r="10" className="fill-cream stroke-border" strokeWidth="1" strokeDasharray="2 2" />
      );
    }
    const isMasc = person.gender?.toLowerCase().startsWith("m") ?? (person.role === "father" || person.role === "grandfather");
    const isFem = person.gender?.toLowerCase().startsWith("f") ?? (person.role === "mother" || person.role === "grandmother");
    const stroke = highlight ? "stroke-gold" : isMasc ? "stroke-forest/60" : isFem ? "stroke-forest/70" : "stroke-border";
    const fill = highlight ? "fill-gold/25" : isMasc ? "fill-forest/12" : isFem ? "fill-forest/20" : "fill-cream";
    const sw = highlight ? 2 : 1.5;
    const commonProps = { className: `${fill} ${stroke}`, strokeWidth: sw } as const;
    return isFem && !isMasc ? (
      <>
        <circle cx={x} cy={y} r="11" {...commonProps} />
        {person.isDeceased && (
          <line x1={x - 10} y1={y - 10} x2={x + 10} y2={y + 10} className="stroke-slate-500" strokeWidth="1.2" />
        )}
      </>
    ) : (
      <>
        <rect x={x - 11} y={y - 11} width="22" height="22" rx="3" {...commonProps} />
        {person.isDeceased && (
          <line x1={x - 11} y1={y - 11} x2={x + 11} y2={y + 11} className="stroke-slate-500" strokeWidth="1.2" />
        )}
      </>
    );
  };

  return (
    <svg viewBox="0 0 300 160" className="w-full h-32">
      {/* Generation lines */}
      <line x1="20" y1="55" x2="280" y2="55" className="stroke-border/40" strokeDasharray="2 3" />
      <line x1="60" y1="105" x2="240" y2="105" className="stroke-border/40" strokeDasharray="2 3" />

      {/* Grandparents row */}
      <Node person={patGf} x={35} y={25} />
      <Node person={patGm} x={95} y={25} />
      <Node person={matGf} x={205} y={25} />
      <Node person={matGm} x={265} y={25} />
      {/* couple links */}
      <line x1="46" y1="25" x2="84" y2="25" className="stroke-border" />
      <line x1="216" y1="25" x2="254" y2="25" className="stroke-border" />
      {/* to parents */}
      <line x1="65" y1="36" x2="90" y2="75" className="stroke-border" />
      <line x1="235" y1="36" x2="210" y2="75" className="stroke-border" />

      {/* Parents row */}
      <Node person={father} x={90} y={85} />
      <Node person={mother} x={210} y={85} />
      <line x1="101" y1="85" x2="199" y2="85" className="stroke-border" />

      {/* to proband */}
      <line x1="150" y1="85" x2="150" y2="120" className="stroke-border" />

      {/* Proband */}
      <Node person={proband ?? { ...({} as GenogramPersonDTO), id: "p", fullName: session.patient, preferredName: null, gender: null, isProband: true, isDeceased: false, hasBirthDate: false, hasDeathDate: false, relationshipTo: null, role: "proband" }} x={150} y={135} highlight />
      <text x={150} y={155} textAnchor="middle" className="fill-primary font-bold" fontSize="9">
        {session.initials}
      </text>
    </svg>
  );
}

function UpcomingList({ currentId, sessions }: { currentId: string; sessions: Session[] }) {
  const others = sessions.filter((s) => s.id !== currentId);

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-border/50 shadow-sm p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-4 flex items-center gap-2">
        <Clock className="size-3.5" /> Próximas hoje
      </p>
      <ul className="space-y-3">
        {others.map((s) => {
          const inner = (
            <>
              <div className="size-10 rounded-xl bg-cream border border-border/40 flex items-center justify-center font-serif font-bold text-primary text-sm shrink-0">
                {s.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-primary text-[13px] truncate">{s.patient}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.start} · {s.type}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/50" />
            </>
          );
          return (
            <li key={s.id} className="border-b border-border/30 last:border-0">
              {s.clientId ? (
                <Link
                  to="/app/paciente/$id"
                  params={{ id: s.clientId }}
                  className="flex items-center gap-3 py-2 rounded-lg hover:bg-forest-soft/40 transition-colors -mx-1 px-1"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 py-2 opacity-70 cursor-not-allowed" title="Sessão sem cliente vinculado">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------- Right Panel ----------------------------- */

function RightPanel({
  session,
  orphanClients,
  prontuariosPendentes,
}: {
  session: Session;
  orphanClients: OrphanClientDTO[];
  prontuariosPendentes: number;
}) {

  return (
    <aside className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
      {/* IA Clínica briefing */}
      <div className="rounded-2xl bg-gradient-to-br from-forest via-forest to-forest/90 text-white p-5 shadow-lg relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-10 -right-10 size-40 rounded-full bg-gold/20 blur-3xl pointer-events-none"
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <Brain className="size-4 text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">IA Clínica</p>
              <p className="text-[11px] text-white/70">Briefing do dia</p>
            </div>
          </div>

          <p className="font-serif text-[14px] leading-relaxed text-white/90">
            Preparei <strong className="text-gold">3 hipóteses clínicas</strong> para o atendimento das 09h com {session.patient.split(" ")[0]}. Há uma possível <strong className="text-gold">coincidência de datas</strong> a investigar com a linhagem paterna.
          </p>

          <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-[12px] text-white/80">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-gold shrink-0 mt-0.5" />
              <span>Sugerido: <em>Mapa de Segredos</em> antes da 4ª sessão.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-3.5 text-gold shrink-0 mt-0.5" />
              <span>2 clientes sem próxima sessão agendada.</span>
            </div>
          </div>

          <Button variant="hero" size="sm" className="mt-4 w-full font-bold">
            <Wand2 className="size-3.5" />
            Ver briefing completo
          </Button>
        </div>
      </div>

      {/* Pendências */}
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-border/50 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="size-3.5" /> Pendências
        </p>
        <ul className="space-y-2.5 text-[13px]">
          <PendingRow label="Prontuários sem evolução" count={prontuariosPendentes} tone="rose" />
          <PendingRow label="Checklists não preenchidos" count={2} tone="gold" />
          <PendingRow label="Genogramas incompletos" count={3} tone="forest" />
          <PendingRow label="Clientes sem retorno" count={orphanClients.length} tone="forest" />
        </ul>
        {orphanClients.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
            {orphanClients.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-[12px]">
                <span className="text-primary/80 font-medium truncate">{c.name}</span>
                <button className="text-forest font-bold hover:underline">Agendar</button>
              </li>
            ))}
          </ul>
        )}
      </div>


      {/* Receita + tempo */}
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-border/50 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Balanço do dia
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-primary/80 font-semibold">
              <DollarSign className="size-3.5 text-emerald-600" /> Receita prevista
            </span>
            <span className="font-serif text-lg font-bold text-primary">R$ 1.350</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-primary/80 font-semibold">
              <Clock className="size-3.5 text-forest" /> Ocupado
            </span>
            <span className="font-mono text-sm font-bold text-primary">4h 00m</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-primary/80 font-semibold">
              <Leaf className="size-3.5 text-emerald-600" /> Tempo livre
            </span>
            <span className="font-mono text-sm font-bold text-emerald-700">2h 40m</span>
          </div>
          <div className="h-1.5 bg-cream rounded-full overflow-hidden mt-2">
            <div className="h-full w-[60%] bg-gradient-to-r from-forest to-forest rounded-full" />
          </div>
        </div>
      </div>

      {/* Notas rápidas */}
      <div className="rounded-2xl bg-gradient-to-br from-cream to-white border border-border/50 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2 flex items-center gap-2">
          <FileText className="size-3.5" /> Nota rápida
        </p>
        <textarea
          placeholder="Uma linha, uma intuição, uma hipótese..."
          className="w-full bg-transparent text-[13px] font-serif text-primary/90 placeholder:text-muted-foreground/60 resize-none focus:outline-none min-h-[60px]"
        />
      </div>
    </aside>
  );
}

function PendingRow({ label, count, tone }: { label: string; count: number; tone: "rose" | "gold" | "forest" | "forest" }) {
  const toneClass = {
    rose: "bg-rose-100 text-rose-700",
    gold: "bg-amber-100 text-amber-700",
    forest: "bg-forest/15 text-forest",
    forest: "bg-forest/10 text-forest",
  }[tone];
  return (
    <li className="flex items-center justify-between group cursor-pointer hover:bg-cream/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
      <span className="text-primary/85 font-medium">{label}</span>
      <span className={`inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full text-[11px] font-black ${toneClass}`}>
        {count}
      </span>
    </li>
  );
}

/* ---------------------------- DTO → UI Mapping ---------------------------- */

function mapDtosToSessions(dtos: AgendaSessionDTO[]): Session[] {
  const accents: Session["accent"][] = ["forest", "forest", "gold"];
  const now = Date.now();
  return dtos.map((d, i) => {
    const seals: Seal[] = [];
    if (d.isFirst) seals.push("primeira");
    else seals.push("retorno");
    if (d.status === "processing" || d.status === "failed") seals.push("prioridade");

    const startTs = new Date(d.startISO).getTime();
    const isNext = startTs >= now && dtos.slice(0, i).every((p) => new Date(p.startISO).getTime() < now);

    const protocols: string[] = d.isFirst
      ? ["Anamnese Sistêmica", "Coleta de 3 Gerações", "Mapa Inicial"]
      : ["Entrevista Transgeracional", "Linha do Tempo", "Mapa de Segredos"];

    return {
      id: d.id,
      clientId: d.clientId || null,
      start: d.start,
      end: d.end,
      patient: d.patient,
      initials: d.initials || "?",
      type: d.type,
      sessionNumber: d.isFirst ? undefined : `Sessão ${d.sessionNumber}`,
      daysSinceFirst: d.daysSinceFirst ?? undefined,
      lastEvolution: d.lastEvolution ?? undefined,
      seals,
      aiAlerts: [], // populated in Commit 4 (real IA)
      protocols,
      status: isNext ? "next" : "later",
      accent: accents[i % accents.length],
    };
  });
}

