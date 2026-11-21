// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { consultanteFamily } from "@/lib/geno/fixtures";
import { GenogramCanvas } from "./genogram-canvas";
import { buildSpatialLayout, projectSpatialPeople } from "./genogram-spatial-layout";
import { GenogramSpatialView, type SpatialCameraHandle } from "./genogram-spatial-view";
import { PersonFormDialog } from "./person-form-dialog";
import { buildRenderGraph } from "./render-graph";

vi.mock("@/integrations/supabase/client", () => import("../../../design/preview/client"));
const { refreshHandles } = vi.hoisted(() => ({ refreshHandles: vi.fn() }));
vi.mock("@xyflow/react", async (load) => ({
  ...(await load<typeof import("@xyflow/react")>()),
  useUpdateNodeInternals: () => refreshHandles,
}));

const clientId = "00000000-0000-4000-8000-000000000006";
const spatial = () => screen.getByRole("region", { name: "Área de navegação do mapa 3D" });
const relationRows = async () => {
  const { data, error } = await supabase
    .from("genogram_relationships")
    .select("*")
    .eq("client_id", clientId)
    .order("id");
  expect(error).toBeNull();
  return data;
};
const peopleOnMap = () =>
  [...spatial().querySelectorAll<HTMLButtonElement>("[data-person-id]")].map((card) => ({
    id: card.dataset.personId,
    generation: Number(card.dataset.generation),
    name: card.querySelector(".geno-spatial-person-name")?.textContent,
  }));
const routesOnMap = () =>
  [...spatial().querySelectorAll("[data-rendered-route]")].map((route) => ({
    id: route.getAttribute("data-rendered-route"),
    path: route.getAttribute("d"),
    branch: route.getAttribute("data-branch"),
  }));
const cameraTransform = () =>
  spatial().querySelector(".geno-spatial-geometry > g")?.getAttribute("transform");

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m22 = 1;
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) => ({
      media,
      matches: media.includes("prefers-reduced-motion"),
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(720);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

it("mede os handles de conexão em lote ao abri-los e fechá-los", async () => {
  refreshHandles.mockClear();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );
  const people = () => [...document.querySelectorAll<HTMLElement>(".react-flow__node-person")];
  await waitFor(() => expect(people()).toHaveLength(35));
  const ids = people().map(({ dataset }) => dataset.id);
  expect(refreshHandles).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
  expect(screen.getAllByTitle("Arraste para conectar")).toHaveLength(35);
  expect(screen.getAllByTitle("Solte a conexão aqui")).toHaveLength(35);
  expect(refreshHandles).toHaveBeenNthCalledWith(1, ids);
  fireEvent.click(people().find((node) => node.textContent?.includes("Consultante"))!);
  expect(screen.getByText(/escolha a segunda pessoa/)).toBeTruthy();
  expect(refreshHandles).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByTitle("Arraste para conectar")).toBeNull();
  expect(refreshHandles).toHaveBeenNthCalledWith(2, ids);
  expect(refreshHandles).toHaveBeenCalledTimes(2);
  expect(people().map(({ dataset }) => dataset.id)).toEqual(ids);
});

it("mantém um cartão no Tab e percorre os outros nomes completos pelas setas", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "3D" }));
  await waitFor(() => expect(peopleOnMap()).toHaveLength(35));
  const viewport = spatial();
  const root = viewport.querySelector<HTMLButtonElement>('[data-reference="true"]')!;
  expect(viewport.querySelectorAll("[data-person-id][tabindex='0']")).toHaveLength(1);
  root.focus();
  fireEvent.keyDown(root, { key: "ArrowRight" });
  const focused = document.activeElement as HTMLButtonElement;
  expect(focused).not.toBe(root);
  expect(focused.dataset.generation).toBe("0");
  expect(focused.getAttribute("aria-label")).toMatch(/Irmã|Irmão/);
  expect(viewport.querySelectorAll("[data-person-id][tabindex='0']")).toHaveLength(1);
});

it("cancela a adição rápida sem ficha e salva pessoa e filiação na mesma operação", async () => {
  const subject = (
    await supabase
      .from("genogram_persons")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_proband", true)
      .single()
  ).data!;
  const people = async () => {
    const { data, error } = await supabase
      .from("genogram_persons")
      .select("*")
      .eq("client_id", clientId);
    if (error) throw error;
    return data ?? [];
  };
  const original = (await people()).length;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const close = vi.fn();
  const created = vi.fn();
  const editor = () => (
    <QueryClientProvider client={qc}>
      <PersonFormDialog
        open
        clientId={clientId}
        onOpenChange={close}
        onCreated={created}
        quickLink={{
          targetId: subject.id,
          targetName: subject.full_name,
          direction: "child",
          parents: [],
          expected: [],
        }}
      />
    </QueryClientProvider>
  );
  const cancel = render(editor());
  fireEvent.change(screen.getByLabelText("Nome completo *"), {
    target: { value: "Rascunho sem vínculo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledWith(false);
  expect(await people()).toHaveLength(original);
  cancel.unmount();
  render(editor());
  fireEvent.change(screen.getByLabelText("Nome completo *"), {
    target: { value: "Familiar fictício vinculado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar à árvore" }));
  await waitFor(() => expect(created).toHaveBeenCalledOnce());
  const [id] = created.mock.calls[0];
  try {
    expect(await people()).toHaveLength(original + 1);
    expect(await relationRows()).toContainEqual(
      expect.objectContaining({
        from_person_id: subject.id,
        to_person_id: id,
        relationship_type: "parent",
        qualifier: "unknown",
      }),
    );
  } finally {
    const args = { _client_id: clientId, _people: [id], _relationships: [] };
    const preview = await supabase.rpc("remove_genogram_selection", args);
    await supabase.rpc("remove_genogram_selection", { ...args, _expected: preview.data });
  }
});

it("preserva a edição de pessoa em memória quando outra aba altera a ficha", async () => {
  const initial = (
    await supabase
      .from("genogram_persons")
      .select("*")
      .eq("client_id", clientId)
      .eq("full_name", "Pai")
      .single()
  ).data!;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const close = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <PersonFormDialog open clientId={clientId} editing={initial} onOpenChange={close} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Nome completo *"), {
    target: { value: "Edição em rascunho" },
  });
  const remoteEdit = await supabase
    .from("genogram_persons")
    .update({ notes: "Nota da outra aba" })
    .eq("id", initial.id);
  expect(remoteEdit.error).toBeNull();
  try {
    fireEvent.click(screen.getByRole("button", { name: "Salvar dossiê" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "A ficha mudou ou foi removida em outra aba",
    );
    expect((screen.getByLabelText("Nome completo *") as HTMLInputElement).value).toBe(
      "Edição em rascunho",
    );
    expect(close).not.toHaveBeenCalled();
    const saved = (
      await supabase.from("genogram_persons").select("*").eq("id", initial.id).single()
    ).data!;
    expect(saved.full_name).toBe(initial.full_name);
    expect(saved.notes).toBe("Nota da outra aba");
  } finally {
    await supabase.from("genogram_persons").update({ notes: initial.notes }).eq("id", initial.id);
  }
});

it("abre o board estreito em escala de leitura, com ficha e panorama fora da escala", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "3D" }));
  await waitFor(() => expect(peopleOnMap()).toHaveLength(35));
  const initialPeople = peopleOnMap();
  const anchor = spatial().querySelector<HTMLButtonElement>('[data-reference="true"]')!;
  const effectiveSize = () =>
    parseFloat(anchor.style.getPropertyValue("--plaque-name-size")) *
    parseFloat(anchor.style.getPropertyValue("--plaque-scale"));
  expect(effectiveSize()).toBeGreaterThanOrEqual(11.99);
  expect(screen.getByRole("button", { name: "Ler do topo" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  const scope = within(screen.getByRole("group", { name: "Explorar ramos da família" }));
  fireEvent.click(scope.getByRole("button", { name: "Árvore inteira em 3D" }));
  expect(effectiveSize()).toBeLessThan(12);
  expect(peopleOnMap()).toEqual(initialPeople);
  fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Consultante" }));
  expect(
    within(screen.getByRole("complementary", { name: "Ficha da pessoa selecionada" })).getByRole(
      "button",
      { name: "Adicionar parente" },
    ),
  ).toBeTruthy();
  fireEvent.click(scope.getByRole("button", { name: "Ler do topo" }));
  expect(effectiveSize()).toBeGreaterThanOrEqual(11.99);
  expect(peopleOnMap()).toEqual(initialPeople);
});

it.each([
  [6, 131, 1440],
  [8, 515, 320],
])("enquadra %i gerações no board sem perder os %i nomes", (depth, size, width) => {
  const height = 720;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  const family = consultanteFamily(depth);
  const { nodes, edges } = buildRenderGraph(family.persons, family.rels, family.probandId);
  const layout = buildSpatialLayout(nodes, edges);
  const camera = createRef<SpatialCameraHandle>();
  const onSelectPerson = vi.fn();
  render(
    <GenogramSpatialView
      workbench
      nodes={nodes}
      edges={edges}
      cameraRef={camera}
      onSelectPerson={onSelectPerson}
    />,
  );

  const initialPeople = peopleOnMap();
  expect(initialPeople).toHaveLength(size);
  expect(
    initialPeople
      .filter(({ generation }) => generation === 0)
      .map(({ name }) => name)
      .sort(),
  ).toEqual(["Consultante", "Irmã", "Irmão"]);
  const verifyFrame = (ids: ReadonlySet<string>) => {
    const view = camera.current!.read()!;
    const people = projectSpatialPeople(layout, view).people.filter(({ id }) => ids.has(id));
    const screenX = width / 2 + view.x;
    const screenY = height / 2 + view.y;
    const lowerX = Math.min(
      ...people.map((person) => screenX + (person.x - person.width / 2) * view.zoom),
    );
    const upperX = Math.max(
      ...people.map((person) => screenX + (person.x + person.width / 2) * view.zoom),
    );
    const lowerY = Math.min(...people.map((person) => screenY + person.y * view.zoom));
    const upperY = Math.max(
      ...people.map((person) => screenY + (person.y + person.height) * view.zoom),
    );
    expect(lowerX).toBeGreaterThanOrEqual(0);
    expect(upperX).toBeLessThanOrEqual(width);
    expect(lowerY).toBeGreaterThanOrEqual(0);
    expect(upperY).toBeLessThanOrEqual(height);
  };
  const allIds = new Set(family.persons.map(({ id }) => id));
  expect(camera.current!.readAnchor()?.overview).toBe(true);
  verifyFrame(allIds);
  fireEvent.click(screen.getByRole("button", { name: "Vista em perspectiva" }));
  verifyFrame(allIds);
  fireEvent.click(screen.getByRole("button", { name: "Ramo materno" }));
  verifyFrame(
    new Set(
      layout.people
        .filter(({ branch, generation }) => branch === "maternal" || generation === 0)
        .map(({ id }) => id),
    ),
  );
  expect(camera.current!.readAnchor()?.overview).toBe(false);
  const distantPerson = family.persons.at(-1)!;
  const plaque = spatial().querySelector<HTMLButtonElement>(
    `[data-person-id="${distantPerson.id}"]`,
  )!;
  fireEvent.click(plaque);
  expect(onSelectPerson).toHaveBeenCalledWith(distantPerson.id);
  expect(plaque.querySelector(".geno-spatial-person-name")?.textContent).toBe(
    distantPerson.full_name,
  );
  expect(spatial().hasAttribute("data-compact-panorama")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Árvore inteira em 3D" }));
  verifyFrame(allIds);
  expect(peopleOnMap()).toEqual(initialPeople);
});

it("enquadra o cartão completo de um nome longo a 320 px sem mudar as gerações", () => {
  const boardWidth = 267;
  const boardHeight = 298;
  const renderedHeight = 342;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(boardWidth);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(boardHeight);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute("data-reading-card") ? renderedHeight : 0;
  });
  const family = consultanteFamily(8);
  const furthest = family.persons.reduce((best, person) =>
    person.full_name.length > best.full_name.length ? person : best,
  );
  const personId = furthest.id;
  const { nodes, edges } = buildRenderGraph(family.persons, family.rels, family.probandId);
  const layout = buildSpatialLayout(nodes, edges);
  const camera = createRef<SpatialCameraHandle>();
  render(
    <GenogramSpatialView
      workbench
      nodes={nodes}
      edges={edges}
      cameraRef={camera}
      onSelectPerson={vi.fn()}
      selectedPersonId={personId}
      focusRequest={{ personId }}
    />,
  );

  const plaque = spatial().querySelector<HTMLButtonElement>(`[data-person-id="${personId}"]`)!;
  expect(plaque.querySelector(".geno-spatial-person-name")?.textContent).toBe(furthest.full_name);
  const view = camera.current!.read()!;
  expect(view.readingCard).toEqual({ id: personId, height: renderedHeight });
  const { y, height } = projectSpatialPeople(layout, view, {
    id: personId,
    height: renderedHeight,
  }).people.find(({ id }) => id === personId)!;
  const top = boardHeight / 2 + view.y + y * view.zoom;
  const bottom = top + height * view.zoom;
  expect(top).toBeGreaterThan(0);
  expect(bottom).toBeLessThan(boardHeight);
  expect(
    Number.parseFloat(plaque.style.getPropertyValue("--plaque-name-size")) *
      Number.parseFloat(plaque.style.getPropertyValue("--plaque-scale")),
  ).toBeGreaterThanOrEqual(12);
  const people = peopleOnMap();
  expect(people).toHaveLength(515);
  expect(
    people
      .filter(({ generation }) => generation === 0)
      .map(({ name }) => name)
      .sort(),
  ).toEqual(["Consultante", "Irmã", "Irmão"]);
  fireEvent.click(screen.getByRole("button", { name: "Árvore inteira em 3D" }));
  expect(camera.current!.read()?.readingCard).toBeUndefined();
  expect(peopleOnMap()).toEqual(people);
});

it("realinha a pessoa em leitura quando a ficha reduz o espaço do board", () => {
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(768);
  const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(520);
  let resize: () => void = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe(element: Element) {
        if (element.classList.contains("geno-spatial-viewport")) resize = this.callback;
      }
      disconnect() {}
    },
  );
  const family = consultanteFamily();
  const personId = family.persons.at(-1)!.id;
  const { nodes, edges } = buildRenderGraph(family.persons, family.rels, family.probandId);
  const layout = buildSpatialLayout(nodes, edges);
  const camera = createRef<SpatialCameraHandle>();
  render(
    <GenogramSpatialView
      workbench
      nodes={nodes}
      edges={edges}
      cameraRef={camera}
      onSelectPerson={vi.fn()}
      selectedPersonId={personId}
      focusRequest={{ personId }}
    />,
  );
  const original = camera.current!.read()!;
  act(() => {
    width.mockReturnValue(430);
    height.mockReturnValue(280);
    resize();
  });
  const resized = camera.current!.read()!;
  const person = projectSpatialPeople(layout, resized).people.find(({ id }) => id === personId)!;
  expect(resized.zoom).toBeLessThan(original.zoom);
  expect(140 + resized.y + person.y * resized.zoom).toBeGreaterThanOrEqual(0);
  expect(spatial().hasAttribute("data-compact-panorama")).toBe(false);
});

it("abre pelo ID da união e mantém o vínculo em foco no 2D e no 3D", async () => {
  const rows = await relationRows();
  const union = rows!.find((row) => row.relationship_type === "union")!;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} focusRelationId={union.id} />
    </QueryClientProvider>,
  );
  const inspector = await screen.findByRole("region", { name: "Vínculo em foco" });
  expect(within(inspector).getByRole("button", { name: "Editar vínculo" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "3D" }));
  await waitFor(() => {
    expect(
      spatial().querySelector(`[data-union-id="union:${union.id}"][data-active]`),
    ).toBeTruthy();
  });
  expect(
    within(screen.getByRole("region", { name: "Vínculo em foco" })).getByRole("button", {
      name: "Editar vínculo",
    }),
  ).toBeTruthy();
});

it("explora os ramos em 3D, edita por ID no mapa e desfaz sem mudar o restante da árvore", async () => {
  const { data: people, error } = await supabase
    .from("genogram_persons")
    .select("*")
    .eq("client_id", clientId);
  expect(error).toBeNull();
  const baselineLinks = await relationRows();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "3D" }));
  await waitFor(() => expect(peopleOnMap()).toHaveLength(35));
  const baselinePeople = peopleOnMap();
  const baselineRoutes = routesOnMap();
  expect(baselineRoutes.length).toBeGreaterThan(40);
  const expectedNames = new Map(people!.map(({ id, full_name }) => [id, full_name]));
  expect(new Map(baselinePeople.map(({ id, name }) => [id, name]))).toEqual(expectedNames);
  const topNames = baselinePeople
    .filter(({ generation }) => generation === 0)
    .map(({ name }) => name)
    .sort();
  expect(topNames).toEqual(["Consultante", "Irmã", "Irmão"]);

  const branches = within(screen.getByRole("group", { name: "Explorar ramos da família" }));
  const overview = branches.getByRole("button", { name: "Árvore inteira em 3D" });
  const paternal = branches.getByRole("button", { name: "Ramo paterno" });
  const maternal = branches.getByRole("button", { name: "Ramo materno" });

  expect(overview.getAttribute("aria-pressed")).toBe("true");
  const root = spatial().querySelector('[data-reference="true"]');
  for (const [branch, opposite] of [
    [paternal, "maternal"],
    [maternal, "paternal"],
  ] as const) {
    fireEvent.click(branch);
    expect(branch.getAttribute("aria-pressed")).toBe("true");
    expect(peopleOnMap()).toEqual(baselinePeople);
    expect(routesOnMap()).toEqual(baselineRoutes);
    expect(root?.hasAttribute("data-branch-muted")).toBe(false);
    expect(
      spatial().querySelector(`[data-person-id][data-branch="${opposite}"][data-branch-muted]`),
    ).toBeTruthy();
  }
  fireEvent.click(paternal);
  const father = within(spatial()).getByRole("button", { name: /^Pai(?:,|$)/ });
  fireEvent.click(father);
  const focusFamily = screen.getByRole("button", { name: "Focar família de Pai" });
  fireEvent.click(focusFamily);
  expect(focusFamily.getAttribute("aria-pressed")).toBe("true");
  expect(peopleOnMap()).toEqual(baselinePeople);
  expect(routesOnMap()).toEqual(baselineRoutes);
  fireEvent.click(paternal);
  const originalCamera = cameraTransform();
  expect(originalCamera).toBeTruthy();
  const inspector = screen.getByRole("complementary", { name: "Ficha da pessoa selecionada" });
  const reviewAction = within(inspector)
    .getAllByRole("button", { name: "Revisar filiação" })
    .find((button) => !button.closest("details"));
  fireEvent.click(reviewAction!);
  const review = screen.getByRole("region", { name: "Revisão de filiação" });
  const slots = within(review).getAllByRole<HTMLSelectElement>("combobox", { name: /^Genitor/ });
  const originalMother = people!.find(({ full_name }) => full_name === "Avó paterna")!;
  const replacement = people!.find(({ full_name }) => full_name === "Avó materna")!;
  const targetSlot = slots.findIndex(({ value }) => value === originalMother.id);
  expect(targetSlot).toBeGreaterThanOrEqual(0);
  fireEvent.click(
    within(review).getByRole("button", { name: `Escolher genitor ${targetSlot + 1} no mapa` }),
  );
  fireEvent.click(maternal);
  const parentOnMap = within(spatial()).getByRole("button", { name: /^Avó materna(?:,|$)/ });
  fireEvent.click(parentOnMap);
  expect(slots[targetSlot].value).toBe(replacement.id);
  fireEvent.change(within(review).getByLabelText(`Natureza do vínculo ${targetSlot + 1}`), {
    target: { value: "unknown" },
  });
  expect(spatial().querySelector('[data-parentage-track="proposed"]')).toBeTruthy();
  fireEvent.click(within(review).getByRole("button", { name: "Confirmar filiação" }));

  const undo = await screen.findByRole("button", { name: "Desfazer filiação" });
  expect(paternal.getAttribute("aria-pressed")).toBe("true");
  expect(cameraTransform()).toBe(originalCamera);
  const editedLinks = await relationRows();
  expect(editedLinks).not.toEqual(baselineLinks);
  expect(
    editedLinks?.find(
      ({ to_person_id, from_person_id }) =>
        to_person_id === father.dataset.personId && from_person_id === replacement.id,
    )?.qualifier,
  ).toBe("unknown");
  fireEvent.click(undo);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Desfazer filiação" })).toBeNull(),
  );
  fireEvent.click(overview);
  expect(overview.getAttribute("aria-pressed")).toBe("true");
  expect(await relationRows()).toEqual(baselineLinks);
  expect(peopleOnMap()).toEqual(baselinePeople);
  expect(routesOnMap()).toEqual(baselineRoutes);

  const restoredInspector = within(
    screen.getByRole("complementary", { name: "Ficha da pessoa selecionada" }),
  );
  fireEvent.click(restoredInspector.getByText("Uniões registradas (1)"));
  fireEvent.click(restoredInspector.getByRole("button", { name: "Editar união com Mãe" }));
  const unionDialog = screen.getByRole("dialog", { name: "Editar vínculo" });
  fireEvent.click(within(unionDialog).getByRole("button", { name: "Cancelar" }));

  fireEvent.click(screen.getByRole("button", { name: "2D" }));
  const twoDimensionalNames = [
    ...document.querySelectorAll(".react-flow__node-person .geno-person-name"),
  ].map((label) => label.textContent);
  expect(twoDimensionalNames.sort()).toEqual([...expectedNames.values()].sort());
  queryClient.clear();
});
