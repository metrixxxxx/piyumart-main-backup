-- Run AFTER the seller_applications / department / meetup_point migration.
BEGIN;
ALTER TABLE public.seller_applications ADD COLUMN IF NOT EXISTS note text;
CREATE UNIQUE INDEX IF NOT EXISTS seller_applications_one_pending_per_user
  ON public.seller_applications (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS seller_applications_status_submitted
  ON public.seller_applications (status, submitted_at DESC);

-- Custom auth accesses this table through the server's Postgres connection only.
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_applications FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('seller-proofs', 'seller-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- Restrict this bucket even if another bucket has a broad permissive policy.
DROP POLICY IF EXISTS seller_proofs_server_only ON storage.objects;
CREATE POLICY seller_proofs_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'seller-proofs') WITH CHECK (bucket_id <> 'seller-proofs');
COMMIT;
