import { describe, expect, it } from "vitest";
import { exportAccountData, exportDossierData, type ExportPageReader } from "./data-export";

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

describe("exportação de um dossiê", () => {
  it("mantém parentescos por ID e rejeita exportação da conta errada", async () => {
    const read: ExportPageReader = async ({ table, filter }) => {
      if (table === "clients") return [{ id: "case", professional_id: "owner" }];
      expect(filter.values).toEqual(["case"]);
      if (table === "genogram_relationships") {
        return [{ id: "link", client_id: "case", from_person_id: "child", to_person_id: "parent" }];
      }
      if (table === "audio_consent_events") {
        return [{ id: "event", client_id: "case", granted: false }];
      }
      return [];
    };

    const out = await exportDossierData(read, "owner", "case");
    expect(out).toMatchObject({
      format: "genealiz.dossier",
      format_version: 1,
      genogram_relationships: [{ from_person_id: "child", to_person_id: "parent" }],
      audio_consent_events: [{ granted: false }],
    });
    await expect(exportDossierData(read, "other", "case")).rejects.toThrow("indisponível");
  });
});
