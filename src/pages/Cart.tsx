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
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Copy, Check, Tag, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
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
  const { position, loading: geoLoading, getPosition } = useGeolocation();
  const [bankDetails, setBankDetails] = useState<{ bank_name: string; bank_account_name: string; bank_account_number: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fees from platform settings
  const [platformFee, setPlatformFee] = useState(500);
  const [riderFee, setRiderFee] = useState(500);
  const serviceFee = platformFee + riderFee;

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_amount: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const discount = appliedPromo?.discount_amount || 0;
  const grandTotal = Math.max(0, total + serviceFee - discount);

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
  }, []);

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
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    return urlData.publicUrl || path;
  };


    if (!promoInput.trim()) return;
    setPromoLoading(true);
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoInput.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      toast({ title: 'Invalid promo code', variant: 'destructive' });
      setPromoLoading(false);
      return;
    }

    const promo = data as any;
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
      toast({ title: 'This promo code has been fully used', variant: 'destructive' });
      setPromoLoading(false);
      return;
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      toast({ title: 'This promo code has expired', variant: 'destructive' });
      setPromoLoading(false);
      return;
    }
    if (total < Number(promo.min_order)) {
      toast({ title: `Minimum order of ₦${Number(promo.min_order).toLocaleString()} required`, variant: 'destructive' });
      setPromoLoading(false);
      return;
    }

    setAppliedPromo({ code: promo.code, discount_amount: Number(promo.discount_amount) });
    toast({ title: `Promo applied! -₦${Number(promo.discount_amount).toLocaleString()} 🎉` });
    setPromoLoading(false);
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const placeOrder = async () => {
    if (!user || !vendorId || items.length === 0) return;
    if (!position && !deliveryLocation.trim()) {
      toast({ title: 'Please share GPS location or enter delivery address', variant: 'destructive' });
      return;
    }

    if (paymentMethod === 'bank_transfer' && !paymentProof) {
      toast({ title: 'Please upload proof of payment', description: 'A screenshot of your transfer receipt is required', variant: 'destructive' });
      return;
    }

    setIsOrdering(true);
    try {
      const orderData: any = {
        student_id: user.id,
        vendor_id: vendorId,
        total: total,
        delivery_fee: serviceFee,
        discount: discount,
        promo_code: appliedPromo?.code || null,
        payment_method: paymentMethod,
        delivery_location: deliveryLocation || (position ? 'GPS Location' : ''),
        notes,
      };
      if (position) {
        orderData.delivery_lat = position.lat;
        orderData.delivery_lng = position.lng;
      }
      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
      if (orderError) throw orderError;

      // Upload payment proof if bank transfer
      if (paymentMethod === 'bank_transfer' && paymentProof) {
        const proofUrl = await uploadPaymentProof(order.id);
        if (proofUrl) {
          await supabase.from('orders').update({ payment_proof_url: proofUrl } as any).eq('id', order.id);
        }
      }

      const orderItems = items.map(i => ({
        delivery_location: deliveryLocation || (position ? 'GPS Location' : ''),
        notes,
      };
      if (position) {
        orderData.delivery_lat = position.lat;
        orderData.delivery_lng = position.lng;
      }
      const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
      if (orderError) throw orderError;

      const orderItems = items.map(i => ({
        order_id: order.id,
        menu_item_id: i.menuItem.id,
        quantity: i.quantity,
        price: i.menuItem.price,
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Increment promo used_count
      if (appliedPromo) {
        try {
          await (supabase.from('promo_codes') as any)
            .update({ used_count: (await (supabase.from('promo_codes') as any).select('used_count').eq('code', appliedPromo.code).single()).data?.used_count + 1 || 1 })
            .eq('code', appliedPromo.code);
        } catch {}
      }

      clearCart();
      toast({ title: 'Order placed! 🎉', description: 'Your food is on its way soon.' });
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
          <ShoppingCart className="mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-bold">Your cart is empty</h1>
          <p className="text-muted-foreground">Browse vendors and add some food!</p>
          <Button className="mt-6" onClick={() => navigate('/dashboard')}>Browse Vendors</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container max-w-2xl py-6">
        <h1 className="mb-6 font-heading text-2xl font-bold">Your Cart 🛒</h1>

        <div className="space-y-3 mb-6">
          {items.map(({ menuItem, quantity }) => (
            <Card key={menuItem.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <h3 className="font-medium">{menuItem.name}</h3>
                  <p className="text-sm text-primary font-medium">₦{Number(menuItem.price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(menuItem.id, quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(menuItem.id, quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(menuItem.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Promo Code */}
        <Card className="mb-6">
          <CardContent className="p-4">
            {appliedPromo ? (
              <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{appliedPromo.code}</span>
                  <span className="text-sm text-green-600">-₦{appliedPromo.discount_amount.toLocaleString()}</span>
                </div>
                <button onClick={removePromo} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  className="uppercase"
                />
                <Button variant="outline" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}>
                  {promoLoading ? '...' : 'Apply'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="space-y-4 p-4">
            <div>
              <Label>Delivery Location</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={position ? 'default' : 'outline'} size="sm" onClick={() => getPosition()} disabled={geoLoading} className="shrink-0">
                  <MapPin className="mr-1 h-3.5 w-3.5" />
                  {position ? '📍 GPS Shared' : geoLoading ? 'Getting...' : 'Use GPS Location'}
                </Button>
                <span className="text-xs text-muted-foreground self-center">or type below</span>
              </div>
              {position && <p className="mt-1 text-xs text-green-600">✅ GPS coordinates captured — rider will get map directions to you</p>}
              {!position && (
                <Input className="mt-2" placeholder="e.g. Block A, Room 204, Hostel Name" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} />
              )}
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay_on_delivery">Pay on Delivery (Cash)</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'bank_transfer' && bankDetails && bankDetails.bank_account_number && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">💳 Transfer to this account:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{bankDetails.bank_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span className="font-medium">{bankDetails.bank_account_name}</span></div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      {bankDetails.bank_account_number}
                      <button onClick={copyAccountNumber} className="rounded p-1 hover:bg-muted transition-colors" type="button">
                        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Transfer ₦{grandTotal.toLocaleString()} and place your order.</p>
              </div>
            )}

            {paymentMethod === 'bank_transfer' && (!bankDetails || !bankDetails.bank_account_number) && (
              <p className="text-sm text-destructive">Bank transfer details haven't been configured yet. Please choose Pay on Delivery.</p>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₦{total.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service Fee (Platform + Rider)</span><span>₦{serviceFee.toLocaleString()}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600"><span>Promo Discount</span><span>-₦{discount.toLocaleString()}</span></div>
              )}
              <div className="flex justify-between border-t pt-2 font-heading text-lg font-bold">
                <span>Total</span><span className="text-primary">₦{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={placeOrder} disabled={isOrdering}>
          {isOrdering ? 'Placing Order...' : `Place Order · ₦${grandTotal.toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
};

export default Cart;
