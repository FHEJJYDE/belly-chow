
-- Create delivery_proofs storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow riders to upload delivery proofs
CREATE POLICY "Riders can upload delivery proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow order participants to view delivery proofs
CREATE POLICY "Order participants can view delivery proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-proofs');

-- Add delivery_proof_url to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_url text DEFAULT NULL;

-- Add estimated_ready_at to orders (for ETA)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_ready_at timestamp with time zone DEFAULT NULL;

-- Create withdrawal_requests table for riders
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  admin_notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Riders can view own withdrawal requests
CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Riders can create withdrawal requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawal_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawal requests
CREATE POLICY "Admins can view all withdrawal requests"
ON public.withdrawal_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update withdrawal requests
CREATE POLICY "Admins can update withdrawal requests"
ON public.withdrawal_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create payout_records table for admin tracking
CREATE TABLE public.payout_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid DEFAULT NULL,
  rider_id uuid DEFAULT NULL,
  amount numeric NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;

-- Only admins can manage payout records
CREATE POLICY "Admins can manage payout records"
ON public.payout_records FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add is_suspended to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason text DEFAULT NULL;
