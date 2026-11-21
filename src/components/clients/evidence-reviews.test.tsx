// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  Outlet,
  RouterProvider,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_authenticated.app.ia-clinica";
import { UnsavedProvider } from "@/components/unsaved/unsaved-guard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("Consulta fora dos dados sintéticos");
    },
  },
}));

const userId = "01000000-0000-4000-8000-000000000001";
const caseId = "01000000-0000-4000-8000-000000000002";
const otherCaseId = "01000000-0000-4000-8000-000000000003";
const relationIds = [
  "01000000-0000-4000-8000-000000000004",
  "01000000-0000-4000-8000-000000000005",
];

afterEach(cleanup);
window.scrollTo = () => {};

it("conserva revisões durante a comparação e protege um rascunho ao mudar de caso", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(
    ["clients", "evidence", userId],
    [
      { id: caseId, full_name: "Caso teste", status: "active" },
      { id: otherCaseId, full_name: "Outro caso", status: "active" },
    ],
  );
  queryClient.setQueryData(["clinical-intel", caseId], {
    client: { full_name: "Caso teste", presenting_complaint: null },
    persons: ["Familiar A", "Familiar B"].map((full_name, n) => ({
      id: String(n),
      full_name,
      occupation: "Ofício teste",
      health_conditions: ["Condição teste"],
    })),
    relationships: relationIds.map((id, index) => ({
      id,
      from_person_id: "0",
      to_person_id: "1",
      relationship_type: "emotional",
      qualifier: index === 0 ? "rupture" : "conflict",
    })),
  });
  queryClient.setQueryData(["hypothesis-reviews", caseId], []);
  const root = createRootRouteWithContext<{ user: { id: string } }>()({ component: Outlet });
  const route = Route.update({
    path: "/app/ia-clinica",
    getParentRoute: () => root,
  } as Parameters<typeof Route.update>[0]);
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [`/app/ia-clinica?caseId=${caseId}`] }),
    context: { user: { id: userId } },
    isServer: false,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    InnerWrap: UnsavedProvider,
  });
  await router.load();
  render(<RouterProvider router={router} />);

  const health = await screen.findByRole("checkbox", { name: /condição de saúde recorrente/i });
  const work = screen.getByRole("checkbox", { name: /profissão repetida/i });
  const relationships = screen
    .getByRole("checkbox", { name: /2 vínculos com ruptura ou conflito/i })
    .closest("li")!;
  fireEvent.click(within(relationships).getByText(/registros consultados/i));
  const sources = within(relationships).getAllByRole("link", { name: "Abrir vínculo no mapa" });
  expect(
    sources.map((link) =>
      new URL(link.getAttribute("href")!, "https://teste.invalid").searchParams.get("relation"),
    ),
  ).toEqual(relationIds);
  fireEvent.click(health);
  fireEvent.click(screen.getByRole("button", { name: /ver hipóteses/i }));
  const review = screen
    .getByRole("heading", { name: "Repetição de condição de saúde" })
    .closest("article")!;
  const note = within(review).getByRole("textbox", {
    name: /justificativa/i,
  }) as HTMLTextAreaElement;
  fireEvent.change(note, { target: { value: "Rascunho fictício." } });
  fireEvent.click(work);
  expect(screen.getByRole("heading", { name: "Repetição profissional" })).toBeTruthy();
  expect(note.value).toBe("Rascunho fictício.");
  fireEvent.click(health);
  expect(screen.queryByRole("heading", { name: "Repetição de condição de saúde" })).toBeNull();
  fireEvent.click(health);
  expect(within(review).getByRole("textbox", { name: /justificativa/i })).toBe(note);
  expect(note.value).toBe("Rascunho fictício.");

  fireEvent.change(screen.getByRole("combobox", { name: "Caso" }), {
    target: { value: otherCaseId },
  });
  expect(await screen.findByRole("alertdialog", { name: "Há alterações não salvas" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ficar aqui" }));
  expect(router.state.location.search).toEqual({ caseId });
  expect(note.value).toBe("Rascunho fictício.");
});
