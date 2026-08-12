import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const KoraPayTest = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const testKoraPayConfig = () => {
        const publicKey = import.meta.env.VITE_KORAPAY_PUBLIC_KEY;
        const environment = import.meta.env.VITE_PAYMENT_ENVIRONMENT;

        toast({
            title: "KoraPay Configuration",
            description: `Public Key: ${publicKey ? 'Set' : 'Missing'}, Environment: ${environment || 'Not set'}`,
        });
    };

    const testDirectKoraPayCall = async () => {
        if (!user) {
            toast({
                title: "Authentication required",
                description: "Please log in to test",
                variant: "destructive",
            });
            return;
        }

        setIsProcessing(true);

        try {
            const publicKey = import.meta.env.VITE_KORAPAY_PUBLIC_KEY;

            if (!publicKey) {
                throw new Error('KoraPay public key not configured');
            }

            // Test direct API call to KoraPay
            const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${publicKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: 100000, // 1000 NGN in kobo
                    currency: 'NGN',
                    reference: `TEST_${Date.now()}`,
                    narration: 'Test payment',
                    customer: {
                        name: user.user_metadata?.full_name || 'Test User',
                        email: user.email!,
                    },
                    redirect_url: window.location.origin,
                }),
            });

            const data = await response.json();

            if (response.ok && data.status) {
                toast({
                    title: "KoraPay API Test Successful!",
                    description: "API connection is working correctly",
                });
            } else {
                toast({
                    title: "KoraPay API Test Failed",
                    description: data.message || `HTTP ${response.status}`,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            console.error('KoraPay test error:', error);
            toast({
                title: "KoraPay Test Error",
                description: error.message || 'Network error',
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>KoraPay Connection Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    onClick={testKoraPayConfig}
                    variant="outline"
                    className="w-full"
                >
                    Check Configuration
                </Button>

                <Button
                    onClick={testDirectKoraPayCall}
                    disabled={isProcessing || !user}
                    className="w-full"
                >
                    {isProcessing ? 'Testing...' : 'Test KoraPay API'}
                </Button>

                {!user && (
                    <p className="text-sm text-muted-foreground text-center">
                        Please log in to test API calls
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default KoraPayTest;