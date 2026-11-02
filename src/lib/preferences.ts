/** Preferências da conta — salvas no perfil (backend), por usuário. Sem dado clínico. */
export type Preferences = {
  textSize: "normal" | "large";
  reduceMotion: boolean;
  agendaView: "day" | "week";
};

export const DEFAULT_PREFERENCES: Preferences = { textSize: "normal", reduceMotion: false, agendaView: "day" };

export function parsePreferences(raw: unknown): Preferences {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    textSize: r.textSize === "large" ? "large" : "normal",
    reduceMotion: r.reduceMotion === true,
    agendaView: r.agendaView === "week" ? "week" : "day",
  };
}

export const preferencesKey = (userId: string) => ["preferences", userId] as const;
