import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Star, ChevronDown, ChevronUp, MapPin, RotateCcw, AlertTriangle, Receipt } from 'lucide-react';
import OrderReceipt from '@/components/OrderReceipt';
import LivePulse from '@/components/LivePulse';
import { OrderCardSkeleton } from '@/components/Skeletons';
import EmptyState from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import ReviewDialog from '@/components/ReviewDialog';
import StudentOrderTracking from '@/components/StudentOrderTracking';
import type { Database } from '@/integrations/supabase/types';

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

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'delivering'];

const Orders = () => {
  const { user } = useAuth();
  const { addItem, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputedOrders, setDisputedOrders] = useState<Set<string>>(new Set());
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReorder = useCallback(async (orderId: string, vendorId: string) => {
    const items = orderItems[orderId] || [];
    if (items.length === 0) {
      toast({ title: 'No items found for this order', variant: 'destructive' });
      return;
    }
    const menuItemIds = items.map(i => i.menu_item_id);
    const { data: currentItems } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', menuItemIds)
      .eq('is_available', true);

    if (!currentItems || currentItems.length === 0) {
      toast({ title: 'These items are no longer available', variant: 'destructive' });
      return;
    }

    clearCart();
    currentItems.forEach(menuItem => {
      const originalItem = items.find(i => i.menu_item_id === menuItem.id);
      const qty = originalItem?.quantity || 1;
      for (let i = 0; i < qty; i++) {
        addItem(menuItem);
      }
    });

    const unavailable = menuItemIds.length - currentItems.length;
    if (unavailable > 0) {
      toast({ title: `${unavailable} item${unavailable > 1 ? 's' : ''} no longer available — the rest were added to your cart` });
    } else {
      toast({ title: 'Items added to cart! 🛒' });
    }
    navigate('/cart');
  }, [orderItems, clearCart, addItem, toast, navigate]);

  const handleSubmitDispute = async () => {
    if (!disputeOrder || !user || !disputeReason) return;
    setSubmittingDispute(true);
    const { error } = await supabase.from('disputes').insert({
      order_id: disputeOrder.id,
      user_id: user.id,
      reason: disputeReason,
      description: disputeDesc || null,
    } as any);
    setSubmittingDispute(false);
    if (error) {
      toast({ title: 'Error filing dispute', description: error.message, variant: 'destructive' });
      return;
    }
    setDisputedOrders(prev => new Set([...prev, disputeOrder.id]));
    setDisputeOrder(null);
    setDisputeReason('');
    setDisputeDesc('');
    toast({ title: 'Dispute filed ✅', description: 'Our team will review it shortly.' });
  };

  const fetchOrders = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      const { data } = await supabase.from('reviews').select('order_id').eq('user_id', user.id);
      setReviewedOrders(new Set(data?.map(r => r.order_id) || []));
    };

    const fetchDisputes = async () => {
      const { data } = await supabase.from('disputes').select('order_id').eq('user_id', user.id);
      setDisputedOrders(new Set(data?.map((d: any) => d.order_id) || []));
    };

    fetchOrders();
    fetchReviews();
    fetchDisputes();

    const channel = supabase.channel('my-orders').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `student_id=eq.${user.id}` },
      () => fetchOrders()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchOrders]);

  // Auto-open tracking for most recent active order
  useEffect(() => {
    if (!trackingOrderId && orders.length > 0) {
      const activeOrder = orders.find(o => ACTIVE_STATUSES.includes(o.status));
      if (activeOrder) {
        setTrackingOrderId(activeOrder.id);
      }
    }
  }, [orders, trackingOrderId]);

  if (loading) return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container max-w-2xl py-6">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">My Orders 📦</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <OrderCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );

  // Full-screen tracking view
  const trackingOrder = trackingOrderId ? orders.find(o => o.id === trackingOrderId) : null;
  if (trackingOrder && ACTIVE_STATUSES.includes(trackingOrder.status)) {
    return (
      <StudentOrderTracking
        order={trackingOrder}
        onBack={() => setTrackingOrderId(null)}
        onCancelled={() => { setTrackingOrderId(null); fetchOrders(); }}
      />
    );
  }

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container max-w-2xl py-6">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">My Orders 📦</h1>
          {activeOrders.length > 0 && <LivePulse />}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            emoji="📦"
            title="No orders yet"
            description="Browse vendors and place your first order!"
          />
        ) : (
          <div className="space-y-6">
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Orders</h2>
                <div className="space-y-3">
                  {activeOrders.map(order => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={() => setTrackingOrderId(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              ₦{(Number(order.total) + Number(order.delivery_fee)).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status] || ''}`}>
                              {order.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-primary font-medium">Tap to track →</span>
                          </div>
                        </div>
                        {/* Mini progress bar */}
                        <div className="mt-3 flex items-center gap-1">
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past Orders */}
            {pastOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past Orders</h2>
                <div className="space-y-3">
                  {pastOrders.map(order => {
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
                              {order.status === 'delivered' && (
                                <Button size="sm" variant="outline" onClick={() => setReceiptOrder(order)} className="gap-1">
                                  <Receipt className="h-3.5 w-3.5" /> Receipt
                                </Button>
                              )}
                              {['delivered', 'cancelled', 'rejected'].includes(order.status) && (
                                <Button size="sm" variant="outline" onClick={() => handleReorder(order.id, order.vendor_id)} className="gap-1">
                                  <RotateCcw className="h-3.5 w-3.5" /> Reorder
                                </Button>
                              )}
                              {!['pending'].includes(order.status) && !disputedOrders.has(order.id) && (
                                <Button size="sm" variant="ghost" onClick={() => setDisputeOrder(order)} className="gap-1 text-destructive hover:text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Report Issue
                                </Button>
                              )}
                              {disputedOrders.has(order.id) && (
                                <span className="text-xs text-muted-foreground">⚠️ Dispute filed</span>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full justify-between text-xs text-muted-foreground"
                            onClick={() => toggleExpand(order.id)}
                          >
                            {items.length} item{items.length !== 1 ? 's' : ''}
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
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

      {receiptOrder && (
        <OrderReceipt
          open={!!receiptOrder}
          onOpenChange={(open) => { if (!open) setReceiptOrder(null); }}
          order={receiptOrder as any}
          items={(orderItems[receiptOrder.id] || []).map(i => ({
            name: i.menu_items?.name || 'Item',
            quantity: i.quantity,
            price: Number(i.price),
          }))}
        />
      )}

      <Dialog open={!!disputeOrder} onOpenChange={open => { if (!open) setDisputeOrder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an Issue — Order #{disputeOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium">What went wrong?</p>
              <Select value={disputeReason} onValueChange={setDisputeReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wrong items received">Wrong items received</SelectItem>
                  <SelectItem value="Missing items">Missing items</SelectItem>
                  <SelectItem value="Food quality issue">Food quality issue</SelectItem>
                  <SelectItem value="Late delivery">Late delivery</SelectItem>
                  <SelectItem value="Order never delivered">Order never delivered</SelectItem>
                  <SelectItem value="Overcharged">Overcharged</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Details (optional)</p>
              <Textarea
                value={disputeDesc}
                onChange={e => setDisputeDesc(e.target.value)}
                placeholder="Describe the issue in more detail..."
              />
            </div>
            <Button onClick={handleSubmitDispute} disabled={!disputeReason || submittingDispute} className="w-full">
              {submittingDispute ? 'Submitting...' : 'Submit Dispute'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
