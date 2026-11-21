import { describe, expect, it } from "vitest";
import { searchLibrary } from "./library-search";
import { buildLibraryItems, libraryProvenance } from "@/components/library/catalog";

const items = [
  {
    key: "1",
    category: "Conceitos",
    title: "Síndrome de aniversário",
    meta: "Schützenberger",
    body: "Datas que se repetem",
  },
  {
    key: "2",
    category: "Livros",
    title: "Meus antepassados",
    meta: "Anne Ancelin Schützenberger · 1993",
    body: "Obra",
  },
  {
    key: "3",
    category: "Conceitos",
    title: "Lealdade invisível",
    meta: "Boszormenyi-Nagy",
    body: "Dívidas",
    term: { related: ["síndrome"] },
  },
];

describe("busca da biblioteca", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(searchLibrary(items, "SINDROME").map((i) => i.key)).toEqual(["1", "3"]);
  });
  it("busca por autor", () => {
    expect(searchLibrary(items, "schutzenberger").map((i) => i.key)).toEqual(["1", "2"]);
  });
  it("vários termos precisam aparecer todos; título pesa mais", () => {
    expect(searchLibrary(items, "aniversario datas").map((i) => i.key)).toEqual(["1"]);
  });
  it("respeita a categoria", () => {
    expect(searchLibrary(items, "", "Livros").map((i) => i.key)).toEqual(["2"]);
  });
  it("distingue referências cadastradas, paráfrases e edição editorial a conferir", () => {
    const catalog = buildLibraryItems([]);
    const from = (key: string) => libraryProvenance(catalog.find((item) => item.key === key)!);
    expect(from("manual-genossociograma")).toContain("pp. 163–164");
    expect(from("quote-0")).toBe("Paráfrase ilustrativa");
    expect(from("term-0")).toContain("edição e páginas sem conferência");
    expect(libraryProvenance({ ...catalog[0], category: "Meu acervo" })).toBe(
      "Referência do seu acervo",
    );
  });
});
