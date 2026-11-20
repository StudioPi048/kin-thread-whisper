import { describe, it, expect } from "vitest";
import {
  LayoutHistory,
  saveDraft,
  readDraft,
  clearDraft,
  clampHorizontalMove,
  type Snapshot,
} from "./layout-history";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe("desfazer/refazer de posições", () => {
  it("desfaz e refaz na ordem certa", () => {
    const h = new LayoutHistory();
    h.push({ a: [0, 0] });
    expect(h.undo({ a: [10, 0] })).toEqual({ a: [0, 0] });
    expect(h.redo({ a: [0, 0] })).toEqual({ a: [10, 0] });
  });
  it("novo movimento apaga o refazer", () => {
    const h = new LayoutHistory();
    h.push({ a: [0, 0] });
    h.undo({ a: [1, 0] });
    h.push({ a: [0, 0] });
    expect(h.canRedo).toBe(false);
  });
});

describe("deslocamento horizontal", () => {
  const current: Snapshot = { a: [0, 0], b: [180, 0], c: [360, 0], p: [40, 320] };

  it("limita o arraste aos vizinhos da mesma faixa", () => {
    expect(clampHorizontalMove(current, "a", 300, 140, 180)).toBe(40);
    expect(clampHorizontalMove(current, "b", -300, 140, 180)).toBe(-40);
    expect(clampHorizontalMove(current, "p", 700, 140, 180)).toBe(700);
  });

  it("permite mover para longe de um vizinho encostado e ignora pedidos inválidos", () => {
    const touching: Snapshot = { a: [0, 0], b: [140, 0] };
    expect(clampHorizontalMove(touching, "a", 300, 140, 180)).toBe(0);
    expect(clampHorizontalMove(touching, "a", -300, 140, 180)).toBe(-300);
    expect(clampHorizontalMove(current, "a", NaN, 140, 180)).toBe(0);
    expect(clampHorizontalMove(current, "ausente", 40, 140, 180)).toBe(0);
  });
});

describe("rascunho por usuário+caso", () => {
  it("isola por usuário e caso e guarda só coordenadas", () => {
    const s = mem();
    saveDraft("u1", "c1", { p1: [5, 0] }, s, 1);
    expect(readDraft("u1", "c1", s)).toEqual({ at: 1, positions: { p1: [5, 0] } });
    expect(readDraft("u2", "c1", s)).toBeNull();
    expect(readDraft("u1", "c2", s)).toBeNull();
    clearDraft("u1", "c1", s);
    expect(readDraft("u1", "c1", s)).toBeNull();
  });
  it("descarta valores inválidos", () => {
    const s = mem();
    s.setItem(
      "genealiz:layout-draft:u:c",
      JSON.stringify({ at: 1, positions: { a: [1, 2], b: "x", c: { name: "Maria" } } }),
    );
    expect(readDraft("u", "c", s)!.positions).toEqual({ a: [1, 2] });
  });
});
