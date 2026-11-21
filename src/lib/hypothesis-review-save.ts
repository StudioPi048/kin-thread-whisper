import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { clinicalIntelQuery } from "@/lib/clinical-intel";
import {
  evidenceFingerprint,
  evidenceSnapshot,
  latestReview,
  reviewsForPattern,
  type ReviewDecision,
  type ReviewRow,
} from "@/lib/hypothesis-review";
import { detectPatterns, type DetectedPattern } from "@/lib/patterns";
import { readCasePages } from "@/lib/read-case-pages";

export const reviewsKey = (clientId: string) => ["hypothesis-reviews", clientId] as const;

export function hypothesisReviewsQuery(clientId: string) {
  return queryOptions({
    queryKey: reviewsKey(clientId),
    enabled: !!clientId,
    queryFn: (): Promise<ReviewRow[]> =>
      readCasePages(
        (after, limit) => {
          const page = supabase
            .from("hypothesis_reviews")
            .select(
              "id, hypothesis_key, hypothesis_title, decision, note, version, evidence_fingerprint, evidence_snapshot, created_at",
            )
            .eq("client_id", clientId)
            .order("id")
            .limit(limit);
          return after ? page.gt("id", after) : page;
        },
        (row) => row.id,
      ),
  });
}

export type ObservedReview = { id: string | null; canonicalId: string | null };

export function observeReview(rows: ReviewRow[], key: string, pattern: DetectedPattern) {
  const latest = reviewsForPattern(rows, key, pattern)[0] ?? null;
  const observed: ObservedReview = {
    id: latest?.id ?? null,
    canonicalId: latestReview(rows, key)?.id ?? null,
  };
  return { latest, observed };
}

const review = z.object({
  id: z.string(),
  hypothesis_key: z.string(),
  hypothesis_title: z.string(),
  decision: z.enum(["accepted", "contested", "needs_data"]),
  note: z.string().nullable(),
  version: z.number(),
  created_at: z.string(),
  evidence_fingerprint: z.string(),
  evidence_snapshot: z.custom<Json>(),
});

const result = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("conflict"), latest: review.nullable() }),
  z.object({ kind: z.literal("saved"), latest: review }),
]);

type AppendArgs = {
  _client_id: string;
  _hypothesis_key: string;
  _hypothesis_title: string;
  _decision: ReviewDecision;
  _note: string | null;
  _evidence_fingerprint: string;
  _evidence_snapshot: ReturnType<typeof evidenceSnapshot>[];
  _expected_review_id: string | null;
};

export async function submitHypothesisReview(
  client: QueryClient,
  args: {
    clientId: string;
    key: string;
    title: string;
    pattern: DetectedPattern;
    decision: ReviewDecision;
    note: string;
    fingerprint: string;
    observed: ObservedReview;
  },
) {
  const rows = await client.fetchQuery({ ...hypothesisReviewsQuery(args.clientId), staleTime: 0 });
  const { latest, observed } = observeReview(rows, args.key, args.pattern);
  if (observed.id !== args.observed.id || observed.canonicalId !== args.observed.canonicalId) {
    return { kind: "conflict" as const, latest, observed };
  }

  const current = await client.fetchQuery({ ...clinicalIntelQuery(args.clientId), staleTime: 0 });
  const pattern = detectPatterns(current.persons, current.relationships).find(
    ({ id }) => id === args.pattern.id,
  );
  if (!pattern || evidenceFingerprint(pattern) !== args.fingerprint) {
    throw new Error(
      "As evidências mudaram. Confira os registros atuais e escolha a decisão novamente.",
    );
  }

  const appendReview = supabase.rpc.bind(supabase) as (
    name: "append_hypothesis_review",
    payload: AppendArgs,
  ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
  const { data, error } = await appendReview("append_hypothesis_review", {
    _client_id: args.clientId,
    _hypothesis_key: args.key,
    _hypothesis_title: args.title,
    _decision: args.decision,
    _note: args.note.trim() || null,
    _evidence_fingerprint: args.fingerprint,
    _evidence_snapshot: [evidenceSnapshot(pattern)],
    _expected_review_id: args.observed.canonicalId,
  });
  if (error) throw new Error(error.message);
  const outcome = result.safeParse(data);
  if (!outcome.success) throw new Error("O registro da revisão não foi confirmado.");
  if (outcome.data.kind === "conflict") {
    return {
      ...outcome.data,
      observed: {
        id: outcome.data.latest?.id ?? null,
        canonicalId: outcome.data.latest?.id ?? null,
      },
    };
  }
  return outcome.data;
}
