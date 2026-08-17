import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, CreditCard } from 'lucide-react';

const MockCheckout = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');

    const reference = searchParams.get('ref') || '';
    const amount = searchParams.get('amount') || '0';

    useEffect(() => {
        // Clear cart storage on checkout load
        localStorage.removeItem('belly_chow_cart_items');
        localStorage.removeItem('belly_chow_cart_vendor_id');

        // Auto-redirect after successful payment
        if (status === 'success') {
            setTimeout(() => {
                navigate(`/orders?payment=success&ref=${reference}`);
            }, 2000);
        }
    }, [status, reference, navigate]);

    const handlePayment = async (success: boolean) => {
        setProcessing(true);

        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        setStatus(success ? 'success' : 'failed');
        setProcessing(false);
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h2>
                        <p className="text-muted-foreground mb-4">
                            Your payment of ₦{parseFloat(amount).toLocaleString()} has been processed.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Redirecting to orders...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h2>
                        <p className="text-muted-foreground mb-4">
                            Your payment could not be processed.
                        </p>
                        <Button onClick={() => navigate('/cart')} className="w-full">
                            Return to Cart
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Mock Payment Checkout
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Amount to Pay</p>
                        <p className="text-3xl font-bold text-foreground">
                            ₦{parseFloat(amount).toLocaleString()}
                        </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Test Mode:</strong> This is a mock payment page for testing.
                            No real payment will be processed.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Reference:</p>
                        <p className="text-xs text-muted-foreground break-all bg-muted p-2 rounded">
                            {reference}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Button
                            onClick={() => handlePayment(true)}
                            disabled={processing}
                            className="w-full bg-green-600 hover:bg-green-700"
                        >
                            {processing ? 'Processing...' : 'Simulate Successful Payment'}
                        </Button>

                        <Button
                            onClick={() => handlePayment(false)}
                            disabled={processing}
                            variant="destructive"
                            className="w-full"
                        >
                            {processing ? 'Processing...' : 'Simulate Failed Payment'}
                        </Button>

                        <Button
                            onClick={() => navigate('/cart')}
                            disabled={processing}
                            variant="outline"
                            className="w-full"
                        >
                            Cancel
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default MockCheckout;