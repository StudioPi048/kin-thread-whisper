export function personSymbol(person: {
  gender?: string | null;
  relationship_to_proband?: string | null;
  full_name?: string | null;
  preferred_name?: string | null;
}) {
  const normalize = (value?: string | null) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const gender = normalize(person.gender);
  if (gender.includes("aborto")) return "aborto";
  if (["masculino", "m", "homem", "male"].includes(gender)) return "masculino";
  if (["feminino", "f", "mulher", "female"].includes(gender)) return "feminino";
  if (gender && gender !== "desconhecido" && gender !== "unknown") return "desconhecido";

  // A referência em "irmã do avô", por exemplo, não descreve o gênero da irmã.
  const role = (person.relationship_to_proband ?? "")
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)[0];
  if (role === "aborto" || /^aborto\b/i.test(person.full_name?.trim() ?? "")) return "aborto";
  if (["pai", "tio", "avô", "bisavô", "trisavô", "filho", "irmão", "irmao"].includes(role)) {
    return "masculino";
  }
  if (["mãe", "mae", "tia", "avó", "bisavó", "trisavó", "filha", "irmã", "irma"].includes(role)) {
    return "feminino";
  }
  return "desconhecido";
}
