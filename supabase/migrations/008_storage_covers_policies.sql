-- supabase/migrations/008_storage_covers_policies.sql
-- Storage RLS for the public `covers` bucket.
-- Path convention: covers/{owner_id}/{quiz_id}/{uuid}.{ext}
-- The first folder segment must equal the uploader's auth.uid() so a user
-- cannot write into another user's directory.

INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "covers_owner_insert" ON storage.objects;
CREATE POLICY "covers_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "covers_owner_update" ON storage.objects;
CREATE POLICY "covers_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "covers_owner_delete" ON storage.objects;
CREATE POLICY "covers_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
