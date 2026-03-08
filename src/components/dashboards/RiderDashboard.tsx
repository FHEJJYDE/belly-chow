import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Phone, User, Store, FileText, CreditCard, Package, ArrowLeft, Clock, CheckCircle2, Truck } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import DeliveryChat from '@/components/chat/DeliveryChat';
import DeliveryMap from '@/components/maps/DeliveryMap';

interface EnrichedOrder {
  id: string;
  status: string;
  total: number;
  delivery_fee: number;
  delivery_location: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  vendor_id: string;
  student_id: string;
  rider_id: string | null;
  vendor_name: string;
  vendor_address: string;
  customer_name: string;
  customer_phone: string;
  items: { name: string; quantity: number; price: number }[];
}

const RiderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<EnrichedOrder[]>([]);
  const [myOrders, setMyOrders] = useState<EnrichedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const { position, error: geoError } = useGeolocation(true);

  // Update rider location in active orders
  useEffect(() => {
    if (!position || !user || myOrders.length === 0) return;
    myOrders.forEach(async (order) => {
      await supabase.from('orders').update({
        rider_lat: position.lat,
        rider_lng: position.lng,
      } as any).eq('id', order.id);
    });
  }, [position, myOrders, user]);

  const enrichOrders = async (orders: any[]): Promise<EnrichedOrder[]> => {
    if (orders.length === 0) return [];

    const vendorIds = [...new Set(orders.map(o => o.vendor_id))];
    const { data: vendors } = await supabase.from('vendors').select('id, name, address').in('id', vendorIds);
    const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);

    const studentIds = [...new Set(orders.map(o => o.student_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', studentIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const orderIds = orders.map(o => o.id);
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id, quantity, price, menu_item_id')
      .in('order_id', orderIds);

    const menuItemIds = [...new Set(orderItems?.map(oi => oi.menu_item_id) || [])];
    let menuMap = new Map<string, string>();
    if (menuItemIds.length > 0) {
      const { data: menuItems } = await supabase.from('menu_items').select('id, name').in('id', menuItemIds);
      menuMap = new Map(menuItems?.map(m => [m.id, m.name]) || []);
    }

    const itemsByOrder = new Map<string, { name: string; quantity: number; price: number }[]>();
    orderItems?.forEach(oi => {
      const list = itemsByOrder.get(oi.order_id) || [];
      list.push({ name: menuMap.get(oi.menu_item_id) || 'Unknown', quantity: oi.quantity, price: oi.price });
      itemsByOrder.set(oi.order_id, list);
    });

    return orders.map(o => {
      const vendor = vendorMap.get(o.vendor_id);
      const profile = profileMap.get(o.student_id);
      return {
        ...o,
        vendor_name: vendor?.name || 'Unknown Vendor',
        vendor_address: vendor?.address || '',
        customer_name: profile?.full_name || 'Unknown',
        customer_phone: profile?.phone || '',
        items: itemsByOrder.get(o.id) || [],
      };
    });
  };

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const [avail, mine] = await Promise.all([
        supabase.from('orders').select('*').eq('status', 'ready').is('rider_id', null).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('rider_id', user.id).in('status', ['picked_up', 'delivering']).order('created_at', { ascending: false }),
      ]);

      const [enrichedAvail, enrichedMine] = await Promise.all([
        enrichOrders(avail.data || []),
        enrichOrders(mine.data || []),
      ]);

      setAvailableOrders(enrichedAvail);
      setMyOrders(enrichedMine);
      setLoading(false);

      // Auto-open active delivery view if there's an active order
      if (enrichedMine.length > 0 && !activeDeliveryId) {
        setActiveDeliveryId(enrichedMine[0].id);
      }
    };
    fetchOrders();

    const channel = supabase.channel('rider-orders').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => fetchOrders()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const updateData: any = { rider_id: user.id, status: 'picked_up' };
    if (position) {
      updateData.rider_lat = position.lat;
      updateData.rider_lng = position.lng;
    }
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Order accepted! 🏍️' });
    setActiveDeliveryId(orderId);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Order marked as ${status}` });
    if (status === 'delivered') setActiveDeliveryId(null);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const activeOrder = myOrders.find(o => o.id === activeDeliveryId);

  // ──────────────────────────────────────────────
  // ACTIVE DELIVERY VIEW — full-screen focused UI
  // ──────────────────────────────────────────────
  if (activeOrder) {
    const statusSteps = [
      { key: 'picked_up', label: 'Picked Up', icon: Package },
      { key: 'delivering', label: 'On the Way', icon: Truck },
      { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
    ];
    const currentStepIndex = statusSteps.findIndex(s => s.key === activeOrder.status);

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Slim header */}
        <div className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveDeliveryId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">Order #{activeOrder.id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(activeOrder.created_at).toLocaleTimeString()}
            </p>
          </div>
          <Badge variant={activeOrder.status === 'delivering' ? 'default' : 'secondary'} className="shrink-0">
            {activeOrder.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Map — takes prominent space */}
        <div className="relative">
          <DeliveryMap
            riderLat={position?.lat}
            riderLng={position?.lng}
            customerLat={activeOrder.delivery_lat}
            customerLng={activeOrder.delivery_lng}
            className="h-[250px] rounded-none"
          />
          {activeOrder.delivery_lat && activeOrder.delivery_lng && (
            <Button
              size="sm"
              className="absolute bottom-3 right-3 gap-1.5 shadow-lg"
              onClick={() => openInGoogleMaps(activeOrder.delivery_lat!, activeOrder.delivery_lng!)}
            >
              <Navigation className="h-4 w-4" /> Navigate
            </Button>
          )}
        </div>

        {/* Progress stepper */}
        <div className="px-4 py-4 bg-card border-b">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => {
              const Icon = step.icon;
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCurrent
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-muted bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[11px] font-medium ${isCurrent ? 'text-primary' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order details scrollable area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Pickup */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Store className="h-4 w-4 text-primary" /> Pickup From
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              <p className="font-semibold">{activeOrder.vendor_name}</p>
              {activeOrder.vendor_address && <p className="text-sm text-muted-foreground">{activeOrder.vendor_address}</p>}
            </CardContent>
          </Card>

          {/* Deliver To */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" /> Deliver To
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <p className="font-semibold flex items-center gap-1.5"><User className="h-4 w-4 text-muted-foreground" /> {activeOrder.customer_name}</p>
              <p className="text-sm text-muted-foreground">{activeOrder.delivery_location || 'No location set'}</p>
              {activeOrder.customer_phone && (
                <a href={`tel:${activeOrder.customer_phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  <Phone className="h-4 w-4" /> {activeOrder.customer_phone}
                </a>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          {activeOrder.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" /> Order Items
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {activeOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="font-medium">₦{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₦{Number(activeOrder.total).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Delivery Fee</span>
                  <span className="font-semibold text-primary">₦{Number(activeOrder.delivery_fee).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment & Notes */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{activeOrder.payment_method.replace('_', ' ')}</span>
                <Badge variant={activeOrder.payment_status === 'confirmed' ? 'default' : 'secondary'} className="ml-auto text-xs">
                  {activeOrder.payment_status}
                </Badge>
              </div>
              {activeOrder.notes && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground pt-1">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{activeOrder.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 z-30 bg-card border-t p-4 flex gap-3">
          <DeliveryChat orderId={activeOrder.id} otherName="Customer" />
          {activeOrder.status === 'picked_up' && (
            <Button className="flex-1 h-12 text-base gap-2" onClick={() => updateStatus(activeOrder.id, 'delivering')}>
              <Truck className="h-5 w-5" /> I'm On the Way
            </Button>
          )}
          {activeOrder.status === 'delivering' && (
            <Button className="flex-1 h-12 text-base gap-2" onClick={() => updateStatus(activeOrder.id, 'delivered')}>
              <CheckCircle2 className="h-5 w-5" /> Mark Delivered ✓
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // DEFAULT VIEW — order list / available
  // ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Rider Dashboard 🏍️</h1>
            <p className="text-sm text-muted-foreground">
              {isOnline ? '🟢 Online' : '🔴 Offline'}
              {position && <span className="ml-2">· GPS active</span>}
              {geoError && <span className="ml-2 text-destructive">· Location error</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label>Online</Label>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
          </div>
        </div>

        {/* Active Deliveries — compact cards that open detail view */}
        {myOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">Active Deliveries ({myOrders.length})</h2>
            <div className="space-y-3">
              {myOrders.map(order => (
                <Card key={order.id} className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setActiveDeliveryId(order.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Store className="h-3.5 w-3.5" /> {order.vendor_name}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location'}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant={order.status === 'delivering' ? 'default' : 'secondary'}>{order.status.replace('_', ' ')}</Badge>
                        <p className="text-sm font-medium text-primary">₦{Number(order.delivery_fee).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Orders */}
        <h2 className="mb-3 font-heading text-lg font-semibold">Available Orders ({availableOrders.length})</h2>
        {!isOnline ? (
          <p className="py-10 text-center text-muted-foreground">Go online to see available orders</p>
        ) : availableOrders.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No orders available right now. Hang tight! 🍕</p>
        ) : (
          <div className="space-y-3">
            {availableOrders.map(order => (
              <Card key={order.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Store className="h-3.5 w-3.5" /> {order.vendor_name}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location'}
                      </p>
                      {order.items.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Package className="inline h-3 w-3 mr-1" />
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      )}
                      {order.delivery_lat && (
                        <p className="text-xs text-accent">
                          📍 GPS — <button className="underline" onClick={(e) => { e.stopPropagation(); openInGoogleMaps(order.delivery_lat!, order.delivery_lng!); }}>Navigate</button>
                        </p>
                      )}
                      <p className="text-sm font-medium text-primary mt-1">Earn ₦{Number(order.delivery_fee).toLocaleString()}</p>
                    </div>
                    <Button onClick={() => acceptOrder(order.id)}>Accept</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiderDashboard;
