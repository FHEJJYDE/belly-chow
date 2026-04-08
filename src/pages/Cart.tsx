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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Minus, Plus, Trash2, ShoppingCart, MapPin, Tag, X, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import DrinkUpsellModal, { SelectedDrink, CustomDrinkRequest } from '@/components/DrinkUpsellModal';

const Cart = () => {
    const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [isOrdering, setIsOrdering] = useState(false);

    const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
    const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
    const [showDrinkModal, setShowDrinkModal] = useState(false);
    const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
    const [customDrinkRequests, setCustomDrinkRequests] = useState<CustomDrinkRequest[]>([]);

    const deliveryFee = 1000; // Fixed delivery fee
    const serviceFee = deliveryFee;

    useEffect(() => {
        if (user) {
            // Load user's default location
            supabase
                .from('profiles')
                .select('default_location')
                .eq('id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.default_location) {
                        setDefaultLocation(data.default_location);
                        setDeliveryLocation(data.default_location.name);
                    }
                })
                .catch(console.error);
        }
    }, [user]);

    const handleLocationSelect = () => {
        if (position) {
            setDeliveryLocation(`${position.coords.latitude}, ${position.coords.longitude}`);
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
            const grandTotal = total + serviceFee;

            // Create order without payment
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    customer_id: user.id,
                    vendor_id: vendorId,
                    items: items,
                    total_amount: grandTotal,
                    delivery_location: deliveryLocation,
                    notes: notes,
                    status: 'pending', // Order starts as pending
                    selected_drinks: selectedDrinks,
                    custom_drink_requests: customDrinkRequests,
                })
                .select()
                .single();

            if (orderError) {
                throw orderError;
            }

            // Clear cart and redirect
            clearCart();

            toast({
                title: "Order placed successfully!",
                description: "Your order has been submitted and is pending confirmation.",
            });

            navigate('/orders');

        } catch (error) {
            console.error('Order creation error:', error);
            toast({
                title: "Order failed",
                description: error instanceof Error ? error.message : "Failed to place order",
                variant: "destructive",
            });
        } finally {
            setIsOrdering(false);
        }
    };

    const handleDrinkSelection = (drinks: SelectedDrink[], customRequests: CustomDrinkRequest[]) => {
        setSelectedDrinks(drinks);
        setCustomDrinkRequests(customRequests);
        setShowDrinkModal(false);
    };

    const grandTotal = total + serviceFee;

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
                                <div key={item.id} className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-foreground">{item.name}</h3>
                                        <p className="text-sm text-muted-foreground">₦{item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="font-medium w-8 text-center">{item.quantity}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(item.id)}
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
                                    Delivery Location
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
                            <Input
                                id="location"
                                value={deliveryLocation}
                                onChange={(e) => setDeliveryLocation(e.target.value)}
                                placeholder="Enter your delivery address"
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
                            <div className="flex justify-between">
                                <span>Delivery Fee</span>
                                <span>₦{deliveryFee.toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>Total</span>
                                    <span>₦{grandTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Drink Selection */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg">Add Drinks</h3>
                            <Button
                                variant="outline"
                                onClick={() => setShowDrinkModal(true)}
                                className="text-sm"
                            >
                                {selectedDrinks.length > 0 ? 'Edit Selection' : 'Select Drinks'}
                            </Button>
                        </div>
                        {selectedDrinks.length > 0 && (
                            <div className="space-y-2">
                                {selectedDrinks.map((drink, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span>{drink.name} x{drink.quantity}</span>
                                        <span>₦{(drink.price * drink.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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

            {/* Drink Selection Modal */}
            <DrinkUpsellModal
                isOpen={showDrinkModal}
                onClose={() => setShowDrinkModal(false)}
                onConfirm={handleDrinkSelection}
                initialDrinks={selectedDrinks}
                initialCustomRequests={customDrinkRequests}
            />
        </div>
    );
};

export default Cart;