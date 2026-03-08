
-- Fix platform_settings: drop restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view settings" ON public.platform_settings;
CREATE POLICY "Anyone can view settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Fix payment-proofs bucket: make it public so admins can view uploaded images
UPDATE storage.buckets SET public = true WHERE id = 'payment-proofs';

-- Fix delivery-proofs bucket too
UPDATE storage.buckets SET public = true WHERE id = 'delivery-proofs';

-- Add storage RLS policies for uploading to payment-proofs (authenticated users)
CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can view payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

-- Add storage RLS policies for delivery-proofs
CREATE POLICY "Authenticated users can upload delivery proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs');

CREATE POLICY "Anyone can view delivery proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-proofs');
