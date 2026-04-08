-- Fix RLS policies for payment_transactions table
-- Add INSERT policy so users can create their own payment transactions

-- Add policy for users to create their own payment transactions
DROP POLICY IF EXISTS "Users can create their own payment transactions" ON payment_transactions;
CREATE POLICY "Users can create their own payment transactions" ON payment_transactions
    FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Add policy for users to update their own payment transactions (needed for payment verification)
DROP POLICY IF EXISTS "Users can update their own payment transactions" ON payment_transactions;
CREATE POLICY "Users can update their own payment transactions" ON payment_transactions
    FOR UPDATE USING (customer_id = auth.uid());

-- Add policy for service role to insert payment transactions (for webhook operations)
DROP POLICY IF EXISTS "Service role can manage payment transactions" ON payment_transactions;
CREATE POLICY "Service role can manage payment transactions" ON payment_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Add policy for authenticated users to insert payment transactions (broader access)
DROP POLICY IF EXISTS "Authenticated users can create payment transactions" ON payment_transactions;
CREATE POLICY "Authenticated users can create payment transactions" ON payment_transactions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Also add similar policies for wallet operations
DROP POLICY IF EXISTS "Users can create wallet transactions" ON wallet_transactions;
CREATE POLICY "Users can create wallet transactions" ON wallet_transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_wallets 
            WHERE user_wallets.id = wallet_transactions.wallet_id 
            AND user_wallets.user_id = auth.uid()
        )
    );

-- Allow service role to manage all wallet transactions
DROP POLICY IF EXISTS "Service role can manage wallet transactions" ON wallet_transactions;
CREATE POLICY "Service role can manage wallet transactions" ON wallet_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Allow users to update their own wallets
DROP POLICY IF EXISTS "Users can update their own wallet" ON user_wallets;
CREATE POLICY "Users can update their own wallet" ON user_wallets
    FOR UPDATE USING (user_id = auth.uid());

-- Allow service role to manage all wallets
DROP POLICY IF EXISTS "Service role can manage wallets" ON user_wallets;
CREATE POLICY "Service role can manage wallets" ON user_wallets
    FOR ALL USING (auth.role() = 'service_role');

-- Allow service role to manage settlement records
DROP POLICY IF EXISTS "Service role can manage settlements" ON settlement_records;
CREATE POLICY "Service role can manage settlements" ON settlement_records
    FOR ALL USING (auth.role() = 'service_role');