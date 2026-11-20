import { validateParentLink } from "./family-relationships";
import type { ParentKind } from "./geno/build";
import type { Tables } from "@/integrations/supabase/types";

type ParentageRelationship = Pick<
  Tables<"genogram_relationships">,
  "id" | "relationship_type" | "from_person_id" | "to_person_id" | "updated_at"
>;

export type ParentageVersion = { id: string; updatedAt: string };
/** Omitting kind preserves the stored nature of an existing relationship, including a legacy null. */
export type ParentageCandidate = { personId: string; kind?: ParentKind };
export type ParentageDecision = "confirm" | "edit";

export const parentageSources = {
  unverified: "Fonte não registrada",
  client_report: "Relato do cliente",
  family_report: "Relato de familiar",
  document: "Documento",
  professional_observation: "Observação da profissional",
  other: "Outra fonte",
} as const;
export type ParentageSource = keyof typeof parentageSources;

export function parentageSnapshot(
  relationships: readonly ParentageRelationship[],
  childId: string,
): ParentageVersion[] {
  return relationships
    .filter((link) => link.relationship_type === "parent" && link.to_person_id === childId)
    .map(({ id, updated_at }) => ({ id, updatedAt: updated_at }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Validates the final parent set so a replacement can free a slot in the same operation. */
export function validateParentagePlan(
  childId: string,
  parents: readonly ParentageCandidate[],
  relationships: readonly ParentageRelationship[],
): string | null {
  const links = relationships.filter((link) => link.relationship_type === "parent");
  const otherLinks = links.filter((link) => link.to_person_id !== childId);
  for (const [index, { personId, kind }] of parents.entries()) {
    if (
      !kind &&
      !links.some((link) => link.to_person_id === childId && link.from_person_id === personId)
    ) {
      return "Informe a natureza da nova filiação.";
    }
    const error = validateParentLink(personId, childId, otherLinks);
    if (error) return error;
    otherLinks.push({
      id: `pending-${index}`,
      from_person_id: personId,
      to_person_id: childId,
      relationship_type: "parent",
      updated_at: "",
    });
  }
  return null;
}

export type ParentageHistoryEntry = Tables<"genogram_parentage_reviews">;
type SavedLink = {
  id: string;
  from_person_id: string;
  updated_at: string;
  qualifier: string | null;
};

export function historyLinks(links: ParentageHistoryEntry["after_links"]): SavedLink[] {
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    if (
      !link ||
      typeof link !== "object" ||
      Array.isArray(link) ||
      typeof link.id !== "string" ||
      typeof link.from_person_id !== "string" ||
      typeof link.updated_at !== "string"
    )
      return [];
    return [
      {
        id: link.id,
        from_person_id: link.from_person_id,
        updated_at: link.updated_at,
        qualifier: typeof link.qualifier === "string" ? link.qualifier : null,
      },
    ];
  });
}

export function reviewMatchesCurrent(
  review: ParentageHistoryEntry | undefined,
  current: readonly ParentageVersion[],
  reviewed: boolean,
) {
  if (!review || !Array.isArray(review.after_links) || review.after_reviewed !== reviewed)
    return false;
  const links = historyLinks(review.after_links);
  return (
    links.length === current.length &&
    links.length === review.after_links.length &&
    current.every((version) =>
      links.some((link) => link.id === version.id && link.updated_at === version.updatedAt),
    )
  );
}
