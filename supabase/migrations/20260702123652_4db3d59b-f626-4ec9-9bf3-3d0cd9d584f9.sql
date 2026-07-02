
CREATE POLICY "Users upload own session audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own session audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own session audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-audio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
