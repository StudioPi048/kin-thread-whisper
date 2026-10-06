export function personSymbol(person: {
  gender?: string | null;
  relationship_to_proband?: string | null;
  full_name?: string | null;
  preferred_name?: string | null;
}) {
  const rawGender = (person.gender || "").toLowerCase().trim();
  const rel = (person.relationship_to_proband || "").toLowerCase();

  const rawName = (person.full_name || "").toLowerCase().trim();
  const rawPref = (person.preferred_name || "").toLowerCase().trim();

  let gender = "desconhecido";
  if (
    rawGender.includes("masculino") ||
    rawGender === "m" ||
    rawGender === "homem" ||
    rel.match(/pai|tio|avô|bisavô|filho|irmão|irmao/)
  ) {
    gender = "masculino";
  } else if (
    rawGender.includes("feminino") ||
    rawGender === "f" ||
    rawGender === "mulher" ||
    rel.match(/mãe|mae|tia|avó|avo|bisavó|filha|irmã|irma/)
  ) {
    gender = "feminino";
  }

  if (rawGender.includes("aborto") || rawName.includes("aborto") || rawPref.includes("aborto")) {
    gender = "aborto";
  }

  return gender;
}
