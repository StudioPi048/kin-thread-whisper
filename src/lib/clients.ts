import { z } from "zod";

/**
 * Domínio de dados do dossiê clínico.
 * Fica fora de rotas para poder ser reutilizado em qualquer tela do app.
 */

export const genderOptions = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao_binario", label: "Não-binário" },
  { value: "outro", label: "Outro" },
  { value: "nao_informado", label: "Prefere não informar" },
] as const;

export type GenderValue = (typeof genderOptions)[number]["value"];

export const clientFormSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(160),
  preferred_name: z.string().trim().max(80).optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  gender: z.enum(["feminino", "masculino", "nao_binario", "outro", "nao_informado"]).optional().or(z.literal("")),
  birthplace: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  presenting_complaint: z.string().trim().max(2000).optional().or(z.literal("")),
  clinical_notes: z.string().trim().max(8000).optional().or(z.literal("")),
  tags_input: z.string().max(300).optional().or(z.literal("")),
  consent_given: z.boolean().default(false),
  consent_notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export function parseTags(input?: string | null): string[] {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export function formatBirthDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function calcAge(iso?: string | null): number | null {
  if (!iso) return null;
  const birth = new Date(iso);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return age >= 0 && age < 130 ? age : null;
}

export function initialsFrom(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
