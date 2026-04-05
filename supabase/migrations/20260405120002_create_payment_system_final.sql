-- Payment Escrow System Database Schema (Final Version)
-- Creates tables for payment transactions, wallets, settlements, and withdrawals
-- Uses IF NOT EXISTS to avoid conflicts

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payment Transactions Table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_transactions') THEN
        CREATE TABLE payment_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID REFERENCES orders(id) UNIQUE NOT NULL,
            customer_id UUID REFERENCES profiles(id) NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
            food_amount DECIMAL(10,2) NOT NULL CHECK (food_amount > 0),
            delivery_fee DECIMAL(10,2) DEFAULT 1000.00 CHECK (delivery_fee >= 0),
            payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack_card', 'paystack_transfer', 'paystack_ussd', 'wallet')),
            payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
            paystack_reference TEXT UNIQUE,
            paystack_transaction_id TEXT,
            paystack_access_code TEXT,
            escrow_status TEXT DEFAULT 'held' CHECK (escrow_status IN ('held', 'released', 'refunded')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE,
            released_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
        CREATE INDEX idx_payment_transactions_customer_id ON payment_transactions(customer_id);
        CREATE INDEX idx_payment_transactions_status ON payment_transactions(payment_status);
        CREATE INDEX idx_payment_transactions_escrow_status ON payment_transactions(escrow_status);
        CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at);
    END IF;
END $$;

-- User Wallets Table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_wallets') THEN
        CREATE TABLE user_wallets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
            balance DECIMAL(10,2) DEFAULT 0.00 CHECK (balance >= 0),
            pending_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (pending_balance >= 0),
            total_earned DECIMAL(10,2) DEFAULT 0.00 CHECK (total_earned >= 0),
            total_withdrawn DECIMAL(10,2) DEFAULT 0.00 CHECK (total_withdrawn >= 0),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
        CREATE INDEX idx_user_wallets_balance ON user_wallets(balance);
    END IF;
END $$;

-- Wallet Transactions Table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
        CREATE TABLE wallet_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_id UUID REFERENCES user_wallets(id) NOT NULL,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'escrow_hold', 'escrow_release', 'refund', 'withdrawal')),
            amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
            reference_type TEXT CHECK (reference_type IN ('order', 'settlement', 'withdrawal', 'refund', 'bonus', 'top_up')),
            reference_id UUID,
            description TEXT NOT NULL,
            balance_before DECIMAL(10,2) NOT NULL CHECK (balance_before >= 0),
            balance_after DECIMAL(10,2) NOT NULL CHECK (balance_after >= 0),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
        CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
        CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);
        CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at);
    END IF;
END $$;

-- Settlement Records Table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settlement_records') THEN
        CREATE TABLE settlement_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_transaction_id UUID REFERENCES payment_transactions(id) NOT NULL,
            recipient_id UUID REFERENCES profiles(id) NOT NULL,
            recipient_type TEXT NOT NULL CHECK (recipient_type IN ('vendor', 'rider', 'platform')),
            amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
            settlement_status TEXT DEFAULT 'completed' CHECK (settlement_status IN ('pending', 'completed', 'failed')),
            failure_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX idx_settlement_records_payment_id ON settlement_records(payment_transaction_id);
        CREATE INDEX idx_settlement_records_recipient ON settlement_records(recipient_id, recipient_type);
        CREATE INDEX idx_settlement_records_status ON settlement_records(settlement_status);
    END IF;
END $$;

-- Update existing withdrawal_requests table or create if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'withdrawal_requests') THEN
        CREATE TABLE withdrawal_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) NOT NULL,
            amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_name TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
            paystack_recipient_code TEXT,
            paystack_transfer_code TEXT,
            admin_notes TEXT,
            failure_reason TEXT,
            requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            processed_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
        CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
        CREATE INDEX idx_withdrawal_requests_requested_at ON withdrawal_requests(requested_at);
    ELSE
        -- Add missing columns to existing withdrawal_requests table
        ALTER TABLE withdrawal_requests 
        ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT,
        ADD COLUMN IF NOT EXISTS paystack_transfer_code TEXT,
        ADD COLUMN IF NOT EXISTS failure_reason TEXT,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create database functions

-- Function to automatically create wallet for new users
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_wallets (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create wallet when user is created (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_user_wallet') THEN
        CREATE TRIGGER trigger_create_user_wallet
            AFTER INSERT ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION create_user_wallet();
    END IF;
END $$;

-- Function to update wallet updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update wallet timestamp on balance changes (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_wallet_timestamp') THEN
        CREATE TRIGGER trigger_update_wallet_timestamp
            BEFORE UPDATE ON user_wallets
            FOR EACH ROW
            EXECUTE FUNCTION update_wallet_timestamp();
    END IF;
END $$;

-- Function for safe wallet credit operation
CREATE OR REPLACE FUNCTION credit_wallet(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_transaction_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    -- Get wallet info
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM user_wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance + p_amount;
    
    -- Update wallet balance
    UPDATE user_wallets
    SET balance = v_new_balance,
        total_earned = total_earned + p_amount
    WHERE id = v_wallet_id;
    
    -- Record transaction
    INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, reference_type, 
        reference_id, description, balance_before, balance_after
    ) VALUES (
        v_wallet_id, p_transaction_type, p_amount, p_reference_type,
        p_reference_id, p_description, v_current_balance, v_new_balance
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function for safe wallet debit operation
CREATE OR REPLACE FUNCTION debit_wallet(
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_transaction_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    -- Get wallet info
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM user_wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
    
    -- Check sufficient balance
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %', v_current_balance, p_amount;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_amount;
    
    -- Update wallet balance
    UPDATE user_wallets
    SET balance = v_new_balance,
        total_withdrawn = total_withdrawn + p_amount
    WHERE id = v_wallet_id;
    
    -- Record transaction
    INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, reference_type,
        reference_id, description, balance_before, balance_after
    ) VALUES (
        v_wallet_id, p_transaction_type, p_amount, p_reference_type,
        p_reference_id, p_description, v_current_balance, v_new_balance
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to process order settlement
CREATE OR REPLACE FUNCTION process_order_settlement(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment_transaction payment_transactions%ROWTYPE;
    v_order orders%ROWTYPE;
    v_vendor_amount DECIMAL(10,2);
    v_rider_amount DECIMAL(10,2);
    v_platform_amount DECIMAL(10,2);
BEGIN
    -- Get payment transaction
    SELECT * INTO v_payment_transaction
    FROM payment_transactions
    WHERE order_id = p_order_id AND payment_status = 'completed' AND escrow_status = 'held';
    
    IF v_payment_transaction.id IS NULL THEN
        RAISE EXCEPTION 'No valid payment transaction found for order %', p_order_id;
    END IF;
    
    -- Get order details
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id;
    
    -- Calculate settlement amounts
    v_vendor_amount := v_payment_transaction.food_amount; -- 100% of food price
    v_rider_amount := 500.00; -- Fixed ₦500 for rider
    v_platform_amount := 500.00; -- Fixed ₦500 for platform
    
    -- Credit vendor wallet
    PERFORM credit_wallet(
        v_order.vendor_id,
        v_vendor_amount,
        'credit',
        'settlement',
        v_payment_transaction.id,
        'Order settlement - food earnings'
    );
    
    -- Credit rider wallet
    PERFORM credit_wallet(
        v_order.rider_id,
        v_rider_amount,
        'credit',
        'settlement',
        v_payment_transaction.id,
        'Order settlement - delivery earnings'
    );
    
    -- Create settlement records
    INSERT INTO settlement_records (payment_transaction_id, recipient_id, recipient_type, amount)
    VALUES 
        (v_payment_transaction.id, v_order.vendor_id, 'vendor', v_vendor_amount),
        (v_payment_transaction.id, v_order.rider_id, 'rider', v_rider_amount),
        (v_payment_transaction.id, v_order.vendor_id, 'platform', v_platform_amount); -- Using vendor_id as placeholder for platform
    
    -- Update escrow status
    UPDATE payment_transactions
    SET escrow_status = 'released',
        released_at = NOW()
    WHERE id = v_payment_transaction.id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$
BEGIN
    -- Payment transactions policies
    DROP POLICY IF EXISTS "Users can view their own payment transactions" ON payment_transactions;
    CREATE POLICY "Users can view their own payment transactions" ON payment_transactions
        FOR SELECT USING (customer_id = auth.uid());

    DROP POLICY IF EXISTS "Vendors can view payments for their orders" ON payment_transactions;
    CREATE POLICY "Vendors can view payments for their orders" ON payment_transactions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM orders 
                WHERE orders.id = payment_transactions.order_id 
                AND orders.vendor_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Riders can view payments for their deliveries" ON payment_transactions;
    CREATE POLICY "Riders can view payments for their deliveries" ON payment_transactions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM orders 
                WHERE orders.id = payment_transactions.order_id 
                AND orders.rider_id = auth.uid()
            )
        );

    -- Wallet policies
    DROP POLICY IF EXISTS "Users can view their own wallet" ON user_wallets;
    CREATE POLICY "Users can view their own wallet" ON user_wallets
        FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON wallet_transactions;
    CREATE POLICY "Users can view their own wallet transactions" ON wallet_transactions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM user_wallets 
                WHERE user_wallets.id = wallet_transactions.wallet_id 
                AND user_wallets.user_id = auth.uid()
            )
        );

    -- Settlement records policies
    DROP POLICY IF EXISTS "Users can view their own settlements" ON settlement_records;
    CREATE POLICY "Users can view their own settlements" ON settlement_records
        FOR SELECT USING (recipient_id = auth.uid());

    -- Withdrawal requests policies
    DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON withdrawal_requests;
    CREATE POLICY "Users can view their own withdrawal requests" ON withdrawal_requests
        FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON withdrawal_requests;
    CREATE POLICY "Users can create their own withdrawal requests" ON withdrawal_requests
        FOR INSERT WITH CHECK (user_id = auth.uid());

    -- Admin policies (users with admin role can view all)
    DROP POLICY IF EXISTS "Admins can view all payment transactions" ON payment_transactions;
    CREATE POLICY "Admins can view all payment transactions" ON payment_transactions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );

    DROP POLICY IF EXISTS "Admins can view all wallets" ON user_wallets;
    CREATE POLICY "Admins can view all wallets" ON user_wallets
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );

    DROP POLICY IF EXISTS "Admins can view all wallet transactions" ON wallet_transactions;
    CREATE POLICY "Admins can view all wallet transactions" ON wallet_transactions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );

    DROP POLICY IF EXISTS "Admins can view all settlements" ON settlement_records;
    CREATE POLICY "Admins can view all settlements" ON settlement_records
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );

    DROP POLICY IF EXISTS "Admins can manage all withdrawal requests" ON withdrawal_requests;
    CREATE POLICY "Admins can manage all withdrawal requests" ON withdrawal_requests
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            )
        );
END $$;