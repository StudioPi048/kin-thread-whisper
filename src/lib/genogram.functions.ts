import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GenogramPersonDTO = {
  id: string;
  fullName: string;
  preferredName: string | null;
  gender: string | null;
  isProband: boolean;
  isDeceased: boolean;
  hasBirthDate: boolean;
  hasDeathDate: boolean;
  relationshipTo: string | null; // relationship_to_proband
  role:
    | "proband"
    | "father"
    | "mother"
    | "grandfather"
    | "grandmother"
    | "sibling"
    | "child"
    | "spouse"
    | "other";
};

export type GenogramAlert = {
  severity: "info" | "warn" | "high";
  message: string;
};

export type ClientGenogramDTO = {
  hasGenogram: boolean;
  totalPersons: number;
  generations: {
    proband: GenogramPersonDTO | null;
    parents: GenogramPersonDTO[];
    grandparents: GenogramPersonDTO[];
    siblings: GenogramPersonDTO[];
    others: GenogramPersonDTO[];
  };
  alerts: GenogramAlert[];
};

const classifyRole = (rel: string | null, isProband: boolean): GenogramPersonDTO["role"] => {
  if (isProband) return "proband";
  const r = (rel ?? "").toLowerCase();
  if (/avô|avo\b|avozinho|grandfather|grandpa/.test(r)) return "grandfather";
  if (/avó|avozinha|grandmother|grandma/.test(r)) return "grandmother";
  if (/\b(pai|father|papai)\b/.test(r)) return "father";
  if (/\b(mãe|mae|mother|mamãe|mamae)\b/.test(r)) return "mother";
  if (/irmão|irma|irmã|sibling|brother|sister/.test(r)) return "sibling";
  if (/filho|filha|child|son|daughter/.test(r)) return "child";
  if (/esposa|esposo|marido|mulher|spouse|companheir/.test(r)) return "spouse";
  return "other";
};

const lastSurname = (fullName: string): string | null => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const skip = new Set(["de", "da", "do", "das", "dos", "e"]);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!skip.has(parts[i].toLowerCase())) return parts[i].toLowerCase();
  }
  return null;
};

export const getClientGenogram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<ClientGenogramDTO> => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("genogram_persons")
      .select(
        "id, full_name, preferred_name, gender, is_proband, is_deceased, birth_date, death_date, relationship_to_proband, life_events",
      )
      .eq("client_id", data.clientId);

    if (error) throw new Error(error.message);

    const persons: (GenogramPersonDTO & { _lifeEvents: unknown })[] = (rows ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      preferredName: r.preferred_name,
      gender: r.gender,
      isProband: r.is_proband,
      isDeceased: r.is_deceased,
      hasBirthDate: !!r.birth_date,
      hasDeathDate: !!r.death_date,
      relationshipTo: r.relationship_to_proband,
      role: classifyRole(r.relationship_to_proband, r.is_proband),
      _lifeEvents: r.life_events,
    }));

    const proband = persons.find((p) => p.role === "proband") ?? null;
    const parents = persons.filter((p) => p.role === "father" || p.role === "mother");
    const grandparents = persons.filter(
      (p) => p.role === "grandfather" || p.role === "grandmother",
    );
    const siblings = persons.filter((p) => p.role === "sibling");
    const others = persons.filter(
      (p) =>
        !["proband", "father", "mother", "grandfather", "grandmother", "sibling"].includes(p.role),
    );

    // ---- rule-based alerts ----
    const alerts: GenogramAlert[] = [];

    if (persons.length === 0) {
      alerts.push({
        severity: "high",
        message: "Genossociograma ainda não iniciado para este cliente.",
      });
    } else {
      if (!proband) {
        alerts.push({
          severity: "warn",
          message: "Nenhuma pessoa marcada como paciente (proband) no genograma.",
        });
      }
      if (parents.length < 2) {
        alerts.push({
          severity: "warn",
          message: `Faltam ${2 - parents.length} figura(s) parental(is) — pai/mãe incompletos.`,
        });
      }
      if (grandparents.length < 4) {
        alerts.push({
          severity: "info",
          message: `Genograma parcial: ${grandparents.length}/4 avós registrados.`,
        });
      }
      const missingBirth = persons.filter((p) => !p.hasBirthDate).length;
      if (missingBirth > 0) {
        alerts.push({
          severity: missingBirth >= 3 ? "warn" : "info",
          message: `${missingBirth} parente(s) sem data de nascimento.`,
        });
      }
      const deceasedNoDate = persons.filter((p) => p.isDeceased && !p.hasDeathDate).length;
      if (deceasedNoDate > 0) {
        alerts.push({
          severity: "warn",
          message: `${deceasedNoDate} falecido(s) sem data de óbito registrada.`,
        });
      }

      // life events without date
      let eventsNoDate = 0;
      persons.forEach((p) => {
        const ev = p._lifeEvents;
        if (Array.isArray(ev)) {
          ev.forEach((e) => {
            if (
              e &&
              typeof e === "object" &&
              !("date" in e && (e as Record<string, unknown>).date)
            ) {
              eventsNoDate++;
            }
          });
        }
      });
      if (eventsNoDate > 0) {
        alerts.push({
          severity: "info",
          message: `${eventsNoDate} evento(s) importante(s) sem data — investigar coincidências.`,
        });
      }

      // repeated surnames
      const surnameCounts = new Map<string, number>();
      persons.forEach((p) => {
        const s = lastSurname(p.fullName);
        if (s) surnameCounts.set(s, (surnameCounts.get(s) ?? 0) + 1);
      });
      surnameCounts.forEach((count, surname) => {
        if (count >= 3) {
          alerts.push({
            severity: "info",
            message: `Sobrenome "${surname[0].toUpperCase() + surname.slice(1)}" repete em ${count} pessoas — possível lealdade familiar.`,
          });
        }
      });
    }

    const strip = (p: GenogramPersonDTO & { _lifeEvents: unknown }): GenogramPersonDTO => ({
      id: p.id,
      fullName: p.fullName,
      preferredName: p.preferredName,
      gender: p.gender,
      isProband: p.isProband,
      isDeceased: p.isDeceased,
      hasBirthDate: p.hasBirthDate,
      hasDeathDate: p.hasDeathDate,
      relationshipTo: p.relationshipTo,
      role: p.role,
    });

    return {
      hasGenogram: persons.length > 0,
      totalPersons: persons.length,
      generations: {
        proband: proband ? strip(proband) : null,
        parents: parents.map(strip),
        grandparents: grandparents.map(strip),
        siblings: siblings.map(strip),
        others: others.map(strip),
      },
      alerts,
    };
  });
