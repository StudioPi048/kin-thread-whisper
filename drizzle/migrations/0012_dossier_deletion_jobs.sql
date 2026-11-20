-- Uma exclusão confirmada grava a fila de limpeza na mesma transação do DELETE.
-- Os caminhos existem na fila somente enquanto os objetos estão pendentes.
CREATE TABLE public.dossier_deletion_jobs (
  client_id uuid PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_paths text[] NOT NULL DEFAULT '{}',
  avatar_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.dossier_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dossier_deletion_jobs FROM PUBLIC, anon, authenticated;

CREATE INDEX dossier_deletion_jobs_pending_owner_idx
  ON public.dossier_deletion_jobs (professional_id, created_at)
  WHERE completed_at IS NULL;

-- O gatilho também captura exclusões de abas antigas enquanto a nova versão é
-- distribuída. O fluxo antigo não pode ficar bloqueado depois de remover mídias.
CREATE FUNCTION public.capture_dossier_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.professional_id IS DISTINCT FROM auth.uid() THEN
    RETURN OLD;
  END IF;

  -- Um caminho de áudio compartilhado com outro dossiê fica no armazenamento.
  PERFORM s.id FROM public.clinical_sessions s
    WHERE s.client_id = OLD.id AND s.user_id = OLD.professional_id FOR UPDATE;

  INSERT INTO public.dossier_deletion_jobs (client_id, professional_id, audio_paths, avatar_paths)
  SELECT OLD.id, OLD.professional_id,
    ARRAY(
      SELECT DISTINCT s.audio_path FROM public.clinical_sessions s
        WHERE s.client_id = OLD.id AND s.user_id = OLD.professional_id
          AND pg_catalog.split_part(s.audio_path, '/', 1) = OLD.professional_id::text
          AND NOT EXISTS (
            SELECT 1 FROM public.clinical_sessions other
              WHERE other.client_id <> OLD.id AND other.audio_path = s.audio_path
          )
    ),
    ARRAY(
      SELECT o.name FROM storage.objects o
        WHERE o.bucket_id = 'client-avatars'
          AND pg_catalog.split_part(o.name, '/', 1) = OLD.id::text
    )
  ON CONFLICT (client_id) DO NOTHING;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_dossier_deletion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_dossier_deletion
  BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.capture_dossier_deletion();

CREATE FUNCTION public.begin_dossier_deletion(_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  client_status text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.' USING ERRCODE = '42501';
  END IF;

  SELECT c.status::text INTO client_status FROM public.clients c
    WHERE c.id = _client_id AND c.professional_id = caller FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.dossier_deletion_jobs j
        WHERE j.client_id = _client_id AND j.professional_id = caller
    ) THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION 'Dossiê indisponível.' USING ERRCODE = '42501';
  END IF;
  IF client_status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION 'Arquive o dossiê antes de excluir definitivamente.';
  END IF;

  DELETE FROM public.clients c WHERE c.id = _client_id AND c.professional_id = caller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A exclusão do dossiê não foi confirmada.';
  END IF;
  RETURN true;
END;
$$;

CREATE FUNCTION public.dossier_deletion_manifest(_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'audio_paths', j.audio_paths, 'avatar_paths', j.avatar_paths, 'completed_at', j.completed_at
  ) FROM public.dossier_deletion_jobs j
    WHERE j.client_id = _client_id AND j.professional_id = auth.uid();
$$;

CREATE FUNCTION public.list_dossier_deletions()
RETURNS TABLE(client_id uuid, created_at timestamptz)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT j.client_id, j.created_at FROM public.dossier_deletion_jobs j
    WHERE j.professional_id = auth.uid() AND j.completed_at IS NULL
    ORDER BY j.created_at;
$$;

CREATE FUNCTION public.can_remove_queued_dossier_avatar(_name text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dossier_deletion_jobs j
      WHERE j.professional_id = auth.uid() AND j.completed_at IS NULL
        AND _name = ANY(j.avatar_paths)
  );
$$;

-- As políticas de áudio existentes usam a pasta do próprio profissional.
-- A foto exige estas regras porque seu dossiê já foi removido.
CREATE POLICY "Owners may read avatars queued for dossier deletion"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-avatars' AND public.can_remove_queued_dossier_avatar(name));
CREATE POLICY "Owners may remove avatars queued for dossier deletion"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-avatars' AND public.can_remove_queued_dossier_avatar(name));

CREATE FUNCTION public.finish_dossier_deletion(_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  job public.dossier_deletion_jobs;
BEGIN
  SELECT * INTO job FROM public.dossier_deletion_jobs j
    WHERE j.client_id = _client_id AND j.professional_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exclusão indisponível.' USING ERRCODE = '42501';
  END IF;
  IF job.completed_at IS NOT NULL THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE (o.bucket_id = 'session-audio' AND o.name = ANY(job.audio_paths))
       OR (o.bucket_id = 'client-avatars' AND o.name = ANY(job.avatar_paths))
  ) THEN
    RETURN false;
  END IF;
  UPDATE public.dossier_deletion_jobs
    SET completed_at = pg_catalog.clock_timestamp(), audio_paths = '{}', avatar_paths = '{}'
    WHERE client_id = job.client_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_dossier_deletion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dossier_deletion_manifest(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_dossier_deletions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_remove_queued_dossier_avatar(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_dossier_deletion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_dossier_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dossier_deletion_manifest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_dossier_deletions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_remove_queued_dossier_avatar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_dossier_deletion(uuid) TO authenticated;
