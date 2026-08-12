-- Payment System Database Setup for Belly-Chow
-- Run this script in your Supabase SQL Editor

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    korapay_reference VARCHAR(255) UNIQUE NOT NULL,
    korapay_transaction_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
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

-- Create escrow_transactions table
CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    platform_fee DECIMAL(10,2) NOT NULL,
    vendor_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'held',
    hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
    auto_release BOOLEAN DEFAULT true,
    manual_release_required BOOLEAN DEFAULT false,
    released_at TIMESTAMP WITH TIME ZONE,
    release_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create refund_transactions table
CREATE TABLE IF NOT EXISTS refund_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    refund_amount DECIMAL(10,2) NOT NULL,
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

-- Create vendor_payouts table
CREATE TABLE IF NOT EXISTS vendor_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
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

-- Add bank_details column to vendors table if it doesn't exist
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS bank_details JSONB;

-- Add payment-related columns to orders table if they don't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_korapay_reference ON payment_transactions(korapay_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_vendor_id ON payment_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_hold_until ON escrow_transactions(hold_until);
CREATE INDEX IF NOT EXISTS idx_refund_transactions_status ON refund_transactions(status);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_refund_transactions_updated_at BEFORE UPDATE ON refund_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendor_payouts_updated_at BEFORE UPDATE ON vendor_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Payment transactions: users can see their own, vendors can see theirs, admins can see all
CREATE POLICY "Users can view their own payment transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Vendors can view their payment transactions" ON payment_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = payment_transactions.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

-- Escrow transactions: similar to payment transactions
CREATE POLICY "Users can view related escrow transactions" ON escrow_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM payment_transactions 
            WHERE payment_transactions.id = escrow_transactions.payment_transaction_id 
            AND payment_transactions.user_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can view their escrow transactions" ON escrow_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = escrow_transactions.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

-- Refund transactions: users can see their own
CREATE POLICY "Users can view their own refund transactions" ON refund_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Vendor payouts: vendors can see their own
CREATE POLICY "Vendors can view their own payouts" ON vendor_payouts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = vendor_payouts.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

-- Insert some test data (optional)
-- You can uncomment this section if you want some test data

/*
-- Insert test drinks if they don't exist
INSERT INTO drinks (name, price, is_available) VALUES 
('Coca Cola', 200, true),
('Pepsi', 200, true),
('Sprite', 200, true),
('Fanta', 200, true),
('Water', 100, true)
ON CONFLICT DO NOTHING;
*/