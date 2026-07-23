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
  TimerReset,
  Users,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentHeader } from "@/components/ui/document-header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getAgendaData, type AgendaSessionDTO, type OrphanClientDTO } from "@/lib/agenda.functions";
import {
  getClientGenogram,
  type ClientGenogramDTO,
  type GenogramPersonDTO,
} from "@/lib/genogram.functions";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
});

/* ------------------------------ Selos Clínicos ---------------------------- */

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
  primeira: {
    label: "Primeira consulta",
    className: "bg-forest/10 text-forest border-forest/25",
    Icon: Sunrise,
  },
  retorno: {
    label: "Retorno",
    className: "bg-forest/8 text-forest border-forest/20",
    Icon: TimerReset,
  },
  crianca: {
    label: "Criança",
    className: "bg-gold-muted/50 text-bronze border-gold/40",
    Icon: Baby,
  },
  prioridade: {
    label: "Alta prioridade",
    className: "bg-clinical-critical/10 text-clinical-critical border-clinical-critical/30",
    Icon: Flame,
  },
  luto: {
    label: "Luto",
    className: "bg-graphite/10 text-graphite border-graphite/25",
    Icon: Moon,
  },
  evolucao: {
    label: "Evolução concluída",
    className: "bg-clinical-positive/10 text-clinical-positive border-clinical-positive/25",
    Icon: Leaf,
  },
  projeto: {
    label: "Projeto Sentido",
    className: "bg-olive/10 text-olive border-olive/30",
    Icon: Waves,
  },
  aniversario: {
    label: "Síndrome de Aniversário",
    className: "bg-terracotta/10 text-terracotta border-terracotta/30",
    Icon: Cake,
  },
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
  accent: "forest" | "rose" | "gold";
};

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
    items.push({
      time: shiftTime(last.end, 30),
      label: "Finalizar evoluções",
      kind: "gap",
      icon: CheckCircle2,
    });
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

/* Atalhos apenas para destinos que existem — a interface não promete o que não entrega */
const QUICK_ACTIONS = [
  { label: "Arquivo de clientes", icon: Users, to: "/app/clientes" },
  { label: "Novo genograma", icon: GitBranch, to: "/app/genossociogramas" },
  { label: "Linhas de herança", icon: TimerReset, to: "/app/linha-do-tempo" },
  { label: "Abrir biblioteca", icon: BookOpen, to: "/app/biblioteca" },
] as const;

/* ------------------------------ Page Component ---------------------------- */

function AgendaPage() {
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

  const firstName =
    profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Pesquisadora";

  const query = useQuery({
    queryKey: ["agenda-data"],
    queryFn: () => getAgendaData(),
    staleTime: 60_000,
  });

  const { sessions, orphanClients, prontuariosPendentes } = useMemo(() => {
    const dto = query.data;
    return {
      sessions: dto ? mapDtosToSessions(dto.today) : [],
      orphanClients: dto?.orphanClients ?? ([] as OrphanClientDTO[]),
      prontuariosPendentes: dto?.stats.prontuariosPendentes ?? 0,
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

  const hasSessions = sessions.length > 0;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-transparent">
      {/* Contextual Header */}
      <ContextualHeader
        stats={stats}
        firstName={firstName}
        isLoading={query.isLoading}
        isError={query.isError}
        hasSessions={hasSessions}
      />

      {/* Quick Actions Bar */}
      <div className="container-liz -mt-6 relative z-10">
        <div className="surface shadow-surface flex flex-wrap gap-1 rounded-2xl px-3 py-2 backdrop-blur">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-primary/80 no-underline hover:text-forest hover:bg-forest-soft/50 transition-colors"
            >
              <a.icon className="size-3.5" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {hasSessions && selected ? (
        /* Three-column workspace */
        <div className="container-liz py-6 grid gap-5 2xl:grid-cols-[260px_minmax(0,1fr)_320px] lg:grid-cols-[240px_minmax(0,1fr)] grid-cols-1">
          {/* LEFT — Timeline */}
          <TimelineColumn
            timeline={timeline}
            sessions={sessions}
            selectedId={activeId}
            onSelect={setSelectedId}
          />

          {/* CENTER — Featured session */}
          <FeaturedSession session={selected} sessions={sessions} />

          {/* RIGHT — IA + Painel */}
          <div className="lg:col-span-2 2xl:col-span-1">
            <RightPanel
              session={selected}
              stats={stats}
              orphanClients={orphanClients}
              prontuariosPendentes={prontuariosPendentes}
            />
          </div>
        </div>
      ) : (
        <EmptyDay isLoading={query.isLoading} orphanClients={orphanClients} />
      )}
    </div>
  );
}

/* Estado vazio editorial — nenhum dado fictício */
function EmptyDay({
  isLoading,
  orphanClients,
}: {
  isLoading: boolean;
  orphanClients: OrphanClientDTO[];
}) {
  if (isLoading) {
    return (
      <div className="container-liz max-w-4xl py-12">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton mt-4 h-24 w-full" />
      </div>
    );
  }
  return (
    <div className="container-liz relative max-w-4xl py-12">
      {/* Relógio de bolso do acervo — o tempo do dia em aberto */}
      <img
        src="/assets/renders/relogio-de-bolso.jpg"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute top-6 right-0 hidden w-[210px] mix-blend-darken [mask-image:radial-gradient(120%_120%_at_50%_45%,black_58%,transparent_90%)] md:block"
      />
      <section>
        <h2 className="mb-6 font-sans text-[11px] font-bold tracking-widest text-warm-gray uppercase">
          Sessões de hoje
        </h2>
        <div className="border-b border-ink/10 py-4 md:pr-56">
          <p className="m-0 font-serif text-xl text-ink/55 italic md:text-2xl">
            Nenhuma sessão registrada para hoje. O dia está aberto para pesquisa e escrita.
          </p>
        </div>
        <div className="mt-8">
          <Link to="/app/clientes">
            <Button
              variant="ghost"
              className="group px-0 font-sans font-medium text-forest hover:bg-forest/5"
            >
              Acessar arquivo de clientes
              <ChevronRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {orphanClients.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 font-sans text-[11px] font-bold tracking-widest text-warm-gray uppercase">
            Clientes sem retorno marcado
          </h2>
          <ul className="m-0 list-none p-0">
            {orphanClients.slice(0, 5).map((c) => (
              <li key={c.id} className="border-b border-ink/10 py-3.5">
                <Link
                  to="/app/clientes/$clientId"
                  params={{ clientId: c.id }}
                  search={{ from: "agenda" }}
                  className="group flex items-center justify-between gap-4 no-underline"
                >
                  <span className="font-serif text-lg text-ink transition-colors group-hover:text-forest-soft">
                    {c.name}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-ink/30 transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* --------------------------------- Header --------------------------------- */

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function ContextualHeader({
  stats,
  firstName,
  isLoading,
  isError,
  hasSessions,
}: {
  stats: {
    total: number;
    primeira: number;
    retornos: number;
    aniversarios: number;
    ocupado: string;
    livre: string;
  };
  firstName: string;
  isLoading: boolean;
  isError: boolean;
  hasSessions: boolean;
}) {
  return (
    <DocumentHeader
      breadcrumb="Agenda Clínica"
      title={
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center size-14 shrink-0 rounded-lg bg-forest text-gold font-serif text-3xl font-bold shadow-sm">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className="tracking-tight">
            {greetingByHour()}, {firstName}.
          </span>
        </div>
      }
      subtitle={
        <div className="font-sans font-normal text-ink/70 text-[15px]">
          {hasSessions ? (
            <>
              Hoje você acompanhará{" "}
              <strong>
                {stats.total} {stats.total === 1 ? "história familiar" : "histórias familiares"}
              </strong>
              .
              {stats.aniversarios > 0 && (
                <>
                  <br />
                  {stats.aniversarios === 1
                    ? "Um dos pacientes está em "
                    : `${stats.aniversarios} pacientes estão em `}
                  <strong>data ativa de Síndrome de Aniversário</strong>.
                </>
              )}
            </>
          ) : (
            <>Nenhuma sessão marcada para hoje.</>
          )}
        </div>
      }
      actions={
        <div className="flex justify-end">
          {isLoading && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50 flex items-center gap-1.5 whitespace-nowrap">
              <Loader2 className="size-3 animate-spin" /> Carregando
            </span>
          )}
          {isError && (
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-clinical-critical bg-clinical-critical/10 border border-clinical-critical/30 px-2 py-0.5 rounded-full whitespace-nowrap">
              Erro de conexão — tentando de novo
            </span>
          )}
        </div>
      }
    >
      {hasSessions && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <HeaderStat
            icon={Users}
            label="Atendimentos"
            value={stats.total.toString()}
            accent="forest"
          />
          <HeaderStat
            icon={Sunrise}
            label="Primeira consulta"
            value={stats.primeira.toString()}
            accent="gold"
          />
          <HeaderStat
            icon={TimerReset}
            label="Retornos"
            value={stats.retornos.toString()}
            accent="forest"
          />
          <HeaderStat
            icon={Cake}
            label="Aniversários"
            value={stats.aniversarios.toString()}
            accent="terracotta"
          />
          <HeaderStat icon={Clock} label="Ocupado" value={stats.ocupado} accent="forest" />
          <HeaderStat icon={Leaf} label="Tempo livre" value={stats.livre} accent="gold" />
        </div>
      )}
    </DocumentHeader>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent: "forest" | "gold" | "terracotta";
}) {
  const accentClass = {
    forest: "text-ink/60",
    gold: "text-gold",
    terracotta: "text-terracotta",
  }[accent];
  return (
    <div className="rounded-xl bg-surface-document/70 backdrop-blur-sm border border-border/40 px-4 py-3 shadow-sm">
      <div className={`flex items-center gap-1.5 ${accentClass}`}>
        <Icon className="size-3.5" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]">{label}</p>
      </div>
      <p className="mt-2 font-serif text-2xl font-bold text-ink">{value}</p>
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

      <div className="relative rounded-2xl bg-surface-document/80 backdrop-blur border border-border/50 shadow-sm p-4">
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
                          : "bg-surface-document border-forest/30 text-forest"
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
  const mergedAlerts = [...session.aiAlerts, ...genogramAlerts.map((a) => a.message)];

  const accentBar = {
    forest: "bg-gradient-to-b from-forest to-forest",
    rose: "bg-clinical-critical",
    gold: "bg-gradient-to-b from-gold to-gold/50",
  }[session.accent];

  const initialsBg = {
    forest: "bg-forest text-white",
    rose: "bg-clinical-critical text-white",
    gold: "bg-gold text-primary",
  }[session.accent];

  return (
    <main className="space-y-5">
      {/* Rich patient card */}
      <article className="relative rounded-3xl bg-surface-document border border-border/60 shadow-dossier overflow-hidden">
        {/* accent bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBar}`} />

        <div className="p-6 md:p-8 pl-8 md:pl-10">
          {/* Top row: time + status */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1 font-serif">
                <span className="text-3xl font-bold text-primary tabular-nums">
                  {session.start}
                </span>
                <span className="text-muted-foreground text-sm">—</span>
                <span className="text-2xl font-semibold text-muted-foreground tabular-nums">
                  {session.end}
                </span>
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
              <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-surface-document border-2 border-cream flex items-center justify-center">
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
                Padrões detectados
              </p>
              {genogramQuery.isLoading && session.clientId && (
                <Loader2 className="size-3 animate-spin text-forest/60 ml-1" />
              )}
            </div>
            {mergedAlerts.length > 0 ? (
              <ul className="space-y-2">
                {mergedAlerts.map((alert, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[13px] text-primary/85 leading-relaxed"
                  >
                    <AlertTriangle className="size-3.5 text-gold shrink-0 mt-1" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            ) : genogramQuery.isLoading ? (
              <p className="text-[12px] text-muted-foreground italic">
                Analisando genossociograma…
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">
                Nenhum padrão detectado — genossociograma completo e sem alertas por regra.
              </p>
            )}
          </div>

          {/* Protocols — sugestões de leitura, não botões */}
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2.5">
              Protocolos sugeridos
            </p>
            <div className="flex flex-wrap gap-2">
              {session.protocols.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-forest-soft/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-forest"
                >
                  <ClipboardList className="size-3.5" />
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Actions — apenas destinos reais */}
          <div className="mt-7 flex flex-wrap gap-2 pt-5 border-t border-border/40">
            {session.clientId ? (
              <Button size="lg" className="font-bold shadow-md" asChild>
                <Link
                  to="/app/clientes/$clientId"
                  params={{ clientId: session.clientId }}
                  search={{ from: "agenda" }}
                >
                  <FileText className="size-4" />
                  Abrir Dossiê
                </Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                className="font-semibold"
                disabled
                title="Sessão sem cliente vinculado"
              >
                <FileText className="size-4" />
                Sem cliente vinculado
              </Button>
            )}
            <Link
              to="/app/genossociogramas"
              className="inline-flex items-center gap-2 h-11 px-4 rounded-md text-[14px] font-semibold text-primary/80 hover:text-forest hover:bg-forest-soft/50 transition-colors"
            >
              <GitBranch className="size-4" />
              Genossociograma
            </Link>
          </div>
        </div>
      </article>

      {/* Mini árvore preview + próximas */}
      <div className="grid md:grid-cols-2 gap-4">
        <MiniTreePreview
          session={session}
          genogram={genogramQuery.data}
          isLoading={genogramQuery.isLoading}
        />
        <UpcomingList currentId={session.id} sessions={sessions} />
      </div>
    </main>
  );
}

function MiniTreePreview({
  session,
  genogram,
  isLoading,
}: {
  session: Session;
  genogram: ClientGenogramDTO | undefined;
  isLoading: boolean;
}) {
  const hasData = !!genogram && genogram.hasGenogram;
  const totalPersons = genogram?.totalPersons ?? 0;

  return (
    <div className="rounded-2xl bg-surface-document/85 backdrop-blur border border-border/50 shadow-sm p-5">
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
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-gold text-gold" /> Paciente
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-forest text-forest" /> Masc.
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-forest text-forest" /> Fem.
          </span>
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
        <circle
          cx={x}
          cy={y}
          r="10"
          className="fill-cream stroke-border"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      );
    }
    const isMasc =
      person.gender?.toLowerCase().startsWith("m") ??
      (person.role === "father" || person.role === "grandfather");
    const isFem =
      person.gender?.toLowerCase().startsWith("f") ??
      (person.role === "mother" || person.role === "grandmother");
    const stroke = highlight
      ? "stroke-gold"
      : isMasc
        ? "stroke-forest/60"
        : isFem
          ? "stroke-forest/70"
          : "stroke-border";
    const fill = highlight
      ? "fill-gold/25"
      : isMasc
        ? "fill-forest/12"
        : isFem
          ? "fill-forest/20"
          : "fill-cream";
    const sw = highlight ? 2 : 1.5;
    const commonProps = { className: `${fill} ${stroke}`, strokeWidth: sw } as const;
    return isFem && !isMasc ? (
      <>
        <circle cx={x} cy={y} r="11" {...commonProps} />
        {person.isDeceased && (
          <line
            x1={x - 10}
            y1={y - 10}
            x2={x + 10}
            y2={y + 10}
            className="stroke-graphite"
            strokeWidth="1.2"
          />
        )}
      </>
    ) : (
      <>
        <rect x={x - 11} y={y - 11} width="22" height="22" rx="3" {...commonProps} />
        {person.isDeceased && (
          <line
            x1={x - 11}
            y1={y - 11}
            x2={x + 11}
            y2={y + 11}
            className="stroke-graphite"
            strokeWidth="1.2"
          />
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
      <Node
        person={
          proband ?? {
            ...({} as GenogramPersonDTO),
            id: "p",
            fullName: session.patient,
            preferredName: null,
            gender: null,
            isProband: true,
            isDeceased: false,
            hasBirthDate: false,
            hasDeathDate: false,
            relationshipTo: null,
            role: "proband",
          }
        }
        x={150}
        y={135}
        highlight
      />
      <text x={150} y={155} textAnchor="middle" className="fill-primary font-bold" fontSize="9">
        {session.initials}
      </text>
    </svg>
  );
}

function UpcomingList({ currentId, sessions }: { currentId: string; sessions: Session[] }) {
  const others = sessions.filter((s) => s.id !== currentId);

  return (
    <div className="rounded-2xl bg-surface-document/85 backdrop-blur border border-border/50 shadow-sm p-5">
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
                  to="/app/clientes/$clientId"
                  params={{ clientId: s.clientId }}
                  search={{ from: "agenda" }}
                  className="flex items-center gap-3 py-2 rounded-lg hover:bg-forest-soft/40 transition-colors -mx-1 px-1"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  className="flex items-center gap-3 py-2 opacity-70 cursor-not-allowed"
                  title="Sessão sem cliente vinculado"
                >
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
  stats,
  orphanClients,
  prontuariosPendentes,
}: {
  session: Session;
  stats: {
    total: number;
    primeira: number;
    retornos: number;
    aniversarios: number;
    ocupado: string;
    livre: string;
  };
  orphanClients: OrphanClientDTO[];
  prontuariosPendentes: number;
}) {
  const WORKDAY_HOURS = 8;
  const occupiedPct = Math.min(100, Math.round((stats.total / WORKDAY_HOURS) * 100));

  return (
    <aside className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
      {/* Preparação do próximo atendimento — dados reais da sessão selecionada */}
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                Preparação
              </p>
              <p className="text-[11px] text-white/70">Atendimento selecionado</p>
            </div>
          </div>

          <p className="font-serif text-[14px] leading-relaxed text-white/90">
            {session.start} · <strong className="text-gold">{session.patient.split(" ")[0]}</strong>{" "}
            — {session.type}
            {session.sessionNumber ? ` · ${session.sessionNumber}` : ""}.
          </p>

          {session.aiAlerts.length > 0 ? (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-[12px] text-white/80">
              {session.aiAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-gold shrink-0 mt-0.5" />
                  <span>{alert}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 pt-4 border-t border-white/10 text-[12px] text-white/60 italic">
              Nenhum sinal transgeracional registrado para esta sessão.
            </p>
          )}

          {session.clientId && (
            <Button variant="hero" size="sm" className="mt-4 w-full font-bold" asChild>
              <Link
                to="/app/clientes/$clientId"
                params={{ clientId: session.clientId }}
                search={{ from: "agenda" }}
              >
                <Wand2 className="size-3.5" />
                Abrir prontuário
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Pendências */}
      <div className="rounded-2xl bg-surface-document/85 backdrop-blur border border-border/50 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="size-3.5" /> Pendências
        </p>
        <ul className="space-y-2.5 text-[13px]">
          <PendingRow label="Prontuários sem evolução" count={prontuariosPendentes} tone="rose" />
          <PendingRow label="Clientes sem retorno" count={orphanClients.length} tone="forest" />
        </ul>
        {orphanClients.length > 0 && (
          <ul className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
            {orphanClients.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between text-[12px]">
                <span className="text-primary/80 font-medium truncate">{c.name}</span>
                <Link
                  to="/app/clientes/$clientId"
                  params={{ clientId: c.id }}
                  search={{ from: "agenda" }}
                  className="text-forest font-bold hover:underline"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Balanço de tempo do dia */}
      <div className="rounded-2xl bg-surface-document/85 backdrop-blur border border-border/50 shadow-sm p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Balanço do dia
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-primary/80 font-semibold">
              <Clock className="size-3.5 text-forest" /> Ocupado
            </span>
            <span className="font-mono text-sm font-bold text-primary">{stats.ocupado}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-primary/80 font-semibold">
              <Leaf className="size-3.5 text-clinical-positive" /> Tempo livre
            </span>
            <span className="font-mono text-sm font-bold text-clinical-positive">
              {stats.livre}
            </span>
          </div>
          <div className="h-1.5 bg-cream rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-forest to-forest rounded-full transition-[width] duration-500"
              style={{ width: `${occupiedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Notas rápidas — persistem neste dispositivo */}
      <QuickNote />
    </aside>
  );
}

const QUICK_NOTE_KEY = "genealiz.agenda.quick-note";

function QuickNote() {
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem(QUICK_NOTE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  return (
    <div className="rounded-2xl bg-gradient-to-br from-cream to-surface-document border border-border/50 shadow-sm p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
          <FileText className="size-3.5" /> Nota rápida
        </p>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
          Salva neste dispositivo
        </span>
      </div>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          try {
            localStorage.setItem(QUICK_NOTE_KEY, e.target.value);
          } catch {
            /* armazenamento indisponível — nota vive só na sessão */
          }
        }}
        placeholder="Uma linha, uma intuição, uma hipótese..."
        aria-label="Nota rápida"
        className="w-full bg-transparent text-[13px] font-serif text-primary/90 placeholder:text-muted-foreground/60 resize-none focus:outline-none min-h-[60px]"
      />
    </div>
  );
}

function PendingRow({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "rose" | "gold" | "forest";
}) {
  const toneClass = {
    rose: "bg-clinical-critical/10 text-clinical-critical",
    gold: "bg-gold-muted/60 text-bronze",
    forest: "bg-forest/15 text-forest",
  }[tone];
  return (
    <li className="flex items-center justify-between group cursor-pointer hover:bg-cream/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
      <span className="text-primary/85 font-medium">{label}</span>
      <span
        className={`inline-flex items-center justify-center min-w-[26px] h-6 px-2 rounded-full text-[11px] font-black ${toneClass}`}
      >
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
    const isNext =
      startTs >= now && dtos.slice(0, i).every((p) => new Date(p.startISO).getTime() < now);

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
