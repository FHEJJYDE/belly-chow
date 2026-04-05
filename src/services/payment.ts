// Payment Service
// Orchestrates the entire payment flow including escrow and settlement

import { supabase } from '@/integrations/supabase/client';
import { koraService } from './kora';
import { walletService } from './wallet';
import { PAYMENT_CONFIG, calculatePaymentBreakdown } from '@/lib/paymentConfig';

export interface PaymentInitializationRequest {
    orderId: string;
    customerId: string;
    customerEmail: string;
    totalAmount: number;
    foodAmount: number;
    deliveryFee: number;
    paymentMethod: string;
}

export interface PaymentResult {
    success: boolean;
    paymentUrl?: string;
    reference?: string;
    error?: string;
}

export interface SettlementResult {
    success: boolean;
    vendorAmount?: number;
    riderAmount?: number;
    platformAmount?: number;
    error?: string;
}

class PaymentService {
    /**
     * Initialize payment for an order
     */
    async initializePayment(paymentData: PaymentInitializationRequest): Promise<PaymentResult> {
        try {
            // Validate order data using configuration
            if (paymentData.deliveryFee !== PAYMENT_CONFIG.DELIVERY_FEE) {
                return {
                    success: false,
                    error: `Delivery fee must be ₦${PAYMENT_CONFIG.DELIVERY_FEE}`,
                };
            }

            // Generate payment reference
            const reference = koraService.generateReference('BC_ORDER');

            // Create payment transaction record
            const { data: paymentTransaction, error: dbError } = await supabase
                .from('payment_transactions')
                .insert({
                    order_id: paymentData.orderId,
                    customer_id: paymentData.customerId,
                    total_amount: paymentData.totalAmount,
                    food_amount: paymentData.foodAmount,
                    delivery_fee: paymentData.deliveryFee,
                    payment_method: paymentData.paymentMethod,
                    paystack_reference: reference, // Using same field for now
                })
                .select('id')
                .single();

            if (dbError) {
                console.error('Error creating payment transaction:', dbError);
                return {
                    success: false,
                    error: 'Failed to create payment record',
                };
            }

            // Initialize Kora payment
            const koraResult = await koraService.initializePayment({
                email: paymentData.customerEmail,
                amount: paymentData.totalAmount,
                reference,
                callback_url: `${window.location.origin}/payment/callback`,
                metadata: {
                    order_id: paymentData.orderId,
                    payment_transaction_id: paymentTransaction.id,
                    food_amount: paymentData.foodAmount,
                    delivery_fee: paymentData.deliveryFee,
                },
                channels: ['card', 'bank_transfer', 'ussd'],
            });

            if (!koraResult.success) {
                // Clean up payment transaction if Kora initialization fails
                await supabase
                    .from('payment_transactions')
                    .update({ payment_status: 'failed' })
                    .eq('id', paymentTransaction.id);

                return {
                    success: false,
                    error: koraResult.error,
                };
            }

            // Update payment transaction with Kora access code
            await supabase
                .from('payment_transactions')
                .update({ paystack_access_code: koraResult.data.access_code }) // Using same field for now
                .eq('id', paymentTransaction.id);

            return {
                success: true,
                paymentUrl: koraResult.data.authorization_url,
                reference,
            };
        } catch (error) {
            console.error('Payment initialization error:', error);
            return {
                success: false,
                error: 'Payment initialization failed',
            };
        }
    }

    /**
     * Process wallet payment
     */
    async processWalletPayment(orderId: string, customerId: string, amount: number): Promise<boolean> {
        try {
            // Check wallet balance
            const balance = await walletService.getWalletBalance(customerId);
            if (!balance || balance.balance < amount) {
                throw new Error('Insufficient wallet balance');
            }

            // Debit wallet
            const debitSuccess = await walletService.debitWallet(
                customerId,
                amount,
                'debit',
                'order',
                orderId,
                `Payment for order ${orderId}`
            );

            if (!debitSuccess) {
                throw new Error('Failed to debit wallet');
            }

            // Update order status
            await supabase
                .from('orders')
                .update({
                    status: 'accepted',
                    payment_status: 'confirmed'
                })
                .eq('id', orderId);

            // Create payment transaction record
            await supabase
                .from('payment_transactions')
                .insert({
                    order_id: orderId,
                    customer_id: customerId,
                    total_amount: amount,
                    food_amount: amount - PAYMENT_CONFIG.DELIVERY_FEE,
                    delivery_fee: PAYMENT_CONFIG.DELIVERY_FEE,
                    payment_method: 'wallet',
                    payment_status: 'completed',
                    completed_at: new Date().toISOString(),
                });

            return true;
        } catch (error) {
            console.error('Wallet payment error:', error);
            return false;
        }
    }

    /**
     * Verify payment and update transaction status
     */
    async verifyPayment(reference: string): Promise<{ success: boolean; orderId?: string; error?: string }> {
        try {
            // Verify payment with Kora
            const verification = await koraService.verifyPayment(reference);

            if (!verification.status) {
                return {
                    success: false,
                    error: verification.message,
                };
            }

            const paymentData = verification.data;

            // Update payment transaction
            const { data: paymentTransaction, error: updateError } = await supabase
                .from('payment_transactions')
                .update({
                    payment_status: paymentData.status === 'success' ? 'completed' : 'failed',
                    paystack_transaction_id: paymentData.id.toString(), // Using same field for now
                    completed_at: paymentData.status === 'success' ? new Date().toISOString() : null,
                })
                .eq('paystack_reference', reference) // Using same field for now
                .select('order_id, payment_status')
                .single();

            if (updateError) {
                console.error('Error updating payment transaction:', updateError);
                return {
                    success: false,
                    error: 'Failed to update payment status',
                };
            }

            if (paymentData.status === 'success') {
                // Update order status to paid
                await supabase
                    .from('orders')
                    .update({
                        status: 'accepted',
                        payment_status: 'confirmed'
                    })
                    .eq('id', paymentTransaction.order_id);

                return {
                    success: true,
                    orderId: paymentTransaction.order_id,
                };
            } else {
                // Update order status to cancelled if payment failed
                await supabase
                    .from('orders')
                    .update({
                        status: 'cancelled',
                        payment_status: 'failed'
                    })
                    .eq('id', paymentTransaction.order_id);

                return {
                    success: false,
                    error: 'Payment was not successful',
                };
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            return {
                success: false,
                error: 'Payment verification failed',
            };
        }
    }

    /**
     * Process settlement after order delivery
     */
    async processOrderSettlement(orderId: string): Promise<SettlementResult> {
        try {
            // Use the database function for settlement processing
            const { data, error } = await supabase.rpc('process_order_settlement', {
                p_order_id: orderId,
            });

            if (error) {
                console.error('Settlement processing error:', error);
                return {
                    success: false,
                    error: error.message || 'Settlement processing failed',
                };
            }

            // Get settlement details for response
            const { data: paymentTransaction } = await supabase
                .from('payment_transactions')
                .select('food_amount')
                .eq('order_id', orderId)
                .single();

            if (paymentTransaction) {
                return {
                    success: true,
                    vendorAmount: parseFloat(paymentTransaction.food_amount),
                    riderAmount: PAYMENT_CONFIG.RIDER_SHARE,
                    platformAmount: PAYMENT_CONFIG.PLATFORM_SHARE,
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Settlement processing error:', error);
            return {
                success: false,
                error: 'Settlement processing failed',
            };
        }
    }

    /**
     * Process refund for cancelled order
     */
    async processRefund(orderId: string, reason: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get payment transaction
            const { data: paymentTransaction, error: fetchError } = await supabase
                .from('payment_transactions')
                .select('*')
                .eq('order_id', orderId)
                .eq('payment_status', 'completed')
                .eq('escrow_status', 'held')
                .single();

            if (fetchError || !paymentTransaction) {
                return {
                    success: false,
                    error: 'No valid payment found for refund',
                };
            }

            // Credit customer wallet with refund
            const refundSuccess = await walletService.creditWallet(
                paymentTransaction.customer_id,
                parseFloat(paymentTransaction.total_amount),
                'refund',
                'refund',
                orderId,
                `Refund for cancelled order: ${reason}`
            );

            if (!refundSuccess) {
                return {
                    success: false,
                    error: 'Failed to process refund to wallet',
                };
            }

            // Update payment transaction status
            await supabase
                .from('payment_transactions')
                .update({
                    payment_status: 'refunded',
                    escrow_status: 'refunded',
                })
                .eq('id', paymentTransaction.id);

            // Update order status
            await supabase
                .from('orders')
                .update({
                    status: 'cancelled',
                    payment_status: 'refunded'
                })
                .eq('id', orderId);

            return { success: true };
        } catch (error) {
            console.error('Refund processing error:', error);
            return {
                success: false,
                error: 'Refund processing failed',
            };
        }
    }

    /**
     * Get payment transaction details
     */
    async getPaymentTransaction(orderId: string) {
        try {
            const { data, error } = await supabase
                .from('payment_transactions')
                .select(`
          *,
          orders (
            vendor_id,
            rider_id,
            status
          )
        `)
                .eq('order_id', orderId)
                .single();

            if (error) {
                console.error('Error fetching payment transaction:', error);
                return null;
            }

            return {
                ...data,
                total_amount: parseFloat(data.total_amount),
                food_amount: parseFloat(data.food_amount),
                delivery_fee: parseFloat(data.delivery_fee),
            };
        } catch (error) {
            console.error('Payment transaction fetch error:', error);
            return null;
        }
    }

    /**
     * Get settlement records for an order
     */
    async getOrderSettlements(orderId: string) {
        try {
            const { data, error } = await supabase
                .from('settlement_records')
                .select(`
          *,
          profiles (
            full_name,
            role
          )
        `)
                .eq('payment_transaction_id', (
                    await supabase
                        .from('payment_transactions')
                        .select('id')
                        .eq('order_id', orderId)
                        .single()
                ).data?.id);

            if (error) {
                console.error('Error fetching settlements:', error);
                return [];
            }

            return data.map(settlement => ({
                ...settlement,
                amount: parseFloat(settlement.amount),
            }));
        } catch (error) {
            console.error('Settlements fetch error:', error);
            return [];
        }
    }

    /**
     * Calculate order totals
     */
    calculateOrderTotals(foodAmount: number) {
        return calculatePaymentBreakdown(foodAmount);
    }

    /**
     * Check if order can be paid
     */
    async canPayForOrder(orderId: string, customerId: string): Promise<{ canPay: boolean; reason?: string }> {
        try {
            // Check if order exists and belongs to customer
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('status, customer_id')
                .eq('id', orderId)
                .single();

            if (orderError || !order) {
                return { canPay: false, reason: 'Order not found' };
            }

            if (order.customer_id !== customerId) {
                return { canPay: false, reason: 'Order does not belong to you' };
            }

            if (order.status !== 'pending') {
                return { canPay: false, reason: 'Order is not in pending status' };
            }

            // Check if payment already exists
            const { data: existingPayment } = await supabase
                .from('payment_transactions')
                .select('payment_status')
                .eq('order_id', orderId)
                .eq('payment_status', 'completed')
                .single();

            if (existingPayment) {
                return { canPay: false, reason: 'Order is already paid' };
            }

            return { canPay: true };
        } catch (error) {
            console.error('Can pay check error:', error);
            return { canPay: false, reason: 'Unable to verify payment eligibility' };
        }
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        return koraService.formatAmount(amount);
    }
}

// Export singleton instance
export const paymentService = new PaymentService();