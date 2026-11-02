// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { UnsavedProvider, useUnsaved } from "./unsaved-guard";

afterEach(cleanup);
window.scrollTo = (() => {}) as typeof window.scrollTo;

const state = { dirty: true, failSave: false, saved: 0, discarded: 0 };

function Editor() {
  useUnsaved("t", {
    label: "Notas da sessão",
    isDirty: () => state.dirty,
    save: async () => {
      if (state.failSave) throw new Error("offline");
      state.saved++;
      state.dirty = false;
    },
    discard: () => {
      state.discarded++;
      state.dirty = false;
    },
  });
  return (
    <div>
      <p>editor</p>
      <Link to="/outra">sair</Link>
      <Link to="/" search={{ tab: "b" }}>
        aba b
      </Link>
    </div>
  );
}

function setup() {
  const root = createRootRoute({
    component: () => (
      <UnsavedProvider>
        <Outlet />
      </UnsavedProvider>
    ),
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    validateSearch: (s: Record<string, unknown>) => ({ tab: s.tab as string | undefined }),
    component: Editor,
  });
  const other = createRoute({
    getParentRoute: () => root,
    path: "/outra",
    component: () => <p>outra página</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([home, other]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("guard de saída (TanStack useBlocker)", () => {
  it("navegação interna com pendência abre o diálogo; Ficar mantém a página", async () => {
    Object.assign(state, { dirty: true, failSave: false, saved: 0, discarded: 0 });
    setup();
    fireEvent.click(await screen.findByText("sair"));
    expect(await screen.findByText("Há alterações não salvas")).toBeTruthy();
    fireEvent.click(screen.getByText("Ficar aqui"));
    await waitFor(() => expect(screen.queryByText("Há alterações não salvas")).toBeNull());
    expect(screen.getByText("editor")).toBeTruthy();
  });

  it("troca de aba também é bloqueada", async () => {
    Object.assign(state, { dirty: true, failSave: false, saved: 0, discarded: 0 });
    const router = setup();
    fireEvent.click(await screen.findByText("aba b"));
    expect(await screen.findByText("Há alterações não salvas")).toBeTruthy();
    expect((router.state.location.search as { tab?: string }).tab).toBeUndefined();
  });

  it("salvar com falha mostra erro e não sai; com sucesso, sai", async () => {
    Object.assign(state, { dirty: true, failSave: true, saved: 0, discarded: 0 });
    setup();
    fireEvent.click(await screen.findByText("sair"));
    fireEvent.click(await screen.findByText("Salvar e sair"));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/offline/)).toBeTruthy();
    expect(screen.getByText("editor")).toBeTruthy();
    state.failSave = false;
    await act(async () => {
      fireEvent.click(screen.getByText("Salvar e sair"));
    });
    expect(await screen.findByText("outra página")).toBeTruthy();
    expect(state.saved).toBe(1);
  });

  it("descartar chama discard e sai; sem pendência não bloqueia", async () => {
    Object.assign(state, { dirty: true, failSave: false, saved: 0, discarded: 0 });
    setup();
    fireEvent.click(await screen.findByText("sair"));
    fireEvent.click(await screen.findByText("Descartar e sair"));
    expect(await screen.findByText("outra página")).toBeTruthy();
    expect(state.discarded).toBe(1);
    cleanup();
    Object.assign(state, { dirty: false });
    setup();
    fireEvent.click(await screen.findByText("sair"));
    expect(await screen.findByText("outra página")).toBeTruthy();
  });
});
