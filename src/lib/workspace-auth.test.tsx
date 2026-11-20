// @vitest-environment jsdom
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as AuthRoute } from "../routes/auth";
import { Route as WorkspaceRoute } from "../routes/_authenticated";
import { withAuthCheckTimeout } from "./workspace-auth";

const { getSession, getUser } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, getUser } },
}));

window.scrollTo = vi.fn();

const root = createRootRoute();
const home = createRoute({ getParentRoute: () => root, path: "/" });
const auth = AuthRoute.update({ path: "/auth", id: "/auth", getParentRoute: () => root } as never);
const workspace = WorkspaceRoute.update({
  id: "/_authenticated",
  getParentRoute: () => root,
  component: Outlet,
} as never);
const dossier = createRoute({
  getParentRoute: () => workspace,
  path: "/app/clientes/$clientId",
  component: () => <p>Dossiê de teste</p>,
});
const routeTree = root.addChildren([home, auth, workspace.addChildren([dossier])]);

function setup(href = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    defaultPreload: "intent",
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  getSession.mockReset();
  getUser.mockReset();
});

afterEach(cleanup);

describe("entrada no Genealiz", () => {
  const destination = "/app/clientes/caso?tab=genogram&person=parente#abertura";
  const user = { id: "fixture" };

  it("pré-carrega Entrar sem consultar a sessão e abre o formulário com a consulta pendente", async () => {
    let resolveSession!: (value: unknown) => void;
    getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const router = setup();

    await act(async () => {
      await router.preloadRoute({ to: "/auth" });
      expect(getSession).not.toHaveBeenCalled();
      await router.navigate({ to: "/auth" });
    });
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
    expect(getSession).toHaveBeenCalledTimes(1);
    await act(async () => resolveSession({ data: { session: null }, error: null }));
  });

  it("retoma o dossiê de uma sessão verificada e preserva o destino completo", async () => {
    getSession.mockResolvedValue({ data: { session: { user } }, error: null });
    getUser.mockResolvedValue({ data: { user }, error: null });
    const router = setup(`/auth?redirect=${encodeURIComponent(destination)}`);

    expect(await screen.findByText("Dossiê de teste")).toBeTruthy();
    expect(router.state.location.href).toBe(destination);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("exibe Entrar quando o dossiê recusa uma sessão antiga", async () => {
    getSession.mockResolvedValue({ data: { session: { user } }, error: null });
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    const router = setup(destination);

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeTruthy();
    expect(router.state.location.search).toMatchObject({ redirect: destination, reauth: true });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("encerra a espera por uma consulta de autenticação sem resposta", async () => {
    vi.useFakeTimers();
    try {
      const check = withAuthCheckTimeout(() => new Promise(() => {}));
      const result = expect(check).rejects.toThrow("A verificação da sessão demorou demais");
      await vi.runAllTimersAsync();
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
