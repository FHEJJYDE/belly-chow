import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import WalletBalance from '@/components/wallet/WalletBalance';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Tag, X, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { walletService } from '@/services/wallet';
import { paymentService } from '@/services/payment';
import { PAYMENT_CONFIG } from '@/lib/paymentConfig';
import DrinkUpsellModal, { SelectedDrink, CustomDrinkRequest } from '@/components/DrinkUpsellModal';

const Cart = () => {
  const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
  const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const [showDrinkUpsell, setShowDrinkUpsell] = useState(false);
  const [drinkUpsellShown, setDrinkUpsellShown] = useState(false);
  const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
  const [customDrinkRequest, setCustomDrinkRequest] = useState<CustomDrinkRequest | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);

  const deliveryFee = PAYMENT_CONFIG.DELIVERY_FEE;
  const serviceFee = deliveryFee;

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_amount: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const discount = appliedPromo?.discount_amount || 0;
  const drinkTotal = selectedDrinks.reduce((s, d) => s + d.price * d.quantity, 0);
  const grandTotal = Math.max(0, total + serviceFee + drinkTotal - discount);

  useEffect(() => {
    // Load saved default location and wallet balance
    if (user) {
      supabase.from('profiles').select('default_lat, default_lng, default_location_name').eq('user_id', user.id).single()
        .then(({ data }) => {
          const d = data as any;
          if (d?.default_lat && d?.default_lng) {
            setDefaultLocation({ lat: d.default_lat, lng: d.default_lng, name: d.default_location_name || 'Saved Location' });
          }
        });

      // Load wallet balance
      walletService.getWalletBalance(user.id)
        .then(balance => setWalletBalance(balance.balance))
        .catch(console.error);
    }
  }, [user]);

  // Show drink upsell once when cart page loads
  useEffect(() => {
    if (items.length > 0 && !drinkUpsellShown) {
      const timer = setTimeout(() => setShowDrinkUpsell(true), 500);
      return () => clearTimeout(timer);
    }
  }, [items.length, drinkUpsellShown]);

  const handleDrinkConfirm = (drinks: SelectedDrink[], customReq: CustomDrinkRequest | null) => {
    setSelectedDrinks(drinks);
    setCustomDrinkRequest(customReq);
    setShowDrinkUpsell(false);
    setDrinkUpsellShown(true);
  };

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method);
  };

  const handleProceedToPayment = async () => {
    if (!user || !vendorId || items.length === 0) return;
    if (!position && !usingDefault && !deliveryLocation.trim()) {
      toast({ title: 'Please share GPS or enter delivery address', variant: 'destructive' });
      return;
    }

    setIsOrdering(true);
    try {
      const useLat = position?.lat ?? (usingDefault && defaultLocation ? defaultLocation.lat : undefined);
      const useLng = position?.lng ?? (usingDefault && defaultLocation ? defaultLocation.lng : undefined);
      const locLabel = deliveryLocation || (position ? 'GPS Location' : usingDefault && defaultLocation ? defaultLocation.name : '');

      // Create order first
      const orderData: any = {
        student_id: user.id,
        vendor_id: vendorId,
        total,
        delivery_fee: serviceFee,
        discount,
        promo_code: appliedPromo?.code || null,
        delivery_location: locLabel,
        notes,
        drink_items: selectedDrinks.length > 0 ? selectedDrinks : [],
        custom_drink_request: customDrinkRequest || null,
        status: 'pending_payment',
      };

      if (useLat && useLng) {
        orderData.delivery_lat = useLat;
        orderData.delivery_lng = useLng;
      }

      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
      if (orderError) throw orderError;

      // Add order items
      const orderItems = items.map(i => ({
        order_id: order.id,
        menu_item_id: i.menuItem.id,
        quantity: i.quantity,
        price: i.menuItem.price
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Process payment based on selected method
      if (selectedPaymentMethod === PAYMENT_CONFIG.PAYMENT_METHODS.WALLET) {
        // Wallet payment
        await paymentService.processWalletPayment(order.id, user.id, grandTotal);
        toast({ title: 'Payment successful', description: 'Order paid with wallet balance' });
      } else {
        // Paystack payment - initialize payment
        const paymentData = await paymentService.initializePayment({
          orderId: order.id,
          customerId: user.id,
          totalAmount: grandTotal,
          foodAmount: total + drinkTotal,
          deliveryFee: serviceFee,
          paymentMethod: selectedPaymentMethod,
          customerEmail: user.email || '',
        });

        // Redirect to Paystack checkout
        if (paymentData.authorization_url) {
          window.location.href = paymentData.authorization_url;
          return;
        }
      }

      // Update promo code usage
      if (appliedPromo) {
        try {
          await supabase.from('promo_codes')
            .update({ used_count: supabase.sql`used_count + 1` })
            .eq('code', appliedPromo.code);
        } catch (error) {
          console.error('Failed to update promo usage:', error);
        }
      }

      clearCart();
      navigate('/orders');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsOrdering(false);
    }
  };

  const handleCheckout = () => {
    if (!position && !usingDefault && !deliveryLocation.trim()) {
      toast({ title: 'Please share GPS or enter delivery address', variant: 'destructive' });
      return;
    }
    setShowPaymentSelector(true);
  };

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    const { data, error } = await supabase.from('promo_codes').select('*').eq('code', promoInput.trim().toUpperCase()).eq('is_active', true).single();
    if (error || !data) { toast({ title: 'Invalid promo code', variant: 'destructive' }); setPromoLoading(false); return; }
    const promo = data as any;
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) { toast({ title: 'This promo code has been fully used', variant: 'destructive' }); setPromoLoading(false); return; }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) { toast({ title: 'This promo code has expired', variant: 'destructive' }); setPromoLoading(false); return; }
    if (total < Number(promo.min_order)) { toast({ title: `Minimum order of ₦${Number(promo.min_order).toLocaleString()} required`, variant: 'destructive' }); setPromoLoading(false); return; }
    setAppliedPromo({ code: promo.code, discount_amount: Number(promo.discount_amount) });
    toast({ title: `Promo applied — ₦${Number(promo.discount_amount).toLocaleString()} off` });
    setPromoLoading(false);
  };

  const removePromo = () => { setAppliedPromo(null); setPromoInput(''); };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container flex flex-col items-center py-20">
          <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h1 className="font-heading text-xl font-bold">Your cart is empty</h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse vendors and add some food</p>
          <Button className="mt-6" variant="outline" onClick={() => navigate('/dashboard')}>Browse vendors</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppNavbar />
      <div className="container max-w-2xl py-8">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Checkout</p>
        <h1 className="mt-1 mb-8 font-heading text-2xl font-bold tracking-tight">Your cart</h1>

        {/* Items */}
        <div className="space-y-2 mb-8">
          {items.map(({ menuItem, quantity }) => (
            <div key={menuItem.id} className="flex items-center justify-between border-b pb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{menuItem.name}</h3>
                <p className="text-sm text-muted-foreground">₦{Number(menuItem.price).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(menuItem.id, quantity - 1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(menuItem.id, quantity + 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(menuItem.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Drinks Summary */}
        {(selectedDrinks.length > 0 || customDrinkRequest) && (
          <div className="mb-8 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">🥤 Drinks added</p>
              <button onClick={() => { setShowDrinkUpsell(true); setDrinkUpsellShown(false); }} className="text-xs text-primary hover:underline">Change</button>
            </div>
            {selectedDrinks.map(d => (
              <div key={d.id} className="flex justify-between text-sm border-b pb-2">
                <span>{d.name} × {d.quantity}</span>
                <span>₦{(d.price * d.quantity).toLocaleString()}</span>
              </div>
            ))}
            {customDrinkRequest && (
              <div className="text-sm rounded-lg bg-muted/50 p-2">
                <span className="text-muted-foreground">Custom request:</span> {customDrinkRequest.name}
                {customDrinkRequest.max_budget > 0 && <span className="text-muted-foreground"> (budget: ₦{customDrinkRequest.max_budget.toLocaleString()})</span>}
              </div>
            )}
          </div>
        )}

        {/* Wallet Balance Display */}
        <div className="mb-6">
          <WalletBalance compact={true} showActions={false} />
        </div>

        {/* Promo Code */}
        <div className="mb-8">
          {appliedPromo ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{appliedPromo.code}</span>
                <span className="text-muted-foreground">−₦{appliedPromo.discount_amount.toLocaleString()}</span>
              </div>
              <button onClick={removePromo} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="Promo code" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} className="uppercase" />
              <Button variant="outline" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}>
                {promoLoading ? '...' : 'Apply'}
              </Button>
            </div>
          )}
        </div>

        {/* Delivery Location */}
        <div className="space-y-6 mb-8">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Delivery location</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={position ? 'default' : 'outline'} size="sm" onClick={() => {
                setUsingDefault(false);
                getPosition();
                if (!navigator.geolocation) toast({ title: 'GPS not supported', variant: 'destructive' });
              }} disabled={geoLoading} className="shrink-0 gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {position ? 'GPS shared' : geoLoading ? 'Getting location...' : 'Use GPS'}
              </Button>
              {defaultLocation && !position && (
                <Button type="button" variant={usingDefault ? 'default' : 'outline'} size="sm" onClick={() => setUsingDefault(!usingDefault)} className="shrink-0 gap-1.5">
                  <Navigation className="h-3.5 w-3.5" />
                  {usingDefault ? defaultLocation.name : `Use "${defaultLocation.name}"`}
                </Button>
              )}
              {!position && !usingDefault && <span className="text-xs text-muted-foreground self-center">or type below</span>}
            </div>
            {position && <p className="text-xs text-muted-foreground">GPS coordinates captured — rider will get directions</p>}
            {usingDefault && !position && <p className="text-xs text-muted-foreground">Using your saved default location — {defaultLocation!.name}</p>}
            {!position && geoError && !usingDefault && <p className="text-xs text-destructive">{geoError.includes('denied') ? 'Location access denied. Enable in settings.' : geoError}</p>}
            {!position && !usingDefault && <Input className="mt-2" placeholder="e.g. Block A, Room 204" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} />}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Textarea placeholder="Special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Summary */}
        <div className="border-t pt-6 mb-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₦{total.toLocaleString()}</span></div>
            {drinkTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Drinks</span><span>₦{drinkTotal.toLocaleString()}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span>₦{serviceFee.toLocaleString()}</span></div>
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>−₦{discount.toLocaleString()}</span></div>}
            <div className="flex justify-between border-t pt-2 font-heading font-bold text-base">
              <span>Total</span><span>₦{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <Button
          className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90"
          onClick={handleCheckout}
          disabled={isOrdering}
          size="lg"
        >
          {isOrdering ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              Processing...
            </div>
          ) : (
            `Proceed to Payment • ₦${grandTotal.toLocaleString()}`
          )}
        </Button>

        {/* Payment Method Selector Modal */}
        {showPaymentSelector && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border">
              <div className="sticky top-0 bg-background/95 backdrop-blur-sm p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Payment</h2>
                  <p className="text-sm text-muted-foreground">Complete your order</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPaymentSelector(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6">
                <PaymentMethodSelector
                  totalAmount={grandTotal}
                  walletBalance={walletBalance}
                  onPaymentMethodSelect={handlePaymentMethodSelect}
                  onProceedToPayment={handleProceedToPayment}
                  isLoading={isOrdering}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <DrinkUpsellModal
        open={showDrinkUpsell}
        onClose={() => { setShowDrinkUpsell(false); setDrinkUpsellShown(true); }}
        onConfirm={handleDrinkConfirm}
      />
    </div>
  );
};

export default Cart;
