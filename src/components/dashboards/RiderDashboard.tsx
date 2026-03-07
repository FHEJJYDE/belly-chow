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
import { Bike, DollarSign, Package, MapPin } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const RiderDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Real-time subscription for new ready orders
    const channel = supabase.channel('rider-orders').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => fetchOrders()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const acceptOrder = async (orderId: string) => {
    if (!user) return;
    const { error } = await supabase.from('orders').update({ rider_id: user.id, status: 'picked_up' }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Order accepted! 🏍️' });
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Order marked as ${status}` });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Rider Dashboard 🏍️</h1>
            <p className="text-sm text-muted-foreground">{isOnline ? 'You are online' : 'You are offline'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label>Online</Label>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
          </div>
        </div>

        {/* Active Deliveries */}
        {myOrders.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 font-heading text-lg font-semibold">Active Deliveries</h2>
            <div className="space-y-3">
              {myOrders.map(order => (
                <Card key={order.id} className="border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" /> {order.delivery_location || 'No location set'}
                        </p>
                        <p className="text-sm text-muted-foreground">₦{Number(order.total).toLocaleString()} + ₦{Number(order.delivery_fee).toLocaleString()} delivery</p>
                      </div>
                      <div className="flex gap-2">
                        {order.status === 'picked_up' && (
                          <Button size="sm" onClick={() => updateStatus(order.id, 'delivering')}>On the way</Button>
                        )}
                        {order.status === 'delivering' && (
                          <Button size="sm" onClick={() => updateStatus(order.id, 'delivered')}>Delivered ✓</Button>
                        )}
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
