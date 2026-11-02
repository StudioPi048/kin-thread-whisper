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
const store = (): Store | null => (typeof window === "undefined" ? null : window.localStorage);

export function readVisits(userId: string, s: Store | null = store()): Visit[] {
  if (!s || !userId) return [];
  try {
    const raw = JSON.parse(s.getItem(key(userId)) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (v): v is Visit =>
        v && typeof v.clientId === "string" && typeof v.tab === "string" && typeof v.at === "number",
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
  const next = [{ clientId, tab, at: now }, ...readVisits(userId, s).filter((v) => v.clientId !== clientId)].slice(0, MAX);
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
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
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
