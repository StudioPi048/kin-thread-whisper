import { expect, it, vi } from "vitest";
import { prepareDossierReport } from "./dossier-report";
import type { ExportPageReader } from "./data-export";

it("relatório com identidade reduzida omite nomes, textos livres e datas precisas", async () => {
  const read = vi.fn<ExportPageReader>(async ({ table }) => {
    if (table === "clients")
      return [{ id: "c1", professional_id: "u1", full_name: "Nome do caso" }];
    if (table === "genogram_persons")
      return [
        {
          id: "p1",
          client_id: "c1",
          full_name: "Nome da pessoa",
          relationship_to_proband: "Rótulo livre",
          is_proband: true,
          birth_date: "1995-05-14",
          life_events: [],
        },
      ];
    if (table === "clinical_sessions")
      return [
        {
          id: "s1",
          client_id: "c1",
          user_id: "u1",
          session_date: "2026-10-11T14:00:00Z",
          manual_notes: "Texto livre sensível",
          clinical_status: "completed",
        },
      ];
    return [];
  });
  const report = await prepareDossierReport(read, "u1", "c1", {
    family: true,
    timeline: true,
    sessions: true,
    includeNotes: true,
    reducedIdentity: true,
  });
  const text = JSON.stringify(report);
  expect(text).not.toMatch(/Nome do caso|Nome da pessoa|Rótulo livre|Texto livre|2026-10|14\/05/);
  expect(text).toContain("Pessoa 1");
  expect(text).toContain("1995");
  expect(text).toContain("2026");
  const request = read.mock.calls
    .map(([call]) => call)
    .find(({ table }) => table === "clinical_sessions");
  expect(request?.columns).not.toContain("manual_notes");
});

it("mantém o intervalo em anos na identidade reduzida e a precisão e origem no relatório completo", async () => {
  const read = vi.fn<ExportPageReader>(async ({ table }) => {
    if (table === "clients") return [{ id: "c1", professional_id: "u1", full_name: "Caso teste" }];
    if (table === "genogram_persons")
      return [
        {
          id: "p1",
          client_id: "c1",
          full_name: "Pessoa teste",
          is_proband: true,
          birth_date_partial: "1980–1985",
          death_date_partial: "15/04",
          life_events: [
            { date: "1992-04", type: "Mudança", description: "Sintético" },
            { date: "1994-04-17", type: "Retorno", description: "Sintético" },
          ],
        },
      ];
    return [];
  });
  const options = {
    family: false,
    timeline: true,
    sessions: false,
    includeNotes: false,
    reducedIdentity: true,
  };
  const reduced = JSON.stringify(await prepareDossierReport(read, "u1", "c1", options));
  expect(reduced).toContain("1980–1985 (intervalo)");
  expect(reduced).toContain("Sem ano informado");
  expect(reduced).not.toMatch(/15\/04|Mudança|Sintético/);

  const full = JSON.stringify(
    await prepareDossierReport(read, "u1", "c1", { ...options, reducedIdentity: false }),
  );
  expect(full).toContain("15/04 (sem ano)");
  expect(full).toContain("abr 1992 (sem dia)");
  expect(full).toContain("17/04/1994");
  expect(full).toContain("Ficha do familiar");
});
