import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Building2, Smartphone, Wallet, CheckCircle } from 'lucide-react';
import { PAYMENT_CONFIG, formatCurrency } from '@/lib/paymentConfig';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectorProps {
    totalAmount: number;
    walletBalance?: number;
    onPaymentMethodSelect: (method: string) => void;
    onProceedToPayment: () => void;
    isLoading?: boolean;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    totalAmount,
    walletBalance = 0,
    onPaymentMethodSelect,
    onProceedToPayment,
    isLoading = false,
}) => {
    const [selectedMethod, setSelectedMethod] = useState<string>('');

    const paymentMethods = [
        {
            id: PAYMENT_CONFIG.PAYMENT_METHODS.KORA_CARD,
            name: 'Debit/Credit Card',
            description: 'Pay with your debit or credit card',
            icon: CreditCard,
            available: true,
            recommended: true,
        },
        {
            id: PAYMENT_CONFIG.PAYMENT_METHODS.KORA_TRANSFER,
            name: 'Bank Transfer',
            description: 'Transfer from your bank account',
            icon: Building2,
            available: true,
            recommended: false,
        },
        {
            id: PAYMENT_CONFIG.PAYMENT_METHODS.KORA_USSD,
            name: 'USSD',
            description: 'Pay using USSD code on your phone',
            icon: Smartphone,
            available: true,
            recommended: false,
        },
        {
            id: PAYMENT_CONFIG.PAYMENT_METHODS.WALLET,
            name: 'Wallet Balance',
            description: `Available: ${formatCurrency(walletBalance)}`,
            icon: Wallet,
            available: walletBalance >= totalAmount,
            recommended: walletBalance >= totalAmount,
        },
    ];

    const handleMethodChange = (method: string) => {
        setSelectedMethod(method);
        onPaymentMethodSelect(method);
    };

    const canProceed = selectedMethod !== '';
    const insufficientWallet = selectedMethod === PAYMENT_CONFIG.PAYMENT_METHODS.WALLET && walletBalance < totalAmount;

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Select Payment Method</h2>
                    <p className="text-sm text-muted-foreground">
                        Choose how you'd like to pay for your order
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-muted-foreground">Total:</span>
                        <Badge variant="secondary" className="text-base font-semibold px-3 py-1">
                            {formatCurrency(totalAmount)}
                        </Badge>
                    </div>
                </div>

                {/* Payment Methods */}
                <RadioGroup value={selectedMethod} onValueChange={handleMethodChange} className="space-y-3">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const isSelected = selectedMethod === method.id;

                        return (
                            <div
                                key={method.id}
                                className={cn(
                                    "relative flex items-center space-x-4 rounded-lg border p-4 transition-all duration-200 cursor-pointer",
                                    method.available
                                        ? "hover:bg-accent/50"
                                        : "opacity-50 cursor-not-allowed",
                                    isSelected
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                        : "border-border",
                                    !method.available && "bg-muted/30"
                                )}
                                onClick={() => method.available && handleMethodChange(method.id)}
                            >
                                <RadioGroupItem
                                    value={method.id}
                                    id={method.id}
                                    disabled={!method.available}
                                    className="mt-0.5"
                                />

                                <div className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-lg",
                                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Label
                                            htmlFor={method.id}
                                            className={cn(
                                                "font-medium cursor-pointer",
                                                method.available ? "text-foreground" : "text-muted-foreground"
                                            )}
                                        >
                                            {method.name}
                                        </Label>
                                        {method.recommended && (
                                            <Badge variant="default" className="text-xs px-2 py-0.5">
                                                Recommended
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {method.description}
                                    </p>
                                    {!method.available && method.id === PAYMENT_CONFIG.PAYMENT_METHODS.WALLET && (
                                        <p className="text-sm text-destructive mt-1">
                                            Need {formatCurrency(totalAmount - walletBalance)} more
                                        </p>
                                    )}
                                </div>

                                {isSelected && (
                                    <CheckCircle className="h-5 w-5 text-primary" />
                                )}
                            </div>
                        );
                    })}
                </RadioGroup>

                {/* Insufficient Wallet Warning */}
                {insufficientWallet && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                        <p className="text-sm text-destructive">
                            Your wallet balance ({formatCurrency(walletBalance)}) is insufficient for this payment.
                            Please select another payment method or top up your wallet.
                        </p>
                    </div>
                )}

                {/* Proceed Button */}
                <Button
                    onClick={onProceedToPayment}
                    disabled={!canProceed || insufficientWallet || isLoading}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                            Processing...
                        </div>
                    ) : (
                        `Proceed to Payment • ${formatCurrency(totalAmount)}`
                    )}
                </Button>

                {/* Security Notice */}
                <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">
                        🔒 Secure payment powered by Kora
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Your payment information is encrypted and secure
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentMethodSelector;