-- Create refund status enum
CREATE TYPE public.refund_status AS ENUM ('none', 'requested', 'approved', 'processed', 'rejected');

-- Add refund columns to orders
ALTER TABLE public.orders 
  ADD COLUMN refund_status public.refund_status NOT NULL DEFAULT 'none',
  ADD COLUMN refund_amount NUMERIC DEFAULT 0,
  ADD COLUMN refund_notes TEXT;