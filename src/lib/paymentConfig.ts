// Payment System Configuration
// Commission rates and fee structure for the Belly-Chow payment system

export const PAYMENT_CONFIG = {
    // Fixed delivery fee structure (₦1,000 total)
    DELIVERY_FEE: 1000, // Fixed ₦1,000 delivery fee
    RIDER_SHARE: 500,   // ₦500 to rider
    PLATFORM_SHARE: 500, // ₦500 to platform

    // Vendor commission (0% - vendors keep 100% of food price)
    VENDOR_COMMISSION_RATE: 0.00, // 0% commission
    VENDOR_SHARE: 1.00, // 100% of food price

    // Kora processing fees
    KORA_FEE_RATE: 0.015, // 1.5% + ₦100 cap
    KORA_FEE_CAP: 2000, // ₦2,000 maximum fee
    KORA_FIXED_FEE: 100, // ₦100 fixed fee

    // Minimum withdrawal amounts
    MIN_WITHDRAWAL: {
        vendor: 1000, // ₦1,000 minimum for vendors
        rider: 500,   // ₦500 minimum for riders
        customer: 100, // ₦100 minimum for customers
    },

    // Payment methods
    PAYMENT_METHODS: {
        KORA_CARD: 'kora_card',
        KORA_TRANSFER: 'kora_transfer',
        KORA_USSD: 'kora_ussd',
        WALLET: 'wallet',
    },

    // Transaction statuses
    PAYMENT_STATUS: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
        REFUNDED: 'refunded',
    },

    ESCROW_STATUS: {
        HELD: 'held',
        RELEASED: 'released',
        REFUNDED: 'refunded',
    },

    SETTLEMENT_STATUS: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
    },

    WITHDRAWAL_STATUS: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        CANCELLED: 'cancelled',
    },
} as const;

// Helper functions for payment calculations
export const calculatePaymentBreakdown = (foodAmount: number) => {
    const deliveryFee = PAYMENT_CONFIG.DELIVERY_FEE;
    const totalAmount = foodAmount + deliveryFee;

    // Calculate Kora fees
    const koraFeePercent = totalAmount * PAYMENT_CONFIG.KORA_FEE_RATE;
    const koraFee = Math.min(
        koraFeePercent + PAYMENT_CONFIG.KORA_FIXED_FEE,
        PAYMENT_CONFIG.KORA_FEE_CAP
    );

    return {
        foodAmount,
        deliveryFee,
        totalAmount,
        koraFee,

        // Settlement amounts
        vendorAmount: foodAmount, // 100% of food price
        riderAmount: PAYMENT_CONFIG.RIDER_SHARE, // Fixed ₦500
        platformGross: PAYMENT_CONFIG.PLATFORM_SHARE, // Fixed ₦500
        platformNet: PAYMENT_CONFIG.PLATFORM_SHARE - koraFee, // After Kora fees
    };
};

// Validate minimum withdrawal amounts
export const validateWithdrawalAmount = (amount: number, userType: 'vendor' | 'rider' | 'customer'): boolean => {
    const minAmount = PAYMENT_CONFIG.MIN_WITHDRAWAL[userType];
    return amount >= minAmount;
};

// Format currency for display
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Get environment variables with defaults
export const getPaymentEnvVars = () => ({
    koraPublicKey: import.meta.env.VITE_KORA_PUBLIC_KEY || '',
    koraSecretKey: import.meta.env.KORA_SECRET_KEY || '',
    deliveryFee: Number(import.meta.env.VITE_DELIVERY_FEE) || PAYMENT_CONFIG.DELIVERY_FEE,
    riderShare: Number(import.meta.env.VITE_RIDER_SHARE) || PAYMENT_CONFIG.RIDER_SHARE,
    platformShare: Number(import.meta.env.VITE_PLATFORM_SHARE) || PAYMENT_CONFIG.PLATFORM_SHARE,
    minWithdrawalVendor: Number(import.meta.env.VITE_MIN_WITHDRAWAL_VENDOR) || PAYMENT_CONFIG.MIN_WITHDRAWAL.vendor,
    minWithdrawalRider: Number(import.meta.env.VITE_MIN_WITHDRAWAL_RIDER) || PAYMENT_CONFIG.MIN_WITHDRAWAL.rider,
});