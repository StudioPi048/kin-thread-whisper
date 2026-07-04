-- Unique index preventing duplicate union with same marriage_order between same pair (order-independent).
-- Treats NULL marriage_order as 0 so only one "união única" per pair is allowed too.
CREATE UNIQUE INDEX IF NOT EXISTS genogram_rel_union_unique_pair_order
ON public.genogram_relationships (
  client_id,
  LEAST(from_person_id, to_person_id),
  GREATEST(from_person_id, to_person_id),
  COALESCE(marriage_order, 0)
)
WHERE relationship_type = 'union';