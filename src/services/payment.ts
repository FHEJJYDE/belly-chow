import { supabase } from '@/integrations/supabase/client';
import { koraPayService, PaymentRequest } from './korapay';
import { v4 as uuidv4 } from 'uuid';

export interface CreatePaymentRequest {
    orderId: string;
    userId: string;
    vendorId: string;
    amount: number;
    currency?: string;
    customerInfo: {
        name: string;
        email: string;
        phone?: string;
    };
    metadata?: Record<string, any>;
}

export interface PaymentResult {
    success: boolean;
    message: string;
    data?: {
        paymentUrl: string;
        reference: string;
        paymentId: string;
    };
    error?: string;
}

export interface EscrowReleaseRequest {
    paymentTransactionId: string;
    reason?: string;
    manualRelease?: boolean;
}

export interface RefundRequest {
    paymentTransactionId: string;
    amount?: number; // If not provided, full refund
    reason: string;
    adminNotes?: string;
}

class PaymentService {
    private readonly escrowHoldHours: number;
    private readonly platformFeePercentage: number;

    constructor() {
        this.escrowHoldHours = parseInt(import.meta.env.VITE_ESCROW_RELEASE_DELAY_HOURS || '24');
        this.platformFeePercentage = 0.05; // 5% platform fee
    }

    /**
     * Create a new payment transaction
     */
    async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
        try {
            const reference = koraPayService.generateReference('BP');
            const formattedAmount = koraPayService.formatAmount(request.amount, request.currency);

            // Create payment transaction record
            const { data: paymentTransaction, error: dbError } = await supabase
                .from('payment_transactions')
                .insert({
                    order_id: request.orderId,
                    user_id: request.userId,
                    vendor_id: request.vendorId,
                    korapay_reference: reference,
                    amount: request.amount,
                    currency: request.currency || 'NGN',
                    status: 'pending',
                    payment_status: 'pending',
                    escrow_status: 'held',
                    escrow_release_date: new Date(Date.now() + this.escrowHoldHours * 60 * 60 * 1000),
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error creating payment transaction:', dbError);
                return {
                    success: false,
                    message: 'Failed to create payment transaction',
                    error: dbError.message,
                };
            }

            // Initialize payment with KoraPay
            const paymentData: PaymentRequest = {
                amount: formattedAmount,
                currency: request.currency || 'NGN',
                reference,
                narration: `Belly-Chow Order Payment - ${request.orderId.substring(0, 8)}`,
                customer: request.customerInfo,
                notification_url: `${window.location.origin}/api/webhooks/korapay`,
                redirect_url: `${window.location.origin}/orders?payment=success&ref=${reference}`,
                merchant_bears_cost: false,
                metadata: {
                    order_id: request.orderId,
                    user_id: request.userId,
                    vendor_id: request.vendorId,
                    payment_transaction_id: paymentTransaction.id,
                    ...request.metadata,
                },
            };

            const koraPayResponse = await koraPayService.initializePayment(paymentData);

            if (!koraPayResponse.status || !koraPayResponse.data) {
                // Update payment transaction with failure
                await supabase
                    .from('payment_transactions')
                    .update({
                        status: 'failed',
                        failure_reason: koraPayResponse.message,
                        korapay_response: koraPayResponse,
                    })
                    .eq('id', paymentTransaction.id);

                return {
                    success: false,
                    message: koraPayResponse.message || 'Payment initialization failed',
                };
            }

            // Update payment transaction with KoraPay response
            await supabase
                .from('payment_transactions')
                .update({
                    korapay_transaction_id: koraPayResponse.data.payment_id,
                    korapay_response: koraPayResponse,
                    status: 'processing',
                })
                .eq('id', paymentTransaction.id);

            // Update order with payment reference
            await supabase
                .from('orders')
                .update({
                    payment_reference: reference,
                    payment_method: 'korapay',
                    payment_status: 'pending',
                })
                .eq('id', request.orderId);

            return {
                success: true,
                message: 'Payment initialized successfully',
                data: {
                    paymentUrl: koraPayResponse.data.checkout_url,
                    reference,
                    paymentId: koraPayResponse.data.payment_id,
                },
            };
        } catch (error: any) {
            console.error('Payment creation error:', error);
            return {
                success: false,
                message: 'An unexpected error occurred',
                error: error.message,
            };
        }
    }

    /**
     * Verify payment status
     */
    async verifyPayment(reference: string): Promise<PaymentResult> {
        try {
            // Get payment transaction from database
            const { data: paymentTransaction, error: dbError } = await supabase
                .from('payment_transactions')
                .select('*')
                .eq('korapay_reference', reference)
                .single();

            if (dbError || !paymentTransaction) {
                return {
                    success: false,
                    message: 'Payment transaction not found',
                    error: dbError?.message,
                };
            }

            // Verify with KoraPay
            const verificationResponse = await koraPayService.verifyPayment(reference);

            if (!verificationResponse.status || !verificationResponse.data) {
                return {
                    success: false,
                    message: verificationResponse.message || 'Payment verification failed',
                };
            }

            const paymentData = verificationResponse.data;
            const isSuccessful = paymentData.status === 'success' || paymentData.status === 'paid';

            // Update payment transaction
            const updateData: any = {
                payment_status: isSuccessful ? 'paid' : 'failed',
                status: isSuccessful ? 'success' : 'failed',
                payment_method: paymentData.payment_method,
                korapay_response: verificationResponse,
            };

            if (isSuccessful) {
                updateData.paid_at = new Date(paymentData.paid_at);
            } else {
                updateData.failure_reason = verificationResponse.message;
            }

            await supabase
                .from('payment_transactions')
                .update(updateData)
                .eq('id', paymentTransaction.id);

            // Update order status
            await supabase
                .from('orders')
                .update({
                    payment_status: isSuccessful ? 'paid' : 'failed',
                    status: isSuccessful ? 'accepted' : 'cancelled',
                })
                .eq('id', paymentTransaction.order_id);

            if (isSuccessful) {
                // Create escrow transaction
                await this.createEscrowTransaction(paymentTransaction);
            }

            return {
                success: isSuccessful,
                message: isSuccessful ? 'Payment verified successfully' : 'Payment verification failed',
                data: isSuccessful ? {
                    paymentUrl: '',
                    reference,
                    paymentId: paymentTransaction.korapay_transaction_id || '',
                } : undefined,
            };
        } catch (error: any) {
            console.error('Payment verification error:', error);
            return {
                success: false,
                message: 'Payment verification failed',
                error: error.message,
            };
        }
    }

    /**
     * Create escrow transaction for successful payment
     */
    private async createEscrowTransaction(paymentTransaction: any): Promise<void> {
        try {
            const customerPlatformFee = 100;
            const vendorDeliveryFee = 200;
            const totalPlatformRevenue = customerPlatformFee + vendorDeliveryFee;
            const vendorAmount = Math.max(0, paymentTransaction.amount - totalPlatformRevenue);

            await supabase
                .from('escrow_transactions')
                .insert({
                    payment_transaction_id: paymentTransaction.id,
                    order_id: paymentTransaction.order_id,
                    vendor_id: paymentTransaction.vendor_id,
                    amount: paymentTransaction.amount,
                    currency: paymentTransaction.currency,
                    platform_fee: totalPlatformRevenue,
                    vendor_amount: vendorAmount,
                    status: 'held',
                    hold_until: paymentTransaction.escrow_release_date,
                    auto_release: true,
                });
        } catch (error) {
            console.error('Error creating escrow transaction:', error);
        }
    }

    /**
     * Release funds from escrow
     */
    async releaseEscrow(request: EscrowReleaseRequest): Promise<PaymentResult> {
        try {
            const { data: escrowTransaction, error: fetchError } = await supabase
                .from('escrow_transactions')
                .select('*, payment_transactions(*), vendors(*)')
                .eq('payment_transaction_id', request.paymentTransactionId)
                .eq('status', 'held')
                .single();

            if (fetchError || !escrowTransaction) {
                return {
                    success: false,
                    message: 'Escrow transaction not found or already processed',
                    error: fetchError?.message,
                };
            }

            // Check if manual release is required and user has permission
            if (escrowTransaction.manual_release_required && !request.manualRelease) {
                return {
                    success: false,
                    message: 'Manual release required for this transaction',
                };
            }

            // Update escrow status
            await supabase
                .from('escrow_transactions')
                .update({
                    status: 'released',
                    released_at: new Date().toISOString(),
                    release_reason: request.reason || 'Automatic release after hold period',
                })
                .eq('id', escrowTransaction.id);

            // Update payment transaction escrow status
            await supabase
                .from('payment_transactions')
                .update({
                    escrow_status: 'released',
                    escrow_released_at: new Date().toISOString(),
                })
                .eq('id', request.paymentTransactionId);

            // Create vendor payout if vendor has bank details
            if (escrowTransaction.vendors?.bank_details) {
                await this.createVendorPayout(escrowTransaction);
            }

            return {
                success: true,
                message: 'Escrow funds released successfully',
            };
        } catch (error: any) {
            console.error('Escrow release error:', error);
            return {
                success: false,
                message: 'Failed to release escrow funds',
                error: error.message,
            };
        }
    }

    /**
     * Create vendor payout
     */
    private async createVendorPayout(escrowTransaction: any): Promise<void> {
        try {
            const reference = koraPayService.generateReference('PAYOUT');
            const bankDetails = escrowTransaction.vendors.bank_details;

            // Create payout record
            const { data: payout, error: payoutError } = await supabase
                .from('vendor_payouts')
                .insert({
                    vendor_id: escrowTransaction.vendor_id,
                    amount: escrowTransaction.vendor_amount,
                    currency: escrowTransaction.currency,
                    bank_name: bankDetails.bank_name,
                    account_number: bankDetails.account_number,
                    account_name: bankDetails.account_name,
                    korapay_transfer_reference: reference,
                    status: 'pending',
                    escrow_transaction_ids: [escrowTransaction.id],
                })
                .select()
                .single();

            if (payoutError) {
                console.error('Error creating payout record:', payoutError);
                return;
            }

            // Process transfer with KoraPay
            const transferResponse = await koraPayService.transferFunds({
                reference,
                destination: {
                    type: 'bank_account',
                    amount: koraPayService.formatAmount(escrowTransaction.vendor_amount, escrowTransaction.currency),
                    currency: escrowTransaction.currency,
                    narration: `Belly-Chow Payout - ${escrowTransaction.id.substring(0, 8)}`,
                    bank_account: {
                        bank: bankDetails.bank_code,
                        account: bankDetails.account_number,
                        account_name: bankDetails.account_name,
                    },
                },
                customer: {
                    name: escrowTransaction.vendors.name,
                    email: escrowTransaction.vendors.email || 'vendor@belly-chow.com',
                },
            });

            // Update payout with transfer response
            await supabase
                .from('vendor_payouts')
                .update({
                    korapay_transfer_id: transferResponse.data?.reference,
                    status: transferResponse.status ? 'processing' : 'failed',
                    korapay_response: transferResponse,
                    failure_reason: transferResponse.status ? null : transferResponse.message,
                    processed_at: transferResponse.status ? new Date().toISOString() : null,
                })
                .eq('id', payout.id);
        } catch (error) {
            console.error('Error creating vendor payout:', error);
        }
    }

    /**
     * Process refund
     */
    async processRefund(request: RefundRequest): Promise<PaymentResult> {
        try {
            const { data: paymentTransaction, error: fetchError } = await supabase
                .from('payment_transactions')
                .select('*')
                .eq('id', request.paymentTransactionId)
                .eq('payment_status', 'paid')
                .single();

            if (fetchError || !paymentTransaction) {
                return {
                    success: false,
                    message: 'Payment transaction not found or not eligible for refund',
                    error: fetchError?.message,
                };
            }

            const refundAmount = request.amount || paymentTransaction.amount;
            const refundReference = koraPayService.generateReference('REFUND');

            // Create refund record
            const { data: refundTransaction, error: refundError } = await supabase
                .from('refund_transactions')
                .insert({
                    payment_transaction_id: request.paymentTransactionId,
                    order_id: paymentTransaction.order_id,
                    user_id: paymentTransaction.user_id,
                    refund_amount: refundAmount,
                    currency: paymentTransaction.currency,
                    refund_type: refundAmount === paymentTransaction.amount ? 'full' : 'partial',
                    korapay_refund_reference: refundReference,
                    status: 'pending',
                    reason: request.reason,
                    admin_notes: request.adminNotes,
                })
                .select()
                .single();

            if (refundError) {
                return {
                    success: false,
                    message: 'Failed to create refund record',
                    error: refundError.message,
                };
            }

            // Process refund with KoraPay
            const refundResponse = await koraPayService.processRefund({
                transaction_reference: paymentTransaction.korapay_reference,
                amount: koraPayService.formatAmount(refundAmount, paymentTransaction.currency),
                reason: request.reason,
            });

            // Update refund record
            const refundStatus = refundResponse.status ? 'success' : 'failed';
            await supabase
                .from('refund_transactions')
                .update({
                    korapay_refund_id: refundResponse.data?.refund_reference,
                    status: refundStatus,
                    korapay_response: refundResponse,
                    processed_at: new Date().toISOString(),
                })
                .eq('id', refundTransaction.id);

            if (refundResponse.status) {
                // Update payment transaction status
                const newPaymentStatus = refundAmount === paymentTransaction.amount ? 'refunded' : 'partially_refunded';
                await supabase
                    .from('payment_transactions')
                    .update({
                        payment_status: newPaymentStatus,
                    })
                    .eq('id', request.paymentTransactionId);

                // Update order status
                await supabase
                    .from('orders')
                    .update({
                        status: 'cancelled',
                        payment_status: newPaymentStatus,
                    })
                    .eq('id', paymentTransaction.order_id);
            }

            return {
                success: refundResponse.status,
                message: refundResponse.message || (refundResponse.status ? 'Refund processed successfully' : 'Refund processing failed'),
            };
        } catch (error: any) {
            console.error('Refund processing error:', error);
            return {
                success: false,
                message: 'Failed to process refund',
                error: error.message,
            };
        }
    }

    /**
     * Get payment transaction by reference
     */
    async getPaymentByReference(reference: string) {
        const { data, error } = await supabase
            .from('payment_transactions')
            .select('*, orders(*), escrow_transactions(*)')
            .eq('korapay_reference', reference)
            .single();

        if (error) {
            throw new Error(`Payment not found: ${error.message}`);
        }

        return data;
    }

    /**
     * Get user's payment history
     */
    async getUserPaymentHistory(userId: string) {
        const { data, error } = await supabase
            .from('payment_transactions')
            .select('*, orders(*), refund_transactions(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch payment history: ${error.message}`);
        }

        return data;
    }

    /**
     * Get vendor's earnings
     */
    async getVendorEarnings(vendorId: string) {
        const { data, error } = await supabase
            .from('escrow_transactions')
            .select('*, payment_transactions(*), vendor_payouts(*)')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch vendor earnings: ${error.message}`);
        }

        return data;
    }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;