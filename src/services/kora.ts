import { getPaymentEnvVars } from '@/lib/paymentConfig';

interface KoraConfig {
    publicKey: string;
    secretKey: string;
    baseUrl: string;
}

interface PaymentInitializationData {
    email: string;
    amount: number; // Amount in naira
    reference: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
}

interface PaymentVerificationResponse {
    status: boolean;
    message: string;
    data: {
        id: string;
        status: 'success' | 'failed' | 'abandoned';
        reference: string;
        amount: number;
        message: string | null;
        gateway_response: string;
        paid_at: string;
        created_at: string;
        channel: string;
        currency: string;
        fees: number;
        customer: {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            phone: string;
        };
    };
}

interface TransferRecipient {
    type: 'bank_account';
    name: string;
    account_number: string;
    bank_code: string;
    currency: 'NGN';
}

interface TransferData {
    amount: number; // Amount in naira
    recipient: string; // Recipient code
    reason: string;
    reference: string;
}

class KoraService {
    private config: KoraConfig;

    constructor() {
        const envVars = getPaymentEnvVars();
        this.config = {
            publicKey: envVars.koraPublicKey,
            secretKey: envVars.koraSecretKey,
            baseUrl: 'https://api.korapay.com/merchant/api/v1'
        };

        if (!this.config.publicKey || !this.config.secretKey) {
            console.warn('Kora keys not configured properly');
        }
    }

    /**
     * Initialize a payment transaction
     */
    async initializePayment(data: PaymentInitializationData) {
        try {
            const response = await fetch(`${this.config.baseUrl}/charges/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: data.amount,
                    currency: 'NGN',
                    reference: data.reference,
                    customer: {
                        email: data.email,
                    },
                    redirect_url: data.callback_url,
                    metadata: data.metadata,
                    channels: data.channels || ['card', 'bank_transfer', 'ussd'],
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || 'Payment initialization failed');
            }

            return {
                success: true,
                data: {
                    authorization_url: result.data.checkout_url,
                    access_code: result.data.reference,
                    reference: result.data.reference,
                },
            };
        } catch (error) {
            console.error('Kora initialization error:', error);
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
            const response = await fetch(`${this.config.baseUrl}/charges/${reference}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || 'Payment verification failed');
            }

            return {
                status: true,
                message: result.message,
                data: {
                    id: result.data.reference,
                    status: result.data.status === 'success' ? 'success' : 'failed',
                    reference: result.data.reference,
                    amount: result.data.amount,
                    message: result.data.description,
                    gateway_response: result.data.gateway_response || '',
                    paid_at: result.data.paid_at || result.data.created_at,
                    created_at: result.data.created_at,
                    channel: result.data.channel || 'card',
                    currency: result.data.currency,
                    fees: result.data.fee || 0,
                    customer: {
                        id: result.data.customer?.customer_id || '',
                        first_name: result.data.customer?.name?.split(' ')[0] || '',
                        last_name: result.data.customer?.name?.split(' ').slice(1).join(' ') || '',
                        email: result.data.customer?.email || '',
                        phone: result.data.customer?.phone || '',
                    },
                },
            };
        } catch (error) {
            console.error('Kora verification error:', error);
            throw error;
        }
    }

    /**
     * Create a transfer recipient
     */
    async createTransferRecipient(recipientData: TransferRecipient) {
        try {
            const response = await fetch(`${this.config.baseUrl}/transfers/recipients`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: recipientData.name,
                    account_number: recipientData.account_number,
                    bank_code: recipientData.bank_code,
                    currency: recipientData.currency,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
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
            console.error('Kora create recipient error:', error);
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
            const response = await fetch(`${this.config.baseUrl}/transfers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reference: transferData.reference,
                    destination: {
                        type: 'bank_account',
                        amount: transferData.amount,
                        currency: 'NGN',
                        narration: transferData.reason,
                        bank_account: {
                            bank: transferData.recipient,
                        },
                    },
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || 'Transfer initiation failed');
            }

            return {
                success: true,
                data: {
                    transfer_code: result.data.reference,
                    id: result.data.id,
                    status: result.data.status,
                },
            };
        } catch (error) {
            console.error('Kora transfer error:', error);
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
                `${this.config.baseUrl}/misc/banks/resolve?bank=${bankCode}&account=${accountNumber}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.config.secretKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const result = await response.json();

            if (!response.ok || !result.status) {
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
            console.error('Kora bank verification error:', error);
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
            const response = await fetch(`${this.config.baseUrl}/misc/banks`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.secretKey}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
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
            console.error('Kora banks error:', error);
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
     * Calculate Kora fees (1.5% + ₦100 cap at ₦2000)
     */
    calculateKoraFees(amount: number): number {
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
export const koraService = new KoraService();

// Export types for use in other files
export type {
    PaymentInitializationData,
    PaymentVerificationResponse,
    TransferRecipient,
    TransferData,
};