import React, { useState } from 'react';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import WalletBalance from '@/components/wallet/WalletBalance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

const PaymentUITest: React.FC = () => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);

    const handlePaymentMethodSelect = (method: string) => {
        setSelectedMethod(method);
        console.log('Selected payment method:', method);
    };

    const handleProceedToPayment = () => {
        console.log('Proceeding to payment with method:', selectedMethod);
        alert(`Payment method selected: ${selectedMethod}`);
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="container max-w-2xl mx-auto space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment UI Components Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Wallet Balance Component</h3>
                            <WalletBalance compact={true} showActions={false} />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Full Wallet Component</h3>
                            <WalletBalance showActions={true} />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Payment Method Selector</h3>
                            <Button
                                onClick={() => setShowPaymentSelector(true)}
                                className="w-full"
                            >
                                Show Payment Method Selector
                            </Button>
                        </div>

                        {showPaymentSelector && (
                            <div className="border rounded-lg p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-semibold">Payment Method Selector</h4>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowPaymentSelector(false)}
                                    >
                                        Close
                                    </Button>
                                </div>
                                <PaymentMethodSelector
                                    totalAmount={5000}
                                    walletBalance={2500}
                                    onPaymentMethodSelect={handlePaymentMethodSelect}
                                    onProceedToPayment={handleProceedToPayment}
                                    isLoading={false}
                                />
                            </div>
                        )}

                        <div className="text-sm text-gray-600">
                            <p>Selected Method: {selectedMethod || 'None'}</p>
                            <p>This page tests the payment UI components to ensure they're working correctly.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PaymentUITest;