-- Create verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Create verifications table
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'national_id',
  status public.verification_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Users can insert their own verification
CREATE POLICY "Users can submit verification" ON public.verifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own verification
CREATE POLICY "Users can view own verification" ON public.verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all verifications" ON public.verifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update verifications" ON public.verifications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for ID documents
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false);

-- Storage policies: users can upload their own docs
CREATE POLICY "Users can upload verification docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can view their own docs
CREATE POLICY "Users can view own verification docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can view all docs
CREATE POLICY "Admins can view all verification docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND public.has_role(auth.uid(), 'admin'));