// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ConsultanteDemo from "./consultante-demo";

const sofiaName = "Sofia Andrade Lima";
const helenaName = "Helena Andrade Nogueira";
const carlosName = "Carlos Augusto Nogueira";
const gilbertoName = "Gilberto Henrique Lima";
const map = () => screen.getByRole("group", { name: "Genossociograma 2D" });
const spatial = () => screen.getByRole("region", { name: "Área de navegação do mapa 3D" });
const clickButton = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

function choose(label: string, option: string) {
  const input = screen.getByLabelText(label);
  const value = (within(input).getByRole("option", { name: option }) as HTMLOptionElement).value;
  fireEvent.change(input, { target: { value } });
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("mostra toda a família, separa as duas uniões e mantém a revisão e a filiação nas duas vistas", () => {
  render(<ConsultanteDemo />);
  const sofia = within(map()).getByRole("button", { name: /Sofia Andrade Lima, Meia-irmã/ });
  expect(within(map()).getAllByRole("button")).toHaveLength(8);
  expect(map().querySelectorAll('[data-generation="0"]')).toHaveLength(3);
  expect(sofia.dataset.generation).toBe("0");
  expect(map().textContent).not.toContain("$");

  const helena = within(map()).getByRole("button", {
    name: /Helena Andrade Nogueira, Consultante/,
  });
  const origin = (person: HTMLElement) =>
    map()
      .querySelector(`[data-child-ids~="${person.dataset.personId}"]`)
      ?.getAttribute("data-union-id");
  expect(origin(sofia)).toBeTruthy();
  expect(origin(helena)).toBeTruthy();
  expect(origin(sofia)).not.toBe(origin(helena));

  fireEvent.click(within(map()).getByRole("button", { name: /Mariana Beatriz Andrade/ }));
  clickButton("3D");
  expect(within(spatial()).getAllByRole("button")).toHaveLength(8);
  expect(spatial().querySelectorAll('[data-generation="0"]')).toHaveLength(3);
  clickButton("Abrir uniões");
  expect(screen.getByText("Uniões de Mariana Beatriz Andrade")).toBeTruthy();
  expect(screen.getByText(new RegExp(gilbertoName), { selector: "strong" })).toBeTruthy();

  fireEvent.click(within(spatial()).getByRole("button", { name: /Sofia Andrade Lima, Meia-irmã/ }));
  clickButton("Revisar filiação");
  expect(document.activeElement).toBe(screen.getByLabelText("Vínculo a revisar"));
  choose("Vínculo a revisar", gilbertoName);
  choose("Genitor proposto", carlosName);
  expect(spatial().querySelector('[data-parentage-track="proposed"]')).toBeTruthy();

  clickButton("2D");
  expect(map().querySelector('[data-parentage-track="proposed"]')).toBeTruthy();
  clickButton("Confirmar filiação");
  expect(screen.getByText("Filiação alterada neste exercício.")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Revisar filiação" }));
  const updatedSofia = within(map()).getByRole("button", { name: /Sofia Andrade Lima, Irmã,/ });
  expect(origin(updatedSofia)).toBe(origin(helena));

  clickButton("3D");
  expect(within(spatial()).getByRole("button", { name: /Sofia Andrade Lima, Irmã,/ })).toBeTruthy();
  clickButton("Desfazer última edição");
  expect(screen.getByText("Filiação anterior restaurada.")).toBeTruthy();
  expect(
    within(spatial()).getByRole("button", { name: /Sofia Andrade Lima, Meia-irmã/ }),
  ).toBeTruthy();
});

it("salva o nome completo, compartilha com a linha do tempo e repõe o caso fictício ao reiniciar", () => {
  render(<ConsultanteDemo />);
  clickButton("Editar nome");
  const field = screen.getByLabelText("Nome completo");
  expect(document.activeElement).toBe(field);
  const changedName = "Helena Andrade Nogueira de Oliveira";
  fireEvent.change(field, { target: { value: changedName } });
  clickButton("Salvar nome");
  expect(within(map()).getByRole("button", { name: new RegExp(changedName) })).toBeTruthy();

  clickButton("3D");
  expect(within(spatial()).getByRole("button", { name: new RegExp(changedName) })).toBeTruthy();
  clickButton("Linha do tempo");
  expect(
    within(screen.getByRole("list", { name: "Linha do tempo do caso fictício" })).getByRole(
      "button",
      { name: new RegExp(changedName) },
    ),
  ).toBeTruthy();

  clickButton("Reiniciar exercício");
  expect(within(map()).getByRole("button", { name: new RegExp(`^${helenaName},`) })).toBeTruthy();
  expect(within(map()).queryByRole("button", { name: new RegExp(changedName) })).toBeNull();
});

it("move na horizontal e restaura a posição ao desfazer na outra vista", () => {
  render(<ConsultanteDemo />);
  const sofia = () => within(map()).getByRole("button", { name: /Sofia Andrade Lima, Meia-irmã/ });
  const before = sofia().style.cssText;
  fireEvent.click(sofia());
  fireEvent.click(screen.getByText("Ajustar posição"));
  clickButton("Mover familiar para a direita");
  expect(screen.getByText("Posição horizontal atualizada.")).toBeTruthy();
  expect(sofia().style.cssText).not.toBe(before);
  expect(sofia().dataset.generation).toBe("0");

  clickButton("3D");
  expect((screen.getByRole("button", { name: "Mover pessoa" }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  clickButton("Desfazer última edição");
  clickButton("2D");
  expect(sofia().style.cssText).toBe(before);
});
