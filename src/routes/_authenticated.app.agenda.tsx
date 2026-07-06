import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
});

function AgendaPage() {
  const [view, setView] = useState<"day" | "week" | "month">("week");

  const todaySessions = [
    {
      time: "09:00 - 10:00",
      client: "Pietro Vinicius Baccin",
      type: "Genograma - Sessão 3",
      active: true,
    },
    { time: "11:30 - 12:30", client: "Leticia Baccin", type: "Anamnese Sistêmica", active: false },
    {
      time: "15:00 - 16:00",
      client: "Anapaula Farhat Kuchockowolec",
      type: "Primeira Consulta",
      active: false,
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b-2 border-border bg-cream px-6 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Instituto Liz / Agenda
        </p>
      </div>

      {/* Header */}
      <div className="block-plum px-6 py-10">
        <div className="container-liz flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-lavender-mid">
              Consultório
            </p>
            <h1 className="mt-2 font-serif text-5xl font-bold text-white">Agenda Clínica</h1>
            <p className="mt-2 text-[14px] text-white/55">
              Visualize seus horários, agende sessões e gerencie sua rotina clínica.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10"
            >
              Configurar Horários
            </Button>
            <Button size="lg" variant="hero">
              <Plus className="size-4" />
              Novo Agendamento
            </Button>
          </div>
        </div>
      </div>

      <div className="container-liz py-8 space-y-6">
        {/* Calendar Navigation & View Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg p-1 bg-white">
              <button
                onClick={() => setView("day")}
                className={`px-3 py-1.5 rounded-md text-[13px] font-bold ${view === "day" ? "bg-plum text-white" : "text-muted-foreground hover:text-primary"}`}
              >
                Dia
              </button>
              <button
                onClick={() => setView("week")}
                className={`px-3 py-1.5 rounded-md text-[13px] font-bold ${view === "week" ? "bg-plum text-white" : "text-muted-foreground hover:text-primary"}`}
              >
                Semana
              </button>
              <button
                onClick={() => setView("month")}
                className={`px-3 py-1.5 rounded-md text-[13px] font-bold ${view === "month" ? "bg-plum text-white" : "text-muted-foreground hover:text-primary"}`}
              >
                Mês
              </button>
            </div>
            <span className="text-[14px] font-bold text-primary">Julho, 2026</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" className="font-bold">
              Hoje
            </Button>
            <Button variant="outline" size="icon-sm">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Weekly Time Grid (Notion / Linear Style) */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Columns (Schedules) */}
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Clock className="size-4 text-plum" />
                Sessões Agendadas para Hoje
              </h3>

              <div className="space-y-3">
                {todaySessions.map((session, i) => (
                  <div
                    key={i}
                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-xl gap-4 transition-all ${
                      session.active
                        ? "border-plum bg-plum/[0.02]"
                        : "border-border/60 bg-slate-50/[0.3] hover:bg-slate-50/[0.8]"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[12px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            session.active
                              ? "bg-plum text-white"
                              : "bg-slate-200 text-muted-foreground"
                          }`}
                        >
                          {session.time}
                        </span>
                        {session.active && (
                          <Badge
                            variant="outline"
                            className="text-plum border-plum bg-plum/5 text-[10px] font-bold"
                          >
                            Em breve
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-serif text-lg font-bold text-primary">
                        {session.client}
                      </h4>
                      <p className="text-[12px] text-muted-foreground">{session.type}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-bold flex items-center gap-1"
                    >
                      Iniciar Sala <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly calendar simulation */}
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm p-6">
              <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <CalendarIcon className="size-4 text-lavender" />
                Visão Geral da Semana
              </h3>
              <div className="grid grid-cols-5 gap-4 divide-x divide-border/40">
                {["Seg 06", "Ter 07", "Qua 08", "Qui 09", "Sex 10"].map((day, idx) => (
                  <div key={day} className="pl-4 first:pl-0 space-y-3">
                    <p className="text-[12px] font-bold text-primary pb-2 border-b border-border/40">
                      {day}
                    </p>
                    <div className="space-y-2">
                      {idx === 0 && (
                        <div className="p-2 bg-plum/5 border border-plum/10 rounded-lg text-[11px] text-plum font-bold">
                          09:00 - Pietro
                        </div>
                      )}
                      {idx === 1 && (
                        <div className="p-2 bg-lavender/5 border border-lavender/10 rounded-lg text-[11px] text-lavender font-bold">
                          14:00 - João
                        </div>
                      )}
                      {idx === 3 && (
                        <div className="p-2 bg-gold/5 border border-gold/10 rounded-lg text-[11px] text-gold-dark font-bold">
                          10:00 - Ana
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Pending Actions) */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/50 bg-white shadow-sm p-6 space-y-4">
              <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Users className="size-4 text-gold" />
                Clientes Sem Sessões
              </h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Esses clientes concluíram sua última sessão mas ainda não possuem um próximo
                agendamento ativo.
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[13px] border-b border-border/40 pb-2">
                  <span className="font-semibold text-primary">Dirceu Baccin</span>
                  <Button variant="ghost" size="sm" className="font-bold text-lavender p-0 h-auto">
                    Agendar
                  </Button>
                </div>
                <div className="flex justify-between items-center text-[13px] border-b border-border/40 pb-2">
                  <span className="font-semibold text-primary">Anapaula Farhat</span>
                  <Button variant="ghost" size="sm" className="font-bold text-lavender p-0 h-auto">
                    Agendar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
