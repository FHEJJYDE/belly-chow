-- Update payment_transactions table to use generic column names for Kora integration
-- Rename paystack_* columns to generic payment_* columns

-- Rename columns to be payment gateway agnostic
ALTER TABLE payment_transactions 
RENAME COLUMN paystack_reference TO payment_reference;

ALTER TABLE payment_transactions 
RENAME COLUMN paystack_transaction_id TO payment_transaction_id;

ALTER TABLE payment_transactions 
RENAME COLUMN paystack_access_code TO payment_access_code;

-- Update withdrawal_requests table columns
ALTER TABLE withdrawal_requests 
RENAME COLUMN paystack_recipient_code TO payment_recipient_code;

ALTER TABLE withdrawal_requests 
RENAME COLUMN paystack_transfer_code TO payment_transfer_code;

-- Update payment method enum to include Kora options
ALTER TABLE payment_transactions 
DROP CONSTRAINT IF EXISTS payment_transactions_payment_method_check;

ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_payment_method_check 
CHECK (payment_method IN ('kora_card', 'kora_transfer', 'kora_ussd', 'kora_qr', 'wallet', 'paystack_card', 'paystack_transfer', 'paystack_ussd'));

-- Update indexes to use new column names
DROP INDEX IF EXISTS idx_payment_transactions_paystack_reference;
CREATE INDEX idx_payment_transactions_payment_reference ON payment_transactions(payment_reference);

-- Add comment to document the change
COMMENT ON COLUMN payment_transactions.payment_reference IS 'Payment gateway reference (Kora, Paystack, etc.)';
COMMENT ON COLUMN payment_transactions.payment_transaction_id IS 'Payment gateway transaction ID';
COMMENT ON COLUMN payment_transactions.payment_access_code IS 'Payment gateway access code';