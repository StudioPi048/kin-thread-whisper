// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConsultanteDemo from "./consultante-demo";

afterEach(() => vi.unstubAllGlobals());

it("mostra meio-irmã, une os pais correspondentes no 3D e confirma e desfaz a filiação", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  render(<ConsultanteDemo />);
  const map = screen.getByRole("group", { name: "Genossociograma 2D" });
  const sofia = within(map).getByRole("button", { name: /Sofia.*Meia-irmã/ });
  const consultante = within(map).getByRole("button", { name: /Helena.*Consultante/ });
  expect(sofia.style.top).toBe(consultante.style.top);
  fireEvent.click(within(map).getByRole("button", { name: /Mariana/ }));
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  const open = screen.getByRole("button", {
    name: "Abrir uniões",
  }) as HTMLButtonElement;
  expect(open.disabled).toBe(false);
  fireEvent.click(open);
  expect(screen.getByText("Uniões de Mariana (fictícia)")).toBeTruthy();
  expect(screen.getByText(/Gilberto \(fictício\)/, { selector: "strong" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "2D" }));
  fireEvent.click(screen.getByRole("button", { name: /Sofia.*Meia-irmã/ }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar filiação" }));
  fireEvent.change(screen.getByLabelText("Natureza do vínculo"), { target: { value: "unknown" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar filiação" }));
  expect(screen.getByText("Filiação confirmada neste exercício.")).toBeTruthy();
  expect(screen.getByText("Por confirmar")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Desfazer filiação" }));
  expect(screen.getByText("Filiação anterior restaurada.")).toBeTruthy();
  expect(screen.queryByText("Por confirmar")).toBeNull();
});
