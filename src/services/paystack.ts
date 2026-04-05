import { getPaymentEnvVars } from '@/lib/paymentConfig';

interface PaystackConfig {
    publicKey: string;
    secretKey: string;
    baseUrl: string;
}

interface PaymentInitializationData {
    email: string;
    amount: number; // Amount in kobo (multiply by 100)
    reference: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
}

interface PaymentVerificationResponse {
    status: boolean;
    message: string;
    data: {
        id: number;
        domain: string;
        status: 'success' | 'failed' | 'abandoned';
        reference: string;
        amount: number;
        message: string | null;
        gateway_response: string;
        paid_at: string;
        created_at: string;
        channel: string;
        currency: string;
        ip_address: string;
        metadata: Record<string, any>;
        fees: number;
        customer: {
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
        };
        authorization: {
            authorization_code: string;
            bin: string;
            last4: string;
            exp_month: string;
            exp_year: string;
            channel: string;
            card_type: string;
            bank: string;
            country_code: string;
            brand: string;
        };
    };
}

interface TransferRecipient {
    type: 'nuban';
    name: string;
    account_number: string;
    bank_code: string;
    currency: 'NGN';
}

interface TransferData {
    source: 'balance';
    amount: number; // Amount in kobo
    recipient: string; // Recipient code
    reason: string;
    reference: string;
}

class PaystackService {
    private config: PaystackConfig;

    constructor() {
        const envVars = getPaymentEnvVars();
        this.config = {
            publicKey: envVars.paystackPublicKey,
            secretKey: envVars.paystackSecretKey,
            baseUrl: 'https://api.paystack.co'
        };

        if (!this.config.publicKey || !this.config.secretKey) {
            console.warn('Paystack keys not configured properly');
        }
    }

    /**
     * Initialize a payment transaction
     */
    async initializePayment(data: PaymentInitializationData) {
        try {
            const response = await fetch(`${this.config.baseUrl}/transaction/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...data,
                    amount: Math.round(data.amount * 100), // Convert to kobo
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Payment initialization failed');
            }

            return {
                success: true,
                data: {
                    authorization_url: result.data.authorization_url,
                    access_code: result.data.access_code,
                    reference: result.data.reference,
                },
            };
        } catch (error) {
            console.error('Paystack initialization error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Payment initialization failed',
            };
        }
    }

    /**
     * Verify a payment transaction
     */
    async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
        try {
            const response = await fetch(`${this.config.baseUrl}/transaction/verify/${reference}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Payment verification failed');
            }

            return result;
        } catch (error) {
            console.error('Paystack verification error:', error);
            throw error;
        }
    }

    /**
     * Create a transfer recipient
     */
    async createTransferRecipient(recipientData: TransferRecipient) {
        try {
            const response = await fetch(`${this.config.baseUrl}/transferrecipient`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(recipientData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create transfer recipient');
            }

            return {
                success: true,
                data: {
                    recipient_code: result.data.recipient_code,
                    id: result.data.id,
                },
            };
        } catch (error) {
            console.error('Paystack create recipient error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create transfer recipient',
            };
        }
    }

    /**
     * Initiate a transfer
     */
    async initiateTransfer(transferData: TransferData) {
        try {
            const response = await fetch(`${this.config.baseUrl}/transfer`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...transferData,
                    amount: Math.round(transferData.amount * 100), // Convert to kobo
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Transfer initiation failed');
            }

            return {
                success: true,
                data: {
                    transfer_code: result.data.transfer_code,
                    id: result.data.id,
                    status: result.data.status,
                },
            };
        } catch (error) {
            console.error('Paystack transfer error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Transfer initiation failed',
            };
        }
    }

    /**
     * Verify bank account details
     */
    async verifyBankAccount(accountNumber: string, bankCode: string) {
        try {
            const response = await fetch(
                `${this.config.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Bank account verification failed');
            }

            return {
                success: true,
                data: {
                    account_name: result.data.account_name,
                    account_number: result.data.account_number,
                },
            };
        } catch (error) {
            console.error('Paystack bank verification error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Bank account verification failed',
            };
        }
    }

    /**
     * Get list of supported banks
     */
    async getBanks() {
        try {
            const response = await fetch(`${this.config.baseUrl}/bank`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch banks');
            }

            return {
                success: true,
                data: result.data.map((bank: any) => ({
                    name: bank.name,
                    code: bank.code,
                    slug: bank.slug,
                })),
            };
        } catch (error) {
            console.error('Paystack banks error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch banks',
            };
        }
    }

    /**
     * Generate payment reference
     */
    generateReference(prefix: string = 'BC'): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Convert amount to kobo (Paystack uses kobo)
     */
    toKobo(amount: number): number {
        return Math.round(amount * 100);
    }

    /**
     * Convert amount from kobo to naira
     */
    fromKobo(amount: number): number {
        return amount / 100;
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number): string {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2,
        }).format(amount);
    }

    /**
     * Calculate Paystack fees (1.5% + ₦100 cap at ₦2000)
     */
    calculatePaystackFees(amount: number): number {
        const percentage = amount * 0.015; // 1.5%
        const withCap = Math.min(percentage + 100, 2000); // Add ₦100, cap at ₦2000
        return Math.round(withCap);
    }

    /**
     * Get public key for frontend integration
     */
    getPublicKey(): string {
        return this.config.publicKey;
    }
}

// Export singleton instance
export const paystackService = new PaystackService();

// Export types for use in other files
export type {
    PaymentInitializationData,
    PaymentVerificationResponse,
    TransferRecipient,
    TransferData,
};