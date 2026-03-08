import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Phone, User, Store, FileText, CreditCard, Package } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
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
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const { position, error: geoError, getPosition } = useGeolocation(true);

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

    // Get vendor info
    const vendorIds = [...new Set(orders.map(o => o.vendor_id))];
    const { data: vendors } = await supabase.from('vendors').select('id, name, address').in('id', vendorIds);
    const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);

    // Get customer profiles
    const studentIds = [...new Set(orders.map(o => o.student_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', studentIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Get order items with menu item names
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
    const menuMap = new Map(menuItems?.map(m => [m.id, m.name]) || []);

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
    setSelectedOrder(orderId);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Order marked as ${status}` });
    if (status === 'delivered') setSelectedOrder(null);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const activeOrder = myOrders.find(o => o.id === selectedOrder) || myOrders[0];

  const OrderInfoCard = ({ order, showActions = false }: { order: EnrichedOrder; showActions?: boolean }) => (
    <Card className={`${showActions && selectedOrder === order.id ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-base">Order #{order.id.slice(0, 8)}</p>
            <Badge variant={order.status === 'picked_up' ? 'default' : 'secondary'} className="mt-1">{order.status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString()}</p>
        </div>

        {/* Pickup - Vendor info */}
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">📍 Pickup From</p>
          <p className="flex items-center gap-1.5 font-medium text-sm"><Store className="h-3.5 w-3.5 text-primary" /> {order.vendor_name}</p>
          {order.vendor_address && <p className="text-xs text-muted-foreground ml-5">{order.vendor_address}</p>}
        </div>

        {/* Delivery - Customer info */}
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">📦 Deliver To</p>
          <p className="flex items-center gap-1.5 font-medium text-sm"><User className="h-3.5 w-3.5 text-primary" /> {order.customer_name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location set'}</p>
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
            </a>
          )}
          {order.delivery_lat && order.delivery_lng && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 gap-1"
              onClick={() => openInGoogleMaps(order.delivery_lat!, order.delivery_lng!)}
            >
              <Navigation className="h-3.5 w-3.5" /> Navigate to Customer
            </Button>
          )}
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">🛒 Items</p>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="text-muted-foreground">₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Payment & Notes */}
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" /> {order.payment_method.replace('_', ' ')}
          </span>
          <span className="font-medium">₦{Number(order.total).toLocaleString()} + ₦{Number(order.delivery_fee).toLocaleString()} delivery</span>
        </div>
        {order.notes && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.notes}
          </p>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex flex-wrap gap-2 pt-1">
            {order.delivery_lat && order.delivery_lng && (
              <Button size="sm" variant="outline" onClick={() => openInGoogleMaps(order.delivery_lat!, order.delivery_lng!)}>
                <Navigation className="mr-1 h-3.5 w-3.5" /> Directions
              </Button>
            )}
            {order.status === 'picked_up' && (
              <Button size="sm" onClick={() => updateStatus(order.id, 'delivering')}>On the way</Button>
            )}
            {order.status === 'delivering' && (
              <Button size="sm" onClick={() => updateStatus(order.id, 'delivered')}>Delivered ✓</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedOrder(order.id)}>Show Map</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

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

        {/* Map for active delivery */}
        {activeOrder && (
          <Card className="mb-6 overflow-hidden">
            <DeliveryMap
              riderLat={position?.lat}
              riderLng={position?.lng}
              customerLat={activeOrder.delivery_lat}
              customerLng={activeOrder.delivery_lng}
            />
          </Card>
        )}

        {/* Active Deliveries */}
        {myOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">Active Deliveries ({myOrders.length})</h2>
            <div className="space-y-3">
              {myOrders.map(order => (
                <OrderInfoCard key={order.id} order={order} showActions />
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
                    <div>
                      <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Store className="h-3.5 w-3.5" /> {order.vendor_name}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location'}
                      </p>
                      {order.items && order.items.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Package className="inline h-3 w-3 mr-1" />
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      )}
                      {order.delivery_lat && <p className="text-xs text-green-600">📍 GPS — <button className="underline" onClick={() => openInGoogleMaps(order.delivery_lat!, order.delivery_lng!)}>Navigate</button></p>}
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
