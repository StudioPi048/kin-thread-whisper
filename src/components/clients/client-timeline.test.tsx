// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PersonRow } from "@/lib/patterns";
import { ClientTimeline } from "./client-timeline";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("Teste isolado da linha do tempo");
    },
  },
}));

const caseId = "01000000-0000-4000-8000-000000000010";
const firstId = "01000000-0000-4000-8000-000000000011";
const secondId = "01000000-0000-4000-8000-000000000012";
const person = (partial: Partial<PersonRow>) => ({
  client_id: caseId,
  life_events: [],
  ...partial,
});
afterEach(cleanup);
window.scrollTo = () => {};

it("mantém seleção entre lista, panorama, zoom e retorno e leva à mesma ficha", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  qc.setQueryData(["clinical-intel", caseId], {
    persons: [
      person({
        id: firstId,
        is_proband: true,
        full_name: "Pessoa sintética",
        birth_date: "1981-01-02",
      }),
      person({
        id: secondId,
        full_name: "Familiar sintético",
        relationship_to_proband: "Mãe",
        birth_date: "1982-01-01",
        death_date_partial: "07/04",
      }),
      person({
        id: "historic",
        full_name: "Antepassado sintético",
        birth_date: "1940-01-01",
        is_deceased: true,
      }),
    ],
    relationships: [],
  });
  const root = createRootRoute({ component: Outlet });
  const dossier = createRoute({
    getParentRoute: () => root,
    path: "/app/clientes/$clientId",
    component: () => <ClientTimeline clientId={caseId} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([dossier]),
    history: createMemoryHistory({ initialEntries: [`/app/clientes/${caseId}`] }),
    Wrap: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    isServer: false,
  });
  await router.load();
  render(<RouterProvider router={router} />);

  const chart = within(await screen.findByRole("region", { name: "Panorama cronológico" }));
  const list = within(screen.getByRole("region", { name: "Acontecimentos" }));
  const listButton = screen.getByRole("button", { name: "Lista" });
  const selection = list.getByRole("button", { name: /02\/01\/1981.*Pessoa sintética/i });
  fireEvent.click(listButton);
  fireEvent.click(selection);
  expect(selection.getAttribute("aria-pressed")).toBe("true");
  expect(listButton.getAttribute("aria-pressed")).toBe("true");
  expect(list.getByRole("link", { name: "Ver no mapa" }).getAttribute("href")).toContain(
    `person=${firstId}`,
  );
  expect(list.getByRole("link", { name: "Ver ficha na planilha" }).getAttribute("href")).toContain(
    "tab=clan",
  );
  expect(list.getByRole("heading", { name: /dia e mês, sem ano/i })).toBeTruthy();
  expect(list.getByRole("heading", { name: /sem data para o gráfico/i })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Panorama" }));
  fireEvent.click(chart.getByRole("button", { name: "Aproximar década de 1980" }));
  expect(chart.getByText("1980 – 1989")).toBeTruthy();
  expect(selection.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(chart.getByRole("button", { name: /ver 2 registros próximos/i }));
  expect(chart.getByRole("region", { name: /registros próximos na cronologia/i })).toBeTruthy();
  fireEvent.click(chart.getByRole("button", { name: "Voltar ao intervalo anterior" }));
  expect(chart.getByText("1940 – 1982")).toBeTruthy();
  expect(selection.getAttribute("aria-pressed")).toBe("true");

  fireEvent.change(list.getByRole("combobox", { name: /agrupar acontecimentos/i }), {
    target: { value: "decade" },
  });
  expect(list.getByRole("heading", { name: "1980–1989" })).toBeTruthy();
  fireEvent.change(list.getByRole("combobox", { name: /agrupar acontecimentos/i }), {
    target: { value: "generation" },
  });
  expect(list.getByRole("heading", { name: /geração 0/i })).toBeTruthy();
});
