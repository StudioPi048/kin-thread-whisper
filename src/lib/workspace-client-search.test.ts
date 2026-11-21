import { expect, it, vi } from "vitest";
import { readCasePages } from "./read-case-pages";
import { readWorkspaceClientPage } from "./workspace-client-search";

it("usa o total do servidor e mantém a última página da busca acessível", async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: {
      clients: [{ id: "1205", full_name: "Último caso", preferred_name: null, status: "active" }],
      total: 1205,
    },
    error: null,
  });
  const client = { rpc } as unknown as Parameters<typeof readWorkspaceClientPage>[0];
  const page = await readWorkspaceClientPage(client, { search: "caso", offset: 1204, limit: 24 });
  expect(rpc).toHaveBeenCalledWith("search_workspace_clients", {
    _search: "caso",
    _status: "active",
    _offset: 1204,
    _limit: 24,
    _details: false,
    _without_upcoming: false,
  });
  expect(page).toMatchObject({ total: 1205, hasMore: false, clients: [{ id: "1205" }] });
});

it("continua lendo os atendimentos quando a API limita a página abaixo do solicitado", async () => {
  const ids = ["a", "b", "c", "d", "e"];
  const fetchPage = vi.fn(async (after: string | null) => ({
    data: ids
      .filter((id) => !after || id > after)
      .slice(0, 2)
      .map((id) => ({ id })),
    error: null,
  }));
  expect((await readCasePages(fetchPage, ({ id }) => id)).map(({ id }) => id)).toEqual(ids);
  expect(fetchPage.mock.calls).toEqual([
    [null, 500],
    ["b", 500],
    ["d", 500],
    ["e", 500],
  ]);
});
