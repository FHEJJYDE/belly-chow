import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Star, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import ReviewDialog from '@/components/ReviewDialog';
import type { Database } from '@/integrations/supabase/types';

const DeliveryMap = lazy(() => import('@/components/maps/DeliveryMap'));

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string; image_url: string | null } | null;
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700',
  accepted: 'bg-blue-500/10 text-blue-700',
  preparing: 'bg-orange-500/10 text-orange-700',
  ready: 'bg-purple-500/10 text-purple-700',
  picked_up: 'bg-indigo-500/10 text-indigo-700',
  delivering: 'bg-cyan-500/10 text-cyan-700',
  delivered: 'bg-green-500/10 text-green-700',
  cancelled: 'bg-red-500/10 text-red-700',
  rejected: 'bg-red-500/10 text-red-700',
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [liveRiderPos, setLiveRiderPos] = useState<{ lat: number; lng: number } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      setOrders(data || []);

      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id);
        const { data: items } = await supabase
          .from('order_items')
          .select('*, menu_items(name, image_url)')
          .in('order_id', orderIds);
        const grouped: Record<string, OrderItem[]> = {};
        (items || []).forEach((item: any) => {
          if (!grouped[item.order_id]) grouped[item.order_id] = [];
          grouped[item.order_id].push(item);
        });
        setOrderItems(grouped);
      }
      setLoading(false);
    };

    const fetchReviews = async () => {
      const { data } = await supabase.from('reviews').select('order_id').eq('user_id', user.id);
      setReviewedOrders(new Set(data?.map(r => r.order_id) || []));
    };

    fetchOrders();
    fetchReviews();

    const channel = supabase.channel('my-orders').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `student_id=eq.${user.id}` },
      () => fetchOrders()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container max-w-2xl py-6">
        <h1 className="mb-6 font-heading text-2xl font-bold">My Orders 📦</h1>

        {orders.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const items = orderItems[order.id] || [];
              const isExpanded = expandedOrders.has(order.id);
              return (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          ₦{(Number(order.total) + Number(order.delivery_fee)).toLocaleString()} · {order.payment_method.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                        {order.delivery_location && (
                          <p className="mt-1 text-xs text-muted-foreground">📍 {order.delivery_location}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status] || ''}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.status === 'delivered' && !reviewedOrders.has(order.id) && (
                          <Button size="sm" variant="outline" onClick={() => setReviewOrder(order)} className="gap-1">
                            <Star className="h-3.5 w-3.5" /> Rate
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expand/collapse items */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-between text-xs text-muted-foreground"
                      onClick={() => toggleExpand(order.id)}
                    >
                      {items.length} item{items.length !== 1 ? 's' : ''}
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {isExpanded && items.length > 0 && (
                      <div className="mt-2 space-y-2 border-t pt-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {item.menu_items?.image_url && (
                                <img src={item.menu_items.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                              )}
                              <span>{item.menu_items?.name || 'Item'} × {item.quantity}</span>
                            </div>
                            <span className="text-muted-foreground">₦{(Number(item.price) * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground">
                          <span>Subtotal</span>
                          <span>₦{Number(order.total).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Delivery</span>
                          <span>₦{Number(order.delivery_fee).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Status tracker for active orders */}
                    {!['delivered', 'cancelled', 'rejected'].includes(order.status) && (
                      <div className="mt-4 flex items-center gap-1">
                        {['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered'].map((step, i, arr) => {
                          const currentIdx = arr.indexOf(order.status);
                          const isActive = i <= currentIdx;
                          return (
                            <div key={step} className="flex flex-1 items-center">
                              <div className={`h-2 w-full rounded-full ${isActive ? 'bg-primary' : 'bg-muted'}`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {reviewOrder && (
        <ReviewDialog
          open={!!reviewOrder}
          onOpenChange={(open) => { if (!open) setReviewOrder(null); }}
          orderId={reviewOrder.id}
          vendorId={reviewOrder.vendor_id}
          riderId={reviewOrder.rider_id}
          onReviewed={() => {
            setReviewedOrders(prev => new Set([...prev, reviewOrder.id]));
            setReviewOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default Orders;
