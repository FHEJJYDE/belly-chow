-- Migration: Integrated Wallet & Escrow Settlement System

-- 0. Prerequisites (Idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('student', 'vendor', 'rider', 'admin');
    END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'student'::public.app_role;

-- 1. Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
    daily_spent NUMERIC NOT NULL DEFAULT 0 CHECK (daily_spent >= 0),
    last_spend_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own wallet" ON public.wallets FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

-- 2. Create Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL, -- 'deposit', 'payment', 'escrow_release', 'withdrawal', 'refund'
    amount NUMERIC NOT NULL,
    fee NUMERIC DEFAULT 0,
    net_amount NUMERIC NOT NULL,
    reference VARCHAR(100) UNIQUE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own transactions" ON public.wallet_transactions FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

-- 3. RPC: Get or Create User Wallet
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

-- 4. RPC: Deposit to Wallet with Fraud Limits
-- Limits: Max Deposit ₦20,000 | Max Balance ₦50,000
CREATE OR REPLACE FUNCTION public.deposit_to_wallet(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reference VARCHAR(100)
)
RETURNS public.wallets AS $$
DECLARE
    v_wallet public.wallets;
    v_net NUMERIC;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than 0';
    END IF;

    IF p_amount > 20000 THEN
        RAISE EXCEPTION 'Single deposit limit exceeded (Max ₦20,000)';
    END IF;

    v_wallet := public.get_or_create_wallet(p_user_id);

    IF (v_wallet.balance + p_amount) > 50000 THEN
        RAISE EXCEPTION 'Maximum wallet balance limit exceeded (Max ₦50,000)';
    END IF;

    -- Update balance
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    -- Record transaction
    INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
    VALUES (v_wallet.id, p_user_id, 'deposit', p_amount, 0, p_amount, p_reference, 'Korapay Wallet Deposit', 'completed');

    RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Pay with Wallet (with Daily Spend Limit ₦30,000)
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

    -- Reset daily spent if new day
    IF v_wallet.last_spend_date IS NULL OR v_wallet.last_spend_date < v_today THEN
        v_daily_spent := 0;
    ELSE
        v_daily_spent := v_wallet.daily_spent;
    END IF;

    IF (v_daily_spent + p_amount) > 30000 THEN
        RAISE EXCEPTION 'Daily wallet spend limit exceeded (Max ₦30,000 per day)';
    END IF;

    IF v_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    -- Deduct balance
    UPDATE public.wallets
    SET balance = balance - p_amount,
        daily_spent = v_daily_spent + p_amount,
        last_spend_date = v_today,
        updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    -- Record transaction
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

-- 6. RPC: Auto-Release Escrow to Vendor & Rider Platform Wallets upon Delivery Confirmation
CREATE OR REPLACE FUNCTION public.release_order_escrow(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    v_order RECORD;
    v_vendor RECORD;
    v_escrow RECORD;
    v_platform_fee NUMERIC := 100;
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

    -- Food subtotal minus ₦200 vendor delivery fee
    v_vendor_net := GREATEST(0, Number(v_order.total) - v_vendor_charge);
    v_rider_fee := Number(v_order.delivery_fee);

    -- Credit Vendor Wallet
    IF v_vendor.user_id IS NOT NULL AND v_vendor_net > 0 THEN
        v_vendor_wallet := public.get_or_create_wallet(v_vendor.user_id);
        UPDATE public.wallets SET balance = balance + v_vendor_net, updated_at = now() WHERE id = v_vendor_wallet.id;
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_vendor_wallet.id, v_vendor.user_id, 'escrow_release', Number(v_order.total), v_vendor_charge, v_vendor_net, 'ESCROW_VENDOR_' || p_order_id, 'Earnings for Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
    END IF;

    -- Credit Rider Wallet if assigned
    IF v_order.rider_id IS NOT NULL AND v_rider_fee > 0 THEN
        v_rider_wallet := public.get_or_create_wallet(v_order.rider_id);
        UPDATE public.wallets SET balance = balance + v_rider_fee, updated_at = now() WHERE id = v_rider_wallet.id;
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_rider_wallet.id, v_order.rider_id, 'escrow_release', v_rider_fee, 0, v_rider_fee, 'ESCROW_RIDER_' || p_order_id, 'Delivery fee for Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
    END IF;

    -- Mark escrow released
    UPDATE public.escrow_transactions
    SET status = 'released', released_at = now()
    WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Automatic Wallet Refund if Pending Order is Cancelled
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
        v_refund_amount := Number(v_order.total) + Number(v_order.delivery_fee) + 100;
        v_wallet := public.get_or_create_wallet(v_order.student_id);
        
        UPDATE public.wallets SET balance = balance + v_refund_amount, updated_at = now() WHERE id = v_wallet.id;
        
        INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount, fee, net_amount, reference, description, status)
        VALUES (v_wallet.id, v_order.student_id, 'refund', v_refund_amount, 0, v_refund_amount, 'REFUND_' || p_order_id, 'Refund for Cancelled Order #' || SUBSTRING(p_order_id::text FROM 1 FOR 8), 'completed');
        
        UPDATE public.orders SET payment_status = 'refunded' WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
