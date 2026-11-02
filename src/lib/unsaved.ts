/**
 * Coordenação de alterações não salvas (mapa, planilha, notas, áudio,
 * anamnese). Puro: o React só registra entradas e mostra o diálogo.
 * Nenhum conteúdo é guardado aqui — cada entrada sabe salvar/descartar
 * o próprio estado em memória.
 */
export interface UnsavedEntry {
  label: string;
  isDirty: () => boolean;
  /** Persiste; deve lançar erro se não confirmou (a edição é mantida). */
  save: () => Promise<void>;
  /** Descarta em memória e libera recursos (timers, microfone). */
  discard: () => void;
}

export class UnsavedRegistry {
  private entries = new Map<string, UnsavedEntry>();
  set(key: string, entry: UnsavedEntry) {
    this.entries.set(key, entry);
  }
  delete(key: string) {
    this.entries.delete(key);
  }
  dirty(): [string, UnsavedEntry][] {
    return [...this.entries].filter(([, e]) => {
      try {
        return e.isDirty();
      } catch {
        return true;
      }
    });
  }
  anyDirty() {
    return this.dirty().length > 0;
  }
  /** Salva tudo que está pendente; retorna o que falhou (edição preservada). */
  async saveAll(): Promise<{ ok: boolean; failed: { label: string; message: string }[] }> {
    const failed: { label: string; message: string }[] = [];
    for (const [, e] of this.dirty()) {
      try {
        await e.save();
        if (e.isDirty()) failed.push({ label: e.label, message: "ainda há alterações pendentes" });
      } catch (err) {
        failed.push({ label: e.label, message: err instanceof Error ? err.message : String(err) });
      }
    }
    return { ok: failed.length === 0, failed };
  }
  discardAll() {
    for (const [, e] of this.dirty()) e.discard();
  }
}

/**
 * Revisões de edição: cada alteração incrementa `current`. Um salvamento
 * captura a revisão no início; ao terminar, só marca como salvo até ela.
 * Alterações feitas durante o salvamento continuam pendentes.
 */
export class RevisionTracker {
  private current = 0;
  private saved = 0;
  bump() {
    this.current++;
    return this.current;
  }
  begin() {
    return this.current;
  }
  /** Retorna true se, após confirmar `rev`, não sobrou nada pendente. */
  confirm(rev: number) {
    this.saved = Math.max(this.saved, rev);
    return this.isClean();
  }
  isClean() {
    return this.saved >= this.current;
  }
  reset() {
    this.current = 0;
    this.saved = 0;
  }
}

/** Decide se a navegação deve passar pelo guard: troca de página ou de aba do dossiê. */
export function isGuardedNavigation(
  current: { pathname: string; search?: Record<string, unknown> },
  next: { pathname: string; search?: Record<string, unknown> },
) {
  if (current.pathname !== next.pathname) return true;
  return (current.search?.tab ?? null) !== (next.search?.tab ?? null);
}

/**
 * Debounce por chave com flush explícito: patches acumulam; `flush` envia
 * tudo já (sem esperar o timer) e, em falha, devolve o patch à fila para
 * nada se perder.
 */
export class KeyedDebounce<P extends Record<string, unknown>> {
  private pending = new Map<string, P>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private send: (key: string, patch: P) => Promise<void>,
    private delay = 900,
    private onError?: (key: string, err: unknown) => void,
  ) {}
  push(key: string, patch: P) {
    this.pending.set(key, { ...(this.pending.get(key) ?? ({} as P)), ...patch });
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(
      key,
      setTimeout(() => {
        this.flushKey(key).catch((e) => this.onError?.(key, e));
      }, this.delay),
    );
  }
  hasPending() {
    return this.pending.size > 0;
  }
  private async flushKey(key: string) {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
    const patch = this.pending.get(key);
    if (!patch) return;
    this.pending.delete(key);
    try {
      await this.send(key, patch);
    } catch (e) {
      // devolve sem sobrescrever edições feitas durante o envio
      this.pending.set(key, { ...patch, ...(this.pending.get(key) ?? ({} as P)) });
      throw e;
    }
  }
  async flush() {
    const errors: unknown[] = [];
    for (const key of [...this.pending.keys()]) {
      try {
        await this.flushKey(key);
      } catch (e) {
        errors.push(e);
      }
    }
    if (errors.length) throw errors[0];
  }
  discard() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.pending.clear();
  }
}
