import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { mockPaymentService } from '@/services/mockPayment';
import { useAuth } from '@/contexts/AuthContext';
import {
    CreditCard,
    Building2,
    Smartphone,
    Shield,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';

interface PaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: {
        id: string;
        total: number;
        delivery_fee: number;
        vendor_id: string;
        items: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
    };
    onPaymentSuccess: (reference: string) => void;
}

const PaymentModal = ({ open, onOpenChange, order, onPaymentSuccess }: PaymentModalProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<string>('card');

    const totalAmount = order.total + order.delivery_fee;
    const currency = import.meta.env.VITE_PAYMENT_CURRENCY || 'NGN';
    const escrowHours = import.meta.env.VITE_ESCROW_RELEASE_DELAY_HOURS || '24';

    const paymentMethods = [
        {
            id: 'card',
            name: 'Debit/Credit Card',
            icon: CreditCard,
            description: 'Pay with your Visa, Mastercard, or Verve card',
            recommended: true,
        },
        {
            id: 'bank_transfer',
            name: 'Bank Transfer',
            icon: Building2,
            description: 'Direct transfer from your bank account',
            recommended: false,
        },
        {
            id: 'ussd',
            name: 'USSD',
            icon: Smartphone,
            description: 'Pay using your mobile phone USSD code',
            recommended: false,
        },
    ];

    const handlePayment = async () => {
        if (!user) {
            toast({
                title: 'Authentication required',
                description: 'Please log in to make a payment',
                variant: 'destructive',
            });
            return;
        }

        setIsProcessing(true);

        try {
            const reference = mockPaymentService.generateReference('ORDER');

            const paymentRequest = {
                amount: totalAmount,
                currency,
                reference,
                customer: {
                    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
                    email: user.email!,
                },
                redirect_url: `${window.location.origin}/orders?payment=success&ref=${reference}`,
            };

            const result = await mockPaymentService.initializePayment(paymentRequest);

            if (result.status && result.data) {
                // Redirect to mock checkout
                window.location.href = result.data.checkout_url;
            } else {
                toast({
                    title: 'Payment initialization failed',
                    description: result.message || 'Unable to initialize payment',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Payment error:', error);
            toast({
                title: 'Payment error',
                description: error.message || 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-500" />
                        Secure Payment
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Order Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>₦{order.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Delivery Fee</span>
                                <span>₦{order.delivery_fee.toLocaleString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>₦{totalAmount.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Methods */}
                    <div className="space-y-3">
                        <h3 className="font-medium text-sm">Select Payment Method</h3>
                        {paymentMethods.map((method) => (
                            <Card
                                key={method.id}
                                className={`cursor-pointer transition-all ${selectedMethod === method.id
                                    ? 'ring-2 ring-primary border-primary'
                                    : 'hover:border-primary/50'
                                    }`}
                                onClick={() => setSelectedMethod(method.id)}
                            >
                                <CardContent className="flex items-center gap-3 p-3">
                                    <method.icon className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{method.name}</span>
                                            {method.recommended && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Recommended
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{method.description}</p>
                                    </div>
                                    <div className={`h-4 w-4 rounded-full border-2 ${selectedMethod === method.id
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground'
                                        }`}>
                                        {selectedMethod === method.id && (
                                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Security Notice */}
                    <Card className="bg-muted/50">
                        <CardContent className="flex items-start gap-3 p-3">
                            <Shield className="h-4 w-4 text-green-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-medium">Secure Escrow Protection</p>
                                <p className="text-xs text-muted-foreground">
                                    Your payment is held securely for {escrowHours} hours until order delivery is confirmed.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Features */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>SSL Encrypted</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>PCI Compliant</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3 w-3 text-blue-500" />
                            <span>Escrow Protected</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <AlertCircle className="h-3 w-3 text-orange-500" />
                            <span>Refund Available</span>
                        </div>
                    </div>

                    {/* Payment Button */}
                    <Button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full"
                        size="lg"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Shield className="h-4 w-4 mr-2" />
                                Pay ₦{totalAmount.toLocaleString()} Securely
                            </>
                        )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                        By proceeding, you agree to our terms and conditions.
                        Test Mode - No real payment will be processed.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PaymentModal;