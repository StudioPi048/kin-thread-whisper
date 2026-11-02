import { describe, it, expect, vi } from "vitest";
import { UnsavedRegistry, RevisionTracker, KeyedDebounce, isGuardedNavigation } from "./unsaved";

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("RevisionTracker: mudança durante salvamento", () => {
  it("move durante save em andamento continua pendente", async () => {
    const t = new RevisionTracker();
    t.bump(); // usuário moveu
    const rev = t.begin(); // save começa
    const d = deferred();
    const saving = d.promise.then(() => t.confirm(rev));
    t.bump(); // move DURANTE o save
    d.resolve();
    expect(await saving).toBe(false); // não pode marcar como salvo
    expect(t.isClean()).toBe(false);
    expect(t.confirm(t.begin())).toBe(true); // próximo save cobre a mudança
  });
  it("sem mudança durante o save, fica limpo", () => {
    const t = new RevisionTracker();
    t.bump();
    expect(t.confirm(t.begin())).toBe(true);
  });
  it("confirmação antiga fora de ordem não regride", () => {
    const t = new RevisionTracker();
    t.bump();
    const r1 = t.begin();
    t.bump();
    const r2 = t.begin();
    expect(t.confirm(r2)).toBe(true);
    expect(t.confirm(r1)).toBe(true);
  });
});

describe("UnsavedRegistry", () => {
  it("falha ao salvar mantém a edição e reporta", async () => {
    const r = new UnsavedRegistry();
    let dirty = true;
    r.set("nota", {
      label: "Notas da sessão",
      isDirty: () => dirty,
      save: async () => {
        throw new Error("offline");
      },
      discard: () => (dirty = false),
    });
    const res = await r.saveAll();
    expect(res.ok).toBe(false);
    expect(res.failed[0]).toEqual({ label: "Notas da sessão", message: "offline" });
    expect(r.anyDirty()).toBe(true);
  });
  it("salvar com sucesso limpa; descartar chama discard só dos sujos", async () => {
    const r = new UnsavedRegistry();
    let a = true;
    const discardB = vi.fn();
    r.set("a", { label: "A", isDirty: () => a, save: async () => void (a = false), discard: () => {} });
    r.set("b", { label: "B", isDirty: () => false, save: async () => {}, discard: discardB });
    expect((await r.saveAll()).ok).toBe(true);
    expect(r.anyDirty()).toBe(false);
    r.discardAll();
    expect(discardB).not.toHaveBeenCalled();
  });
  it("save que retorna mas deixa pendência conta como falha", async () => {
    const r = new UnsavedRegistry();
    r.set("x", { label: "X", isDirty: () => true, save: async () => {}, discard: () => {} });
    expect((await r.saveAll()).ok).toBe(false);
  });
});

describe("guard de navegação", () => {
  it("bloqueia troca de página e de aba, não outros parâmetros", () => {
    expect(isGuardedNavigation({ pathname: "/a" }, { pathname: "/b" })).toBe(true);
    expect(
      isGuardedNavigation(
        { pathname: "/c", search: { tab: "genogram" } },
        { pathname: "/c", search: { tab: "sessions" } },
      ),
    ).toBe(true);
    expect(
      isGuardedNavigation(
        { pathname: "/c", search: { tab: "genogram" } },
        { pathname: "/c", search: { tab: "genogram", person: "x" } },
      ),
    ).toBe(false);
  });
});

describe("KeyedDebounce da planilha", () => {
  it("flush envia já, acumulando campos; falha devolve o patch", async () => {
    vi.useFakeTimers();
    const sent: [string, Record<string, unknown>][] = [];
    let fail = true;
    const q = new KeyedDebounce<Record<string, unknown>>(async (k, p) => {
      if (fail) throw new Error("rede");
      sent.push([k, p]);
    });
    q.push("p1", { full_name: "A" });
    q.push("p1", { notes: "n" });
    await expect(q.flush()).rejects.toThrow("rede");
    expect(q.hasPending()).toBe(true);
    fail = false;
    await q.flush();
    expect(sent).toEqual([["p1", { full_name: "A", notes: "n" }]]);
    expect(q.hasPending()).toBe(false);
    vi.useRealTimers();
  });
  it("edição feita durante envio com falha não é sobrescrita", async () => {
    const d = deferred();
    const q = new KeyedDebounce<Record<string, unknown>>(() => d.promise);
    q.push("p1", { full_name: "A" });
    const f = q.flush();
    q.push("p1", { full_name: "B" });
    d.reject(new Error("x"));
    await expect(f).rejects.toThrow();
    // o valor mais novo (B) vence
    const sent: unknown[] = [];
    const q2 = q as unknown as { send: (k: string, p: unknown) => Promise<void> };
    q2.send = async (_k, p) => void sent.push(p);
    await q.flush();
    expect(sent).toEqual([{ full_name: "B" }]);
    q.discard();
  });
  it("discard limpa timers e pendências", () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => {});
    const q = new KeyedDebounce(send);
    q.push("p1", { a: 1 });
    q.discard();
    vi.advanceTimersByTime(2000);
    expect(send).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
