import { useState } from 'react';
import { paymentService, type OrderPaymentData } from '@/services/payment';
import { walletService } from '@/services/wallet';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const usePayment = () => {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number>(0);

    const initializePayment = async (orderData: OrderPaymentData) => {
        if (!user) {
            toast.error('Please log in to continue');
            return { success: false, error: 'User not authenticated' };
        }

        setIsProcessing(true);
        try {
            const result = await paymentService.initializeOrderPayment(orderData);

            if (result.success && result.paymentUrl) {
                // Redirect to Paystack payment page
                window.location.href = result.paymentUrl;
                return result;
            } else {
                toast.error(result.error || 'Payment initialization failed');
                return result;
            }
        } catch (error) {
            console.error('Payment initialization error:', error);
            toast.error('Payment initialization failed');
            return { success: false, error: 'Payment initialization failed' };
        } finally {
            setIsProcessing(false);
        }
    };

    const verifyPayment = async (reference: string) => {
        setIsProcessing(true);
        try {
            const result = await paymentService.verifyPayment(reference);

            if (result.success) {
                toast.success('Payment successful!');
                return result;
            } else {
                toast.error(result.error || 'Payment verification failed');
                return result;
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
            return { success: false, error: 'Payment verification failed' };
        } finally {
            setIsProcessing(false);
        }
    };

    const loadWalletBalance = async () => {
        if (!user?.id) return;

        try {
            const balance = await walletService.getWalletBalance(user.id);
            setWalletBalance(balance?.balance || 0);
        } catch (error) {
            console.error('Error loading wallet balance:', error);
        }
    };

    const calculateOrderTotals = (foodAmount: number) => {
        return paymentService.calculateOrderTotals(foodAmount);
    };

    const canPayForOrder = async (orderId: string) => {
        if (!user?.id) return { canPay: false, reason: 'User not authenticated' };

        return await paymentService.canPayForOrder(orderId, user.id);
    };

    return {
        initializePayment,
        verifyPayment,
        loadWalletBalance,
        calculateOrderTotals,
        canPayForOrder,
        isProcessing,
        walletBalance,
    };
};

export default usePayment;