-- Migration: Updated Payment & Monetization Structure

-- 0. Prerequisites: Ensure app_role type and profiles.role column exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('student', 'vendor', 'rider', 'admin');
    END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'student'::public.app_role;

-- 1. Update Platform Settings defaults and add vendor_delivery_fee
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS vendor_delivery_fee NUMERIC NOT NULL DEFAULT 200;

ALTER TABLE public.platform_settings 
ALTER COLUMN platform_fee SET DEFAULT 100;

UPDATE public.platform_settings 
SET platform_fee = 100, vendor_delivery_fee = 200 
WHERE id IS NOT NULL;

-- 2. Delivery Zones Table for location-based rider fees
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(100) NOT NULL UNIQUE,
    delivery_fee NUMERIC NOT NULL DEFAULT 500,
    rider_fee NUMERIC NOT NULL DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default campus delivery zones if empty
INSERT INTO public.delivery_zones (zone_name, delivery_fee, rider_fee)
VALUES 
    ('Main Campus Hostels', 500, 500),
    ('Faculty & Academic Block', 600, 600),
    ('Off-Campus Zone A (Near Gate)', 700, 700),
    ('Off-Campus Zone B (Far Campus)', 1000, 1000)
ON CONFLICT (zone_name) DO NOTHING;

-- Enable RLS on delivery_zones
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on delivery_zones" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "Allow admin all on delivery_zones" ON public.delivery_zones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Vendor Registration & Tiered Promotion Fields
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS registration_fee_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS featured_tier VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ DEFAULT NULL;

-- Vendor Promotions Subscription Table
CREATE TABLE IF NOT EXISTS public.vendor_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL, -- 'bronze', 'silver', 'gold'
    amount NUMERIC NOT NULL,
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendor_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow vendor read own promotions" ON public.vendor_promotions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_promotions.vendor_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Rider Withdrawal Requests Service Fee Fields
ALTER TABLE public.withdrawal_requests 
ADD COLUMN IF NOT EXISTS service_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- 5. Vendor Registration Fee Check (Free for first 25, ₦2,000 thereafter)
CREATE OR REPLACE FUNCTION public.handle_user_signup(
  user_id uuid,
  user_role public.app_role,
  vendor_name text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_count integer;
  v_fee_paid boolean;
  v_fee_amount numeric;
BEGIN
  UPDATE public.profiles
  SET role = user_role,
      updated_at = NOW()
  WHERE public.profiles.user_id = handle_user_signup.user_id;

  IF user_role = 'vendor'::public.app_role AND vendor_name IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.vendors;
    IF v_count < 25 THEN
      v_fee_paid := TRUE;
      v_fee_amount := 0;
    ELSE
      v_fee_paid := FALSE;
      v_fee_amount := 2000;
    END IF;

    INSERT INTO public.vendors (user_id, name, is_approved, registration_fee_paid, registration_fee_amount)
    VALUES (user_id, vendor_name, false, v_fee_paid, v_fee_amount)
    ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

