-- COMPLETE REMOVAL OF PAYMENT SYSTEM
-- This will remove all payment-related tables, functions, and policies

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trigger_create_user_wallet ON profiles;
DROP TRIGGER IF EXISTS trigger_update_wallet_timestamp ON user_wallets;

-- Drop all payment-related tables (in correct order to handle dependencies)
DROP TABLE IF EXISTS webhook_errors CASCADE;
DROP TABLE IF EXISTS payment_system_errors CASCADE;
DROP TABLE IF EXISTS system_health_metrics CASCADE;
DROP TABLE IF EXISTS settlement_records CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS user_wallets CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;

-- Drop all payment-related functions (after tables and triggers)
DROP FUNCTION IF EXISTS log_payment_error(TEXT, TEXT, TEXT, UUID, UUID, UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS record_health_metric(TEXT, DECIMAL(10,4), TEXT, TEXT);
DROP FUNCTION IF EXISTS calculate_payment_success_rate(INTEGER);
DROP FUNCTION IF EXISTS calculate_average_settlement_time(INTEGER);
DROP FUNCTION IF EXISTS credit_wallet(UUID, DECIMAL(10,2), TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS debit_wallet(UUID, DECIMAL(10,2), TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS process_order_settlement(UUID);
DROP FUNCTION IF EXISTS create_user_wallet();
DROP FUNCTION IF EXISTS update_wallet_timestamp();

-- Clean up any remaining sequences or indexes
DROP SEQUENCE IF EXISTS payment_transactions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS user_wallets_id_seq CASCADE;
DROP SEQUENCE IF EXISTS wallet_transactions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS settlement_records_id_seq CASCADE;
DROP SEQUENCE IF EXISTS withdrawal_requests_id_seq CASCADE;

-- Remove any payment-related columns from orders table if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE orders DROP COLUMN payment_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE orders DROP COLUMN payment_method;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'orders' AND column_name = 'payment_reference') THEN
        ALTER TABLE orders DROP COLUMN payment_reference;
    END IF;
END $$;