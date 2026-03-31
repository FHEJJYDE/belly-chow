import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Copy, Check, Tag, X, Upload, Image as ImageIcon, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import DrinkUpsellModal, { SelectedDrink, CustomDrinkRequest } from '@/components/DrinkUpsellModal';
import type { Enums } from '@/integrations/supabase/types';

type PaymentMethod = Enums<"payment_method">;

const Cart = () => {
  const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_on_delivery');
  const [notes, setNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
  const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const [bankDetails, setBankDetails] = useState<{ bank_name: string; bank_account_name: string; bank_account_number: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDrinkUpsell, setShowDrinkUpsell] = useState(false);
  const [drinkUpsellShown, setDrinkUpsellShown] = useState(false);
  const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
  const [customDrinkRequest, setCustomDrinkRequest] = useState<CustomDrinkRequest | null>(null);

  const [platformFee, setPlatformFee] = useState(500);
  const [riderFee, setRiderFee] = useState(500);
  const serviceFee = platformFee + riderFee;

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_amount: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const discount = appliedPromo?.discount_amount || 0;
  const drinkTotal = selectedDrinks.reduce((s, d) => s + d.price * d.quantity, 0);
  const grandTotal = Math.max(0, total + serviceFee + drinkTotal - discount);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        setPlatformFee(Number((data as any).platform_fee) || 500);
        setRiderFee(Number((data as any).rider_fee) || 500);
        setBankDetails({
          bank_name: (data as any).bank_name || '',
          bank_account_name: (data as any).bank_account_name || '',
          bank_account_number: (data as any).bank_account_number || '',
        });
      }
    };
    fetchSettings();

    // Load saved default location
    if (user) {
      supabase.from('profiles').select('default_lat, default_lng, default_location_name').eq('user_id', user.id).single()
        .then(({ data }) => {
          const d = data as any;
          if (d?.default_lat && d?.default_lng) {
            setDefaultLocation({ lat: d.default_lat, lng: d.default_lng, name: d.default_location_name || 'Saved Location' });
          }
        });
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

  const copyAccountNumber = () => {
    if (bankDetails?.bank_account_number) {
      navigator.clipboard.writeText(bankDetails.bank_account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB allowed', variant: 'destructive' });
      return;
    }
    setPaymentProof(file);
    setPaymentProofPreview(URL.createObjectURL(file));
  };

  const uploadPaymentProof = async (orderId: string): Promise<string | null> => {
    if (!paymentProof || !user) return null;
    setUploadingProof(true);
    const ext = paymentProof.name.split('.').pop();
    const path = `${user.id}/${orderId}.${ext}`;
    const { error } = await supabase.storage.from('payment-proofs').upload(path, paymentProof, { upsert: true });
    setUploadingProof(false);
    if (error) { console.error('Upload error:', error); return null; }
    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    return urlData.publicUrl || path;
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

  const placeOrder = async () => {
    if (!user || !vendorId || items.length === 0) return;
    if (!position && !usingDefault && !deliveryLocation.trim()) { toast({ title: 'Please share GPS or enter delivery address', variant: 'destructive' }); return; }
    if (paymentMethod === 'bank_transfer' && !paymentProof) { toast({ title: 'Please upload proof of payment', variant: 'destructive' }); return; }

    setIsOrdering(true);
    try {
      const useLat = position?.lat ?? (usingDefault && defaultLocation ? defaultLocation.lat : undefined);
      const useLng = position?.lng ?? (usingDefault && defaultLocation ? defaultLocation.lng : undefined);
      const locLabel = deliveryLocation || (position ? 'GPS Location' : usingDefault && defaultLocation ? defaultLocation.name : '');

      const orderData: any = {
        student_id: user.id, vendor_id: vendorId, total, delivery_fee: serviceFee, discount,
        promo_code: appliedPromo?.code || null, payment_method: paymentMethod,
        delivery_location: locLabel, notes,
        drink_items: selectedDrinks.length > 0 ? selectedDrinks : [],
        custom_drink_request: customDrinkRequest || null,
      };
      if (useLat && useLng) { orderData.delivery_lat = useLat; orderData.delivery_lng = useLng; }
      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
      if (orderError) throw orderError;

      if (paymentMethod === 'bank_transfer' && paymentProof) {
        const proofUrl = await uploadPaymentProof(order.id);
        if (proofUrl) await supabase.from('orders').update({ payment_proof_url: proofUrl } as any).eq('id', order.id);
      }

      const orderItems = items.map(i => ({ order_id: order.id, menu_item_id: i.menuItem.id, quantity: i.quantity, price: i.menuItem.price }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      if (appliedPromo) {
        try {
          await (supabase.from('promo_codes') as any).update({ used_count: (await (supabase.from('promo_codes') as any).select('used_count').eq('code', appliedPromo.code).single()).data?.used_count + 1 || 1 }).eq('code', appliedPromo.code);
        } catch {}
      }

      clearCart();
      toast({ title: 'Order placed', description: 'Your food is on its way soon.' });
      navigate('/orders');
    } catch (error: any) {
      toast({ title: 'Failed to place order', description: error.message, variant: 'destructive' });
    } finally {
      setIsOrdering(false);
    }
  };

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

        {/* Delivery & Payment */}
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
            <Label className="text-sm font-medium">Payment method</Label>
            <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pay_on_delivery">Pay on Delivery (Cash)</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === 'bank_transfer' && bankDetails && bankDetails.bank_account_number && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-semibold">Transfer details</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bankDetails.bank_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Account</span><span className="font-medium">{bankDetails.bank_account_name}</span></div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Number</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {bankDetails.bank_account_number}
                    <button onClick={copyAccountNumber} className="rounded p-1 hover:bg-muted transition-colors" type="button">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Transfer ₦{grandTotal.toLocaleString()} and upload receipt below.</p>
            </div>
          )}

          {paymentMethod === 'bank_transfer' && bankDetails && bankDetails.bank_account_number && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Upload className="h-4 w-4" /> Payment proof <span className="text-destructive">*</span>
              </Label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofSelect} />
              {paymentProofPreview ? (
                <div className="relative rounded-lg border overflow-hidden">
                  <img src={paymentProofPreview} alt="Payment proof" className="w-full max-h-48 object-contain bg-muted" />
                  <button type="button" onClick={() => { setPaymentProof(null); setPaymentProofPreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-foreground p-1 text-background shadow-sm hover:opacity-80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-sm font-medium">Upload transfer receipt</span>
                  <span className="text-xs">JPG, PNG — max 5MB</span>
                </button>
              )}
            </div>
          )}

          {paymentMethod === 'bank_transfer' && (!bankDetails || !bankDetails.bank_account_number) && (
            <p className="text-sm text-destructive">Bank transfer details not configured. Choose Pay on Delivery.</p>
          )}

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

        <Button className="w-full" onClick={placeOrder} disabled={isOrdering || uploadingProof}>
          {isOrdering ? 'Placing order...' : `Place order — ₦${grandTotal.toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
};

export default Cart;
