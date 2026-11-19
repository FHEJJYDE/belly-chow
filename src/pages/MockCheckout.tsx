import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, CreditCard, ShieldCheck } from 'lucide-react';

const MockCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  const reference = searchParams.get('ref') || '';
  const amount = searchParams.get('amount') || '0';
  const orderId = searchParams.get('orderId') || '';

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate(`/orders?payment=success&ref=${reference}`, { replace: true });
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [status, reference, navigate]);

  const handlePayment = async (success: boolean) => {
    setProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (success) {
        // Update order payment status in database so vendor & rider see confirmed payment
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'confirmed' as any,
              payment_reference: reference,
            } as any)
            .eq('id', orderId);
        } else if (reference) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'confirmed' as any,
            } as any)
            .eq('payment_reference', reference);
        }

        // Only clear cart after payment succeeds!
        clearCart();
        setStatus('success');
      } else {
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed' as any,
            } as any)
            .eq('id', orderId);
        }
        setStatus('failed');
      }
    } catch (err) {
      console.error('Mock checkout update error:', err);
      setStatus(success ? 'success' : 'failed');
    } finally {
      setProcessing(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-emerald-500/30 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Confirmed! 🎉</h2>
            <p className="text-muted-foreground mb-4">
              Your payment of{' '}
              <span className="font-bold text-foreground">
                ₦{parseFloat(amount).toLocaleString()}
              </span>{' '}
              has been verified and your order is now with the vendor.
            </p>
            <p className="text-xs text-muted-foreground">Redirecting to live order tracker...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/30 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Payment Declined</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Your simulated payment did not complete. Your cart items are still saved so you can try again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStatus('pending')} className="flex-1">
                Try Again
              </Button>
              <Button onClick={() => navigate('/cart')} className="flex-1">
                Return to Cart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-primary/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Belly-Chow Sandbox Checkout
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Test Mode
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="bg-muted/60 p-4 rounded-xl text-center border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Total Amount Payable
            </p>
            <p className="text-3xl font-extrabold text-primary">
              ₦{parseFloat(amount).toLocaleString()}
            </p>
          </div>

          <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Sandbox Gateway:</strong> Simulate an instant payment response below while live KoraPay merchant verification is pending.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Transaction Reference:</p>
            <p className="text-xs font-mono text-foreground break-all bg-muted p-2 rounded-lg border">
              {reference}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              onClick={() => handlePayment(true)}
              disabled={processing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
            >
              {processing ? 'Verifying Transaction...' : '✓ Simulate Successful Payment'}
            </Button>

            <Button
              onClick={() => handlePayment(false)}
              disabled={processing}
              variant="destructive"
              className="w-full h-10"
            >
              {processing ? 'Processing...' : '✕ Simulate Failed Payment'}
            </Button>

            <Button
              onClick={() => navigate('/cart')}
              disabled={processing}
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
            >
              Cancel & Return to Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MockCheckout;
