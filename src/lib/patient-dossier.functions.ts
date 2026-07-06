import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  JOURNEY_STAGES,
  libraryTagsFor,
  normalizePatternKey,
  protocolsFor,
  questionsFor,
  type JourneyStage,
} from "./clinical-catalog";

// ---------- DTOs ----------

export type PatientIdentityDTO = {
  id: string;
  fullName: string;
  preferredName: string | null;
  avatarUrl: string | null;
  ageYears: number | null;
  gender: string | null;
  status: string;
  profession: string | null;
  clientSinceISO: string;
  monthsAsClient: number;
  tags: string[];
  nextSessionISO: string | null;
  presentingComplaint: string | null;
};

export type JourneyDTO = {
  currentStage: JourneyStage;
  stages: { key: JourneyStage; label: string; description: string; status: "done" | "current" | "future" }[];
};

export type EvolutionDTO = {
  id: string;
  dateISO: string;
  title: string | null;
  summary: string | null;
  status: string;
};

export type TimelineEventDTO = {
  dateISO: string;
  year: number;
  kind: "birth" | "death" | "life_event";
  personName: string;
  label: string;
};

export type LibrarySuggestionDTO = {
  id: string;
  author: string;
  title: string;
  topic: string | null;
  matchedTag: string;
};

export type BriefingDTO = {
  hypotheses: { title: string; description: string | null; severity: string }[];
  suggestedQuestions: string[];
  suggestedProtocols: string[];
  clinicalAlerts: { severity: "info" | "warn" | "high"; message: string }[];
};

// Genogram summary reused from the existing genogram function shape.
export type DossierGenogramDTO = {
  hasGenogram: boolean;
  totalPersons: number;
  proband: { id: string; fullName: string; gender: string | null; role: string } | null;
  parents: { id: string; fullName: string; role: string; isDeceased: boolean }[];
  grandparents: { id: string; fullName: string; role: string; isDeceased: boolean }[];
};

export type PatientDossierDTO = {
  identity: PatientIdentityDTO;
  journey: JourneyDTO;
  summary: {
    lastEvolution: EvolutionDTO | null;
    presentingIntention: string | null;
    signatureNotes: string | null;
  };
  genogram: DossierGenogramDTO;
  timeline: TimelineEventDTO[];
  briefing: BriefingDTO;
  library: LibrarySuggestionDTO[];
  evolutions: EvolutionDTO[];
  counts: {
    totalSessions: number;
    totalPatterns: number;
    totalPersons: number;
  };
};

// ---------- Helpers ----------

const classifyRole = (rel: string | null, isProband: boolean): string => {
  if (isProband) return "proband";
  const r = (rel ?? "").toLowerCase();
  if (/avô|avo\b|grandfather/.test(r)) return "grandfather";
  if (/avó|grandmother/.test(r)) return "grandmother";
  if (/\b(pai|father)\b/.test(r)) return "father";
  if (/\b(mãe|mae|mother)\b/.test(r)) return "mother";
  return "other";
};

const computeAgeYears = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const monthsBetween = (fromISO: string): number => {
  const d = new Date(fromISO);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
};

const extractSummary = (note: unknown): string | null => {
  if (!note || typeof note !== "object") return null;
  const n = note as Record<string, unknown>;
  const s = n.resumo ?? n.summary ?? n.overview;
  return typeof s === "string" && s.trim() ? s.trim() : null;
};

const deriveStage = (sessionCount: number, hasGenogram: boolean, patternCount: number): JourneyStage => {
  if (sessionCount === 0) return "primeira";
  if (sessionCount === 1) return "investigacao";
  if (!hasGenogram) return "investigacao";
  if (patternCount === 0) return "hipoteses";
  if (sessionCount < 6) return "hipoteses";
  if (sessionCount < 12) return "elaboracao";
  return "integracao";
};

// ---------- Server function ----------

export const getPatientDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PatientDossierDTO> => {
    const { supabase, userId } = context;
    const clientId = data.clientId;

    // Kick off all reads in parallel — RLS keeps them scoped to the professional.
    const [clientRes, sessionsRes, personsRes, patternsRes, intakeRes] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, full_name, preferred_name, avatar_url, birth_date, gender, status, tags, created_at, presenting_complaint, professional_id",
        )
        .eq("id", clientId)
        .eq("professional_id", userId)
        .maybeSingle(),
      supabase
        .from("clinical_sessions")
        .select("id, session_date, title, status, structured_note")
        .eq("client_id", clientId)
        .eq("user_id", userId)
        .order("session_date", { ascending: false })
        .limit(20),
      supabase
        .from("genogram_persons")
        .select(
          "id, full_name, preferred_name, gender, is_proband, is_deceased, birth_date, death_date, relationship_to_proband, life_events",
        )
        .eq("client_id", clientId),
      supabase
        .from("patterns_detected")
        .select("id, pattern_type, title, description, severity, created_at")
        .eq("client_id", clientId)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("client_intakes")
        .select("presenting_intention, signature_notes, profession")
        .eq("client_id", clientId)
        .eq("professional_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (clientRes.error) throw new Error(clientRes.error.message);
    if (!clientRes.data) throw new Error("Cliente não encontrado ou fora do seu acesso.");

    const c = clientRes.data;
    const sessions = sessionsRes.data ?? [];
    const persons = personsRes.data ?? [];
    const patterns = patternsRes.data ?? [];
    const intake = intakeRes.data ?? null;

    // Next scheduled session (first session in the future).
    const now = Date.now();
    const nextSession = sessions
      .slice()
      .reverse()
      .find((s) => new Date(s.session_date).getTime() > now);

    // ---- Identity ----
    const identity: PatientIdentityDTO = {
      id: c.id,
      fullName: c.full_name,
      preferredName: c.preferred_name,
      avatarUrl: c.avatar_url,
      ageYears: computeAgeYears(c.birth_date),
      gender: c.gender,
      status: c.status,
      profession: intake?.profession ?? null,
      clientSinceISO: c.created_at,
      monthsAsClient: monthsBetween(c.created_at),
      tags: c.tags ?? [],
      nextSessionISO: nextSession?.session_date ?? null,
      presentingComplaint: c.presenting_complaint,
    };

    // ---- Journey ----
    const hasGenogram = persons.length > 0;
    const currentStage = deriveStage(sessions.length, hasGenogram, patterns.length);
    const currentIdx = JOURNEY_STAGES.findIndex((s) => s.key === currentStage);
    const journey: JourneyDTO = {
      currentStage,
      stages: JOURNEY_STAGES.map((s, i) => ({
        ...s,
        status: i < currentIdx ? "done" : i === currentIdx ? "current" : "future",
      })),
    };

    // ---- Evolutions ----
    const evolutions: EvolutionDTO[] = sessions
      .filter((s) => new Date(s.session_date).getTime() <= now) // only past
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        dateISO: s.session_date,
        title: s.title,
        summary: extractSummary(s.structured_note),
        status: s.status,
      }));

    const lastEvolution = evolutions[0] ?? null;

    // ---- Genogram summary ----
    const enriched = persons.map((p) => ({
      ...p,
      role: classifyRole(p.relationship_to_proband, p.is_proband),
    }));
    const proband = enriched.find((p) => p.role === "proband") ?? null;
    const genogram: DossierGenogramDTO = {
      hasGenogram,
      totalPersons: persons.length,
      proband: proband
        ? { id: proband.id, fullName: proband.full_name, gender: proband.gender, role: proband.role }
        : null,
      parents: enriched
        .filter((p) => p.role === "father" || p.role === "mother")
        .map((p) => ({ id: p.id, fullName: p.full_name, role: p.role, isDeceased: p.is_deceased })),
      grandparents: enriched
        .filter((p) => p.role === "grandfather" || p.role === "grandmother")
        .map((p) => ({ id: p.id, fullName: p.full_name, role: p.role, isDeceased: p.is_deceased })),
    };

    // ---- Timeline (from genogram_persons dates + life_events) ----
    const timeline: TimelineEventDTO[] = [];
    enriched.forEach((p) => {
      if (p.birth_date) {
        const d = new Date(p.birth_date);
        timeline.push({
          dateISO: p.birth_date,
          year: d.getFullYear(),
          kind: "birth",
          personName: p.full_name,
          label: p.is_proband ? "Nascimento (paciente)" : "Nascimento",
        });
      }
      if (p.death_date) {
        const d = new Date(p.death_date);
        timeline.push({
          dateISO: p.death_date,
          year: d.getFullYear(),
          kind: "death",
          personName: p.full_name,
          label: "Falecimento",
        });
      }
      const ev = p.life_events;
      if (Array.isArray(ev)) {
        ev.forEach((e) => {
          if (e && typeof e === "object") {
            const evObj = e as Record<string, unknown>;
            const evDate = typeof evObj.date === "string" ? evObj.date : null;
            const evLabel =
              (typeof evObj.title === "string" && evObj.title) ||
              (typeof evObj.description === "string" && evObj.description) ||
              "Evento familiar";
            if (evDate) {
              const d = new Date(evDate);
              if (!Number.isNaN(d.getTime())) {
                timeline.push({
                  dateISO: evDate,
                  year: d.getFullYear(),
                  kind: "life_event",
                  personName: p.full_name,
                  label: evLabel,
                });
              }
            }
          }
        });
      }
    });
    timeline.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

    // ---- Briefing (regras determinísticas) ----
    const suggestedQuestions = new Set<string>();
    const suggestedProtocols = new Set<string>();
    patterns.forEach((p) => {
      questionsFor(p.pattern_type).forEach((q) => suggestedQuestions.add(q));
      protocolsFor(p.pattern_type).forEach((pr) => suggestedProtocols.add(pr));
    });
    if (patterns.length === 0) {
      questionsFor("default").forEach((q) => suggestedQuestions.add(q));
      protocolsFor("default").forEach((p) => suggestedProtocols.add(p));
    }

    // Alerts from rules
    const clinicalAlerts: BriefingDTO["clinicalAlerts"] = [];
    if (!hasGenogram) {
      clinicalAlerts.push({ severity: "high", message: "Genossociograma ainda não iniciado." });
    } else {
      const parents = enriched.filter((p) => p.role === "father" || p.role === "mother");
      if (parents.length < 2) {
        clinicalAlerts.push({
          severity: "warn",
          message: `Faltam ${2 - parents.length} figura(s) parental(is) no genograma.`,
        });
      }
      const grandparents = enriched.filter((p) => p.role === "grandfather" || p.role === "grandmother");
      if (grandparents.length < 4) {
        clinicalAlerts.push({
          severity: "info",
          message: `${grandparents.length}/4 avós registrados.`,
        });
      }
      const noBirth = enriched.filter((p) => !p.birth_date).length;
      if (noBirth > 0) {
        clinicalAlerts.push({
          severity: noBirth >= 3 ? "warn" : "info",
          message: `${noBirth} parente(s) sem data de nascimento.`,
        });
      }
      const deceasedNoDate = enriched.filter((p) => p.is_deceased && !p.death_date).length;
      if (deceasedNoDate > 0) {
        clinicalAlerts.push({
          severity: "warn",
          message: `${deceasedNoDate} falecido(s) sem data de óbito.`,
        });
      }
    }
    if (evolutions.length === 0) {
      clinicalAlerts.push({ severity: "info", message: "Nenhuma evolução registrada — primeira escuta pendente." });
    }

    const briefing: BriefingDTO = {
      hypotheses: patterns.slice(0, 5).map((p) => ({
        title: p.title,
        description: p.description,
        severity: p.severity,
      })),
      suggestedQuestions: Array.from(suggestedQuestions).slice(0, 6),
      suggestedProtocols: Array.from(suggestedProtocols).slice(0, 6),
      clinicalAlerts,
    };

    // ---- Library (match por tag dos padrões detectados) ----
    const tagsToMatch = new Set<string>();
    patterns.forEach((p) => libraryTagsFor(p.pattern_type).forEach((t) => tagsToMatch.add(t)));
    if (tagsToMatch.size === 0) {
      libraryTagsFor("default").forEach((t) => tagsToMatch.add(t));
    }

    let library: LibrarySuggestionDTO[] = [];
    if (tagsToMatch.size > 0) {
      const { data: libRows } = await supabase
        .from("library_entries")
        .select("id, author, title, topic, tags")
        .overlaps("tags", Array.from(tagsToMatch))
        .limit(6);
      library = (libRows ?? []).map((row) => ({
        id: row.id,
        author: row.author,
        title: row.title,
        topic: row.topic,
        matchedTag:
          (row.tags ?? []).find((t: string) => tagsToMatch.has(t.toLowerCase())) ??
          Array.from(tagsToMatch)[0],
      }));
    }

    return {
      identity,
      journey,
      summary: {
        lastEvolution,
        presentingIntention: intake?.presenting_intention ?? null,
        signatureNotes: intake?.signature_notes ?? null,
      },
      genogram,
      timeline,
      briefing,
      library,
      evolutions,
      counts: {
        totalSessions: sessions.length,
        totalPatterns: patterns.length,
        totalPersons: persons.length,
      },
    };
  });

// Re-export for consumers that need the enum in the client bundle.
export { JOURNEY_STAGES } from "./clinical-catalog";
export type { JourneyStage } from "./clinical-catalog";
