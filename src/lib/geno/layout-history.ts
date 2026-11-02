/**
 * Desfazer/refazer SOMENTE de posições do mapa (nunca de dados remotos) e
 * rascunho local de arranjo por usuário+caso (apenas IDs de nó e coordenadas).
 */
export type Snapshot = Record<string, [number, number]>;

export class LayoutHistory {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  constructor(private limit = 50) {}
  push(s: Snapshot) {
    this.past.push(s);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: Snapshot): Snapshot | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(current);
    return prev;
  }
  redo(current: Snapshot): Snapshot | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    return next;
  }
  reset() {
    this.past = [];
    this.future = [];
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}

export interface LayoutDraft {
  at: number;
  positions: Snapshot;
}
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => (typeof window === "undefined" ? null : window.localStorage);
export const draftKey = (userId: string, clientId: string) =>
  `genealiz:layout-draft:${userId}:${clientId}`;

export function saveDraft(
  userId: string,
  clientId: string,
  positions: Snapshot,
  s = store(),
  now = Date.now(),
) {
  if (!s || !userId || !clientId) return;
  try {
    s.setItem(
      draftKey(userId, clientId),
      JSON.stringify({ at: now, positions } satisfies LayoutDraft),
    );
  } catch {
    /* sem espaço: rascunho apenas não é salvo */
  }
}
export function readDraft(userId: string, clientId: string, s = store()): LayoutDraft | null {
  if (!s || !userId || !clientId) return null;
  try {
    const d = JSON.parse(s.getItem(draftKey(userId, clientId)) || "null");
    if (!d || typeof d.at !== "number" || typeof d.positions !== "object") return null;
    const clean: Snapshot = {};
    for (const [k, v] of Object.entries(d.positions as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number"))
        clean[k] = [v[0], v[1]];
    }
    return { at: d.at, positions: clean };
  } catch {
    return null;
  }
}
export function clearDraft(userId: string, clientId: string, s = store()) {
  try {
    s?.removeItem(draftKey(userId, clientId));
  } catch {
    /* ignore */
  }
}

/**
 * Aplica um snapshot (rascunho, desfazer/refazer) respeitando a faixa Y da
 * geração: só o X do snapshot é usado; Y vem do nó atual (já normalizado).
 * IDs que não existem mais são ignorados.
 */
export function constrainSnapshotY(snap: Snapshot, current: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const [id, [x]] of Object.entries(snap)) {
    const cur = current[id];
    if (!cur || !Number.isFinite(x)) continue;
    out[id] = [x, cur[1]];
  }
  return out;
}
