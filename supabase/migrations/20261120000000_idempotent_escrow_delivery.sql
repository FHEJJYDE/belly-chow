-- ==============================================================================
-- Idempotent Escrow Release & Delivery Fulfillment Migration
-- ==============================================================================
-- 1. Ensure 'arrived' exists in order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arrived' BEFORE 'delivered';

-- 2. Mark order as delivered + payment confirmed & release escrow once (no double-crediting)
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

    -- Ensure the order is marked delivered and payment is confirmed
    UPDATE public.orders
    SET status = 'delivered'::public.order_status,
        payment_status = 'confirmed'::public.payment_status
    WHERE id = p_order_id;

    -- Idempotency guard: prevent double-crediting if both rider and student confirm
    IF EXISTS (
        SELECT 1 FROM public.wallet_transactions
        WHERE reference = 'ESCROW_VENDOR_' || p_order_id
           OR reference = 'ESCROW_RIDER_' || p_order_id
    ) THEN
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
