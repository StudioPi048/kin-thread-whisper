// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, preferencesKey } from "@/lib/preferences";
import { AccountPreferences } from "./account-sections";

const backend = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => backend } }));

afterEach(cleanup);

it("bloqueia edições enquanto confirma preferências e reabre o formulário com o resultado", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const userId = "conta-teste";
  const key = preferencesKey(userId);
  queryClient.setQueryData(key, DEFAULT_PREFERENCES);
  const confirmed = { ...DEFAULT_PREFERENCES, textSize: "large" } as const;
  const result = { data: { preferences: confirmed }, error: null };
  let releaseSave!: (value: typeof result) => void;
  const saving = new Promise<typeof result>((resolve) => {
    releaseSave = resolve;
  });
  backend.update.mockReturnValue({
    eq: () => ({ select: () => ({ maybeSingle: () => saving }) }),
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AccountPreferences userId={userId} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("radio", { name: "Maior" }));
  const button = screen.getByRole("button", { name: "Salvar preferências" });
  fireEvent.click(button);
  await waitFor(() => expect(backend.update).toHaveBeenCalledWith({ preferences: confirmed }));

  const week = screen.getByRole("radio", { name: "Semana" }) as HTMLInputElement;
  expect(week.matches(":disabled")).toBe(true);
  expect(screen.getByRole("checkbox").matches(":disabled")).toBe(true);
  await act(async () => releaseSave(result));
  await screen.findByText("Salvo");
  expect(queryClient.getQueryData(key)).toEqual(confirmed);
  expect(week.matches(":disabled")).toBe(false);

  fireEvent.click(week);
  expect(week.checked).toBe(true);
  expect(button.matches(":disabled")).toBe(false);
});
