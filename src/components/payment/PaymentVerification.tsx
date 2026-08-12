import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { paymentService } from '@/services/payment';
import {
    CheckCircle,
    XCircle,
    Loader2,
    ArrowRight,
    Receipt,
    Clock
} from 'lucide-react';

const PaymentVerification = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'failed'>('loading');
    const [paymentData, setPaymentData] = useState<any>(null);

    const reference = searchParams.get('ref');
    const status = searchParams.get('payment');

    useEffect(() => {
        if (!reference) {
            navigate('/orders');
            return;
        }

        verifyPayment();
    }, [reference]);

    const verifyPayment = async () => {
        if (!reference) return;

        try {
            setVerificationStatus('loading');

            // Add a small delay to ensure webhook has processed
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = await paymentService.verifyPayment(reference);

            if (result.success) {
                setVerificationStatus('success');
                setPaymentData(result.data);
                toast({
                    title: 'Payment successful! 🎉',
                    description: 'Your order has been confirmed and is being processed.',
                });
            } else {
                setVerificationStatus('failed');
                toast({
                    title: 'Payment verification failed',
                    description: result.message || 'Unable to verify payment status',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Payment verification error:', error);
            setVerificationStatus('failed');
            toast({
                title: 'Verification error',
                description: 'An error occurred while verifying your payment',
                variant: 'destructive',
            });
        }
    };

    const handleContinue = () => {
        navigate('/orders');
    };

    const handleRetry = () => {
        verifyPayment();
    };

    if (verificationStatus === 'loading') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center gap-4 p-8">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-semibold">Verifying Payment</h2>
                            <p className="text-muted-foreground">
                                Please wait while we confirm your payment...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (verificationStatus === 'success') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-xl text-green-600 dark:text-green-400">
                            Payment Successful!
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center space-y-2">
                            <p className="text-muted-foreground">
                                Your payment has been processed successfully and your order is confirmed.
                            </p>
                            {reference && (
                                <div className="bg-muted p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Payment Reference</p>
                                    <p className="font-mono text-sm">{reference}</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                <div>
                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        Escrow Protection Active
                                    </p>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                                        Your payment is held securely until delivery confirmation
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <div>
                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                        Order Confirmed
                                    </p>
                                    <p className="text-xs text-green-600/80 dark:text-green-400/80">
                                        You'll receive updates on your order status
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button onClick={handleContinue} className="w-full" size="lg">
                            View My Orders
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <CardTitle className="text-xl text-red-600 dark:text-red-400">
                        Payment Verification Failed
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground">
                            We couldn't verify your payment. This might be due to a network issue or the payment is still processing.
                        </p>
                        {reference && (
                            <div className="bg-muted p-3 rounded-lg">
                                <p className="text-xs text-muted-foreground">Payment Reference</p>
                                <p className="font-mono text-sm">{reference}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Button onClick={handleRetry} className="w-full" variant="outline">
                            <Loader2 className="h-4 w-4 mr-2" />
                            Retry Verification
                        </Button>
                        <Button onClick={handleContinue} className="w-full">
                            Check Order Status
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>

                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                            If you continue to experience issues, please contact support with your payment reference.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PaymentVerification;