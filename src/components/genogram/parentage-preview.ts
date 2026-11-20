/** Transient comparison between two parent sets on the same map. */
export type ParentagePreview = {
  childId: string;
  previousParentIds: readonly string[];
  proposedParentIds: readonly string[];
  phase: "draft" | "confirmed";
};
