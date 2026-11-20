import { describe, expect, it } from "vitest";
import { RELATIONSHIP_GROUPS, smartNormalizeRelationship } from "@/lib/relationship-normalizer";

describe("parentesco explícito e rótulos legados", () => {
  it("preserva a identidade das etiquetas do seletor", () => {
    for (const { options } of RELATIONSHIP_GROUPS) {
      for (const option of options) expect(smartNormalizeRelationship(option)).toBe(option);
    }
  });

  it.each([
    "avô",
    "avó do consultante",
    "tio-avô paterno",
    "Irmãos do bisavô",
    "Irmão de criação",
    "Irmã adotiva",
    "Meio irmão",
    "Irmã",
    "Mãe adotiva",
    "Padrasto",
    "bisavô paterno",
  ])("preserva %j sem confundir o ramo ou a natureza do vínculo", (label) => {
    expect(smartNormalizeRelationship(label)).toBe(label);
  });

  it.each([
    ["irmãos do avô materno", "Irmã(o) do avô materno"],
    ["irmã da avó do pai", "Irmã(o) da avó paterna"],
    ["irmã do bisavô materno pai da avó", "Irmã(o) do Bisavô materno (pai da avó)"],
    ["irmã do consulente", "Irmã(o)"],
  ])("reconhece o caminho completo %j", (label, canonical) => {
    expect(smartNormalizeRelationship(label)).toBe(canonical);
  });
});
