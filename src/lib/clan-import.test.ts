import { describe, it, expect } from "vitest";
import { autoMap, analyzeImport } from "./clan-import";

describe("importação da planilha", () => {
  it("mapeia colunas pelo cabeçalho em qualquer ordem", () => {
    const m = autoMap(["Parentesco", "Nome", "Nascimento"]);
    expect(m.full_name).toBe(1);
    expect(m.relationship).toBe(0);
    expect(m.birth).toBe(2);
  });
  it("erros por linha, sem descartar as válidas", () => {
    const m = autoMap(["Nome", "Parentesco", "Nascimento"]);
    const r = analyzeImport(
      [
        ["Ana", "Mãe", "10/02/1960"],
        ["", "Pai", "01/01/1958"],
        ["Rui", "Avô paterno", "99/99/1930"],
      ],
      m,
    );
    expect(r.map((x) => x.status)).toEqual(["ok", "error", "error"]);
    expect(r[1].line).toBe(3);
    expect(r[1].messages).toContain("Nome obrigatório");
  });
  it("detecta duplicidade contra existentes e dentro do arquivo", () => {
    const m = autoMap(["Nome", "Parentesco", "Nascimento"]);
    const r = analyzeImport(
      [
        ["Ana", "Mãe", "10/02/1960"],
        ["Ana", "Mãe", "10/02/1960"],
        ["Rui", "Pai", ""],
      ],
      m,
      [{ full_name: "rui", birth_date: null }],
    );
    expect(r.map((x) => x.status)).toEqual(["ok", "duplicate", "duplicate"]);
  });
  it("data só com ano é marcada como aproximada", () => {
    const m = autoMap(["Nome", "Parentesco", "Nascimento"]);
    const [row] = analyzeImport([["Ana", "Mãe", "1960"]], m);
    expect(row.status).toBe("ok");
    expect(row.messages.join(" ")).toMatch(/aproximad/);
  });
  it("linha do cliente é ignorada (vem do cadastro)", () => {
    const m = autoMap(["Nome", "Parentesco"]);
    expect(analyzeImport([["Eu", "Consulente"]], m)[0].status).toBe("skip");
  });
});
