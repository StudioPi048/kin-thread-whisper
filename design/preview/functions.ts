import { persons, sessions, clients } from "./client";
export async function getAgendaData() {
  return {
    today: sessions.map((s, i) => ({
      id: s.id,
      clientId: s.client_id,
      patient: clients[i].full_name,
      initials: clients[i].full_name
        .split(" ")
        .map((x) => x[0])
        .join(""),
      start: new Date(s.session_date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      end: `${new Date(s.session_date).getHours()}:50`,
      startISO: s.session_date,
      type: "Retorno",
      sessionNumber: 2,
      isFirst: false,
      daysSinceFirst: 30,
      lastEvolution: null,
      status: "scheduled",
      durationMin: 50,
      clinicalStatus: "scheduled",
      audioState: "none",
    })),
    week: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i - 2);
      return { date: d.toISOString().slice(0, 10), count: i === 2 ? 3 : 0 };
    }),
    orphanClients: [],
    stats: { total: 3, primeira: 0, retornos: 3, prontuariosPendentes: 0 },
  };
}
export async function getClientGenogram() {
  const rows = persons.map((p) => ({
    id: p.id,
    fullName: String(p.full_name),
    preferredName: p.preferred_name,
    gender: p.gender,
    isProband: p.is_proband,
    isDeceased: p.is_deceased,
    hasBirthDate: true,
    hasDeathDate: false,
    relationshipTo: p.relationship_to_proband,
    role: p.is_proband ? "proband" : "other",
  }));
  return {
    hasGenogram: true,
    totalPersons: rows.length,
    generations: {
      proband: rows[6],
      parents: rows.slice(4, 6),
      grandparents: rows.slice(0, 4),
      siblings: [rows[7]],
      others: [],
    },
    alerts: [],
  };
}
export async function processSessionAudio() {
  throw new Error("Processamento desativado no preview local.");
}

export async function getAgendaWeek() {
  return sessions.map((s, i) => ({
    id: s.id,
    clientId: s.client_id,
    patient: clients[i].full_name,
    dateKey: s.session_date.slice(0, 10),
    startISO: s.session_date,
    start: new Date(s.session_date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    end: new Date(new Date(s.session_date).getTime() + 50 * 60000).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    durationMin: 50,
    clinicalStatus: "scheduled",
  }));
}

export async function rescheduleSession() {
  throw new Error("Reagendamento remoto desativado no preview local.");
}
