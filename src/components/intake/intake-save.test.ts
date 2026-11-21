import { describe, expect, it, vi } from "vitest";
import {
  calculateCompletion,
  intakeBirthTimeInput,
  intakeBirthTimeStorage,
  findIntakeQuestions,
  sectionCompletion,
  type ClientIntake,
} from "@/lib/intake";
import { KeyedDebounce } from "@/lib/unsaved";
import {
  acknowledgeIntakeEdits,
  captureIntakeEdits,
  intakePatch,
  persistIntakeEdits,
  type IntakeEdits,
} from "./intake-save";

const sample = (fields: Partial<ClientIntake> = {}) =>
  ({ updated_at: "revision-1", ...fields }) as ClientIntake;

describe("salvamento da anamnese", () => {
  it("envia A e B em ordem e mantém B quando a confirmação de A chega", async () => {
    let pending: IntakeEdits = {};
    const previous = sample({ presenting_intention: "Anterior", signature_notes: "Conferida" });
    let saved = previous;
    const writes: string[] = [];
    let confirmFirst: () => void = () => {};
    const firstWrite = new Promise<void>((resolve) => {
      confirmFirst = resolve;
    });
    const acknowledged = vi.fn();
    const queue = new KeyedDebounce<IntakeEdits>(async (_, edits) => {
      const patch = intakePatch(saved, edits);
      writes.push(patch.presenting_intention!);
      if (writes.length === 1) await firstWrite;
      saved = { ...saved, ...patch };
      pending = acknowledgeIntakeEdits(pending, edits);
      acknowledged({ ...saved, ...intakePatch(saved, pending) });
    });

    const a = captureIntakeEdits({ presenting_intention: "A" }, 1);
    pending = a;
    queue.push("intake", a);
    const first = queue.flush();
    await vi.waitFor(() => expect(writes).toEqual(["A"]));

    const b = captureIntakeEdits({ presenting_intention: "B" }, 2);
    pending = { ...pending, ...b };
    queue.push("intake", b);
    const all = queue.flush();
    expect(writes).toEqual(["A"]);
    confirmFirst();
    await Promise.all([first, all]);

    expect(writes).toEqual(["A", "B"]);
    expect(acknowledged).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ presenting_intention: "B", signature_notes: "Conferida" }),
    );
    expect(saved).toMatchObject({ presenting_intention: "B", signature_notes: "Conferida" });
    expect(pending).toEqual({});
    expect(queue.hasPending()).toBe(false);
  });

  it("relê após uma atualização paralela e altera somente os campos e origens editados", async () => {
    let row = sample({ section_sources: { opening: "cliente", personal: "documento" } });
    const update = vi.fn(async (patch: Partial<ClientIntake>, previous: ClientIntake) => {
      if (previous.updated_at === "revision-1") {
        row = {
          ...row,
          updated_at: "revision-2",
          signature_notes: "Conferida em outra aba",
          section_sources: { opening: "cliente", personal: "familiar" },
        };
        return null;
      }
      row = { ...row, ...patch, updated_at: "revision-3" };
      return row;
    });
    const edits = captureIntakeEdits(
      { presenting_intention: "Retorno", "source:opening": null },
      1,
      row,
    );
    const saved = await persistIntakeEdits(
      { read: async () => row, insert: vi.fn(), update },
      edits,
    );

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      {
        presenting_intention: "Retorno",
        section_sources: { personal: "familiar" },
        completion_percentage: calculateCompletion({
          presenting_intention: "Retorno",
          signature_notes: "Conferida em outra aba",
        }),
      },
      expect.objectContaining({ updated_at: "revision-2" }),
    );
    expect(saved.row?.signature_notes).toBe("Conferida em outra aba");
    expect(saved.conflicts).toEqual({});
  });

  it("persiste somente alterações independentes e devolve as três versões da resposta e da fonte", async () => {
    const original = sample({
      presenting_intention: "Resposta anterior",
      signature_notes: "Anotação original",
      field_context: { presenting_intention: { source: "client", status: "pending" } },
      last_section_edited: "opening",
      last_field_edited: "signature_notes",
    });
    let row = sample({
      ...original,
      updated_at: "revision-2",
      presenting_intention: "Resposta em outra aba",
      field_context: { presenting_intention: { source: "family", status: "pending" } },
    });
    const independent = captureIntakeEdits(
      {
        signature_notes: "Anotação nova",
        "context:presenting_intention:status": "unknown",
        last_section_edited: "opening",
        last_field_edited: "signature_notes",
      },
      1,
      original,
    );
    const overlap = captureIntakeEdits(
      {
        presenting_intention: "Meu rascunho",
        "context:presenting_intention:source": "document",
        last_section_edited: "opening",
        last_field_edited: "presenting_intention",
      },
      2,
      original,
    );
    const writer = {
      read: async () => row,
      insert: vi.fn(),
      update: vi.fn(async (patch: Partial<ClientIntake>) => {
        row = { ...row, ...patch, updated_at: "revision-3" };
        return row;
      }),
    };
    const all = { ...independent, ...overlap };
    const result = await persistIntakeEdits(writer, all);
    expect(result.accepted).toEqual(independent);
    expect(result.conflicts).toEqual({
      presenting_intention: { previous: "Resposta anterior", current: "Resposta em outra aba" },
      "context:presenting_intention:source": { previous: "client", current: "family" },
    });
    expect(result.row).toMatchObject({
      presenting_intention: "Resposta em outra aba",
      signature_notes: "Anotação nova",
      last_field_edited: "signature_notes",
      field_context: { presenting_intention: { source: "family", status: "unknown" } },
    });
    const pending = acknowledgeIntakeEdits(all, result.accepted, result.row);
    expect(pending).toEqual(overlap);

    // A escrita explícita corresponde à versão que a pessoa revisou, mesmo com nova alteração.
    const reviewed = {
      presenting_intention: { ...pending.presenting_intention, expected: "Resposta em outra aba" },
    };
    row = { ...row, presenting_intention: "Terceira versão" };
    expect(await persistIntakeEdits(writer, reviewed)).toMatchObject({
      wrote: false,
      conflicts: {
        presenting_intention: { previous: "Resposta em outra aba", current: "Terceira versão" },
      },
    });
    expect(writer.update).toHaveBeenCalledTimes(1);
  });

  it("usa o valor confirmado pelo próprio envio como base de uma edição posterior da mesma resposta", async () => {
    const initial = sample({ presenting_intention: "A" });
    const sent = captureIntakeEdits({ presenting_intention: "B" }, 1, initial);
    const next = captureIntakeEdits({ presenting_intention: "C" }, 2, initial, sent);
    const afterOwnWrite = sample({ presenting_intention: "B", updated_at: "revision-2" });
    const remaining = acknowledgeIntakeEdits(next, sent, afterOwnWrite);
    expect(remaining.presenting_intention).toMatchObject({ expected: "B", value: "C" });
    const update = vi.fn(async (patch) => ({ ...afterOwnWrite, ...patch }));
    const result = await persistIntakeEdits(
      { read: async () => afterOwnWrite, insert: vi.fn(), update },
      remaining,
    );
    expect(result.conflicts).toEqual({});
    expect(result.row?.presenting_intention).toBe("C");
  });

  it("preserva outras fontes quando altera só a situação de uma resposta", () => {
    const previous = sample({
      field_context: {
        presenting_intention: { note: "Relato", source: "client" },
        signature_notes: { source: "document" },
      },
    });
    const edits = captureIntakeEdits({ "context:presenting_intention:status": "unknown" }, 1);
    const patch = intakePatch(previous, edits);
    expect(patch.field_context).toEqual({
      presenting_intention: { note: "Relato", source: "client", status: "unknown" },
      signature_notes: { source: "document" },
    });
    expect(sectionCompletion({ ...previous, ...patch }, "opening")).toMatchObject({
      filled: 1,
      unknown: 1,
    });
    expect(findIntakeQuestions("gestacao").some(({ section }) => section.id === "origins")).toBe(
      true,
    );
  });

  it("retoma o envio mais recente após falha sem descartar outros campos da fila", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("Conexão indisponível"))
      .mockResolvedValue(undefined);
    const queue = new KeyedDebounce<IntakeEdits>(send);
    queue.push(
      "intake",
      captureIntakeEdits({ presenting_intention: "A", signature_notes: "Nota" }, 1),
    );
    await expect(queue.flush()).rejects.toThrow("Conexão indisponível");
    expect(queue.hasPending()).toBe(true);

    queue.push("intake", captureIntakeEdits({ presenting_intention: "B" }, 2));
    await queue.flush();
    expect(send).toHaveBeenLastCalledWith("intake", {
      ...captureIntakeEdits({ signature_notes: "Nota" }, 1),
      ...captureIntakeEdits({ presenting_intention: "B" }, 2),
    });
    expect(queue.hasPending()).toBe(false);
  });
});

it("preserva a hora civil relatada e permite limpar uma data na Anamnese", () => {
  expect(intakeBirthTimeInput("1992-01-05 09:30:00+00")).toBe("1992-01-05T09:30");
  expect(intakeBirthTimeStorage("1992-01-05T09:30")).toBe("1992-01-05T09:30:00Z");
  expect(intakeBirthTimeStorage("")).toBeNull();
  expect(
    intakePatch(
      sample({ union_date: "2020-02-11" }),
      captureIntakeEdits(
        {
          birth_datetime: null,
          union_date: null,
          birth_place: "Cidade de teste",
        },
        1,
      ),
    ),
  ).toEqual({ birth_datetime: null, union_date: null, birth_place: "Cidade de teste" });
});

it("filtra respostas sem fonte e permite combinar o filtro com a busca da pergunta", () => {
  const intake = sample({
    presenting_intention: "Resposta com fonte",
    pregnancy_notes: "Resposta sem fonte",
    birth_notes: "   ",
    field_context: {
      presenting_intention: { source: "client" },
      signature_notes: { status: "pending" },
    },
  });
  expect(findIntakeQuestions("", intake).map(({ field }) => field)).toEqual([
    "signature_notes",
    "pregnancy_notes",
  ]);
  expect(findIntakeQuestions("Gestacao", intake).map(({ field }) => field)).toEqual([
    "pregnancy_notes",
  ]);
});
