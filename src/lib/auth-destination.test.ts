import { describe, expect, it } from "vitest";
import { workspaceDestination } from "./auth-destination";

describe("destino após autenticação", () => {
  it("preserva a aba e a pessoa de um dossiê", () => {
    const route = "/app/clientes/caso?tab=genogram&person=parente#abertura";
    expect(workspaceDestination(route)).toBe(route);
    expect(workspaceDestination("/app")).toBe("/app");
  });

  it("recusa destinos fora da área autenticada", () => {
    for (const route of [
      "//externo.invalid",
      "/app/../../auth",
      "/app%2fclientes",
      "/application",
      "/app/\\externo.invalid",
      "https://externo.invalid/app",
    ]) {
      expect(workspaceDestination(route)).toBeUndefined();
    }
  });
});
