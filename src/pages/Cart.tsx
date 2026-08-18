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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Tag, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import PaymentModal from '@/components/payment/PaymentModal';

const Cart = () => {
    const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [isOrdering, setIsOrdering] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);

    const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
    const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);

    const [platformFee, setPlatformFee] = useState(100);
    const [deliveryFee, setDeliveryFee] = useState(500);
    const [zones, setZones] = useState<{ id: string; zone_name: string; delivery_fee: number }[]>([]);

    useEffect(() => {
        const fetchFees = async () => {
            const [{ data: pSettings }, { data: zoneData }] = await Promise.all([
                supabase.from('platform_settings').select('platform_fee').limit(1).maybeSingle(),
                (supabase.from('delivery_zones') as any).select('id, zone_name, delivery_fee').eq('is_active', true),
            ]);
            if (pSettings?.platform_fee) setPlatformFee(Number(pSettings.platform_fee));
            if (zoneData && zoneData.length > 0) {
                setZones(zoneData);
                setDeliveryFee(Number(zoneData[0].delivery_fee));
            }
        };
        fetchFees();
    }, []);

    useEffect(() => {
        if (user) {
            // Profiles table stores location as separate columns: default_lat, default_lng, default_location_name
            supabase
                .from('profiles')
                .select('default_lat, default_lng, default_location_name')
                .eq('user_id', user.id)
                .single()
                .then(({ data, error }) => {
                    if (error || !data) return;
                    if (data.default_lat && data.default_lng && data.default_location_name) {
                        setDefaultLocation({
                            lat: data.default_lat,
                            lng: data.default_lng,
                            name: data.default_location_name,
                        });
                        setDeliveryLocation(data.default_location_name);
                    }
                });
        }
    }, [user]);

    const handleLocationSelect = () => {
        // position from useGeolocation returns {lat, lng}, not a GeolocationPosition object
        if (position?.lat && position?.lng) {
            setDeliveryLocation(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
        } else {
            getPosition();
        }
    };

    const handlePlaceOrder = async () => {
        if (!user) {
            toast({
                title: "Authentication required",
                description: "Please log in to place an order",
                variant: "destructive",
            });
            return;
        }

        if (!deliveryLocation.trim()) {
            toast({
                title: "Delivery location required",
                description: "Please enter your delivery location",
                variant: "destructive",
            });
            return;
        }

        if (items.length === 0) {
            toast({
                title: "Cart is empty",
                description: "Please add items to your cart before ordering",
                variant: "destructive",
            });
            return;
        }

        setIsOrdering(true);

        try {
            const grandTotal = total + deliveryFee + platformFee;
            const effectiveVendorId = vendorId || items[0]?.menuItem?.vendor_id;

            if (!effectiveVendorId) {
                toast({
                    title: "Vendor Error",
                    description: "Cannot identify vendor for items in cart",
                    variant: "destructive",
                });
                return;
            }

            // Create order with pending payment status
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    student_id: user.id,
                    vendor_id: effectiveVendorId,
                    total: total,
                    delivery_fee: deliveryFee,
                    delivery_location: deliveryLocation,
                    notes: notes,
                    status: 'pending',
                    payment_status: 'pending',
                    payment_method: 'pay_on_delivery',
                })
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // Create order items
            const orderItems = items.map(item => ({
                order_id: order.id,
                menu_item_id: item.menuItem.id,
                quantity: item.quantity,
                price: item.menuItem.price,
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) {
                throw itemsError;
            }

            // Prepare order data for payment
            setOrderData({
                id: order.id,
                total: grandTotal,
                delivery_fee: deliveryFee,
                vendor_id: effectiveVendorId,
                items: items.map(item => ({
                    name: item.menuItem.name,
                    quantity: item.quantity,
                    price: item.menuItem.price,
                })),
            });

            // Clear cart state & localStorage immediately so items are removed after placing order
            clearCart();

            // Show payment modal
            setShowPaymentModal(true);

        } catch (error) {
            console.error('Order creation error:', error);
            toast({
                title: "Order failed",
                description: (error as any)?.message || "Failed to create order",
                variant: "destructive",
            });
        } finally {
            setIsOrdering(false);
        }
    };

    const handlePaymentSuccess = (reference: string) => {
        // Clear cart after successful payment
        clearCart();
        setShowPaymentModal(false);

        toast({
            title: "Order placed successfully!",
            description: "Your payment is being processed. You'll be redirected shortly.",
        });

        // Redirect to payment verification page
        navigate(`/payment/verify?ref=${reference}&payment=success`);
    };

    const grandTotal = total + deliveryFee + platformFee;

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-background">
                <AppNavbar />
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center py-12">
                        <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                        <h2 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h2>
                        <p className="text-muted-foreground mb-6">Add some delicious items to get started!</p>
                        <Button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600">
                            Browse Menu
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20 md:pb-0">
            <AppNavbar />
            <div className="container mx-auto px-4 py-6 max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">Your Order</h1>
                    <p className="text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''} in your cart</p>
                </div>

                {/* Cart Items */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.menuItem.id} className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-foreground">{item.menuItem.name}</h3>
                                        <p className="text-sm text-muted-foreground">₦{item.menuItem.price?.toLocaleString() || '0'}</p>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateQuantity(item.menuItem.id, Math.max(0, item.quantity - 1))}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="font-medium w-8 text-center">{item.quantity}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(item.menuItem.id)}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Location */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="location" className="text-base font-medium flex items-center">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    Delivery Location & Zone
                                </Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleLocationSelect}
                                    disabled={geoLoading}
                                    className="text-xs"
                                >
                                    <Navigation className="h-3 w-3 mr-1" />
                                    {geoLoading ? 'Getting...' : 'Use Current'}
                                </Button>
                            </div>
                            {zones.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Select Delivery Zone Rate</Label>
                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                        onChange={(e) => {
                                            const selected = zones.find(z => z.zone_name === e.target.value);
                                            if (selected) {
                                                setDeliveryFee(Number(selected.delivery_fee));
                                                setDeliveryLocation(selected.zone_name);
                                            }
                                        }}
                                    >
                                        {zones.map(z => (
                                            <option key={z.id} value={z.zone_name}>
                                                {z.zone_name} — ₦{Number(z.delivery_fee).toLocaleString()} delivery
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Input
                                id="location"
                                value={deliveryLocation}
                                onChange={(e) => setDeliveryLocation(e.target.value)}
                                placeholder="Enter specific hostel room / delivery details"
                                className="w-full"
                            />
                            {geoError && (
                                <p className="text-sm text-destructive">
                                    Unable to get location: {geoError}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Order Notes */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <Label htmlFor="notes" className="text-base font-medium mb-3 block">
                            <Tag className="h-4 w-4 mr-2 inline" />
                            Special Instructions (Optional)
                        </Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Any special requests or delivery instructions..."
                            className="w-full"
                            rows={3}
                        />
                    </CardContent>
                </Card>

                {/* Order Summary */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>₦{total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Delivery Fee (Rider)</span>
                                <span>₦{deliveryFee.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Platform Service Fee</span>
                                <span>₦{platformFee.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>Total</span>
                                    <span>₦{(total + deliveryFee + platformFee).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Place Order Button */}
                <Button
                    onClick={handlePlaceOrder}
                    disabled={isOrdering || !deliveryLocation.trim()}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 text-lg font-semibold"
                >
                    {isOrdering ? 'Placing Order...' : `Place Order • ₦${grandTotal.toLocaleString()}`}
                </Button>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && orderData && (
                <PaymentModal
                    open={showPaymentModal}
                    onOpenChange={setShowPaymentModal}
                    order={orderData}
                    onPaymentSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default Cart;