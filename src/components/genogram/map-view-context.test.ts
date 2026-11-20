import { describe, expect, it } from "vitest";
import { readMapViewAnchor } from "./map-view-context";

describe("contexto entre vistas do genossociograma", () => {
  it("mantém a pessoa visível selecionada no mesmo ponto e na mesma escala relativa", () => {
    const people = [
      { id: "center", x: 400, y: 200 },
      { id: "selected", x: 600, y: 100 },
    ];
    expect(readMapViewAnchor(people, 800, 400, 1.25, "selected")).toEqual({
      personId: "selected",
      horizontal: 0.75,
      vertical: 0.25,
      scale: 1.25,
    });
  });

  it("usa uma pessoa visível quando a seleção ficou fora da área após deslocar o mapa", () => {
    const people = [
      { id: "outside", x: 802, y: 200 },
      { id: "visible", x: 50, y: 35 },
    ];
    expect(readMapViewAnchor(people, 800, 400, 1, "outside")?.personId).toBe("visible");
    expect(readMapViewAnchor(people, 0, 400, 1)).toBeUndefined();
  });
});
