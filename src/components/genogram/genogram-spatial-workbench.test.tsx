// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { GenogramCanvas } from "./genogram-canvas";

vi.mock("@/integrations/supabase/client", () => import("../../../design/preview/client"));

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
const peopleOnOrbit = (orbit: HTMLElement) =>
  Array.from(orbit.querySelectorAll<HTMLButtonElement>("[data-person-id][data-generation]"))
    .map((card) => ({
      id: card.dataset.personId,
      generation: Number(card.dataset.generation),
      name: card.querySelector(".geno-orbit-person-name")?.textContent,
    }))
    .sort((a, b) => a.id!.localeCompare(b.id!));
const routesOnOrbit = (orbit: HTMLElement) =>
  [...orbit.querySelectorAll("[data-orbit-route]")].map((route) => ({
    id: route.getAttribute("data-orbit-route"),
    path: route.getAttribute("d"),
  }));

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
  const overview = branches.getByRole("button", { name: "Árvore inteira" });
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

it("preserva a árvore editável da cena orbital ao confirmar e desfazer uma filiação", async () => {
  const baselineLinks = await relationRows();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "3D" }));
  await waitFor(() => expect(peopleOnMap()).toHaveLength(35));
  const baselinePeople = peopleOnMap().sort((a, b) => a.id!.localeCompare(b.id!));
  const baselineRoutes = routesOnMap();
  const personId = (name: string) => baselinePeople.find((person) => person.name === name)!.id;

  fireEvent.click(screen.getByRole("button", { name: "Órbita 3D" }));
  const orbit = await screen.findByRole("region", { name: "Cena orbital do genossociograma" });
  await waitFor(() => expect(peopleOnOrbit(orbit)).toEqual(baselinePeople));
  expect(
    peopleOnOrbit(orbit)
      .filter(({ generation }) => generation === 0)
      .map(({ name }) => name)
      .sort(),
  ).toEqual(["Consultante", "Irmã", "Irmão"]);

  const paternal = within(orbit).getByRole("button", { name: "Ramo paterno" });
  const maternal = within(orbit).getByRole("button", { name: "Ramo materno" });
  const generations = within(within(orbit).getByRole("group", { name: "Gerações da árvore" }));
  const parents = generations.getByRole("button", { name: "Pais e tios" });
  fireEvent.click(paternal);
  fireEvent.click(parents);
  expect(orbit.getAttribute("data-active-generation")).toBe("1");
  const navigation = within(orbit).getByRole("region", { name: "Área de navegação orbital" });
  const initialAzimuth = navigation.getAttribute("data-azimuth");
  fireEvent.keyDown(navigation, { key: "ArrowRight" });
  const workingAzimuth = navigation.getAttribute("data-azimuth");
  expect(workingAzimuth).not.toBe(initialAzimuth);
  fireEvent.click(within(orbit).getByRole("button", { name: /^Pai(?:,|$)/ }));
  const workingRoutes = routesOnOrbit(orbit);
  const inspector = within(
    screen.getByRole("complementary", { name: "Ficha da pessoa selecionada" }),
  );
  expect(inspector.getByRole("heading", { name: "Pai" })).toBeTruthy();
  fireEvent.click(inspector.getByRole("button", { name: "Revisar filiação" }));
  const review = within(screen.getByRole("region", { name: "Revisão de filiação" }));
  const slots = review.getAllByRole<HTMLSelectElement>("combobox", { name: /^Genitor/ });
  const slot = slots.findIndex(({ value }) => value === personId("Avó paterna"));
  expect(slot).toBeGreaterThanOrEqual(0);
  fireEvent.click(review.getByRole("button", { name: `Escolher genitor ${slot + 1} no mapa` }));
  fireEvent.click(maternal);
  fireEvent.click(generations.getByRole("button", { name: "Avós" }));
  expect(orbit.getAttribute("data-active-generation")).toBe("2");
  fireEvent.keyDown(navigation, { key: "ArrowRight" });
  const replacement = personId("Avó materna");
  fireEvent.click(within(orbit).getByRole("button", { name: /^Avó materna(?:,|$)/ }));
  expect(slots[slot].value).toBe(replacement);
  fireEvent.change(review.getByLabelText(`Natureza do vínculo ${slot + 1}`), {
    target: { value: "unknown" },
  });
  expect(orbit.querySelector('[data-parentage-track="proposed"]')).toBeTruthy();
  fireEvent.click(review.getByRole("button", { name: "Confirmar filiação" }));

  const undo = await screen.findByRole("button", { name: "Desfazer filiação" });
  expect(paternal.getAttribute("aria-pressed")).toBe("true");
  expect(parents.getAttribute("aria-pressed")).toBe("true");
  expect(orbit.getAttribute("data-active-generation")).toBe("1");
  expect(navigation.getAttribute("data-azimuth")).toBe(workingAzimuth);
  expect(
    (await relationRows())?.find(
      (row) => row.to_person_id === personId("Pai") && row.from_person_id === replacement,
    )?.qualifier,
  ).toBe("unknown");
  fireEvent.click(undo);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Desfazer filiação" })).toBeNull(),
  );
  expect(await relationRows()).toEqual(baselineLinks);
  expect(peopleOnOrbit(orbit)).toEqual(baselinePeople);
  expect(routesOnOrbit(orbit)).toEqual(workingRoutes);

  fireEvent.click(within(orbit).getByRole("button", { name: "Voltar ao board" }));
  expect(peopleOnMap().sort((a, b) => a.id!.localeCompare(b.id!))).toEqual(baselinePeople);
  expect(routesOnMap()).toEqual(baselineRoutes);
  expect(inspector.getByRole("heading", { name: "Pai" })).toBeTruthy();
  queryClient.clear();
});

it("permite navegar por geração a 390 px e deixa a roda simples rolar a página", async () => {
  vi.stubGlobal("innerWidth", 390);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(640);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenogramCanvas clientId={clientId} />
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Órbita 3D" }));
  const orbit = await screen.findByRole("region", { name: "Cena orbital do genossociograma" });
  const tree = within(orbit);
  const navigation = tree.getByRole("region", { name: "Área de navegação orbital" });
  const camera = within(tree.getByRole("group", { name: "Câmera da cena orbital" }));
  await waitFor(() => expect(peopleOnOrbit(orbit)).toHaveLength(35));
  const allNames = peopleOnOrbit(orbit);
  const overviewAzimuth = navigation.getAttribute("data-azimuth");

  const generation = tree.getByRole<HTMLSelectElement>("combobox", { name: "Geração em foco" });
  const grandparents = within(generation).getByRole<HTMLOptionElement>("option", { name: "Avós" });
  fireEvent.change(generation, { target: { value: grandparents.value } });
  expect(orbit.getAttribute("data-active-generation")).toBe("2");
  expect(peopleOnOrbit(orbit)).toEqual(allNames);

  fireEvent.click(camera.getByRole("button", { name: "Vista frontal" }));
  expect(Number(navigation.getAttribute("data-azimuth"))).toBe(0);
  fireEvent.click(camera.getByRole("button", { name: "Girar à direita" }));
  expect(Number(navigation.getAttribute("data-azimuth"))).not.toBe(0);

  const pan = camera.getByRole("button", { name: "Mover câmera" });
  fireEvent.click(pan);
  expect(pan.getAttribute("aria-pressed")).toBe("true");
  const beforePan = navigation.getAttribute("data-azimuth");
  const beforePanRoutes = routesOnOrbit(orbit);
  fireEvent.keyDown(navigation, { key: "ArrowRight" });
  expect(navigation.getAttribute("data-azimuth")).toBe(beforePan);
  expect(routesOnOrbit(orbit)).not.toEqual(beforePanRoutes);
  fireEvent.click(pan);

  const beforeWheel = navigation.getAttribute("data-orbit-zoom");
  expect(beforeWheel).not.toBeNull();
  expect(fireEvent.wheel(navigation, { deltaY: -120 })).toBe(true);
  expect(navigation.getAttribute("data-orbit-zoom")).toBe(beforeWheel);
  expect(fireEvent.wheel(navigation, { deltaY: -120, ctrlKey: true })).toBe(false);
  expect(Number(navigation.getAttribute("data-orbit-zoom"))).toBeGreaterThan(Number(beforeWheel));

  fireEvent.click(camera.getByRole("button", { name: "Reenquadrar" }));
  expect(navigation.getAttribute("data-azimuth")).toBe(overviewAzimuth);
  expect(generation.value).toBe(grandparents.value);

  fireEvent.click(tree.getByRole("button", { name: "Árvore inteira" }));
  expect(generation.value).not.toBe(grandparents.value);
  expect(peopleOnOrbit(orbit)).toEqual(allNames);
  queryClient.clear();
});
