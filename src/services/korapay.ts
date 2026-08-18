import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// KoraPay API configuration
const KORAPAY_BASE_URL = import.meta.env.VITE_PAYMENT_ENVIRONMENT === 'live'
    ? 'https://api.korapay.com/merchant/api/v1'
    : 'https://api.korapay.com/merchant/api/v1'; // KoraPay uses same URL for test/live

const KORAPAY_PUBLIC_KEY = import.meta.env.VITE_KORAPAY_PUBLIC_KEY;

// Payment interfaces
export interface PaymentRequest {
    amount: number;
    currency?: string;
    reference?: string;
    narration?: string;
    channels?: string[];
    default_channel?: string;
    customer: {
        name: string;
        email: string;
        phone?: string;
    };
    notification_url?: string;
    redirect_url?: string;
    merchant_bears_cost?: boolean;
    metadata?: Record<string, any>;
}

export interface PaymentResponse {
    status: boolean;
    message: string;
    data?: {
        checkout_url: string;
        reference: string;
        payment_id: string;
    };
}

export interface PaymentVerificationResponse {
    status: boolean;
    message: string;
    data?: {
        reference: string;
        amount: number;
        currency: string;
        status: string;
        payment_method: string;
        paid_at: string;
        customer: {
            name: string;
            email: string;
            phone?: string;
        };
        metadata?: Record<string, any>;
    };
}

export interface TransferRequest {
    reference: string;
    destination: {
        type: 'bank_account';
        amount: number;
        currency: string;
        narration: string;
        bank_account: {
            bank: string;
            account: string;
            account_name?: string;
        };
    };
    customer: {
        name: string;
        email: string;
    };
}

export interface TransferResponse {
    status: boolean;
    message: string;
    data?: {
        reference: string;
        status: string;
        amount: number;
        fee: number;
        currency: string;
        narration: string;
    };
}

export interface RefundRequest {
    transaction_reference: string;
    amount?: number;
    reason: string;
}

export interface RefundResponse {
    status: boolean;
    message: string;
    data?: {
        transaction_reference: string;
        refund_reference: string;
        amount: number;
        status: string;
    };
}

class KoraPayService {
    private apiKey: string;
    private baseURL: string;

    constructor() {
        this.apiKey = KORAPAY_PUBLIC_KEY;
        this.baseURL = KORAPAY_BASE_URL;

        if (!this.apiKey) {
            throw new Error('KoraPay public key is not configured');
        }
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Initialize a payment transaction
     */
    async initializePayment(paymentData: PaymentRequest): Promise<PaymentResponse> {
        try {
            const reference = paymentData.reference || `BP_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

            const payload = {
                amount: paymentData.amount,
                currency: paymentData.currency || 'NGN',
                reference,
                narration: paymentData.narration || 'Belly-Chow Order Payment',
                channels: paymentData.channels || ['card', 'bank_transfer', 'ussd'],
                default_channel: paymentData.default_channel || 'card',
                customer: paymentData.customer,
                notification_url: paymentData.notification_url,
                redirect_url: paymentData.redirect_url || `${window.location.origin}/orders`,
                merchant_bears_cost: paymentData.merchant_bears_cost || false,
                metadata: {
                    ...paymentData.metadata,
                    source: 'belly-chow-web',
                    timestamp: new Date().toISOString(),
                },
            };

            const response = await axios.post(
                `${this.baseURL}/charges/initialize`,
                payload,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data ? {
                    checkout_url: response.data.data.checkout_url,
                    reference: response.data.data.reference,
                    payment_id: response.data.data.reference,
                } : undefined,
            };
        } catch (error: any) {
            console.error('KoraPay payment initialization error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Payment initialization failed',
            };
        }
    }

    /**
     * Verify a payment transaction
     */
    async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
        try {
            const response = await axios.get(
                `${this.baseURL}/charges/${reference}`,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data ? {
                    reference: response.data.data.reference,
                    amount: response.data.data.amount,
                    currency: response.data.data.currency,
                    status: response.data.data.status,
                    payment_method: response.data.data.payment_method || 'unknown',
                    paid_at: response.data.data.paid_at,
                    customer: response.data.data.customer,
                    metadata: response.data.data.metadata,
                } : undefined,
            };
        } catch (error: any) {
            console.error('KoraPay payment verification error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Payment verification failed',
            };
        }
    }

    /**
     * Process a refund
     */
    async processRefund(refundData: RefundRequest): Promise<RefundResponse> {
        try {
            const payload = {
                transaction_reference: refundData.transaction_reference,
                amount: refundData.amount,
                reason: refundData.reason,
            };

            const response = await axios.post(
                `${this.baseURL}/transactions/refund`,
                payload,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data ? {
                    transaction_reference: response.data.data.transaction_reference,
                    refund_reference: response.data.data.refund_reference,
                    amount: response.data.data.amount,
                    status: response.data.data.status,
                } : undefined,
            };
        } catch (error: any) {
            console.error('KoraPay refund error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Refund processing failed',
            };
        }
    }

    /**
     * Transfer funds to vendor account
     */
    async transferFunds(transferData: TransferRequest): Promise<TransferResponse> {
        try {
            const response = await axios.post(
                `${this.baseURL}/transactions/disburse`,
                transferData,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data ? {
                    reference: response.data.data.reference,
                    status: response.data.data.status,
                    amount: response.data.data.amount,
                    fee: response.data.data.fee || 0,
                    currency: response.data.data.currency,
                    narration: response.data.data.narration,
                } : undefined,
            };
        } catch (error: any) {
            console.error('KoraPay transfer error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Transfer failed',
            };
        }
    }

    /**
     * Get supported banks for transfers
     */
    async getSupportedBanks(country: string = 'NG'): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseURL}/misc/banks?country=${country}`,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data,
            };
        } catch (error: any) {
            console.error('KoraPay banks fetch error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Failed to fetch banks',
                data: [],
            };
        }
    }

    /**
     * Resolve bank account details
     */
    async resolveBankAccount(bankCode: string, accountNumber: string): Promise<any> {
        try {
            const response = await axios.post(
                `${this.baseURL}/misc/banks/resolve`,
                {
                    bank: bankCode,
                    account: accountNumber,
                },
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data,
            };
        } catch (error: any) {
            console.error('KoraPay account resolution error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Account resolution failed',
            };
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(reference: string): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseURL}/transactions/${reference}`,
                { headers: this.getHeaders() }
            );

            return {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data,
            };
        } catch (error: any) {
            console.error('KoraPay transaction status error:', error);
            return {
                status: false,
                message: error.response?.data?.message || 'Failed to get transaction status',
            };
        }
    }

    /**
     * Generate payment reference
     */
    generateReference(prefix: string = 'BP'): string {
        return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    }

    /**
     * Format amount for KoraPay (convert to kobo for NGN)
     */
    formatAmount(amount: number, currency: string = 'NGN'): number {
        if (currency === 'NGN') {
            return Math.round(amount * 100); // Convert to kobo
        }
        return amount;
    }

    /**
     * Parse amount from KoraPay response (convert from kobo for NGN)
     */
    parseAmount(amount: number, currency: string = 'NGN'): number {
        if (currency === 'NGN') {
            return amount / 100; // Convert from kobo
        }
        return amount;
    }
}

// Export singleton instance
export const koraPayService = new KoraPayService();
export const korapayService = koraPayService;
export default koraPayService;