// Mock Payment Service for Testing
// This simulates KoraPay without needing valid API keys

export interface MockPaymentRequest {
    amount: number;
    currency: string;
    reference: string;
    customer: {
        name: string;
        email: string;
    };
    redirect_url: string;
}

export interface MockPaymentResponse {
    status: boolean;
    message: string;
    data?: {
        checkout_url: string;
        reference: string;
        payment_id: string;
    };
}

class MockPaymentService {
    /**
     * Simulate payment initialization
     */
    async initializePayment(request: MockPaymentRequest): Promise<MockPaymentResponse> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate mock checkout URL
        const mockCheckoutUrl = `${window.location.origin}/mock-checkout?ref=${request.reference}&amount=${request.amount}`;

        return {
            status: true,
            message: 'Payment initialized successfully (MOCK)',
            data: {
                checkout_url: mockCheckoutUrl,
                reference: request.reference,
                payment_id: `mock_${Date.now()}`,
            },
        };
    }

    /**
     * Simulate payment verification
     */
    async verifyPayment(reference: string): Promise<MockPaymentResponse> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            status: true,
            message: 'Payment verified successfully (MOCK)',
            data: {
                checkout_url: '',
                reference: reference,
                payment_id: `mock_${Date.now()}`,
            },
        };
    }

    /**
     * Generate payment reference
     */
    generateReference(prefix: string = 'MOCK'): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    /**
     * Format amount (convert to kobo for NGN)
     */
    formatAmount(amount: number, currency: string = 'NGN'): number {
        if (currency === 'NGN') {
            return Math.round(amount * 100);
        }
        return amount;
    }
}

export const mockPaymentService = new MockPaymentService();
export default mockPaymentService;