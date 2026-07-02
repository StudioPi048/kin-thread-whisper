CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- Recria o índice sem depender do operator class do public antes de mover a extensão
DROP INDEX IF EXISTS public.clients_full_name_trgm_idx;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE INDEX clients_full_name_trgm_idx
  ON public.clients
  USING gin (lower(full_name) extensions.gin_trgm_ops);