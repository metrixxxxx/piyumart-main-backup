-- Private Storage bucket. Access is authorized by the application's server routes.
BEGIN;
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pickup-proofs', 'pickup-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
DROP POLICY IF EXISTS pickup_proofs_server_only ON storage.objects;
CREATE POLICY pickup_proofs_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'pickup-proofs') WITH CHECK (bucket_id <> 'pickup-proofs');
COMMIT;
