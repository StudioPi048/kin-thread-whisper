/**
 * Domínio simbólico do genossociograma.
 * Fica separado de qualquer componente para poder ser reutilizado
 * pelo canvas, formulários e (futuramente) pelo motor de padrões.
 */
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export const relationshipQualifiers: Record<RelationshipType, { value: string; label: string }[]> =
  {
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
  return genogramGenderOptions.find((g) => g.value === gender)?.symbol ?? "◇";
}

export function relationshipLabel(type: string, qualifier?: string | null): string {
  const t = relationshipTypes.find((r) => r.value === type)?.label ?? type;
  if (!qualifier) return t;
  const q = relationshipQualifiers[type as RelationshipType]?.find((x) => x.value === qualifier);
  return q ? `${t.split(" (")[0]} · ${q.label}` : t;
}

function parseISODate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateBR(iso?: string | null): string {
  const d = parseISODate(iso);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "";
}

/** Datas completas (não só o ano) pro card do nó — nasc. e óbito, quando houver. */
export function personDatesLabel(birth?: string | null, death?: string | null): string {
  const b = formatDateBR(birth);
  const d = formatDateBR(death);
  if (b && d) return `${b} – ${d}`;
  return b || d;
}

/** Concepção estimada: nascimento menos 9 meses. Sem dado de gestação, é sempre 9
 * meses cheios — prematuridade fica a critério do clínico ajustar manualmente. */
export function estimateConceptionDate(birthDate?: string | null): Date | null {
  const d = parseISODate(birthDate);
  return d ? subMonths(d, 9) : null;
}

export interface NearbyLoss {
  personId: string;
  name: string;
  deathDateLabel: string;
  daysBeforeBirth: number;
}

/**
 * Padrão de "filho de substituição" (psicogenealogia): sinaliza quando o
 * nascimento de alguém ocorreu dentro da janela de ~9 meses após o
 * falecimento de outro membro do clã — a concepção coincidiu com o luto.
 */
export function findNearbyLosses(
  birthDate: string | null | undefined,
  personId: string,
  allPersons: {
    id: string;
    full_name?: string | null;
    preferred_name?: string | null;
    death_date?: string | null;
  }[],
): NearbyLoss[] {
  const birth = parseISODate(birthDate);
  if (!birth) return [];
  const windowStart = subMonths(birth, 9);

  const losses: NearbyLoss[] = [];
  for (const p of allPersons) {
    if (p.id === personId) continue;
    const death = parseISODate(p.death_date);
    if (!death || death < windowStart || death > birth) continue;
    losses.push({
      personId: p.id,
      name: p.preferred_name || p.full_name || "(sem nome)",
      deathDateLabel: formatDateBR(p.death_date),
      daysBeforeBirth: Math.round((birth.getTime() - death.getTime()) / 86400000),
    });
  }
  return losses.sort((a, b) => a.daysBeforeBirth - b.daysBeforeBirth);
}
