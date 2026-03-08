import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import DeliveryChat from '@/components/chat/DeliveryChat';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string } | null;
};

const VendorOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
      if (v) {
        setVendorId(v.id);
        const { data } = await supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(200);
        setOrders(data || []);

        if (data && data.length > 0) {
          const orderIds = data.map(o => o.id);
          const { data: items } = await supabase
            .from('order_items')
            .select('*, menu_items(name)')
            .in('order_id', orderIds);
          const grouped: Record<string, OrderItem[]> = {};
          (items || []).forEach((item: any) => {
            if (!grouped[item.order_id]) grouped[item.order_id] = [];
            grouped[item.order_id].push(item);
          });
          setOrderItems(grouped);
        }
      }
      setLoading(false);
    };
    fetchData();

    const channel = supabase.channel('vendor-orders').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData()
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: status as any } : o));
      toast({ title: `Order ${status}` });
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const pending = orders.filter(o => o.status === 'pending');
  const active = orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status));
  const completed = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status));

  const OrderCard = ({ order }: { order: Order }) => {
    const items = orderItems[order.id] || [];
    const isExpanded = expandedOrders.has(order.id);
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">#{order.id.slice(0, 8)}</p>
              <p className="text-sm text-muted-foreground">₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')}</p>
              <p className="text-xs text-muted-foreground">{order.delivery_location} · {new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={order.status === 'pending' ? 'destructive' : 'default'}>{order.status}</Badge>
              {order.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => updateStatus(order.id, 'accepted')}>Accept</Button>
                  <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, 'rejected')}>Reject</Button>
                </>
              )}
              {order.status === 'accepted' && <Button size="sm" onClick={() => updateStatus(order.id, 'preparing')}>Start Preparing</Button>}
              {order.status === 'preparing' && <Button size="sm" onClick={() => updateStatus(order.id, 'ready')}>Mark Ready</Button>}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs text-muted-foreground"
            onClick={() => toggleExpand(order.id)}
          >
            {items.length} item{items.length !== 1 ? 's' : ''}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {isExpanded && items.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.menu_items?.name || 'Item'} × {item.quantity}</span>
                  <span className="text-muted-foreground">₦{(Number(item.price) * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {order.notes && (
            <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>
          )}

          {/* Chat for active orders (picked_up, delivering, preparing, ready) */}
          {['accepted', 'preparing', 'ready', 'picked_up', 'delivering'].includes(order.status) && (
            <DeliveryChat orderId={order.id} otherName="Rider & Student" />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Orders</h1>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? <p className="py-10 text-center text-muted-foreground">No pending orders</p> : pending.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="active" className="mt-4 space-y-3">
          {active.length === 0 ? <p className="py-10 text-center text-muted-foreground">No active orders</p> : active.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 ? <p className="py-10 text-center text-muted-foreground">No completed orders</p> : completed.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorOrders;
