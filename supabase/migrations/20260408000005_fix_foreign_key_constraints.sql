-- Fix foreign key constraints for payment_transactions table
-- Make customer_id foreign key constraint more flexible

-- First, let's check if we can make customer_id nullable temporarily for debugging
ALTER TABLE payment_transactions ALTER COLUMN customer_id DROP NOT NULL;

-- Add a check to see if we have any orphaned records
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    -- Count payment transactions with invalid customer_ids
    SELECT COUNT(*) INTO orphaned_count
    FROM payment_transactions pt
    LEFT JOIN profiles p ON pt.customer_id = p.id
    WHERE pt.customer_id IS NOT NULL AND p.id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % payment transactions with invalid customer_ids', orphaned_count;
    END IF;
END $$;

-- Temporarily drop the foreign key constraint to allow payments to be created
-- We'll add it back later once we fix the authentication issue
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_customer_id_fkey;

-- Add a new foreign key constraint that allows NULL values and has ON DELETE SET NULL
ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Also make order_id foreign key more flexible
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_order_id_fkey;
ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;