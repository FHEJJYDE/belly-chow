-- Add missing columns to payment_transactions table if they don't exist
-- This ensures compatibility with the existing code

-- Add payment_reference column if it doesn't exist (keep paystack_reference for compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'payment_reference') THEN
        ALTER TABLE payment_transactions ADD COLUMN payment_reference TEXT UNIQUE;
        
        -- Copy data from paystack_reference to payment_reference if paystack_reference exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'paystack_reference') THEN
            UPDATE payment_transactions SET payment_reference = paystack_reference WHERE paystack_reference IS NOT NULL;
        END IF;
    END IF;
END $$;

-- Add payment_transaction_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'payment_transaction_id') THEN
        ALTER TABLE payment_transactions ADD COLUMN payment_transaction_id TEXT;
        
        -- Copy data from paystack_transaction_id if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'paystack_transaction_id') THEN
            UPDATE payment_transactions SET payment_transaction_id = paystack_transaction_id WHERE paystack_transaction_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- Add payment_access_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'payment_access_code') THEN
        ALTER TABLE payment_transactions ADD COLUMN payment_access_code TEXT;
        
        -- Copy data from paystack_access_code if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payment_transactions' 
                   AND column_name = 'paystack_access_code') THEN
            UPDATE payment_transactions SET payment_access_code = paystack_access_code WHERE paystack_access_code IS NOT NULL;
        END IF;
    END IF;
END $$;