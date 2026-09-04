import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Tag, Navigation, Star, Sparkles, Building, ChevronDown, Check } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import PaymentModal from '@/components/payment/PaymentModal';
import LocationSelectorModal from '@/components/location/LocationSelectorModal';

const Cart = () => {
    const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [deliveryLocation, setDeliveryLocation] = useState(() => {
        return localStorage.getItem('selected_campus_location') || '';
    });
    const [notes, setNotes] = useState('');
    const [isOrdering, setIsOrdering] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);
    const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(() => {
        try {
            const raw = localStorage.getItem('selected_campus_coords');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [campusLocations, setCampusLocations] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
    const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);

    const [platformFee, setPlatformFee] = useState(100);
    const [deliveryFee, setDeliveryFee] = useState(500);
    const [zones, setZones] = useState<{ id: string; zone_name: string; delivery_fee: number }[]>([]);

    useEffect(() => {
        const fetchCampusLocations = async () => {
            try {
                const { data } = await supabase
                    .from('campus_locations')
                    .select('*')
                    .eq('is_active', true)
                    .order('is_popular', { ascending: false })
                    .order('name', { ascending: true });
                if (data && data.length > 0) {
                    setCampusLocations(data);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchCampusLocations();
    }, []);

    useEffect(() => {
        const fetchFees = async () => {
            const [{ data: pSettings }, { data: zoneData }] = await Promise.all([
                supabase.from('platform_settings').select('platform_fee').limit(1).maybeSingle(),
                (supabase.from as any)('delivery_zones').select('id, zone_name, delivery_fee').eq('is_active', true),
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
        if (user && !deliveryLocation) {
            // Profiles table stores location as separate columns: default_lat, default_lng, default_location_name
            supabase
                .from('profiles')
                .select('default_lat, default_lng, default_location_name, campus_location')
                .eq('user_id', user.id)
                .single()
                .then(({ data, error }) => {
                    if (error || !data) return;
                    const loc = data.default_location_name || data.campus_location;
                    if (loc) {
                        setDeliveryLocation(loc);
                    }
                    if (data.default_lat && data.default_lng) {
                        setDefaultLocation({
                            lat: data.default_lat,
                            lng: data.default_lng,
                            name: loc || 'My Saved Spot',
                        });
                        setDeliveryCoords({ lat: data.default_lat, lng: data.default_lng });
                    }
                });
        }
    }, [user, deliveryLocation]);

    const handleLocationSelect = () => {
        if (position?.lat && position?.lng) {
            setDeliveryCoords({ lat: position.lat, lng: position.lng });
            // Show a human-readable label alongside raw coords
            setDeliveryLocation(`GPS Location (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)})`);
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
                    // Persist GPS coordinates immediately so rider map has a pin from the start
                    ...(deliveryCoords ? {
                        delivery_lat: deliveryCoords.lat,
                        delivery_lng: deliveryCoords.lng,
                    } : position ? {
                        delivery_lat: position.lat,
                        delivery_lng: position.lng,
                    } : {}),
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
                                <Label htmlFor="location" className="text-base font-semibold flex items-center">
                                    <MapPin className="h-4 w-4 mr-2 text-primary" />
                                    Delivery Location & Campus Spot
                                </Label>
                                <div className="flex items-center gap-1.5">
                                    <LocationSelectorModal
                                        currentLocation={deliveryLocation}
                                        onLocationSelect={(name, obj) => {
                                            setDeliveryLocation(name);
                                            if (obj?.lat && obj?.lng) {
                                                setDeliveryCoords({ lat: obj.lat, lng: obj.lng });
                                            }
                                        }}
                                        triggerButton={
                                            <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                                                <Building className="h-3.5 w-3.5 text-orange-500" />
                                                <span>Pick Campus Spot</span>
                                            </Button>
                                        }
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleLocationSelect}
                                        disabled={geoLoading}
                                        className="text-xs h-8"
                                    >
                                        <Navigation className="h-3 w-3 mr-1" />
                                        {geoLoading ? 'Getting GPS...' : 'Use GPS'}
                                    </Button>
                                </div>
                            </div>

                            {/* GPS Status banner */}
                            {geoError && !position && (
                                <div className="flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Location Unavailable</p>
                                            <p className="mt-0.5">{geoError} You can select from campus spots or type your hostel room below.</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => getPosition()}
                                        disabled={geoLoading}
                                        className="shrink-0 text-[11px] h-7 px-2 border-destructive/30 hover:bg-destructive/10"
                                    >
                                        {geoLoading ? 'Retrying…' : 'Retry GPS'}
                                    </Button>
                                </div>
                            )}

                            {position && !geoError && (
                                <div className="flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                                    <Navigation className="h-3.5 w-3.5 shrink-0" />
                                    <span>GPS active {position.accuracy ? `(±${Math.round(position.accuracy)}m accuracy)` : ''}</span>
                                </div>
                            )}

                            {/* Quick 1-Tap Popular Campus Spots */}
                            {campusLocations.filter(l => l.is_popular).length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 text-amber-500" /> Popular Spots (1-Tap):
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {campusLocations.filter(l => l.is_popular).slice(0, 6).map(loc => {
                                            const isSelected = deliveryLocation.includes(loc.name);
                                            return (
                                                <button
                                                    key={loc.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setDeliveryLocation(loc.name);
                                                        if (loc.lat && loc.lng) {
                                                            setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                                                        }
                                                        localStorage.setItem('selected_campus_location', loc.name);
                                                    }}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                                        isSelected
                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                            : 'bg-muted hover:bg-muted/80 text-foreground'
                                                    }`}
                                                >
                                                    <Star className={`h-2.5 w-2.5 ${isSelected ? 'fill-primary-foreground' : 'fill-amber-400 text-amber-500'}`} />
                                                    <span>{loc.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {zones.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Select Delivery Zone Rate</Label>
                                    <select
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                        onChange={(e) => {
                                            const selected = zones.find(z => z.zone_name === e.target.value);
                                            if (selected) {
                                                setDeliveryFee(Number(selected.delivery_fee));
                                                if (!deliveryLocation) {
                                                    setDeliveryLocation(selected.zone_name);
                                                }
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

                            {/* Autocomplete Input & Suggestions */}
                            <div className="relative">
                                <Label htmlFor="location" className="text-xs text-muted-foreground block mb-1">
                                    Delivery Address / Room / Landmark
                                </Label>
                                <Input
                                    id="location"
                                    value={deliveryLocation}
                                    onFocus={() => setShowSuggestions(true)}
                                    onChange={(e) => {
                                        setDeliveryLocation(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    placeholder="Type keyword (e.g. Hall 1, Room 204, Library, SUB)..."
                                    className="w-full"
                                />

                                {/* Dropdown suggestions */}
                                {showSuggestions && deliveryLocation.trim().length > 0 && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border bg-popover text-popover-foreground shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                                        {campusLocations
                                            .filter(loc =>
                                                loc.name.toLowerCase().includes(deliveryLocation.toLowerCase()) ||
                                                (loc.description && loc.description.toLowerCase().includes(deliveryLocation.toLowerCase())) ||
                                                loc.category.toLowerCase().includes(deliveryLocation.toLowerCase())
                                            )
                                            .slice(0, 6)
                                            .map(loc => (
                                                <button
                                                    key={loc.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setDeliveryLocation(loc.name);
                                                        if (loc.lat && loc.lng) {
                                                            setDeliveryCoords({ lat: loc.lat, lng: loc.lng });
                                                        }
                                                        localStorage.setItem('selected_campus_location', loc.name);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full p-2.5 text-left flex items-start gap-2.5 hover:bg-muted/70 transition-colors border-b last:border-b-0"
                                                >
                                                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-xs truncate">{loc.name}</span>
                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
                                                                {loc.category}
                                                            </Badge>
                                                        </div>
                                                        {loc.description && (
                                                            <p className="text-[11px] text-muted-foreground truncate">{loc.description}</p>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        <div className="p-2 bg-muted/40 border-t flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[10px]"
                                                onClick={() => setShowSuggestions(false)}
                                            >
                                                Close Suggestions
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
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