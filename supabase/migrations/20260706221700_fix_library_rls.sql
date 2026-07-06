-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Any authenticated user can read library" ON public.library_entries;

-- Recreate it to only allow users who have an active profile
CREATE POLICY "Users with profiles can read library"
  ON public.library_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );
