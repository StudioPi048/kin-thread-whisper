import { describe, expect, it } from "vitest";
import { validateParentLink } from "./family-relationships";

const link = (id: string, from_person_id: string, to_person_id: string) => ({
  id,
  from_person_id,
  to_person_id,
});

describe("confirmar filiação", () => {
  const recorded = [link("a", "bisavó", "avó"), link("b", "avó", "mãe"), link("c", "mãe", "lia")];

  it("recusa um ciclo que passa por várias gerações", () => {
    expect(validateParentLink("lia", "bisavó", recorded)).toMatch(/ciclo/);
  });

  it("permite a mesma bisavó para a avó e sua irmã, sem ligação entre irmãs", () => {
    expect(validateParentLink("bisavó", "tia-avó", recorded)).toBeNull();
  });

  it("permite revisar o próprio vínculo e recusa duplicatas independentes", () => {
    expect(validateParentLink("bisavó", "avó", recorded, "a")).toBeNull();
    expect(validateParentLink("bisavó", "avó", recorded)).toMatch(/já está registrada/);
  });
});
