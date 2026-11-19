import { useState, useEffect, useMemo } from 'react';
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
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  MapPin,
  Tag,
  Navigation,
  Star,
  Sparkles,
  Building,
  Clock,
  DoorOpen,
  Check,
  GlassWater,
  X,
  Locate,
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLocation as useLiveLocationContext } from '@/contexts/LocationContext';
import PaymentModal from '@/components/payment/PaymentModal';
import LocationSelectorModal from '@/components/location/LocationSelectorModal';
import DrinkUpsellModal, { SelectedDrink, CustomDrinkRequest } from '@/components/DrinkUpsellModal';
import {
  useCampusLocations,
  CampusLocationItem,
  filterCampusLocations,
  findNearestCampusLocation,
  DELIVERY_INSTRUCTION_PRESETS,
  DEFAULT_DROPOFF_BY_CATEGORY,
} from '@/hooks/useCampusLocations';

const Cart = () => {
  const { items, updateQuantity, removeItem, clearCart, total, vendorId } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { locations: campusLocations, zones } = useCampusLocations();

  const [deliveryLocation, setDeliveryLocation] = useState(() => {
    return localStorage.getItem('selected_campus_location') || '';
  });
  const [selectedDropoff, setSelectedDropoff] = useState(() => {
    return localStorage.getItem('selected_campus_dropoff') || '';
  });
  const [roomNumber, setRoomNumber] = useState(() => {
    return localStorage.getItem('selected_campus_room') || '';
  });
  const [deliveryInstruction, setDeliveryInstruction] = useState('');
  const [notes, setNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Drink Upsell State
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
  const [customDrink, setCustomDrink] = useState<CustomDrinkRequest | null>(null);

  // Promo Code Redemption State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discountAmount: number;
  } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const raw = localStorage.getItem('selected_campus_coords');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'live_gps' | 'address'>('address');
  const { position, error: geoError, loading: geoLoading, getPosition } = useGeolocation();
  const { setIsSharingLiveStudentGps } = useLiveLocationContext();

  const [platformFee, setPlatformFee] = useState(100);
  const [deliveryFee, setDeliveryFee] = useState<number>(() => {
    const savedFee = localStorage.getItem('selected_campus_fee');
    return savedFee ? Number(savedFee) : 500;
  });
  const [estimatedMins, setEstimatedMins] = useState<number>(() => {
    const savedEta = localStorage.getItem('selected_campus_eta');
    return savedEta ? Number(savedEta) : 15;
  });
  const [activeZoneName, setActiveZoneName] = useState<string>(() => {
    return localStorage.getItem('selected_campus_zone') || '';
  });

  // Resolve fee dynamically from admin-configured delivery_zones first, then location.delivery_fee
  const resolveSpotFee = (loc?: CampusLocationItem | null, zoneOverride?: string): number => {
    const targetZone = zoneOverride || loc?.zone_name;
    if (targetZone && zones.length > 0) {
      const matchedZone = zones.find(
        (z) => z.zone_name.toLowerCase() === targetZone.toLowerCase()
      );
      if (matchedZone) return Number(matchedZone.delivery_fee);
    }
    if (loc?.delivery_fee != null) return Number(loc.delivery_fee);
    if (zones.length > 0) return Number(zones[0].delivery_fee);
    return 500;
  };

  // Matched Campus Building object for micro-dropoff options
  const matchedCampusBuilding = useMemo<CampusLocationItem | null>(() => {
    if (!deliveryLocation.trim()) return null;
    const baseName = deliveryLocation.split(' • ')[0].trim().toLowerCase();
    return (
      campusLocations.find(
        (loc) =>
          loc.name.toLowerCase() === baseName ||
          deliveryLocation.toLowerCase().includes(loc.name.toLowerCase())
      ) || null
    );
  }, [campusLocations, deliveryLocation]);

  // Sync fee, coords & ETA whenever a campus building or admin zone is matched
  useEffect(() => {
    if (matchedCampusBuilding) {
      setDeliveryFee(resolveSpotFee(matchedCampusBuilding));
      if (matchedCampusBuilding.estimated_delivery_mins) {
        setEstimatedMins(Number(matchedCampusBuilding.estimated_delivery_mins));
      }
      if (matchedCampusBuilding.zone_name) {
        setActiveZoneName(matchedCampusBuilding.zone_name);
      } else if (zones[0]?.zone_name && !activeZoneName) {
        setActiveZoneName(zones[0].zone_name);
      }
      if (matchedCampusBuilding.lat && matchedCampusBuilding.lng && !deliveryCoords) {
        setDeliveryCoords({
          lat: Number(matchedCampusBuilding.lat),
          lng: Number(matchedCampusBuilding.lng),
        });
      }
    } else if (zones.length > 0 && !activeZoneName) {
      setActiveZoneName(zones[0].zone_name);
      setDeliveryFee(Number(zones[0].delivery_fee));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCampusBuilding, zones]);

  useEffect(() => {
    const fetchFees = async () => {
      const { data: pSettings } = await supabase
        .from('platform_settings')
        .select('platform_fee')
        .limit(1)
        .maybeSingle();
      if (pSettings?.platform_fee) setPlatformFee(Number(pSettings.platform_fee));
    };
    fetchFees();
  }, []);

  useEffect(() => {
    if (user && !deliveryLocation) {
      supabase
        .from('profiles')
        .select('default_lat, default_lng, default_location_name, campus_location')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return;
          const loc = data.default_location_name || data.campus_location;
          if (loc) {
            setDeliveryLocation(loc);
          }
          if (data.default_lat && data.default_lng) {
            setDeliveryCoords({ lat: Number(data.default_lat), lng: Number(data.default_lng) });
          }
        });
    }
  }, [user, deliveryLocation]);

  // When GPS position arrives, snap to the nearest campus landmark automatically!
  useEffect(() => {
    if (!position?.lat || !position?.lng) return;
    setDeliveryCoords({ lat: position.lat, lng: position.lng });
    const nearest = findNearestCampusLocation(position.lat, position.lng, campusLocations);
    if (nearest && nearest.distanceMeters <= 600) {
      const loc = nearest.location;
      const defaultDrop = loc.dropoff_points?.[0] || "Main Gate / Porter's Lodge";
      setDeliveryLocation(loc.name);
      setSelectedDropoff(defaultDrop);
      setDeliveryFee(resolveSpotFee(loc));
      setEstimatedMins(Number(loc.estimated_delivery_mins || 15));
      setActiveZoneName(loc.zone_name || zones[0]?.zone_name || 'Campus Delivery');
      toast({
        title: `Snapped to ${loc.name} 📍`,
        description: `${nearest.distanceMeters}m from your GPS (~${loc.estimated_delivery_mins || 15} mins delivery)`,
      });
    } else {
      setDeliveryLocation(
        `Pinned GPS Spot (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)})`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, campusLocations]);

  const handleLocationSelect = () => {
    setDeliveryMode('live_gps');
    setIsSharingLiveStudentGps(true);
    getPosition();
  };

  const applyCampusSpot = (loc: CampusLocationItem) => {
    setDeliveryMode('address');
    setIsSharingLiveStudentGps(false);
    const defaultDrop = loc.dropoff_points?.[0] || "Main Gate / Porter's Lodge";
    setDeliveryLocation(loc.name);
    setSelectedDropoff(defaultDrop);
    if (loc.lat && loc.lng) {
      const coords = { lat: Number(loc.lat), lng: Number(loc.lng) };
      setDeliveryCoords(coords);
      localStorage.setItem('selected_campus_coords', JSON.stringify(coords));
    }
    const fee = resolveSpotFee(loc);
    const eta = Number(loc.estimated_delivery_mins || 15);
    const zone = loc.zone_name || zones[0]?.zone_name || 'Campus Delivery';
    setDeliveryFee(fee);
    setEstimatedMins(eta);
    setActiveZoneName(zone);
    localStorage.setItem('selected_campus_location', loc.name);
    localStorage.setItem('selected_campus_dropoff', defaultDrop);
    localStorage.setItem('selected_campus_fee', String(fee));
    localStorage.setItem('selected_campus_eta', String(eta));
    localStorage.setItem('selected_campus_zone', zone);
    setShowSuggestions(false);
  };

  const availableDropoffs = useMemo(() => {
    if (!matchedCampusBuilding) return DEFAULT_DROPOFF_BY_CATEGORY.Hostel;
    if (
      Array.isArray(matchedCampusBuilding.dropoff_points) &&
      matchedCampusBuilding.dropoff_points.length > 0
    ) {
      return matchedCampusBuilding.dropoff_points;
    }
    return (
      DEFAULT_DROPOFF_BY_CATEGORY[matchedCampusBuilding.category] ||
      DEFAULT_DROPOFF_BY_CATEGORY.Hostel
    );
  }, [matchedCampusBuilding]);

  const drinkTotal = useMemo(() => {
    return selectedDrinks.reduce((sum, d) => sum + d.price * d.quantity, 0);
  }, [selectedDrinks]);

  const discountAmount = appliedPromo ? appliedPromo.discountAmount : 0;
  const discountedFoodSubtotal = Math.max(0, total + drinkTotal - discountAmount);
  const grandTotal = discountedFoodSubtotal + deliveryFee + platformFee;

  // Promo Code Application Handler
  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setApplyingPromo(true);
    try {
      const { data: promo, error } = await (supabase.from('promo_codes') as any)
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !promo) {
        toast({
          title: 'Invalid Promo Code',
          description: `Code "${code}" does not exist or is no longer active.`,
          variant: 'destructive',
        });
        return;
      }

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        toast({
          title: 'Promo Expired',
          description: 'This discount code has expired.',
          variant: 'destructive',
        });
        return;
      }

      const usedCount = Number(promo.used_count ?? promo.uses_count ?? 0);
      if (promo.max_uses && usedCount >= Number(promo.max_uses)) {
        toast({
          title: 'Promo Limit Reached',
          description: 'This promo code has reached its maximum redemptions.',
          variant: 'destructive',
        });
        return;
      }

      const minOrder = Number(promo.min_order ?? 0);
      if (total < minOrder) {
        toast({
          title: 'Minimum Order Not Met',
          description: `Order subtotal must be at least ₦${minOrder.toLocaleString()} to use ${code}.`,
          variant: 'destructive',
        });
        return;
      }

      const computedDiscount =
        Number(promo.discount_amount) > 0
          ? Number(promo.discount_amount)
          : Number(promo.discount_percent) > 0
          ? Math.round((total * Number(promo.discount_percent)) / 100)
          : 0;

      setAppliedPromo({
        id: promo.id,
        code: promo.code,
        discountAmount: computedDiscount,
      });

      toast({
        title: `Promo ${promo.code} applied! 🎉`,
        description: `You saved ₦${computedDiscount.toLocaleString()} on this order.`,
      });
    } catch (err: any) {
      toast({
        title: 'Could not verify promo',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setApplyingPromo(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to place an order',
        variant: 'destructive',
      });
      return;
    }

    const hasGpsFix = Boolean(
      (position?.lat && position?.lng) || (deliveryCoords?.lat && deliveryCoords?.lng)
    );

    if (!deliveryLocation.trim() && !(deliveryMode === 'live_gps' && hasGpsFix)) {
      toast({
        title: 'Delivery location required',
        description: 'Turn on Live GPS Tracking or choose a campus delivery spot.',
        variant: 'destructive',
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add items to your cart before ordering',
        variant: 'destructive',
      });
      return;
    }

    setIsOrdering(true);

    try {
      const effectiveVendorId = vendorId || items[0]?.menuItem?.vendor_id;

      if (!effectiveVendorId) {
        toast({
          title: 'Vendor Error',
          description: 'Cannot identify vendor for items in cart',
          variant: 'destructive',
        });
        return;
      }

      // Build formatted full delivery location string for rider visibility
      const resolvedLat =
        deliveryMode === 'live_gps'
          ? position?.lat ?? deliveryCoords?.lat ?? null
          : deliveryCoords?.lat ??
            (matchedCampusBuilding?.lat
              ? Number(matchedCampusBuilding.lat)
              : position?.lat ?? null);
      const resolvedLng =
        deliveryMode === 'live_gps'
          ? position?.lng ?? deliveryCoords?.lng ?? null
          : deliveryCoords?.lng ??
            (matchedCampusBuilding?.lng
              ? Number(matchedCampusBuilding.lng)
              : position?.lng ?? null);

      const nearestForGps =
        resolvedLat && resolvedLng
          ? findNearestCampusLocation(resolvedLat, resolvedLng, campusLocations)
          : null;

      const baseAddress =
        deliveryMode === 'live_gps' && !deliveryLocation.trim()
          ? nearestForGps && nearestForGps.distanceMeters <= 800
            ? `Live GPS Pin (Near ${nearestForGps.location.name})`
            : 'Live GPS Location (Rider Tracking Active)'
          : deliveryLocation.split(' • ')[0].trim() || 'Live GPS Location';

      const locSegments = [baseAddress];
      if (selectedDropoff && !baseAddress.includes(selectedDropoff)) {
        locSegments.push(selectedDropoff);
      }
      if (roomNumber.trim() && !baseAddress.includes(roomNumber.trim())) {
        locSegments.push(`Rm/Blk: ${roomNumber.trim()}`);
      }
      const fullDeliveryAddress = locSegments.join(' • ');

      // Combine delivery instruction preset + custom drink + custom notes
      const customDrinkNote = customDrink
        ? `Custom Drink Request: ${customDrink.name} (Max ₦${customDrink.max_budget})`
        : '';
      const combinedNotes = [deliveryInstruction, customDrinkNote, notes.trim()]
        .filter(Boolean)
        .join(' | ');

      // Reuse pendingOrderId if the user closed PaymentModal and clicked Place Order again!
      let orderId = pendingOrderId;

      if (orderId) {
        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            total: discountedFoodSubtotal,
            delivery_fee: deliveryFee,
            delivery_location: fullDeliveryAddress,
            ...(resolvedLat && resolvedLng
              ? {
                  delivery_lat: resolvedLat,
                  delivery_lng: resolvedLng,
                }
              : {}),
            promo_code: appliedPromo?.code || null,
            drink_items: selectedDrinks.length > 0 ? selectedDrinks : null,
            notes: combinedNotes || null,
          } as any)
          .eq('id', orderId);

        if (updateErr) throw updateErr;
      } else {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            student_id: user.id,
            vendor_id: effectiveVendorId,
            total: discountedFoodSubtotal,
            delivery_fee: deliveryFee,
            delivery_location: fullDeliveryAddress,
            ...(resolvedLat && resolvedLng
              ? {
                  delivery_lat: resolvedLat,
                  delivery_lng: resolvedLng,
                }
              : {}),
            promo_code: appliedPromo?.code || null,
            drink_items: selectedDrinks.length > 0 ? selectedDrinks : null,
            notes: combinedNotes || null,
            status: 'pending',
            payment_status: 'pending',
            payment_method: 'pay_on_delivery',
          } as any)
          .select()
          .single();

        if (orderError) throw orderError;
        orderId = order.id;
        setPendingOrderId(order.id);

        const orderItems = items.map((item) => ({
          order_id: order.id,
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          price: item.menuItem.price,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;
      }

      // Pass exact breakdown to PaymentModal (DO NOT clear cart yet until payment completes!)
      setOrderData({
        id: orderId,
        subtotal: total,
        drink_total: drinkTotal,
        discount_amount: discountAmount,
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        total: grandTotal,
        vendor_id: effectiveVendorId,
        items: items.map((item) => ({
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.menuItem.price,
        })),
      });

      setShowPaymentModal(true);
    } catch (error) {
      console.error('Order creation error:', error);
      toast({
        title: 'Order failed',
        description: (error as any)?.message || 'Failed to create order',
        variant: 'destructive',
      });
    } finally {
      setIsOrdering(false);
    }
  };

  const handlePaymentSuccess = async (reference: string) => {
    // Increment promo usage if a promo was applied
    if (appliedPromo) {
      try {
        const { data: p } = await (supabase.from('promo_codes') as any)
          .select('used_count')
          .eq('id', appliedPromo.id)
          .maybeSingle();
        if (p) {
          await (supabase.from('promo_codes') as any)
            .update({ used_count: (Number(p.used_count) || 0) + 1 })
            .eq('id', appliedPromo.id);
        }
      } catch {
        /* ignore */
      }
    }

    // Clear cart ONLY after payment succeeds!
    clearCart();
    setShowPaymentModal(false);
    setPendingOrderId(null);

    toast({
      title: 'Order placed successfully! 🎉',
      description: 'Your order has been sent to the vendor.',
    });

    navigate(`/payment/verify?ref=${reference}&payment=success`);
  };

  if (items.length === 0 && !showPaymentModal) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">
              Add some delicious items to get started!
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Browse Menu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <AppNavbar />
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Your Order</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} dish{items.length !== 1 ? 'es' : ''} in your tray
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDrinkModal(true)}
            className="gap-1.5 rounded-full border-primary/30 text-xs font-semibold"
          >
            <GlassWater className="h-3.5 w-3.5 text-primary" />
            {selectedDrinks.length > 0
              ? `Drinks (${selectedDrinks.reduce((s, d) => s + d.quantity, 0)})`
              : '+ Add Cold Drink 🧊'}
          </Button>
        </div>

        {/* Cart Items */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.menuItem.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <h3 className="font-medium text-foreground truncate">{item.menuItem.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ₦{item.menuItem.price?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuantity(item.menuItem.id, Math.max(0, item.quantity - 1))
                      }
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-medium w-7 text-center">{item.quantity}</span>
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

              {/* Selected Drinks Upsell Summary */}
              {selectedDrinks.length > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <GlassWater className="h-3.5 w-3.5" /> Added Drinks
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDrinkModal(true)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Edit Drinks
                    </button>
                  </div>
                  {selectedDrinks.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {d.quantity}x {d.name}
                      </span>
                      <span className="font-medium">₦{(d.price * d.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Smart Campus Delivery Location & Micro-Dropoff Card */}
        <Card className="mb-6 border-primary/20 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label
                    htmlFor="location"
                    className="text-base font-bold flex items-center gap-1.5"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    How Should the Rider Find You?
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share your live GPS pin directly with the rider, or pick a campus spot
                  </p>
                </div>
              </div>

              {/* 2-Mode Switcher: Live GPS Pin (No typing needed) vs Campus Building / Address */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted border">
                <button
                  type="button"
                  onClick={handleLocationSelect}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    deliveryMode === 'live_gps'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Locate className={`h-4 w-4 ${deliveryMode === 'live_gps' ? 'animate-pulse' : ''}`} />
                  <span>Track My Live GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMode('address');
                    setIsSharingLiveStudentGps(false);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    deliveryMode === 'address'
                      ? 'bg-background text-foreground shadow-sm border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building className="h-4 w-4 text-orange-500" />
                  <span>Pick Campus Spot</span>
                </button>
              </div>

              {/* MODE 1: LIVE GPS TRACKING CARD (No physical address required!) */}
              {deliveryMode === 'live_gps' && (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-primary/15 text-primary mt-0.5">
                        <Navigation className={`h-5 w-5 ${geoLoading ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-heading font-bold text-sm text-foreground">
                            {geoLoading
                              ? 'Locking onto your GPS signal...'
                              : position || deliveryCoords
                              ? 'Live GPS Locked — No Address Needed! 📍'
                              : 'Waiting for GPS permission'}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {position || deliveryCoords
                            ? 'Your rider will see your exact live pin on their map and navigate straight to you.'
                            : 'Allow browser location access or switch to "Pick Campus Spot".'}
                        </p>
                        {(position || deliveryCoords) && (
                          <p className="text-[11px] font-mono text-primary font-semibold mt-1">
                            Coordinates: {(position?.lat ?? deliveryCoords?.lat)?.toFixed(5)},{' '}
                            {(position?.lng ?? deliveryCoords?.lng)?.toFixed(5)}
                            {position?.accuracy ? ` (±${Math.round(position.accuracy)}m)` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => getPosition()}
                      disabled={geoLoading}
                      className="text-xs h-8 shrink-0"
                    >
                      {geoLoading ? 'Locating...' : 'Refresh Pin'}
                    </Button>
                  </div>

                  {/* Delivery Zone Selector for Live GPS */}
                  {zones.length > 0 && (
                    <div className="pt-2 border-t border-primary/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <Label className="text-xs font-semibold text-foreground">
                        Your Current Campus Area (for delivery fee):
                      </Label>
                      <select
                        value={activeZoneName}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm"
                        onChange={(e) => {
                          const selected = zones.find((z) => z.zone_name === e.target.value);
                          if (selected) {
                            setActiveZoneName(selected.zone_name);
                            setDeliveryFee(Number(selected.delivery_fee));
                          }
                        }}
                      >
                        {zones.map((z) => (
                          <option key={z.id} value={z.zone_name}>
                            {z.zone_name} — ₦{Number(z.delivery_fee).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Optional landmark note if they want to add one */}
                  <div className="pt-1">
                    <Input
                      placeholder="Optional note for rider (e.g. Wearing a black hoodie by the car park)"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* MODE 2: CAMPUS SPOT / ADDRESS PICKER */}
              {deliveryMode === 'address' && (
                <>
                  <div className="flex items-center justify-end gap-1.5">
                    <LocationSelectorModal
                      currentLocation={deliveryLocation}
                      onLocationSelect={(name, obj, meta) => {
                        setDeliveryMode('address');
                        setDeliveryLocation(name);
                        if (meta?.dropoffPoint !== undefined) setSelectedDropoff(meta.dropoffPoint);
                        if (meta?.roomNumber !== undefined) setRoomNumber(meta.roomNumber);
                        if (meta?.deliveryFee) setDeliveryFee(meta.deliveryFee);
                        if (meta?.estimatedMins) setEstimatedMins(meta.estimatedMins);
                        if (meta?.zoneName) setActiveZoneName(meta.zoneName);
                        if (meta?.lat && meta?.lng) {
                          setDeliveryCoords({ lat: Number(meta.lat), lng: Number(meta.lng) });
                        } else if (obj?.lat && obj?.lng) {
                          setDeliveryCoords({ lat: Number(obj.lat), lng: Number(obj.lng) });
                        }
                      }}
                      triggerButton={
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1.5 font-semibold border-primary/30"
                        >
                          <Building className="h-3.5 w-3.5 text-orange-500" />
                          <span>Open Campus Picker & Pin Map</span>
                        </Button>
                      }
                    />
                  </div>

                  {/* Active Delivery Zone & ETA Summary Pill */}
                  {deliveryLocation && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {activeZoneName && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">
                            {activeZoneName}
                          </Badge>
                        )}
                        <span className="font-semibold text-foreground truncate">
                          {deliveryLocation.split(' • ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <Clock className="h-3.5 w-3.5" /> ~{estimatedMins} mins
                        </span>
                        <span className="font-bold text-foreground">
                          ₦{deliveryFee.toLocaleString()} fee
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick 1-Tap Popular Campus Spots */}
                  {campusLocations.filter((l) => l.is_popular).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" /> 1-Tap Campus Hubs:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {campusLocations
                          .filter((l) => l.is_popular)
                          .slice(0, 8)
                          .map((loc) => {
                            const isSelected =
                              matchedCampusBuilding?.id === loc.id ||
                              deliveryLocation.includes(loc.name);
                            return (
                              <button
                                key={loc.id}
                                type="button"
                                onClick={() => applyCampusSpot(loc)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-muted hover:bg-muted/80 text-foreground'
                                }`}
                              >
                                <Star
                                  className={`h-2.5 w-2.5 ${
                                    isSelected
                                      ? 'fill-primary-foreground'
                                      : 'fill-amber-400 text-amber-500'
                                  }`}
                                />
                                <span>
                                  {loc.short_code ? `${loc.short_code} • ` : ''}
                                  {loc.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Autocomplete Search Input */}
                  <div className="relative">
                    <Label htmlFor="location" className="text-xs text-muted-foreground block mb-1">
                      Building / Hostel / Landmark / Student Slang
                    </Label>
                    <Input
                      id="location"
                      value={deliveryLocation}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        setDeliveryLocation(e.target.value);
                        setShowSuggestions(true);
                      }}
                      placeholder="Search hostel, faculty, student slang, or lodge..."
                      className="w-full"
                    />

                    {showSuggestions &&
                      deliveryLocation.trim().length > 0 &&
                      campusLocations.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border bg-popover text-popover-foreground shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                          {filterCampusLocations(
                            campusLocations,
                            deliveryLocation.split(' • ')[0]
                          )
                            .slice(0, 7)
                            .map((loc) => (
                              <button
                                key={loc.id}
                                type="button"
                                onClick={() => applyCampusSpot(loc)}
                                className="w-full p-2.5 text-left flex items-start justify-between gap-2.5 hover:bg-muted/70 transition-colors border-b last:border-b-0"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-xs truncate">
                                        {loc.name}
                                      </span>
                                      {loc.short_code && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] px-1.5 py-0 font-bold"
                                        >
                                          {loc.short_code}
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1 py-0 capitalize"
                                      >
                                        {loc.category}
                                      </Badge>
                                    </div>
                                    {loc.description && (
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {loc.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="block text-xs font-bold text-foreground">
                                    ₦{resolveSpotFee(loc).toLocaleString()}
                                  </span>
                                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">
                                    ~{loc.estimated_delivery_mins || 15}m
                                  </span>
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

                  {/* Micro-Dropoff Point Selector & Room Input */}
                  {deliveryLocation.trim().length > 0 && (
                    <div className="rounded-xl border bg-muted/25 p-3.5 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                          <DoorOpen className="h-3.5 w-3.5 text-primary" />
                          Where exactly should the rider meet you?
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableDropoffs.map((point) => {
                            const active = selectedDropoff === point;
                            return (
                              <button
                                key={point}
                                type="button"
                                onClick={() => {
                                  setSelectedDropoff(point);
                                  localStorage.setItem('selected_campus_dropoff', point);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                                  active
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-background hover:bg-muted text-foreground border-border'
                                }`}
                              >
                                {active && <Check className="h-3 w-3" />}
                                <span>{point}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">
                            Block / Room Number (Optional)
                          </Label>
                          <Input
                            placeholder="e.g. Block B, Room 204"
                            value={roomNumber}
                            onChange={(e) => {
                              setRoomNumber(e.target.value);
                              localStorage.setItem('selected_campus_room', e.target.value);
                            }}
                            className="h-9 text-xs bg-background"
                          />
                        </div>

                        {/* Manual Zone Selector when typing a custom address */}
                        {!matchedCampusBuilding && zones.length > 0 && (
                          <div>
                            <Label className="text-[11px] text-muted-foreground block mb-1">
                              Delivery Zone
                            </Label>
                            <select
                              value={activeZoneName}
                              className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
                              onChange={(e) => {
                                const selected = zones.find((z) => z.zone_name === e.target.value);
                                if (selected) {
                                  setActiveZoneName(selected.zone_name);
                                  setDeliveryFee(Number(selected.delivery_fee));
                                }
                              }}
                            >
                              {zones.map((z) => (
                                <option key={z.id} value={z.zone_name}>
                                  {z.zone_name} — ₦{Number(z.delivery_fee).toLocaleString()}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* GPS Error banner */}
              {geoError && !position && (
                <div className="flex items-start justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">GPS Signal Unavailable</p>
                      <p className="mt-0.5">
                        {geoError} Switch to "Pick Campus Spot" above to select a building without GPS.
                      </p>
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
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Promo Code Redemption Card */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <Label className="text-sm font-bold flex items-center gap-1.5 mb-2.5">
              <Tag className="h-4 w-4 text-primary" />
              Promo / Discount Code
            </Label>
            {appliedPromo ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white font-mono">
                    {appliedPromo.code}
                  </Badge>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    -₦{appliedPromo.discountAmount.toLocaleString()} discount applied!
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                  }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code (e.g. CHOWPASS, WELCOME50)"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  className="uppercase font-mono text-xs h-10"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleApplyPromo}
                  disabled={applyingPromo || !promoInput.trim()}
                  className="h-10 px-4 text-xs font-bold shrink-0"
                >
                  {applyingPromo ? 'Checking...' : 'Apply Code'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Notes + 1-Tap Rider Handover Instructions */}
        <Card className="mb-6">
          <CardContent className="p-6 space-y-3">
            <Label htmlFor="notes" className="text-base font-semibold block">
              Rider Delivery Note & Kitchen Instructions
            </Label>

            {/* 1-Tap Delivery Handover Chips */}
            <div className="flex flex-wrap gap-1.5">
              {DELIVERY_INSTRUCTION_PRESETS.map((preset) => {
                const isSelected = deliveryInstruction === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDeliveryInstruction(isSelected ? '' : preset)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Extra pepper, no onions, or landmark tip for rider..."
              className="w-full"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Food Subtotal</span>
                <span>₦{total.toLocaleString()}</span>
              </div>
              {drinkTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Drinks Add-on</span>
                  <span>₦{drinkTotal.toLocaleString()}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Promo Discount ({appliedPromo?.code})</span>
                  <span>-₦{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Delivery Fee ({activeZoneName || 'Campus'} • ~{estimatedMins}m)
                </span>
                <span>₦{deliveryFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Platform Service Fee</span>
                <span>₦{platformFee.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2.5 mt-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Payable</span>
                  <span className="text-primary">₦{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Place Order Button */}
        <Button
          onClick={handlePlaceOrder}
          disabled={
            isOrdering ||
            (!deliveryLocation.trim() &&
              !(
                deliveryMode === 'live_gps' &&
                ((position?.lat && position?.lng) || (deliveryCoords?.lat && deliveryCoords?.lng))
              ))
          }
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 text-base font-bold rounded-xl shadow-lg"
        >
          {isOrdering ? 'Preparing Checkout...' : `Proceed to Payment • ₦${grandTotal.toLocaleString()}`}
        </Button>
      </div>

      {/* Drink Upsell Modal */}
      <DrinkUpsellModal
        open={showDrinkModal}
        onClose={() => setShowDrinkModal(false)}
        onConfirm={(drinks, customReq) => {
          setSelectedDrinks(drinks);
          setCustomDrink(customReq);
          setShowDrinkModal(false);
          if (drinks.length > 0 || customReq) {
            toast({
              title: 'Drinks added to your order! 🧊',
              description:
                drinks.length > 0
                  ? `${drinks.reduce((s, d) => s + d.quantity, 0)} cold drink(s) added`
                  : `Custom request: ${customReq?.name}`,
            });
          }
        }}
      />

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
