
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE POLICY "Users can view their own client avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.professional_id = auth.uid()
  )
);

CREATE POLICY "Users can upload their own client avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-avatars'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.professional_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own client avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.professional_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own client avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-avatars'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.professional_id = auth.uid()
  )
);
