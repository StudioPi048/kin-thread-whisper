/**
 * Domínio simbólico do genossociograma.
 * Fica separado de qualquer componente para poder ser reutilizado
 * pelo canvas, formulários e (futuramente) pelo motor de padrões.
 */

export const genogramGenderOptions = [
  { value: "feminino", label: "Feminino", symbol: "○" },
  { value: "masculino", label: "Masculino", symbol: "□" },
  { value: "nao_binario", label: "Não-binário", symbol: "◇" },
  { value: "outro", label: "Outro", symbol: "◇" },
  { value: "desconhecido", label: "Desconhecido", symbol: "?" },
] as const;

export type GenogramGender = (typeof genogramGenderOptions)[number]["value"];

export const relationshipTypes = [
  { value: "parent", label: "Parental (pai/mãe → filho)" },
  { value: "union", label: "União (casal)" },
  { value: "sibling", label: "Irmandade" },
  { value: "emotional", label: "Vínculo emocional" },
] as const;

export type RelationshipType = (typeof relationshipTypes)[number]["value"];

export const relationshipQualifiers: Record<
  RelationshipType,
  { value: string; label: string }[]
> = {
  parent: [
    { value: "biological", label: "Biológico" },
    { value: "adoptive", label: "Adotivo" },
    { value: "foster", label: "Acolhimento" },
    { value: "stepparent", label: "Padrasto/madrasta" },
  ],
  union: [
    { value: "marriage", label: "Casamento" },
    { value: "cohabitation", label: "União estável" },
    { value: "engagement", label: "Noivado" },
    { value: "divorce", label: "Divórcio" },
    { value: "separation", label: "Separação" },
    { value: "affair", label: "Caso / amante" },
  ],
  sibling: [
    { value: "biological", label: "Biológico" },
    { value: "twin", label: "Gêmeos" },
    { value: "half", label: "Meio-irmão(ã)" },
    { value: "adoptive", label: "Adotivo" },
  ],
  emotional: [
    { value: "close", label: "Próximo" },
    { value: "fusion", label: "Fusão" },
    { value: "conflict", label: "Conflito" },
    { value: "rupture", label: "Ruptura" },
    { value: "distance", label: "Distância" },
    { value: "grief", label: "Luto não elaborado" },
    { value: "secret", label: "Segredo compartilhado" },
  ],
};

export function genderSymbol(gender?: string | null): string {
  return (
    genogramGenderOptions.find((g) => g.value === gender)?.symbol ?? "◇"
  );
}

export function relationshipLabel(type: string, qualifier?: string | null): string {
  const t = relationshipTypes.find((r) => r.value === type)?.label ?? type;
  if (!qualifier) return t;
  const q = relationshipQualifiers[type as RelationshipType]?.find((x) => x.value === qualifier);
  return q ? `${t.split(" (")[0]} · ${q.label}` : t;
}

export function personYears(birth?: string | null, death?: string | null): string {
  const b = birth?.slice(0, 4) ?? "";
  const d = death?.slice(0, 4) ?? "";
  if (!b && !d) return "";
  return `${b}${b || d ? " – " : ""}${d}`;
}
