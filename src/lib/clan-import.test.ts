import { describe, it, expect } from "vitest";
import {
  autoMap,
  analyzeImport,
  parseDateField,
  parseDateString,
  readClanFile,
  inferGenderFromRelationship,
} from "./clan-import";

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
  it("data só com ano não vira 01/01: fica em notes e birth_date null", () => {
    const m = autoMap(["Nome", "Parentesco", "Nascimento"]);
    const [row] = analyzeImport([["Ana", "Mãe", "1960"]], m);
    expect(row.status).toBe("ok");
    expect(row.record?.birth_date).toBeNull();
    expect(row.record?.notes).toContain('"1960"');
    expect(row.record?.notes).toContain("[Importação]");
  });
  it("DD/MM sem ano não fabrica ano 2000", () => {
    const m = autoMap(["Nome", "Parentesco", "Nascimento", "Falecimento"]);
    const [row] = analyzeImport([["Rui", "Pai", "14/08", "03/2001"]], m);
    expect(row.record?.birth_date).toBeNull();
    expect(row.record?.death_date).toBeNull();
    expect(row.record?.is_deceased).toBe(true);
    expect(row.record?.notes).toMatch(/14\/08/);
    expect(parseDateString("14/08")).toBeNull();
    expect(parseDateString("1985")).toBeNull();
  });
  it("datas inválidas e ano 0000 são erro da linha", () => {
    expect(parseDateField("0000").kind).toBe("invalid");
    expect(parseDateField("31/02/1990").kind).toBe("invalid");
    expect(parseDateField("10/10/0000").kind).toBe("invalid");
    expect(parseDateField("abc").kind).toBe("invalid");
    expect(parseDateField("10/02/60").kind).toBe("invalid");
    expect(parseDateField("10/02/1960")).toEqual({ kind: "exact", iso: "1960-02-10" });
    const m = autoMap(["Nome", "Parentesco", "Nascimento"]);
    expect(analyzeImport([["Ana", "Mãe", "0000"]], m)[0].status).toBe("error");
  });
  it("ordem precisa ser inteiro positivo", () => {
    const m = autoMap(["Nome", "Parentesco", "Ordem"]);
    const r = analyzeImport(
      [
        ["A", "Tio", "0"],
        ["B", "Tio", "2.5"],
        ["C", "Tio", "-1"],
        ["D", "Tio", "3"],
      ],
      m,
    );
    expect(r.map((x) => x.status)).toEqual(["error", "error", "error", "ok"]);
    expect(r[3].record?.birth_order).toBe(3);
  });
  it("linha do cliente é ignorada (vem do cadastro)", () => {
    const m = autoMap(["Nome", "Parentesco"]);
    expect(analyzeImport([["Eu", "Consulente"]], m)[0].status).toBe("skip");
  });
  it("não transforma irmãos de referência desconhecida em irmãos da linha anterior", () => {
    const mapping = autoMap(["Nome", "Parentesco"]);
    const [_, vague, explicit, canonical] = analyzeImport(
      [
        ["Antônio", "Avô paterno"],
        ["Pedro", "Irmão"],
        ["Maria", "Irmã(o) da Bisavó paterna (mãe do avô)"],
        ["João", "Irmã(o)"],
      ],
      mapping,
    );

    expect(vague.record?.relationship_to_proband).toBe("Irmão (referência não informada)");
    expect(vague.messages.join(" ")).toContain("Irmão de quem?");
    expect(explicit.record?.relationship_to_proband).toBe("Irmã(o) da Bisavó paterna (mãe do avô)");
    expect(canonical.record?.relationship_to_proband).toBe("Irmã(o)");
  });
  it("lê cabeçalhos reais do CSV de exportação e mantém aspas, separadores e vazios", async () => {
    const file = new TextEncoder().encode(
      "\uFEFFNOME;PARENTESCO;Data Nascimento;Tempo gestacional;Data Morte;ENFERMIDADES;PROFISSÕES;VÍCIOS;Temperamento;Ordem;Observações\n" +
        '"Ana";"Mãe";"1960";"40";"Sim";"";"Docente";"";"";"2";"disse ""oi"";\nem casa"',
    );
    const { header, rows } = await readClanFile(file.buffer, "csv");
    const [row] = analyzeImport(rows, autoMap(header));
    expect(row.record).toMatchObject({
      full_name: "Ana",
      relationship_to_proband: "Mãe",
      birth_date: null,
      gestational_weeks: "40",
      is_deceased: true,
      health_conditions: [],
      occupation: "Docente",
      vices: null,
      birth_order: 2,
    });
    expect(row.record?.notes).toContain('disse "oi";\nem casa');
  });
  it("preserva nomes e parentesco em CSV UTF-8 sem BOM", async () => {
    const file = new TextEncoder().encode("Nome,Parentesco\nÁlvaro,Irmão do avô");
    const { header, rows } = await readClanFile(file.buffer, "csv");
    expect(rows).toEqual([["Álvaro", "Irmão do avô"]]);
    const [row] = analyzeImport(rows, autoMap(header));
    expect(row.record?.relationship_to_proband).toBe("Irmão do avô");
  });

  it("lê o gênero da pessoa e não do parente mencionado no rótulo", () => {
    expect(inferGenderFromRelationship("Irmã do avô paterno")).toBe("feminino");
    expect(inferGenderFromRelationship("Irmão da avó")).toBe("masculino");
    expect(inferGenderFromRelationship("Irmã(o)")).toBeUndefined();
  });
});
