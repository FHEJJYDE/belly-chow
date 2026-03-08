import { useState, useEffect } from 'react';
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
import { Minus, Plus, Trash2, ShoppingCart, MapPin } from 'lucide-react';
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

  const deliveryFee = 200;

  const placeOrder = async () => {
    if (!user || !vendorId || items.length === 0) return;
    if (!deliveryLocation.trim()) {
      toast({ title: 'Please enter delivery location', variant: 'destructive' });
      return;
    }

    setIsOrdering(true);
    try {
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        student_id: user.id,
        vendor_id: vendorId,
        total: total,
        delivery_fee: deliveryFee,
        payment_method: paymentMethod,
        delivery_location: deliveryLocation,
        notes,
      }).select().single();

      if (orderError) throw orderError;

      const orderItems = items.map(i => ({
        order_id: order.id,
        menu_item_id: i.menuItem.id,
        quantity: i.quantity,
        price: i.menuItem.price,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

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

        <Card className="mb-6">
          <CardContent className="space-y-4 p-4">
            <div>
              <Label>Delivery Location</Label>
              <Input placeholder="e.g. Block A, Room 204, Hostel Name" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)} />
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
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span>₦{deliveryFee.toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-2 font-heading text-lg font-bold">
                <span>Total</span><span className="text-primary">₦{(total + deliveryFee).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={placeOrder} disabled={isOrdering}>
          {isOrdering ? 'Placing Order...' : `Place Order · ₦${(total + deliveryFee).toLocaleString()}`}
        </Button>
      </div>
    </div>
  );
};

export default Cart;
