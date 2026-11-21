import { describe, expect, it } from "vitest";
import {
  exportAccountData,
  exportDossierData,
  packageDossier,
  type ExportPageReader,
} from "./data-export";
import { smallFamily } from "./geno/fixtures";
import { buildLogicalGraph, layoutGraph, type NodePositionRow } from "./geno/build";
import type { PersonRow, RelationshipRow } from "./patterns";

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
  it("lista gravações e inclui bytes somente com opção e autorização vigente", async () => {
    const session = (id: string, audio_path = `owner/case/${id}/audio.webm`) => ({
      id,
      audio_path,
      client_id: "case",
      user_id: "owner",
      status: "ready",
      recording_consent_id: "grant",
    });
    const read: ExportPageReader = async ({ table }) => {
      if (table === "clients") return [{ id: "case", professional_id: "owner" }];
      if (table === "clinical_sessions")
        return [
          session("ok"),
          session("revoked"),
          session("missing"),
          session("foreign", "another/case/foreign/audio.webm"),
        ];
      if (table === "audio_consent_events")
        return [
          {
            id: "grant",
            client_id: "case",
            scope: "recording",
            granted: true,
            revision: 1,
            session_id: null,
          },
          {
            id: "revoke",
            client_id: "case",
            scope: "recording",
            granted: false,
            revision: 2,
            session_id: "revoked",
          },
        ];
      return [];
    };
    const data = await exportDossierData(read, "owner", "case");
    const without = await packageDossier(data);
    expect(without.manifest.media.every(({ state }) => state === "not_selected")).toBe(true);
    const requested: string[] = [];
    const withAudio = await packageDossier(data, async (path) => {
      requested.push(path);
      if (path.includes("missing")) throw new Error("unavailable");
      return { bytes: 1, mime_type: "audio/webm", data_url: "data:audio/webm;base64,AA==" };
    });
    expect(requested).toEqual(["owner/case/ok/audio.webm", "owner/case/missing/audio.webm"]);
    expect(withAudio.format_version).toBe(2);
    expect(withAudio.manifest.media.map(({ state }) => state)).toEqual([
      "included",
      "authorization_required",
      "not_available",
      "not_available",
    ]);
  });
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

  it("reconstitui uma cópia isolada da topologia e das posições a partir do JSON", async () => {
    const { persons, rels, probandId } = smallFamily();
    const positions: NodePositionRow[] = [
      {
        id: "position",
        layout_id: "layout",
        layout_mode: "manual",
        node_id: probandId,
        node_type: "person",
        x: 44,
        y: 0,
        created_at: "",
        updated_at: "",
      },
    ];
    const read: ExportPageReader = async ({ table }) => {
      if (table === "clients") return [{ id: "synthetic", professional_id: "owner" }];
      if (table === "genogram_persons") return persons;
      if (table === "genogram_relationships") return rels;
      if (table === "genogram_layouts") return [{ id: "layout", client_id: "synthetic" }];
      if (table === "genogram_node_positions") return positions;
      return [];
    };
    const written = await exportDossierData(read, "owner", "synthetic");
    const copy = JSON.parse(JSON.stringify(written)) as {
      genogram_persons: PersonRow[];
      genogram_relationships: RelationshipRow[];
      genogram_node_positions: NodePositionRow[];
    };
    const restored = buildLogicalGraph({
      persons: copy.genogram_persons,
      rels: copy.genogram_relationships,
      probandId,
      positions: copy.genogram_node_positions,
    });
    const original = buildLogicalGraph({ persons, rels, probandId, positions });
    expect([...restored.parentsByChild]).toEqual([...original.parentsByChild]);
    expect([...restored.topRowIds]).toEqual([...original.topRowIds]);
    expect(layoutGraph(restored)).toEqual(layoutGraph(original));
  });
});
