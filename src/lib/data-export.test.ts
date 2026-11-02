import { describe, expect, it } from "vitest";
import { exportAccountData, type ExportPageReader } from "./data-export";

describe("exportação pessoal", () => {
  it("pagina além de 1000 familiares e inclui as posições apenas dos layouts da conta", async () => {
    const read: ExportPageReader = async ({ table, filter, from, to }) => {
      expect(filter.values.length).toBeGreaterThan(0);
      if (table === "profiles") return [{ id: "owner" }];
      if (table === "clients") return [{ id: "case", professional_id: "owner" }];
      if (table === "genogram_persons")
        return Array.from({ length: 1201 }, (_, i) => ({ id: String(i), client_id: "case" })).slice(
          from,
          to + 1,
        );
      if (table === "genogram_layouts") return [{ id: "layout", client_id: "case" }];
      if (table === "genogram_node_positions") {
        expect(filter).toEqual({ column: "layout_id", values: ["layout"] });
        return [{ id: "position", layout_id: "layout" }];
      }
      return [];
    };
    const out = await exportAccountData(read, "owner");
    expect(out.genogram_persons).toHaveLength(1201);
    expect(out.genogram_node_positions).toHaveLength(1);
  });

  it("recusa gerar arquivo se a resposta contém perfil de outra conta", async () => {
    await expect(exportAccountData(async () => [{ id: "other-user" }], "owner")).rejects.toThrow(
      "fora do escopo",
    );
  });

  it("não consulta dados de casos quando a conta não tem clientes", async () => {
    const calls: string[] = [];
    const out = await exportAccountData(async ({ table }) => {
      calls.push(table);
      return [];
    }, "owner");
    expect(calls).toEqual(["profiles", "clients"]);
    expect(out.genogram_persons).toEqual([]);
  });
});
