import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Sparkles,
  Wand2,
  Play,
  FileText,
  GitBranch,
  Clock,
  BookOpen,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  Users,
  Feather,
  MessageCircle,
  ClipboardList,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPatientDossier,
  type PatientDossierDTO,
  type JourneyDTO,
  type TimelineEventDTO,
  type BriefingDTO,
  type LibrarySuggestionDTO,
  type EvolutionDTO,
  type DossierGenogramDTO,
  type PatientIdentityDTO,
} from "@/lib/patient-dossier.functions";

export const Route = createFileRoute("/_authenticated/app/paciente/$id")({
  component: PatientDossierPage,
});

/* ================================ Page ================================ */

function PatientDossierPage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["patient-dossier", id],
    queryFn: () => getPatientDossier({ data: { clientId: id } }),
    staleTime: 60_000,
    retry: 1,
  });

  if (q.isLoading) return <DossierSkeleton />;
  if (q.isError || !q.data) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-cream flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="size-10 text-rose-500 mx-auto" />
          <h2 className="font-serif text-2xl font-bold text-primary">
            Não foi possível abrir o dossiê
          </h2>
          <p className="text-sm text-muted-foreground">
            {q.error instanceof Error ? q.error.message : "Erro desconhecido"}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => router.invalidate()}>
              Tentar novamente
            </Button>
            <Link to="/app/agenda">
              <Button variant="ghost">Voltar para a agenda</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <DossierView data={q.data} />;
}

function DossierView({ data }: { data: PatientDossierDTO }) {
  const { identity, journey, summary, genogram, timeline, briefing, library, evolutions, counts } =
    data;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_20%_0%,oklch(0.97_0.02_295)_0%,transparent_45%),radial-gradient(circle_at_100%_100%,oklch(0.96_0.03_60/0.4)_0%,transparent_50%),var(--color-cream)] pb-24">
      {/* Breadcrumb */}
      <div className="border-b border-border/60 bg-white/60 backdrop-blur-sm px-6 py-3">
        <div className="container-liz flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            <Link to="/app/agenda" className="hover:text-forest flex items-center gap-1.5">
              <ArrowLeft className="size-3" /> Agenda
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-forest">Dossiê Clínico</span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground/70">
            {counts.totalSessions} sessão(ões) · {counts.totalPersons} pessoas no genograma ·{" "}
            {counts.totalPatterns} padrões
          </span>
        </div>
      </div>

      <PatientHeader identity={identity} />

      <div className="container-liz mt-6">
        <JourneyStrip journey={journey} />
      </div>

      <div className="container-liz mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT column */}
        <div className="space-y-5 min-w-0">
          <ClinicalSummary
            lastEvolution={summary.lastEvolution}
            presentingIntention={summary.presentingIntention}
            signatureNotes={summary.signatureNotes}
            presentingComplaint={identity.presentingComplaint}
          />
          <GenogramShowcase
            genogram={genogram}
            patientName={identity.preferredName ?? identity.fullName}
          />
          <FamilyTimeline events={timeline} />
          <RecentEvolutions evolutions={evolutions} />
        </div>

        {/* RIGHT column */}
        <div className="space-y-5 min-w-0">
          <AiBriefing briefing={briefing} />
          <ConnectedLibrary items={library} />
        </div>
      </div>

      <ActionBar clientId={identity.id} />
    </div>
  );
}

/* ============================ Patient Header ============================ */

function PatientHeader({ identity }: { identity: PatientIdentityDTO }) {
  const monogram = (identity.preferredName ?? identity.fullName)
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const displayName = identity.preferredName ?? identity.fullName;

  return (
    <div className="relative overflow-hidden">
      <div className="block-forest px-6 pt-10 pb-14 relative">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "3px 3px",
          }}
        />
        <div className="container-liz relative">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-start gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                {identity.avatarUrl ? (
                  <img
                    src={identity.avatarUrl}
                    alt={displayName}
                    className="size-24 md:size-28 rounded-2xl object-cover border-2 border-white/20 shadow-2xl"
                  />
                ) : (
                  <div className="size-24 md:size-28 rounded-2xl bg-gradient-to-br from-forest to-forest text-white flex items-center justify-center font-serif text-3xl md:text-4xl font-bold shadow-2xl border-2 border-white/20">
                    {monogram || "?"}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-white border-2 border-forest flex items-center justify-center">
                  <CircleDot className="size-3.5 text-forest" />
                </div>
              </div>

              {/* Identity */}
              <div className="min-w-0 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-forest-mid mb-2">
                  Dossiê Clínico
                </p>
                <h1 className="font-serif text-3xl md:text-5xl font-bold text-white leading-tight truncate">
                  {displayName}
                </h1>
                <p className="mt-2 text-[13px] text-white/70 font-semibold">
                  {[
                    identity.ageYears != null && `${identity.ageYears} anos`,
                    identity.profession,
                    `Paciente há ${formatMonths(identity.monthsAsClient)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {/* Chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusChip status={identity.status} />
                  {identity.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-white/85 uppercase tracking-wider"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Next session card */}
            <div className="flex flex-col items-end gap-2">
              <NextSessionCard iso={identity.nextSessionISO} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: "Ativo",
      className: "bg-emerald-400/20 text-emerald-100 border-emerald-300/40",
    },
    archived: {
      label: "Arquivado",
      className: "bg-slate-400/20 text-slate-100 border-slate-300/40",
    },
  };
  const m = map[status] ?? {
    label: status,
    className: "bg-white/10 text-white/80 border-white/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.className}`}
    >
      <Circle className="size-2 fill-current" /> {m.label}
    </span>
  );
}

function NextSessionCard({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <div className="rounded-xl bg-white/[0.06] backdrop-blur border border-white/10 px-4 py-3 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
          Próxima sessão
        </p>
        <p className="font-serif text-lg font-bold text-white/80 mt-1">Não agendada</p>
      </div>
    );
  }
  const d = new Date(iso);
  return (
    <div className="rounded-xl bg-white/[0.08] backdrop-blur border border-white/15 px-4 py-3 text-right">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold flex items-center gap-1 justify-end">
        <CalendarIcon className="size-3" /> Próxima sessão
      </p>
      <p className="font-serif text-2xl font-bold text-white mt-1 tabular-nums">
        {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
      </p>
      <p className="text-[11px] text-white/70 tabular-nums">
        {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

/* ============================= Journey Strip ============================ */

function JourneyStrip({ journey }: { journey: JourneyDTO }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-border/50 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
          <Feather className="size-3.5" /> Jornada clínica
        </p>
        <span className="text-[10px] text-forest font-bold uppercase tracking-wider">
          Etapa atual: {journey.stages.find((s) => s.status === "current")?.label}
        </span>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {journey.stages.map((s, i) => {
          const isCurrent = s.status === "current";
          const isDone = s.status === "done";
          return (
            <div key={s.key} className="flex-1 min-w-[100px]">
              <div className="flex items-center gap-1">
                <div
                  className={`size-6 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold ${
                    isCurrent
                      ? "bg-forest ring-4 ring-forest/15"
                      : isDone
                        ? "bg-forest"
                        : "bg-cream border border-border text-muted-foreground/60"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </div>
                {i < journey.stages.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full ${isDone ? "bg-forest" : "bg-border"}`}
                  />
                )}
              </div>
              <p
                className={`mt-2 text-[11.5px] font-bold ${isCurrent ? "text-forest" : isDone ? "text-primary" : "text-muted-foreground"}`}
              >
                {s.label}
              </p>
              <p className="text-[10.5px] text-muted-foreground/80 leading-tight mt-0.5">
                {s.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========================== Clinical Summary =========================== */

function ClinicalSummary({
  lastEvolution,
  presentingIntention,
  signatureNotes,
  presentingComplaint,
}: {
  lastEvolution: EvolutionDTO | null;
  presentingIntention: string | null;
  signatureNotes: string | null;
  presentingComplaint: string | null;
}) {
  return (
    <div className="rounded-3xl bg-white border border-border/60 shadow-[0_20px_60px_-30px_rgba(60,20,80,0.35)] p-6 md:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest flex items-center gap-2 mb-4">
        <Sparkles className="size-3.5" /> Resumo clínico vivo
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        <SummaryBlock title="Última evolução" empty="Nenhuma evolução registrada ainda.">
          {lastEvolution ? (
            <>
              <p className="text-[11px] text-muted-foreground font-semibold mb-1">
                {new Date(lastEvolution.dateISO).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {lastEvolution.title ? ` · ${lastEvolution.title}` : ""}
              </p>
              <p className="font-serif italic text-[14px] text-primary/90 leading-relaxed">
                {lastEvolution.summary ?? "Evolução registrada sem resumo estruturado."}
              </p>
            </>
          ) : null}
        </SummaryBlock>

        <SummaryBlock
          title="Intenção do paciente"
          empty="Sem intenção declarada no formulário de acolhimento."
        >
          {presentingIntention ? (
            <p className="text-[13px] text-primary/85 leading-relaxed">{presentingIntention}</p>
          ) : null}
        </SummaryBlock>

        <SummaryBlock title="Queixa apresentada" empty="Sem queixa registrada.">
          {presentingComplaint ? (
            <p className="text-[13px] text-primary/85 leading-relaxed">{presentingComplaint}</p>
          ) : null}
        </SummaryBlock>

        <SummaryBlock title="Notas de assinatura" empty="Sem notas de assinatura da terapeuta.">
          {signatureNotes ? (
            <p className="font-serif italic text-[13px] text-primary/80 leading-relaxed">
              {signatureNotes}
            </p>
          ) : null}
        </SummaryBlock>
      </div>
    </div>
  );
}

function SummaryBlock({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = !children;
  return (
    <div
      className={`rounded-xl border p-4 ${isEmpty ? "border-dashed border-border/60 bg-cream/30" : "border-border/40 bg-cream/50"}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
        {title}
      </p>
      {isEmpty ? <p className="text-[12px] italic text-muted-foreground/80">{empty}</p> : children}
    </div>
  );
}

/* ========================= Genogram Showcase =========================== */

function GenogramShowcase({
  genogram,
  patientName,
}: {
  genogram: DossierGenogramDTO;
  patientName: string;
}) {
  return (
    <div className="rounded-3xl bg-white border border-border/60 shadow-[0_10px_40px_-25px_rgba(60,20,80,0.25)] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-gradient-to-r from-forest/[0.03] to-forest/[0.05]">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest flex items-center gap-2">
          <GitBranch className="size-3.5" /> Genossociograma
        </p>
        <Link
          to="/app/genossociogramas"
          className="text-[11px] text-forest font-bold hover:underline flex items-center gap-1"
        >
          Abrir editor <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="p-6">
        {genogram.hasGenogram ? (
          <BigTree genogram={genogram} patientName={patientName} />
        ) : (
          <div className="py-10 text-center">
            <GitBranch className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-serif text-lg font-bold text-primary">
              Genossociograma ainda não iniciado
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Comece pelo paciente e vá subindo as gerações.
            </p>
            <Link to="/app/genossociogramas">
              <Button variant="outline" className="mt-4">
                <GitBranch className="size-4" />
                Iniciar genograma
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function BigTree({ genogram, patientName }: { genogram: DossierGenogramDTO; patientName: string }) {
  const father = genogram.parents.find((p) => p.role === "father");
  const mother = genogram.parents.find((p) => p.role === "mother");
  const gpats = genogram.grandparents.slice(0, 4);
  const [patGf, patGm, matGf, matGm] = [
    gpats.find((p) => p.role === "grandfather"),
    gpats.find((p) => p.role === "grandmother"),
    gpats.filter((p) => p.role === "grandfather")[1] ?? null,
    gpats.filter((p) => p.role === "grandmother")[1] ?? null,
  ];

  const Node = ({
    person,
    x,
    y,
    labelPos = "below",
    highlight,
  }: {
    person: { id?: string; fullName: string; role?: string; isDeceased?: boolean } | null;
    x: number;
    y: number;
    labelPos?: "below" | "above";
    highlight?: boolean;
  }) => {
    if (!person) {
      return (
        <circle
          cx={x}
          cy={y}
          r="14"
          className="fill-cream stroke-border"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      );
    }
    const isFem = person.role === "mother" || person.role === "grandmother";
    const isMasc = person.role === "father" || person.role === "grandfather";
    const stroke = highlight
      ? "stroke-gold"
      : isMasc
        ? "stroke-forest/70"
        : isFem
          ? "stroke-forest/80"
          : "stroke-border";
    const fill = highlight
      ? "fill-gold/25"
      : isMasc
        ? "fill-forest/12"
        : isFem
          ? "fill-forest/20"
          : "fill-cream";
    const sw = highlight ? 2.5 : 1.75;
    const size = highlight ? 20 : 15;
    const shape =
      isFem && !isMasc ? (
        <circle cx={x} cy={y} r={size} className={`${fill} ${stroke}`} strokeWidth={sw} />
      ) : (
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          rx="4"
          className={`${fill} ${stroke}`}
          strokeWidth={sw}
        />
      );
    const firstName = person.fullName.split(/\s+/)[0];
    const labelY = labelPos === "below" ? y + size + 14 : y - size - 6;
    return (
      <>
        {shape}
        {person.isDeceased && (
          <line
            x1={x - size}
            y1={y - size}
            x2={x + size}
            y2={y + size}
            className="stroke-slate-600"
            strokeWidth="1.5"
          />
        )}
        <text
          x={x}
          y={labelY}
          textAnchor="middle"
          className={`fill-primary font-bold ${highlight ? "text-[11px]" : ""}`}
          fontSize={highlight ? 11 : 10}
        >
          {firstName}
        </text>
      </>
    );
  };

  return (
    <>
      <svg viewBox="0 0 600 340" className="w-full h-[320px]">
        {/* Row lines */}
        <line x1="60" y1="70" x2="540" y2="70" className="stroke-border/30" strokeDasharray="2 4" />
        <line
          x1="140"
          y1="180"
          x2="460"
          y2="180"
          className="stroke-border/30"
          strokeDasharray="2 4"
        />

        {/* Grandparents row */}
        <Node person={patGf ?? null} x={80} y={70} />
        <Node person={patGm ?? null} x={180} y={70} />
        <Node person={matGf ?? null} x={420} y={70} />
        <Node person={matGm ?? null} x={520} y={70} />
        <line x1="95" y1="70" x2="165" y2="70" className="stroke-border" strokeWidth="1.2" />
        <line x1="435" y1="70" x2="505" y2="70" className="stroke-border" strokeWidth="1.2" />
        <line x1="130" y1="86" x2="180" y2="164" className="stroke-border" strokeWidth="1.2" />
        <line x1="470" y1="86" x2="420" y2="164" className="stroke-border" strokeWidth="1.2" />

        {/* Parents row */}
        <Node person={father ?? null} x={180} y={180} />
        <Node person={mother ?? null} x={420} y={180} />
        <line x1="195" y1="180" x2="405" y2="180" className="stroke-border" strokeWidth="1.2" />

        {/* Proband connector */}
        <line x1="300" y1="180" x2="300" y2="255" className="stroke-border" strokeWidth="1.2" />

        {/* Proband */}
        <Node
          person={{ fullName: patientName, role: "proband", isDeceased: false }}
          x={300}
          y={280}
          highlight
        />
      </svg>

      <div className="mt-4 flex items-center justify-between text-[11px] flex-wrap gap-2">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-gold text-gold" /> Paciente
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-forest text-forest" /> Masculino
          </span>
          <span className="flex items-center gap-1">
            <Circle className="size-2 fill-forest text-forest" /> Feminino
          </span>
          <span className="text-muted-foreground/70">✕ falecido</span>
        </div>
        <span className="text-muted-foreground/70">
          {genogram.totalPersons} pessoas · {genogram.grandparents.length}/4 avós
        </span>
      </div>
    </>
  );
}

/* ========================== Family Timeline ============================ */

function FamilyTimeline({ events }: { events: TimelineEventDTO[] }) {
  const byDecade = useMemo(() => {
    const groups = new Map<number, TimelineEventDTO[]>();
    events.forEach((e) => {
      const decade = Math.floor(e.year / 10) * 10;
      if (!groups.has(decade)) groups.set(decade, []);
      groups.get(decade)!.push(e);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [events]);

  return (
    <div className="rounded-3xl bg-white border border-border/60 shadow-[0_10px_40px_-25px_rgba(60,20,80,0.2)] p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest flex items-center gap-2">
          <Clock className="size-3.5" /> Linha do tempo familiar
        </p>
        <span className="text-[10px] text-muted-foreground/70">{events.length} eventos</span>
      </div>

      {events.length === 0 ? (
        <p className="text-[12px] italic text-muted-foreground text-center py-6">
          Nenhum evento familiar registrado ainda — adicione datas ao genossociograma.
        </p>
      ) : (
        <div className="space-y-5">
          {byDecade.map(([decade, list]) => (
            <div key={decade}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Década de {decade}
              </p>
              <ul className="space-y-2 pl-2 border-l-2 border-forest/30">
                {list.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 -ml-[9px]">
                    <span
                      className={`size-4 rounded-full mt-0.5 shrink-0 border-2 border-white ${
                        e.kind === "birth"
                          ? "bg-emerald-500"
                          : e.kind === "death"
                            ? "bg-slate-500"
                            : "bg-gold"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-primary font-semibold">
                        <span className="tabular-nums text-muted-foreground font-normal">
                          {e.year}
                        </span>{" "}
                        · {e.label}
                        {e.personName && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            — {e.personName}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================== Recent Evolutions ========================== */

function RecentEvolutions({ evolutions }: { evolutions: EvolutionDTO[] }) {
  return (
    <div className="rounded-3xl bg-white border border-border/60 shadow-[0_10px_40px_-25px_rgba(60,20,80,0.2)] p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest flex items-center gap-2">
          <FileText className="size-3.5" /> Últimas evoluções
        </p>
        <span className="text-[10px] text-muted-foreground/70">
          {evolutions.length}/8 mais recentes
        </span>
      </div>

      {evolutions.length === 0 ? (
        <div className="py-8 text-center">
          <FileText className="size-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] italic text-muted-foreground">
            Primeira sessão ainda não realizada.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {evolutions.map((e) => (
            <li key={e.id} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
              <div className="text-center w-14 shrink-0">
                <p className="font-serif text-2xl font-bold text-forest tabular-nums leading-none">
                  {new Date(e.dateISO).getDate().toString().padStart(2, "0")}
                </p>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mt-0.5">
                  {new Date(e.dateISO)
                    .toLocaleDateString("pt-BR", { month: "short" })
                    .replace(".", "")}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-primary text-[13.5px] truncate">
                    {e.title ?? "Sessão sem título"}
                  </p>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">
                    {e.status}
                  </Badge>
                </div>
                <p className="text-[12.5px] text-muted-foreground leading-snug mt-1 line-clamp-2">
                  {e.summary ??
                    "Sem resumo estruturado — abra a evolução para ler o registro completo."}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/50 mt-3 shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================ AI Briefing ============================= */

function AiBriefing({ briefing }: { briefing: BriefingDTO }) {
  const hasContent =
    briefing.hypotheses.length > 0 ||
    briefing.suggestedQuestions.length > 0 ||
    briefing.suggestedProtocols.length > 0 ||
    briefing.clinicalAlerts.length > 0;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-forest via-forest to-forest/95 text-white p-6 shadow-[0_20px_60px_-30px_rgba(60,20,80,0.6)] relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 size-52 rounded-full bg-gold/20 blur-3xl pointer-events-none"
      />
      <div className="relative space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold">
              Briefing IA
            </p>
            <p className="text-[12px] text-white/70 mt-0.5">Baseado nos padrões detectados</p>
          </div>
          <button
            disabled
            title="Em breve — IA generativa"
            className="rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white/60 cursor-not-allowed flex items-center gap-1.5"
          >
            <Wand2 className="size-3" /> Gerar briefing IA
          </button>
        </div>

        {!hasContent && (
          <p className="text-[12px] text-white/70 italic">
            Padrões clínicos e sugestões aparecerão à medida que sessões forem registradas e o
            genossociograma preenchido.
          </p>
        )}

        {briefing.clinicalAlerts.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold/90 mb-2">
              Pontos de atenção
            </p>
            <ul className="space-y-1.5">
              {briefing.clinicalAlerts.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px] text-white/90 leading-relaxed"
                >
                  <AlertTriangle
                    className={`size-3.5 shrink-0 mt-0.5 ${a.severity === "high" ? "text-rose-300" : a.severity === "warn" ? "text-gold" : "text-forest-mid"}`}
                  />
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {briefing.hypotheses.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold/90 mb-2">
              Hipóteses clínicas
            </p>
            <ul className="space-y-2">
              {briefing.hypotheses.map((h, i) => (
                <li key={i} className="rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2">
                  <p className="font-bold text-[13px] text-white">{h.title}</p>
                  {h.description && (
                    <p className="text-[12px] text-white/70 mt-1 leading-snug">{h.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {briefing.suggestedQuestions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold/90 mb-2 flex items-center gap-1.5">
              <MessageCircle className="size-3" /> Perguntas sugeridas
            </p>
            <ul className="space-y-1.5">
              {briefing.suggestedQuestions.map((q, i) => (
                <li
                  key={i}
                  className="text-[12.5px] text-white/85 leading-relaxed font-serif italic"
                >
                  "{q}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {briefing.suggestedProtocols.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold/90 mb-2 flex items-center gap-1.5">
              <ClipboardList className="size-3" /> Protocolos recomendados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {briefing.suggestedProtocols.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-white/[0.08] border border-white/15 px-2.5 py-1 text-[11.5px] font-semibold text-white/90"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================== Connected Library ========================== */

function ConnectedLibrary({ items }: { items: LibrarySuggestionDTO[] }) {
  return (
    <div className="rounded-3xl bg-white border border-border/60 shadow-[0_10px_40px_-25px_rgba(60,20,80,0.2)] p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest flex items-center gap-2">
          <BookOpen className="size-3.5" /> Biblioteca conectada
        </p>
        <Link
          to="/app/biblioteca"
          className="text-[11px] text-forest font-bold hover:underline flex items-center gap-1"
        >
          Ver tudo <ChevronRight className="size-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] italic text-muted-foreground text-center py-4">
          Sem sugestões da biblioteca. Elas aparecem quando padrões clínicos são detectados.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                to="/app/biblioteca"
                className="group flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-cream/40 hover:bg-forest-soft/40 hover:border-forest/40 transition-colors"
              >
                <div className="size-10 rounded-lg bg-gradient-to-br from-forest/15 to-forest/25 flex items-center justify-center shrink-0">
                  <BookOpen className="size-4 text-forest" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary text-[13px] truncate">{it.title}</p>
                  <p className="text-[11.5px] text-muted-foreground">{it.author}</p>
                  <span className="inline-block mt-1 text-[9.5px] font-bold uppercase tracking-wider text-forest/70 bg-forest/8 px-1.5 py-0.5 rounded">
                    {it.matchedTag}
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/40 mt-2 group-hover:text-forest transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================= Action Bar ============================== */

function ActionBar({ clientId }: { clientId: string }) {
  void clientId;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-white/95 backdrop-blur-lg shadow-[0_-8px_30px_-15px_rgba(60,20,80,0.25)]">
      <div className="container-liz py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <Users className="size-3.5 text-forest" /> Ações do dossiê
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="lg" className="font-bold shadow-md">
            <Play className="size-4 fill-current" /> Preparar sessão
          </Button>
          <Button variant="outline" size="lg" className="font-bold">
            <FileText className="size-4" /> Registrar evolução
          </Button>
          <Link to="/app/genossociogramas">
            <Button variant="ghost" size="lg" className="font-semibold">
              <GitBranch className="size-4" /> Genossociograma
            </Button>
          </Link>
          <Button variant="ghost" size="lg" className="font-semibold">
            <Clock className="size-4" /> Linha do tempo
          </Button>
          <Button variant="ghost" size="lg" className="font-semibold">
            <ArrowRight className="size-4" /> Agendar retorno
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Skeleton =============================== */

function DossierSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-cream flex flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-forest" />
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Carregando dossiê clínico…
      </p>
    </div>
  );
}

/* ================================ Utils ================================ */

function formatMonths(m: number): string {
  if (m < 1) return "menos de 1 mês";
  if (m < 12) return `${m} mês${m > 1 ? "es" : ""}`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  if (rest === 0) return `${years} ano${years > 1 ? "s" : ""}`;
  return `${years} ano${years > 1 ? "s" : ""} e ${rest} m${rest > 1 ? "eses" : "ês"}`;
}
