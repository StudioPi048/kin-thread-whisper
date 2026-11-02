CREATE TABLE public.hypothesis_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL DEFAULT auth.uid(),
  hypothesis_key text NOT NULL,
  hypothesis_title text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','contested','needs_data')),
  note text,
  evidence_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_fingerprint text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hypothesis_reviews_client_key_idx ON public.hypothesis_reviews (client_id, hypothesis_key, version DESC);

GRANT SELECT, INSERT ON public.hypothesis_reviews TO authenticated;
GRANT ALL ON public.hypothesis_reviews TO service_role;

ALTER TABLE public.hypothesis_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read reviews of own clients"
  ON public.hypothesis_reviews FOR SELECT TO authenticated
  USING (
    professional_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid())
  );

CREATE POLICY "Owners append reviews to own clients"
  ON public.hypothesis_reviews FOR INSERT TO authenticated
  WITH CHECK (
    professional_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid())
  );

-- Histórico imutável: sem UPDATE/DELETE. Versão calculada no servidor.
CREATE OR REPLACE FUNCTION public.set_hypothesis_review_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.professional_id := auth.uid();
  NEW.created_at := now();
  PERFORM pg_advisory_xact_lock(hashtext(NEW.client_id::text || ':' || NEW.hypothesis_key));
  SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM public.hypothesis_reviews
   WHERE client_id = NEW.client_id AND hypothesis_key = NEW.hypothesis_key;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hypothesis_reviews_version
  BEFORE INSERT ON public.hypothesis_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_hypothesis_review_version();