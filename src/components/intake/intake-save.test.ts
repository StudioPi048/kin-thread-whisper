import { describe, expect, it, vi } from "vitest";
import { calculateCompletion, type ClientIntake } from "@/lib/intake";
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
    expect(saved.signature_notes).toBe("Conferida em outra aba");
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
