CREATE OR REPLACE FUNCTION public.append_hypothesis_review(
  _client_id uuid,
  _hypothesis_key text,
  _hypothesis_title text,
  _decision text,
  _note text,
  _evidence_fingerprint text,
  _evidence_snapshot jsonb,
  _expected_review_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  recent public.hypothesis_reviews;
BEGIN
  IF NOT EXISTS (
    SELECT FROM public.clients c WHERE c.id = _client_id AND c.professional_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;

  -- The insert trigger uses this same lock to serialize versions, including older clients.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(_client_id::text || ':' || _hypothesis_key));
  SELECT * INTO recent
    FROM public.hypothesis_reviews
    WHERE client_id = _client_id AND hypothesis_key = _hypothesis_key
    ORDER BY version DESC
    LIMIT 1;
  IF recent.id IS DISTINCT FROM _expected_review_id THEN
    RETURN jsonb_build_object('kind', 'conflict', 'latest', CASE WHEN recent.id IS NOT NULL THEN to_jsonb(recent) END);
  END IF;

  INSERT INTO public.hypothesis_reviews (
    client_id, hypothesis_key, hypothesis_title, decision, note, evidence_fingerprint, evidence_snapshot
  ) VALUES (
    _client_id, _hypothesis_key, _hypothesis_title, _decision, _note, _evidence_fingerprint, _evidence_snapshot
  ) RETURNING * INTO recent;
  RETURN jsonb_build_object('kind', 'saved', 'latest', to_jsonb(recent));
END;
$$;

REVOKE ALL ON FUNCTION public.append_hypothesis_review(uuid, text, text, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_hypothesis_review(uuid, text, text, text, text, text, jsonb, uuid) TO authenticated;
