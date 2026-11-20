import { describe, expect, it } from "vitest";
import { nameSearchPattern } from "./client-index";

describe("busca pelo nome e nome de preferência", () => {
  it("aceita acentos, variações de caixa e sobrenomes intermediários", () => {
    const pattern = new RegExp(nameSearchPattern("Joao Araujo"), "iu");
    expect(pattern.test("João Silva de Araújo")).toBe(true);
    expect(pattern.test("João da Cunha")).toBe(false);
  });

  it("não transfere pontuação digitada para operadores do filtro", () => {
    expect(nameSearchPattern(' ,() " % * ')).toBe("");
    expect(nameSearchPattern("Ana%Carla")).not.toMatch(/[%(),"]/);
  });
});
