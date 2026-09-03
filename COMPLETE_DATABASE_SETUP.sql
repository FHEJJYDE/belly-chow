-- ==============================================================================
-- 🍔 BELLY-CHOW: MASTER CONSOLIDATED DATABASE SCHEMA & SETUP
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- This single file contains all tables, enums, merged roles, triggers, functions,
-- escrow & wallet systems, delivery zones, storage buckets, and RLS policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & ENUM TYPES (Idempotent)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('student', 'vendor', 'rider', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived', 'delivered', 'cancelled', 'rejected');
    ELSE
        ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arrived' BEFORE 'delivered';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE public.payment_method AS ENUM ('pay_on_delivery', 'bank_transfer', 'wallet');
    ELSE
        ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
    ELSE
        ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'refunded';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE public.refund_status AS ENUM ('none', 'requested', 'approved', 'processed', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE public.dispute_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. PROFILES TABLE (Merged Email & Roles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'student'::public.app_role,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT NULL,
  campus_location TEXT DEFAULT '',
  default_lat NUMERIC DEFAULT NULL,
  default_lng NUMERIC DEFAULT NULL,
  default_location_name TEXT DEFAULT '',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspension_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'student'::public.app_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_lng NUMERIC DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_location_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 4. ROLE & AUTH RPC FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role AS $$
DECLARE
  _role public.app_role;
BEGIN
  SELECT role INTO _role FROM public.profiles WHERE user_id = _user_id;
  IF _role IS NULL THEN
    RETURN 'student'::public.app_role;
  END IF;
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'::public.app_role)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
-- ------------------------------------------------------------------------------
-- 5. VENDORS & CATALOG TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  address TEXT DEFAULT '',
  lat NUMERIC DEFAULT NULL,
  lng NUMERIC DEFAULT NULL,
  opening_time TEXT DEFAULT '08:00',
  closing_time TEXT DEFAULT '22:00',
  is_active BOOLEAN DEFAULT true,
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  featured_tier TEXT DEFAULT NULL,
  featured_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  rating NUMERIC DEFAULT 5.0,
  total_reviews INTEGER DEFAULT 0,
  logo_url TEXT DEFAULT NULL,
  bank_details JSONB DEFAULT NULL,
  registration_fee_paid BOOLEAN DEFAULT false,
  registration_fee_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lat NUMERIC DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lng NUMERIC DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS opening_time TEXT DEFAULT '08:00';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '22:00';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS featured_tier TEXT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS featured_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS registration_fee_amount NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'General',
  image_url TEXT DEFAULT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name VARCHAR(100) NOT NULL UNIQUE,
  delivery_fee NUMERIC NOT NULL DEFAULT 500,
  rider_fee NUMERIC NOT NULL DEFAULT 500,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL,
  amount NUMERIC NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. ORDERS & ORDER ITEMS TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.order_status DEFAULT 'pending'::public.order_status,
  total NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  delivery_location TEXT DEFAULT '',
  delivery_lat NUMERIC DEFAULT NULL,
  delivery_lng NUMERIC DEFAULT NULL,
  rider_lat NUMERIC DEFAULT NULL,
  rider_lng NUMERIC DEFAULT NULL,
  payment_method public.payment_method DEFAULT 'pay_on_delivery'::public.payment_method,
  payment_status public.payment_status DEFAULT 'pending'::public.payment_status,
  payment_reference VARCHAR(255) DEFAULT NULL,
  payment_proof_url TEXT DEFAULT NULL,
  delivery_proof_url TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  promo_code TEXT DEFAULT NULL,
  drink_items JSONB DEFAULT NULL,
  estimated_ready_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  refund_status public.refund_status DEFAULT 'none'::public.refund_status,
  refund_amount NUMERIC DEFAULT NULL,
  refund_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_lat NUMERIC DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_lng NUMERIC DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- ------------------------------------------------------------------------------
-- 7. WALLET & ESCROW LEDGER TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  daily_spent NUMERIC NOT NULL DEFAULT 0 CHECK (daily_spent >= 0),
  last_spend_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  amount NUMERIC NOT NULL,
  fee NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  reference VARCHAR(100) UNIQUE,
  description TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  korapay_reference VARCHAR(255) UNIQUE NOT NULL,
  korapay_transaction_id VARCHAR(255),
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  escrow_status VARCHAR(50) DEFAULT 'held',
  escrow_release_date TIMESTAMP WITH TIME ZONE,
  escrow_released_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  korapay_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  platform_fee NUMERIC(10,2) NOT NULL,
  vendor_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'held',
  hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_release BOOLEAN DEFAULT true,
  manual_release_required BOOLEAN DEFAULT false,
  released_at TIMESTAMP WITH TIME ZONE,
  release_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refund_amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  refund_type VARCHAR(20) NOT NULL CHECK (refund_type IN ('full', 'partial')),
  korapay_refund_reference VARCHAR(255),
  korapay_refund_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  reason TEXT NOT NULL,
  admin_notes TEXT,
  korapay_response JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  korapay_transfer_reference VARCHAR(255),
  korapay_transfer_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  escrow_transaction_ids UUID[] NOT NULL,
  korapay_response JSONB,
  failure_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  service_fee NUMERIC DEFAULT 100,
  net_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'motorcycle',
  plate_number TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  account_name TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. COMMUNICATIONS, REVIEWS & SUPPORT TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status public.dispute_status DEFAULT 'open'::public.dispute_status,
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status public.verification_status DEFAULT 'pending'::public.verification_status,
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 100,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_fee NUMERIC NOT NULL DEFAULT 500,
  platform_fee NUMERIC NOT NULL DEFAULT 100,
  rider_fee NUMERIC NOT NULL DEFAULT 500,
  vendor_delivery_fee NUMERIC NOT NULL DEFAULT 200,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  bank_name TEXT DEFAULT '',
  bank_account_number TEXT DEFAULT '',
  bank_account_name TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS vendor_delivery_fee NUMERIC NOT NULL DEFAULT 200;

-- ------------------------------------------------------------------------------
-- 9. AUDIT & ERROR LOGGING TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component_stack TEXT,
  url TEXT,
  severity VARCHAR(20) DEFAULT 'error',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  status public.dispute_status DEFAULT 'open'::public.dispute_status,
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_category TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  error_context JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  reference TEXT,
  error_message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  time_period TEXT DEFAULT 'instant',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------------
-- 10. WALLET RPC PROCEDURES (Deposit, Pay, Escrow Release, Wallet Refund)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_user_id UUID)
RETURNS public.wallets AS $$
DECLARE
    v_wallet public.wallets;
BEGIN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
    IF v_wallet.id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance)
        VALUES (p_user_id, 0)
        RETURNING * INTO v_wallet;
    END IF;
    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.deposit_to_wallet(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reference VARCHAR(100)
)
RETURNS public.wallets AS $$
DECLARE
    v_wallet public.wallets;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than 0';
    END IF;

    IF p_amount > 50000 THEN
        RAISE EXCEPTION 'Single deposit limit exceeded (Max ₦50,000)';
    END IF;

    v_wallet := public.get_or_create_wallet(p_user_id);

    IF (v_wallet.balance + p_amount) > 100000 THEN
        RAISE EXCEPTION 'Maximum wallet balance limit exceeded (Max ₦100,000)';
    END IF;

    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
    VALUES (v_wallet.id, p_user_id, 'deposit', p_amount, 0, p_amount, p_reference, 'Belly-Chow Wallet Deposit', 'completed');

    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pay_with_wallet(
    p_user_id UUID,
    p_amount NUMERIC,
    p_order_id UUID
)
RETURNS public.wallets AS $$
DECLARE
    v_wallet public.wallets;
    v_today DATE := CURRENT_DATE;
    v_daily_spent NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0';
    END IF;

    v_wallet := public.get_or_create_wallet(p_user_id);

    IF v_wallet.last_spend_date IS NULL OR v_wallet.last_spend_date < v_today THEN
        v_daily_spent := 0;
    ELSE
        v_daily_spent := v_wallet.daily_spent;
    END IF;

    IF (v_daily_spent + p_amount) > 50000 THEN
        RAISE EXCEPTION 'Daily wallet spend limit exceeded (Max ₦50,000 per day)';
    END IF;

    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    UPDATE public.wallets
    SET balance = balance - p_amount,
        daily_spent = v_daily_spent + p_amount,
        last_spend_date = v_today,
        updated_at = NOW()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
    VALUES (
        v_wallet.id, 
        p_user_id, 
        'payment', 
        p_amount, 
        0, 
        p_amount, 
        'ORDER_PAY_' || p_order_id, 
        'Order Payment #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 
        'completed'
    );

    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_order_escrow(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
    v_vendor RECORD;
    v_vendor_charge NUMERIC := 200;
    v_vendor_net NUMERIC;
    v_rider_fee NUMERIC;
    v_vendor_wallet public.wallets;
    v_rider_wallet public.wallets;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_vendor FROM public.vendors WHERE id = v_order.vendor_id;

    v_vendor_net := GREATEST(0, (v_order.total::NUMERIC) - v_vendor_charge);
    v_rider_fee := v_order.delivery_fee::NUMERIC;

    -- Credit Vendor Wallet
    IF v_vendor.user_id IS NOT NULL AND v_vendor_net > 0 THEN
        v_vendor_wallet := public.get_or_create_wallet(v_vendor.user_id);
        UPDATE public.wallets SET balance = balance + v_vendor_net, updated_at = NOW() WHERE id = v_vendor_wallet.id;
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_vendor_wallet.id, v_vendor.user_id, 'escrow_release', (v_order.total::NUMERIC), v_vendor_charge, v_vendor_net, 'ESCROW_VENDOR_' || p_order_id, 'Earnings for Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
    END IF;

    -- Credit Rider Wallet
    IF v_order.rider_id IS NOT NULL AND v_rider_fee > 0 THEN
        v_rider_wallet := public.get_or_create_wallet(v_order.rider_id);
        UPDATE public.wallets SET balance = balance + v_rider_fee, updated_at = NOW() WHERE id = v_rider_wallet.id;
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_rider_wallet.id, v_order.rider_id, 'escrow_release', v_rider_fee, 0, v_rider_fee, 'ESCROW_RIDER_' || p_order_id, 'Delivery fee for Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
    END IF;

    -- Mark escrow released
    UPDATE public.escrow_transactions
    SET status = 'released', released_at = NOW()
    WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refund_wallet_order(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
    v_wallet public.wallets;
    v_refund_amount NUMERIC;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF v_order.id IS NULL OR v_order.status != 'cancelled' THEN
        RETURN;
    END IF;

    IF v_order.payment_method = 'wallet' OR v_order.payment_status = 'confirmed' THEN
        v_refund_amount := (v_order.total::NUMERIC) + (v_order.delivery_fee::NUMERIC) + 100;
        v_wallet := public.get_or_create_wallet(v_order.student_id);
        
        UPDATE public.wallets SET balance = balance + v_refund_amount, updated_at = NOW() WHERE id = v_wallet.id;
        
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_wallet.id, v_order.student_id, 'refund', v_refund_amount, 0, v_refund_amount, 'REFUND_' || p_order_id, 'Refund for Cancelled Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
        
        UPDATE public.orders SET payment_status = 'refunded' WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_order_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, order_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_order_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.calculate_payment_success_rate(p_hours INTEGER DEFAULT 24)
RETURNS NUMERIC AS $$
DECLARE
  v_total INTEGER;
  v_success INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total 
  FROM public.payment_transactions 
  WHERE created_at >= NOW() - (p_hours || ' hours')::INTERVAL;
  
  IF v_total = 0 THEN
    RETURN 100.0;
  END IF;
  
  SELECT COUNT(*) INTO v_success 
  FROM public.payment_transactions 
  WHERE payment_status = 'completed' AND created_at >= NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN ROUND((v_success::NUMERIC / v_total::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.calculate_average_settlement_time(p_hours INTEGER DEFAULT 24)
RETURNS NUMERIC AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(EXTRACT(EPOCH FROM (released_at - created_at))) INTO v_avg
  FROM public.escrow_transactions
  WHERE status = 'released' AND created_at >= NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN COALESCE(ROUND(v_avg, 2), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_payment_error(
  p_error_category TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_user_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_payment_transaction_id UUID DEFAULT NULL,
  p_error_context JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.payment_system_errors (
    error_category, error_code, error_message, user_id, order_id, payment_transaction_id, error_context, severity
  )
  VALUES (
    p_error_category, p_error_code, p_error_message, p_user_id, p_order_id, p_payment_transaction_id, p_error_context, p_severity
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_health_metric(
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_metric_unit TEXT DEFAULT NULL,
  p_time_period TEXT DEFAULT 'instant'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.system_health_metrics (metric_name, metric_value, metric_unit, time_period)
  VALUES (p_metric_name, p_metric_value, p_metric_unit, p_time_period)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 11. SEED DEFAULT DATA
-- ------------------------------------------------------------------------------
INSERT INTO public.platform_settings (delivery_fee, platform_fee, rider_fee, vendor_delivery_fee, commission_rate)
SELECT 500, 100, 500, 200, 0.10
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

INSERT INTO public.delivery_zones (zone_name, delivery_fee, rider_fee)
VALUES 
    ('Main Campus Hostels', 500, 500),
    ('Faculty & Academic Block', 600, 600),
    ('Off-Campus Zone A (Near Gate)', 700, 700),
    ('Off-Campus Zone B (Far Campus)', 1000, 1000)
ON CONFLICT (zone_name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Vendors Policies
DROP POLICY IF EXISTS "Active vendors viewable by everyone" ON public.vendors;
CREATE POLICY "Active vendors viewable by everyone" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Vendors can update own record" ON public.vendors;
CREATE POLICY "Vendors can update own record" ON public.vendors FOR UPDATE USING (auth.uid() = user_id);

-- Menu Items & Drinks Policies
DROP POLICY IF EXISTS "Menu items viewable by everyone" ON public.menu_items;
CREATE POLICY "Menu items viewable by everyone" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drinks viewable by everyone" ON public.drinks;
CREATE POLICY "Drinks viewable by everyone" ON public.drinks FOR SELECT USING (true);

-- Delivery Zones Policies
DROP POLICY IF EXISTS "Allow public read on delivery_zones" ON public.delivery_zones;
CREATE POLICY "Allow public read on delivery_zones" ON public.delivery_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin all on delivery_zones" ON public.delivery_zones;
CREATE POLICY "Allow admin all on delivery_zones" ON public.delivery_zones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

-- Vendor Promotions Policies
DROP POLICY IF EXISTS "Allow vendor read own promotions" ON public.vendor_promotions;
CREATE POLICY "Allow vendor read own promotions" ON public.vendor_promotions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vendors WHERE id = vendor_promotions.vendor_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

-- Orders & Order Items Policies
DROP POLICY IF EXISTS "Users view relevant orders" ON public.orders;
CREATE POLICY "Users view relevant orders" ON public.orders FOR SELECT USING (
  auth.uid() = student_id OR auth.uid() = rider_id OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Students can create orders" ON public.orders;
CREATE POLICY "Students can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Participants can update orders" ON public.orders;
CREATE POLICY "Participants can update orders" ON public.orders FOR UPDATE USING (
  auth.uid() = student_id OR auth.uid() = rider_id OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Order items viewable by order participants" ON public.order_items;
CREATE POLICY "Order items viewable by order participants" ON public.order_items FOR SELECT USING (true);

-- Wallets & Wallet Transactions Policies
DROP POLICY IF EXISTS "Allow users to view own wallet" ON public.wallets;
CREATE POLICY "Allow users to view own wallet" ON public.wallets FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Allow users to view own transactions" ON public.wallet_transactions;
CREATE POLICY "Allow users to view own transactions" ON public.wallet_transactions FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

-- Withdrawal Requests & Rider Settings Policies
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests" ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users can create withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can create withdrawal requests" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Rider Settings Policies
DROP POLICY IF EXISTS "Riders can view own settings" ON public.rider_settings;
CREATE POLICY "Riders can view own settings" ON public.rider_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can insert own settings" ON public.rider_settings;
CREATE POLICY "Riders can insert own settings" ON public.rider_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can update own settings" ON public.rider_settings;
CREATE POLICY "Riders can update own settings" ON public.rider_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Messages Policies
DROP POLICY IF EXISTS "Order participants can view messages" ON public.messages;
CREATE POLICY "Order participants can view messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND (orders.student_id = auth.uid() OR orders.rider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = orders.vendor_id AND vendors.user_id = auth.uid())))
);

DROP POLICY IF EXISTS "Order participants can send messages" ON public.messages;
CREATE POLICY "Order participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Platform Settings & Promo Codes Policies
DROP POLICY IF EXISTS "Platform settings viewable by everyone" ON public.platform_settings;
CREATE POLICY "Platform settings viewable by everyone" ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Promo codes viewable by everyone" ON public.promo_codes;
CREATE POLICY "Promo codes viewable by everyone" ON public.promo_codes FOR SELECT USING (true);

-- Disputes Policies
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own disputes" ON public.disputes;
CREATE POLICY "Users view own disputes" ON public.disputes FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Users create own disputes" ON public.disputes;
CREATE POLICY "Users create own disputes" ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
);

-- Monitoring & Error Logs Policies
ALTER TABLE public.payment_system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view payment errors" ON public.payment_system_errors;
CREATE POLICY "Admins view payment errors" ON public.payment_system_errors FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins update payment errors" ON public.payment_system_errors;
CREATE POLICY "Admins update payment errors" ON public.payment_system_errors FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins view webhook errors" ON public.webhook_errors;
CREATE POLICY "Admins view webhook errors" ON public.webhook_errors FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins update webhook errors" ON public.webhook_errors;
CREATE POLICY "Admins update webhook errors" ON public.webhook_errors FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Everyone view health metrics" ON public.system_health_metrics;
CREATE POLICY "Everyone view health metrics" ON public.system_health_metrics FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 13. STORAGE BUCKETS & POLICIES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-logos', 'vendor-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verifications', 'verifications', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload objects" ON storage.objects;
CREATE POLICY "Authenticated users can upload objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public objects viewable by everyone" ON storage.objects;
CREATE POLICY "Public objects viewable by everyone" ON storage.objects FOR SELECT USING (true);
