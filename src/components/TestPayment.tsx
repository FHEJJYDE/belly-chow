import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { paymentService } from '@/services/payment';
import { koraPayService } from '@/services/korapay';
import { mockPaymentService } from '@/services/mockPayment';
import { supabase } from '@/integrations/supabase/client';

const TestPayment = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [amount, setAmount] = useState('1000');
    const [isProcessing, setIsProcessing] = useState(false);
    const [testReference, setTestReference] = useState('');

    const handleTestPayment = async () => {
        if (!user) {
            toast({
                title: "Authentication required",
                description: "Please log in to test payments",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            // First, let's check if we have any vendors in the database
            const { data: vendors, error: vendorError } = await supabase
                .from('vendors')
                .select('id')
                .limit(1);

            if (vendorError) {
                throw new Error(`Vendor check failed: ${vendorError.message}`);
            }

            if (!vendors || vendors.length === 0) {
                toast({
                    title: "No vendors found",
                    description: "Please create a vendor first or use the KoraPay Direct test",
                    variant: "destructive",
                });
                return;
            }

            // Create a test order first
            const { data: testOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    student_id: user.id, // Use student_id instead of customer_id
                    vendor_id: vendors[0].id,
                    total: parseFloat(amount),
                    delivery_fee: 0,
                    delivery_location: 'Test Location',
                    notes: 'Test order for payment testing',
                    status: 'pending',
                    payment_status: 'pending',
                })
                .select()
                .single();

            if (orderError) {
                throw new Error(`Order creation failed: ${orderError.message}`);
            }

            const paymentRequest = {
                orderId: testOrder.id,
                userId: user.id,
                vendorId: vendors[0].id,
                amount: parseFloat(amount),
                currency: 'NGN',
                customerInfo: {
                    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Test Customer',
                    email: user.email!,
                    phone: user.user_metadata?.phone || '08012345678',
                },
                metadata: {
                    test_payment: true,
                    description: 'Test payment from Belly-Chow',
                },
            };

            const result = await paymentService.createPayment(paymentRequest);

            if (result.success && result.data) {
                toast({
                    title: "Payment initialized!",
                    description: `Reference: ${result.data.reference}`,
                });

                setTestReference(result.data.reference);

                // Open payment URL in new tab for testing
                window.open(result.data.paymentUrl, '_blank');
            } else {
                toast({
                    title: "Payment initialization failed",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('Test payment error:', error);
            toast({
                title: "Test payment error",
                description: error.message || 'An unexpected error occurred',
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVerifyPayment = async () => {
        if (!testReference) {
            toast({
                title: "No reference",
                description: "Please create a test payment first",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            const result = await paymentService.verifyPayment(testReference);

            toast({
                title: result.success ? "Payment verified!" : "Payment verification failed",
                description: result.message,
                variant: result.success ? "default" : "destructive",
            });
        } catch (error: any) {
            console.error('Payment verification error:', error);
            toast({
                title: "Verification error",
                description: error.message || 'An unexpected error occurred',
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTestKoraPayDirect = async () => {
        if (!user) {
            toast({
                title: "Authentication required",
                description: "Please log in to test payments",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            const reference = mockPaymentService.generateReference('TEST');

            const paymentData = {
                amount: parseFloat(amount),
                currency: 'NGN',
                reference,
                customer: {
                    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Test Customer',
                    email: user.email!,
                },
                redirect_url: `${window.location.origin}/test-payment?ref=${reference}`,
            };

            const result = await mockPaymentService.initializePayment(paymentData);

            if (result.status && result.data) {
                toast({
                    title: "Mock payment initialized!",
                    description: `Reference: ${result.data.reference}`,
                });

                setTestReference(result.data.reference);

                // Open mock checkout in same tab
                window.location.href = result.data.checkout_url;
            } else {
                toast({
                    title: "Mock payment failed",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('Mock payment error:', error);
            toast({
                title: "Mock payment error",
                description: error.message || 'An unexpected error occurred',
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Test Payment System</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="amount">Amount (NGN)</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                        />
                    </div>

                    <div className="space-y-2">
                        <Button
                            onClick={handleTestPayment}
                            disabled={isProcessing || !user}
                            className="w-full"
                        >
                            {isProcessing ? 'Processing...' : 'Test Full Payment Flow'}
                        </Button>

                        <Button
                            onClick={handleTestKoraPayDirect}
                            disabled={isProcessing || !user}
                            variant="outline"
                            className="w-full"
                        >
                            {isProcessing ? 'Processing...' : 'Test Mock Payment (No API Key Needed)'}
                        </Button>

                        {testReference && (
                            <Button
                                onClick={handleVerifyPayment}
                                disabled={isProcessing}
                                variant="secondary"
                                className="w-full"
                            >
                                {isProcessing ? 'Verifying...' : 'Verify Last Payment'}
                            </Button>
                        )}
                    </div>

                    {testReference && (
                        <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium">Last Reference:</p>
                            <p className="text-xs text-muted-foreground break-all">{testReference}</p>
                        </div>
                    )}

                    {!user && (
                        <p className="text-sm text-muted-foreground text-center">
                            Please log in to test payments
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TestPayment;