// Wallet Service
// Handles wallet operations, balance management, and transactions

import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_CONFIG, validateWithdrawalAmount, formatCurrency } from '@/lib/paymentConfig';

export interface WalletBalance {
    balance: number;
    pending_balance: number;
    total_earned: number;
    total_withdrawn: number;
}

export interface WalletTransaction {
    id: string;
    transaction_type: 'credit' | 'debit' | 'escrow_hold' | 'escrow_release' | 'refund' | 'withdrawal';
    amount: number;
    reference_type: 'order' | 'settlement' | 'withdrawal' | 'refund' | 'bonus' | 'top_up';
    reference_id: string | null;
    description: string;
    balance_before: number;
    balance_after: number;
    created_at: string;
}

export interface WithdrawalRequest {
    id: string;
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    requested_at: string;
    processed_at: string | null;
    failure_reason: string | null;
}

class WalletService {
    /**
     * Get user's wallet balance
     */
    async getWalletBalance(userId: string): Promise<WalletBalance | null> {
        try {
            const { data, error } = await supabase
                .from('user_wallets')
                .select('balance, pending_balance, total_earned, total_withdrawn')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching wallet balance:', error);
                return null;
            }

            return {
                balance: parseFloat(data.balance),
                pending_balance: parseFloat(data.pending_balance),
                total_earned: parseFloat(data.total_earned),
                total_withdrawn: parseFloat(data.total_withdrawn),
            };
        } catch (error) {
            console.error('Wallet balance fetch error:', error);
            return null;
        }
    }

    /**
     * Get wallet transaction history
     */
    async getWalletTransactions(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<WalletTransaction[]> {
        try {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select(`
          id,
          transaction_type,
          amount,
          reference_type,
          reference_id,
          description,
          balance_before,
          balance_after,
          created_at
        `)
                .eq('wallet_id', await this.getWalletId(userId))
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('Error fetching wallet transactions:', error);
                return [];
            }

            return data.map(transaction => ({
                ...transaction,
                amount: parseFloat(transaction.amount),
                balance_before: parseFloat(transaction.balance_before),
                balance_after: parseFloat(transaction.balance_after),
            }));
        } catch (error) {
            console.error('Wallet transactions fetch error:', error);
            return [];
        }
    }

    /**
     * Credit user's wallet
     */
    async creditWallet(
        userId: string,
        amount: number,
        transactionType: 'credit' | 'escrow_release' | 'refund',
        referenceType: 'order' | 'settlement' | 'refund' | 'bonus' | 'top_up',
        referenceId: string | null,
        description: string
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase.rpc('credit_wallet', {
                p_user_id: userId,
                p_amount: amount,
                p_transaction_type: transactionType,
                p_reference_type: referenceType,
                p_reference_id: referenceId,
                p_description: description,
            });

            if (error) {
                console.error('Error crediting wallet:', error);
                return false;
            }

            return data === true;
        } catch (error) {
            console.error('Wallet credit error:', error);
            return false;
        }
    }

    /**
     * Debit user's wallet
     */
    async debitWallet(
        userId: string,
        amount: number,
        transactionType: 'debit' | 'withdrawal',
        referenceType: 'order' | 'withdrawal',
        referenceId: string | null,
        description: string
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase.rpc('debit_wallet', {
                p_user_id: userId,
                p_amount: amount,
                p_transaction_type: transactionType,
                p_reference_type: referenceType,
                p_reference_id: referenceId,
                p_description: description,
            });

            if (error) {
                console.error('Error debiting wallet:', error);
                return false;
            }

            return data === true;
        } catch (error) {
            console.error('Wallet debit error:', error);
            return false;
        }
    }

    /**
     * Create withdrawal request
     */
    async createWithdrawalRequest(
        userId: string,
        amount: number,
        bankName: string,
        accountNumber: string,
        accountName: string
    ): Promise<{ success: boolean; id?: string; error?: string }> {
        try {
            // Check if user has sufficient balance
            const balance = await this.getWalletBalance(userId);
            if (!balance || balance.balance < amount) {
                return {
                    success: false,
                    error: 'Insufficient balance',
                };
            }

            // Check minimum withdrawal amount based on user role
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .single();

            const userType = userRoles?.role === 'rider' ? 'rider' : 'vendor';

            if (!validateWithdrawalAmount(amount, userType)) {
                const minAmount = PAYMENT_CONFIG.MIN_WITHDRAWAL[userType];
                return {
                    success: false,
                    error: `Minimum withdrawal amount is ₦${minAmount}`,
                };
            }

            // Create withdrawal request
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .insert({
                    user_id: userId,
                    amount,
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_name: accountName,
                })
                .select('id')
                .single();

            if (error) {
                console.error('Error creating withdrawal request:', error);
                return {
                    success: false,
                    error: 'Failed to create withdrawal request',
                };
            }

            return {
                success: true,
                id: data.id,
            };
        } catch (error) {
            console.error('Withdrawal request error:', error);
            return {
                success: false,
                error: 'Failed to create withdrawal request',
            };
        }
    }

    /**
     * Get user's withdrawal requests
     */
    async getWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
        try {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('user_id', userId)
                .order('requested_at', { ascending: false });

            if (error) {
                console.error('Error fetching withdrawal requests:', error);
                return [];
            }

            return data.map(request => ({
                ...request,
                amount: parseFloat(request.amount),
            }));
        } catch (error) {
            console.error('Withdrawal requests fetch error:', error);
            return [];
        }
    }

    /**
     * Get wallet earnings analytics
     */
    async getEarningsAnalytics(userId: string, days: number = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('amount, created_at, transaction_type')
                .eq('wallet_id', await this.getWalletId(userId))
                .eq('transaction_type', 'credit')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching earnings analytics:', error);
                return {
                    totalEarnings: 0,
                    dailyEarnings: [],
                    averageDaily: 0,
                };
            }

            const totalEarnings = data.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
            const averageDaily = totalEarnings / days;

            // Group by day
            const dailyEarnings = data.reduce((acc, transaction) => {
                const date = new Date(transaction.created_at).toDateString();
                acc[date] = (acc[date] || 0) + parseFloat(transaction.amount);
                return acc;
            }, {} as Record<string, number>);

            return {
                totalEarnings,
                dailyEarnings: Object.entries(dailyEarnings).map(([date, amount]) => ({
                    date,
                    amount,
                })),
                averageDaily,
            };
        } catch (error) {
            console.error('Earnings analytics error:', error);
            return {
                totalEarnings: 0,
                dailyEarnings: [],
                averageDaily: 0,
            };
        }
    }

    /**
     * Check if user can make a withdrawal
     */
    async canWithdraw(userId: string, amount: number): Promise<{ canWithdraw: boolean; reason?: string }> {
        try {
            const balance = await this.getWalletBalance(userId);
            if (!balance) {
                return { canWithdraw: false, reason: 'Unable to fetch wallet balance' };
            }

            if (balance.balance < amount) {
                return { canWithdraw: false, reason: 'Insufficient balance' };
            }

            // Check for pending withdrawal requests
            const { data: pendingRequests } = await supabase
                .from('withdrawal_requests')
                .select('id')
                .eq('user_id', userId)
                .in('status', ['pending', 'processing']);

            if (pendingRequests && pendingRequests.length > 0) {
                return { canWithdraw: false, reason: 'You have a pending withdrawal request' };
            }

            return { canWithdraw: true };
        } catch (error) {
            console.error('Can withdraw check error:', error);
            return { canWithdraw: false, reason: 'Unable to verify withdrawal eligibility' };
        }
    }

    /**
     * Get wallet ID for a user
     */
    private async getWalletId(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('user_wallets')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching wallet ID:', error);
                return null;
            }

            return data.id;
        } catch (error) {
            console.error('Wallet ID fetch error:', error);
            return null;
        }
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        return formatCurrency(amount);
    }

    /**
     * Get transaction type display name
     */
    getTransactionTypeDisplay(type: string): string {
        const typeMap: Record<string, string> = {
            credit: 'Credit',
            debit: 'Debit',
            escrow_hold: 'Payment Hold',
            escrow_release: 'Payment Release',
            refund: 'Refund',
            withdrawal: 'Withdrawal',
        };

        return typeMap[type] || type;
    }

    /**
     * Get reference type display name
     */
    getReferenceTypeDisplay(type: string): string {
        const typeMap: Record<string, string> = {
            order: 'Order',
            settlement: 'Settlement',
            withdrawal: 'Withdrawal',
            refund: 'Refund',
            bonus: 'Bonus',
            top_up: 'Top Up',
        };

        return typeMap[type] || type;
    }
}

// Export singleton instance
export const walletService = new WalletService();