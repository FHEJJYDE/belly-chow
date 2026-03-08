import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import DeliveryMap from '@/components/maps/DeliveryMap';

const RiderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
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

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const [avail, mine] = await Promise.all([
        supabase.from('orders').select('*').eq('status', 'ready').is('rider_id', null).order('created_at', { ascending: false }),
        supabase.from('orders').select('*').eq('rider_id', user.id).in('status', ['picked_up', 'delivering']).order('created_at', { ascending: false }),
      ]);
      setAvailableOrders(avail.data || []);
      setMyOrders(mine.data || []);
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
            <h2 className="mb-3 font-heading text-lg font-semibold">Active Deliveries</h2>
            <div className="space-y-3">
              {myOrders.map(order => (
                <Card key={order.id} className={`border-primary ${selectedOrder === order.id ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location set'}
                        </p>
                        <p className="text-sm text-muted-foreground">₦{Number(order.total).toLocaleString()} + ₦{Number(order.delivery_fee).toLocaleString()} delivery</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {order.delivery_lat && order.delivery_lng && (
                          <Button size="sm" variant="outline" onClick={() => openInGoogleMaps(order.delivery_lat, order.delivery_lng)}>
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
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location'}
                    </p>
                    <p className="text-sm font-medium text-primary">Earn ₦{Number(order.delivery_fee).toLocaleString()}</p>
                    {order.delivery_lat && <p className="text-xs text-muted-foreground">📍 GPS location available</p>}
                  </div>
                  <Button onClick={() => acceptOrder(order.id)}>Accept</Button>
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
