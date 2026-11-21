// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ClientIntake } from "@/lib/intake";
import { IntakeForm } from "./intake-form";

const storage = vi.hoisted(() => ({
  row: {} as Partial<ClientIntake>,
  changes: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "client_intakes") throw new Error("Teste isolado da anamnese");
      let patch: Partial<ClientIntake> | undefined;
      let expected: unknown;
      const query = {
        select: () => query,
        update: (values: Partial<ClientIntake>) => {
          patch = values;
          return query;
        },
        eq: (key: string, value: unknown) => {
          if (key === "updated_at") expected = value;
          return query;
        },
        maybeSingle: async () => {
          if (!patch) return { data: storage.row, error: null };
          if (expected !== storage.row.updated_at) return { data: null, error: null };
          storage.row = { ...storage.row, ...patch, updated_at: `revision-${++storage.changes}` };
          return { data: storage.row, error: null };
        },
      };
      return query;
    },
  },
}));

afterEach(cleanup);

it("mostra três versões e mantém disponível o rascunho de outra aba ao mesclar alterações", async () => {
  storage.row = {
    updated_at: "revision-0",
    presenting_intention: "Relato inicial",
    signature_notes: "Observação anterior",
  };
  storage.changes = 0;
  const renderTab = (label: string) => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    render(
      <section aria-label={label}>
        <QueryClientProvider client={qc}>
          <IntakeForm clientId="caso-sintetico" professionalId="conta-sintetica" />
        </QueryClientProvider>
      </section>,
    );
    return within(screen.getByRole("region", { name: label }));
  };
  const first = renderTab("Primeira aba");
  const second = renderTab("Segunda aba");
  const firstAnswer = await first.findByRole("textbox", { name: /intenção do atendimento/i });
  const secondAnswer = (await second.findByRole("textbox", {
    name: /intenção do atendimento/i,
  })) as HTMLTextAreaElement;

  fireEvent.change(firstAnswer, { target: { value: "Resposta da primeira aba" } });
  fireEvent.click(first.getByRole("button", { name: "Salvar agora" }));
  await first.findByText(/anamnese salva às/i);

  fireEvent.change(secondAnswer, { target: { value: "Rascunho da segunda aba" } });
  fireEvent.change(second.getByRole("textbox", { name: /observações sobre a grafia/i }), {
    target: { value: "Outra pergunta da segunda aba" },
  });
  fireEvent.click(second.getByRole("button", { name: "Salvar agora" }));
  const review = within(await second.findByRole("region", { name: "Conflitos de edição" }));
  expect(review.getByText("Relato inicial")).toBeTruthy();
  expect(review.getByText("Resposta da primeira aba")).toBeTruthy();
  expect(review.getByText("Rascunho da segunda aba")).toBeTruthy();
  expect(secondAnswer.value).toBe("Rascunho da segunda aba");
  expect(storage.row).toMatchObject({
    presenting_intention: "Resposta da primeira aba",
    signature_notes: "Outra pergunta da segunda aba",
  });

  fireEvent.click(review.getByRole("button", { name: "Salvar meu rascunho" }));
  await waitFor(() => expect(storage.row.presenting_intention).toBe("Rascunho da segunda aba"));
  await waitFor(() =>
    expect(second.queryByRole("region", { name: "Conflitos de edição" })).toBeNull(),
  );

  fireEvent.change(firstAnswer, { target: { value: "Outra tentativa da primeira aba" } });
  fireEvent.click(first.getByRole("button", { name: "Salvar agora" }));
  const otherReview = within(await first.findByRole("region", { name: "Conflitos de edição" }));
  fireEvent.click(otherReview.getByRole("button", { name: "Usar versão salva" }));
  expect((firstAnswer as HTMLTextAreaElement).value).toBe("Rascunho da segunda aba");
  expect(first.queryByRole("region", { name: "Conflitos de edição" })).toBeNull();
});
