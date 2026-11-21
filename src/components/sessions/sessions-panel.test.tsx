// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { audioConsentsKey } from "@/lib/audio-consent";
import { clients, sessions } from "../../../design/preview/client";
import { SessionsPanel } from "./sessions-panel";
import { TranscriptReview } from "./transcript-review";

const controls = vi.hoisted(() => ({ consentUnavailable: false }));

vi.mock("@/integrations/supabase/client", () => import("../../../design/preview/client"));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/ai/session-processing.functions", () => ({ processSessionAudio: vi.fn() }));
vi.mock("@/lib/audio-consent", async (original) => {
  const actual = await original<typeof import("@/lib/audio-consent")>();
  return {
    ...actual,
    readAudioConsents: (...args: Parameters<typeof actual.readAudioConsents>) => {
      if (controls.consentUnavailable) throw new Error("Consulta fictícia indisponível");
      return actual.readAudioConsents(...args);
    },
  };
});

const queryClients: QueryClient[] = [];

function openSessionPanel(index: number, focusSession: boolean) {
  const client = clients[index];
  const session = sessions[index];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(queryClient);
  render(
    <QueryClientProvider client={queryClient}>
      <SessionsPanel
        clientId={client.id}
        clientName={client.full_name}
        focusedSessionId={focusSession ? session.id : undefined}
      />
    </QueryClientProvider>,
  );
  return { client, session, queryClient };
}

function fakeMicrophone() {
  const stopped = vi.fn();
  let interrupt: (() => void) | undefined;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop: stopped }] }) },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      onerror?: () => void;
      constructor(readonly stream: MediaStream) {
        interrupt = () => {
          this.ondataavailable?.({ data: new Blob(["trecho recuperado"]) });
          this.onerror?.();
        };
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        const notify = () => {
          this.ondataavailable?.({ data: new Blob(["áudio fictício"]) });
          this.onstop?.();
        };
        queueMicrotask(notify);
      }
    },
  );
  return { stopped, interrupt: () => interrupt?.() };
}

beforeEach(() => {
  controls.consentUnavailable = false;
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((client) => client.clear());
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  Reflect.deleteProperty(navigator, "mediaDevices");
  vi.unstubAllGlobals();
});

it("abre as notas no compromisso selecionado sem duplicá-lo", async () => {
  const { client, session } = openSessionPanel(0, true);
  const register = await screen.findByRole("button", { name: "Registrar sessão sem áudio" });
  fireEvent.click(register);
  expect(document.activeElement?.id).toBe(`notes-${session.id}`);
  const { data } = await supabase.from("clinical_sessions").select("id").eq("client_id", client.id);
  expect(data?.map(({ id }) => id)).toEqual([session.id]);
  expect(screen.getByRole("button", { name: "Nova sessão sem áudio" })).toBeTruthy();
});

it("confirma a autorização no escopo acionado no gravador", async () => {
  const { client, session } = openSessionPanel(1, false);
  const recorder = screen.getByRole("region", { name: "Gravação de áudio" });
  const shortcut = await within(recorder).findByRole("button", {
    name: "Ver autorizações de áudio",
  });
  fireEvent.change(within(recorder).getByLabelText("Sessão para o áudio"), {
    target: { value: session.id },
  });
  fireEvent.click(shortcut);

  const consents = screen.getByRole("region", { name: "Autorizações de áudio" });
  expect((within(consents).getByLabelText("Aplicação da decisão") as HTMLSelectElement).value).toBe(
    session.id,
  );
  fireEvent.click(
    within(consents).getByRole("button", { name: "Registrar autorização para gravar áudio" }),
  );
  expect(
    within(consents).getByText(session.title, { exact: false, selector: "strong" }),
  ).toBeTruthy();
  fireEvent.change(within(consents).getByLabelText("Origem da decisão"), {
    target: { value: "written" },
  });
  fireEvent.click(within(consents).getByRole("button", { name: "Confirmar decisão" }));
  await waitFor(async () => {
    const { data } = await supabase
      .from("audio_consent_events")
      .select("*")
      .eq("client_id", client.id);
    expect(data?.map((row) => row.session_id)).toEqual([session.id]);
  });
});

it("retém o trecho capturado em caso de falha e aguarda reconfirmação para guardá-lo", async () => {
  const { id: sessionId, client_id: clientId } = sessions[2];
  const { stopped } = fakeMicrophone();
  await supabase.rpc("record_audio_consent_details", {
    _client_id: clientId,
    _scope: "recording",
    _source: "written",
    _granted: true,
    _session_id: sessionId,
  });
  const { queryClient } = openSessionPanel(2, true);
  const start = await screen.findByRole("button", { name: "Iniciar gravação" });
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(start);
  await screen.findByRole("button", { name: "Finalizar gravação" });
  controls.consentUnavailable = true;
  await act(() => queryClient.invalidateQueries({ queryKey: audioConsentsKey(clientId) }));
  const keep = await screen.findByRole<HTMLButtonElement>("button", {
    name: "Guardar áudio no dossiê",
  });
  expect(keep.disabled).toBe(true);
  expect(stopped).toHaveBeenCalledTimes(1);

  controls.consentUnavailable = false;
  await act(() => queryClient.invalidateQueries({ queryKey: audioConsentsKey(clientId) }));
  await waitFor(() => expect(keep.disabled).toBe(false));
});

it("recupera a gravação interrompida, impede o envio à sessão cancelada e permite ouvir antes da IA", async () => {
  const { id: sessionId, client_id: clientId } = sessions[2];
  const { interrupt } = fakeMicrophone();
  await supabase.rpc("record_audio_consent_details", {
    _client_id: clientId,
    _scope: "recording",
    _source: "written",
    _granted: true,
  });
  const { queryClient } = openSessionPanel(2, true);
  const start = await screen.findByRole<HTMLButtonElement>("button", { name: "Iniciar gravação" });
  await waitFor(() => expect(start.disabled).toBe(false));
  fireEvent.click(start);
  await screen.findByRole("button", { name: "Finalizar gravação" });
  await act(async () => interrupt());
  await screen.findByText(/trecho recuperado/);
  await supabase
    .from("clinical_sessions")
    .update({ clinical_status: "canceled" })
    .eq("id", sessionId);
  const save = await screen.findByRole<HTMLButtonElement>("button", {
    name: "Guardar áudio no dossiê",
  });
  fireEvent.click(save);
  await screen.findByText(/sessão foi cancelada/);
  const destination = await screen.findByLabelText("Novo destino da gravação");
  expect(save.disabled).toBe(true);
  fireEvent.change(destination, { target: { value: "new" } });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await screen.findByRole("button", { name: "Ouvir áudio guardado" });
  const data = await queryClient.fetchQuery({
    queryKey: ["clinical_sessions", clientId],
    queryFn: async () =>
      (await supabase.from("clinical_sessions").select("*").eq("client_id", clientId)).data,
  });
  expect(data?.find((item) => item.id === sessionId)).toMatchObject({
    clinical_status: "canceled",
    audio_path: null,
  });
  const moved = data?.find((item) => item.id !== sessionId);
  expect(moved).toMatchObject({
    status: "draft",
    audio_path: expect.stringMatching(/\.webm$/),
  });
  expect(moved?.transcript ?? null).toBeNull();
});

it("prioriza a leitura da nota concluída e deixa a edição disponível por escolha", async () => {
  openSessionPanel(4, false);
  const edit = await screen.findByRole("button", { name: "Editar notas" });
  expect(screen.queryByLabelText("Notas manuais")).toBeNull();
  fireEvent.click(edit);
  expect(screen.getByLabelText("Notas manuais")).toBeTruthy();
});

it("mantém a correção local visível quando outra aba substitui a transcrição", async () => {
  const queryClient = new QueryClient();
  queryClients.push(queryClient);
  const transcript = (text: string) => (
    <QueryClientProvider client={queryClient}>
      <TranscriptReview
        sessionId={sessions[0].id}
        clientId={sessions[0].client_id}
        transcript={text}
        updatedAt="2026-11-21T10:00:00Z"
        audioPath={null}
        processing={false}
        refresh={async () => {}}
      />
    </QueryClientProvider>
  );
  const { rerender } = render(transcript("Relato fictício da primeira versão."));
  fireEvent.click(screen.getByRole("button", { name: "Revisar transcrição" }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar trecho" }));
  fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "corrected" } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Minha correção fictícia" } });
  rerender(transcript("Relato fictício da segunda versão."));
  expect(screen.getByText(/A transcrição mudou em outra aba/)).toBeTruthy();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Sua correção na versão anterior").value).toBe(
    "Minha correção fictícia",
  );
  expect(screen.getByText("Relato fictício da segunda versão.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Salvar revisão" })).toBeNull();
});
