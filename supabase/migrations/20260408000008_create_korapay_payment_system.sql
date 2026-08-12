-- Create payment system with KoraPay integration and escrow functionality

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- KoraPay specific fields
    korapay_reference VARCHAR(255) UNIQUE NOT NULL,
    korapay_transaction_id VARCHAR(255),
    
    -- Transaction details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    payment_method VARCHAR(50), -- card, bank_transfer, ussd, etc.
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, success, failed, cancelled
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded, partially_refunded
    
    -- Escrow fields
    escrow_status VARCHAR(50) DEFAULT 'held', -- held, released, disputed, refunded
    escrow_release_date TIMESTAMP WITH TIME ZONE,
    escrow_released_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    korapay_response JSONB,
    webhook_data JSONB,
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_currency CHECK (currency IN ('NGN', 'USD', 'GHS', 'KES')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
    CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
    CONSTRAINT valid_escrow_status CHECK (escrow_status IN ('held', 'released', 'disputed', 'refunded'))
);

-- Escrow management table
CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Escrow details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    platform_fee DECIMAL(10,2) DEFAULT 0,
    vendor_amount DECIMAL(10,2) NOT NULL, -- amount - platform_fee
    
    -- Status and timing
    status VARCHAR(50) DEFAULT 'held', -- held, released, disputed, refunded
    hold_until TIMESTAMP WITH TIME ZONE NOT NULL,
    released_at TIMESTAMP WITH TIME ZONE,
    
    -- Release conditions
    auto_release BOOLEAN DEFAULT true,
    manual_release_required BOOLEAN DEFAULT false,
    dispute_raised BOOLEAN DEFAULT false,
    
    -- Metadata
    release_reason TEXT,
    dispute_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_escrow_amount CHECK (amount > 0),
    CONSTRAINT valid_vendor_amount CHECK (vendor_amount >= 0),
    CONSTRAINT valid_platform_fee CHECK (platform_fee >= 0),
    CONSTRAINT valid_escrow_status CHECK (status IN ('held', 'released', 'disputed', 'refunded'))
);

-- Refund transactions table
CREATE TABLE IF NOT EXISTS refund_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Refund details
    refund_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    refund_type VARCHAR(50) DEFAULT 'full', -- full, partial
    
    -- KoraPay refund fields
    korapay_refund_reference VARCHAR(255) UNIQUE,
    korapay_refund_id VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, success, failed
    
    -- Metadata
    reason TEXT NOT NULL,
    admin_notes TEXT,
    korapay_response JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_refund_amount CHECK (refund_amount > 0),
    CONSTRAINT valid_refund_type CHECK (refund_type IN ('full', 'partial')),
    CONSTRAINT valid_refund_status CHECK (status IN ('pending', 'processing', 'success', 'failed'))
);

-- Vendor payouts table
CREATE TABLE IF NOT EXISTS vendor_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Payout details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    
    -- Bank details
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    
    -- KoraPay transfer fields
    korapay_transfer_reference VARCHAR(255) UNIQUE,
    korapay_transfer_id VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, success, failed
    
    -- Related transactions
    escrow_transaction_ids UUID[] DEFAULT '{}',
    
    -- Metadata
    korapay_response JSONB,
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_payout_amount CHECK (amount > 0),
    CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'processing', 'success', 'failed'))
);

-- Webhook logs table for debugging and audit
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_type VARCHAR(100) NOT NULL, -- payment, refund, transfer
    korapay_reference VARCHAR(255),
    
    -- Request details
    headers JSONB,
    payload JSONB NOT NULL,
    signature VARCHAR(500),
    
    -- Processing details
    processed BOOLEAN DEFAULT false,
    processing_result JSONB,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_vendor_id ON payment_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_korapay_reference ON payment_transactions(korapay_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_escrow_status ON payment_transactions(escrow_status);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payment_id ON escrow_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_vendor_id ON escrow_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_hold_until ON escrow_transactions(hold_until);

CREATE INDEX IF NOT EXISTS idx_refund_transactions_payment_id ON refund_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_refund_transactions_status ON refund_transactions(status);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id ON vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_korapay_reference ON payment_webhook_logs(korapay_reference);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON payment_webhook_logs(processed);

-- Add payment_method and payment_status columns to orders table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'korapay';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_reference') THEN
        ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(255);
    END IF;
END $$;

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_escrow_transactions_updated_at ON escrow_transactions;
CREATE TRIGGER update_escrow_transactions_updated_at 
    BEFORE UPDATE ON escrow_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_refund_transactions_updated_at ON refund_transactions;
CREATE TRIGGER update_refund_transactions_updated_at 
    BEFORE UPDATE ON refund_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_payouts_updated_at ON vendor_payouts;
CREATE TRIGGER update_vendor_payouts_updated_at 
    BEFORE UPDATE ON vendor_payouts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_transactions
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

CREATE POLICY "Admins can view all payment transactions" ON payment_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- RLS Policies for escrow_transactions
CREATE POLICY "Vendors can view their escrow transactions" ON escrow_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = escrow_transactions.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all escrow transactions" ON escrow_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- RLS Policies for refund_transactions
CREATE POLICY "Users can view their own refund transactions" ON refund_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all refund transactions" ON refund_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- RLS Policies for vendor_payouts
CREATE POLICY "Vendors can view their own payouts" ON vendor_payouts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM vendors 
            WHERE vendors.id = vendor_payouts.vendor_id 
            AND vendors.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all vendor payouts" ON vendor_payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- RLS Policies for webhook_logs (admin only)
CREATE POLICY "Admins can manage webhook logs" ON payment_webhook_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );