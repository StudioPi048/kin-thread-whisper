/**
 * Retomada real: guarda SOMENTE IDs de cliente + aba visitada + horário,
 * isolado por usuário no navegador. Nenhum nome ou dado clínico.
 */
export interface Visit {
  clientId: string;
  tab: string;
  at: number;
}
const MAX = 8;
const key = (userId: string) => `genealiz:visits:${userId}`;

type Store = Pick<Storage, "getItem" | "setItem">;
function store(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readVisits(userId: string, s: Store | null = store()): Visit[] {
  if (!s || !userId) return [];
  try {
    const raw = JSON.parse(s.getItem(key(userId)) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (v): v is Visit =>
        v &&
        typeof v.clientId === "string" &&
        typeof v.tab === "string" &&
        typeof v.at === "number",
    );
  } catch {
    return [];
  }
}

export function recordVisit(
  userId: string,
  clientId: string,
  tab: string,
  s: Store | null = store(),
  now = Date.now(),
): Visit[] {
  if (!s || !userId || !clientId) return [];
  const next = [
    { clientId, tab, at: now },
    ...readVisits(userId, s).filter((v) => v.clientId !== clientId),
  ].slice(0, MAX);
  try {
    s.setItem(key(userId), JSON.stringify(next));
  } catch {
    /* armazenamento indisponível: retomada apenas não é salva */
  }
  return next;
}

export const prefKey = (userId: string, name: string) => `genealiz:${name}:${userId}`;
export function readPref<T>(userId: string, name: string, fallback: T): T {
  const s = store();
  if (!s || !userId) return fallback;
  try {
    const v = s.getItem(prefKey(userId, name));
    if (!v) return fallback;
    const parsed = JSON.parse(v);
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...fallback, ...parsed }
        : fallback;
    }
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
export function writePref(userId: string, name: string, value: unknown) {
  const s = store();
  if (!s || !userId) return;
  try {
    s.setItem(prefKey(userId, name), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export type ClientListPreferences = {
  tab: "active" | "archived";
  viewMode: "list" | "cards";
};

export function readClientListPreferences(
  userId: string,
  s: Store | null = store(),
): ClientListPreferences {
  const fallback: ClientListPreferences = { tab: "active", viewMode: "list" };
  if (!s || !userId) return fallback;
  try {
    const k = prefKey(userId, "clients-filters");
    const previous = JSON.parse(s.getItem(k) ?? "null");
    if (!previous || typeof previous !== "object" || Array.isArray(previous)) return fallback;
    const preferences: ClientListPreferences = {
      tab: previous.tab === "archived" ? "archived" : "active",
      viewMode: previous.viewMode === "cards" ? "cards" : "list",
    };
    // Rewrite the original key to remove search text saved by earlier versions.
    const serialized = JSON.stringify(preferences);
    if (serialized !== JSON.stringify(previous)) s.setItem(k, serialized);
    return preferences;
  } catch {
    return fallback;
  }
}

export interface OnboardingCounts {
  clients: number;
  persons: number;
  relationships: number;
  sessions: number;
}
export function onboardingSteps(c: OnboardingCounts) {
  const steps = [
    { id: "client", label: "Cadastrar um caso", done: c.clients > 0 },
    { id: "persons", label: "Adicionar familiares", done: c.persons > 0 },
    { id: "rel", label: "Registrar um vínculo", done: c.relationships > 0 },
    { id: "session", label: "Agendar uma sessão", done: c.sessions > 0 },
  ];
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}
