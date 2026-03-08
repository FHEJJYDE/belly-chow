import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Star } from 'lucide-react';
import ReviewDialog from '@/components/ReviewDialog';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

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
  const [loading, setLoading] = useState(true);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      setOrders(data || []);
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
            {orders.map(order => (
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
            ))}
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
