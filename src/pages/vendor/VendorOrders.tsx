import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, ImageIcon, CheckCircle, XCircle, Volume2, VolumeX, Download, MapPin } from 'lucide-react';
import DeliveryChat from '@/components/chat/DeliveryChat';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

const DeliveryMap = lazy(() => import('@/components/maps/DeliveryMap'));

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string } | null;
};

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode); gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime); oscillator.stop(ctx.currentTime + 0.5);
  } catch { }
};

const VendorOrders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCountRef = useRef(0);

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
    if (v) {
      setVendorId(v.id);
      const { data } = await supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(200);
      const newOrders = data || [];
      const newPending = newOrders.filter(o => o.status === 'pending').length;
      if (soundEnabled && newPending > prevOrderCountRef.current) playNotificationSound();
      prevOrderCountRef.current = newPending;
      setOrders(newOrders);
      if (newOrders.length > 0) {
        const { data: items } = await supabase.from('order_items').select('*, menu_items(name)').in('order_id', newOrders.map(o => o.id));
        const grouped: Record<string, OrderItem[]> = {};
        (items || []).forEach((item: any) => { if (!grouped[item.order_id]) grouped[item.order_id] = []; grouped[item.order_id].push(item); });
        setOrderItems(grouped);
      }
    }
    setLoading(false);
  }, [user, soundEnabled]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('vendor-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (!error) { setOrders(orders.map(o => o.id === orderId ? { ...o, status: status as any } : o)); toast({ title: `Order ${status}` }); }
  };

  const updatePaymentStatus = async (orderId: string, status: 'confirmed' | 'failed') => {
    const { error } = await supabase.from('orders').update({ payment_status: status as any }).eq('id', orderId);
    if (!error) { setOrders(orders.map(o => o.id === orderId ? { ...o, payment_status: status as any } : o)); toast({ title: `Payment ${status}` }); }
  };

  const exportCSV = () => {
    const delivered = orders.filter(o => o.status === 'delivered');
    if (delivered.length === 0) { toast({ title: 'No delivered orders to export' }); return; }
    const headers = ['Order ID', 'Date', 'Total', 'Delivery Fee', 'Payment Method', 'Payment Status', 'Location'];
    const rows = delivered.map(o => [
      o.id.slice(0, 8), 
      new Date(o.created_at).toLocaleDateString(), 
      Number(o.total), 
      Number(o.delivery_fee), 
      o.payment_method?.replace('_', ' ') || 'Unknown', 
      o.payment_status, 
      o.delivery_location
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report downloaded' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;

  const pending = orders.filter(o => o.status === 'pending');
  const active = orders.filter(o => ['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'].includes(o.status));
  const completed = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status));

  const OrderCard = ({ order }: { order: Order }) => {
    const items = orderItems[order.id] || [];
    const isExpanded = expandedOrders.has(order.id);
    return (
      <Card className="premium-card bg-card/30 border-border/40 overflow-hidden shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Order #{order.id.slice(0, 8)}</span>
                <Badge variant={order.status === 'pending' ? 'destructive' : 'outline'} className="text-[10px] uppercase font-bold tracking-wider">
                  {order.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ordered: {new Date(order.created_at).toLocaleString()}
              </p>
              <p className="text-xs font-semibold text-primary mt-1">
                Total: ₦{Number(order.total).toLocaleString()} · Payment: {order.payment_method?.replace('_', ' ') || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delivery location: {order.delivery_location}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {order.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => updateStatus(order.id, 'accepted')} className="font-semibold gap-1">
                    Accept Order
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'rejected')} className="font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive border-destructive/30">
                    Reject
                  </Button>
                </>
              )}
              {order.status === 'accepted' && (
                <Button size="sm" onClick={() => updateStatus(order.id, 'preparing')} className="font-semibold gap-1">
                  Start Preparing
                </Button>
              )}
              {order.status === 'preparing' && (
                <Button size="sm" onClick={() => updateStatus(order.id, 'ready')} className="font-semibold gap-1">
                  Mark Ready
                </Button>
              )}
            </div>
          </div>

          {/* Bank Transfer Payment Proof Section */}
          {order.payment_method === 'bank_transfer' && (
            <div className="rounded-xl border border-border/40 p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant={order.payment_status === 'confirmed' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'secondary'} className="gap-1 text-xs">
                  {order.payment_status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
                  {order.payment_status === 'failed' && <XCircle className="h-3 w-3" />}
                  Payment Proof Status: {order.payment_status}
                </Badge>
                
                {order.payment_status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(order.id, 'confirmed')} className="gap-1 h-7 text-xs border-green-500/30 text-green-500 hover:bg-green-500/5">
                      <CheckCircle className="h-3 w-3" /> Confirm Payment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(order.id, 'failed')} className="gap-1 h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/5">
                      <XCircle className="h-3 w-3" /> Reject Payment
                    </Button>
                  </div>
                )}
              </div>

              {(order as any).payment_proof_url && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5" /> Uploaded Payment Receipt
                  </p>
                  <a href={(order as any).payment_proof_url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
                    <img src={(order as any).payment_proof_url} alt="Payment proof" className="w-full max-h-36 rounded-lg object-contain bg-muted/30 border border-border/30 hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Order items toggle */}
          <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:bg-muted/10 py-1.5" onClick={() => toggleExpand(order.id)}>
            <span className="font-semibold">📦 {items.length} item{items.length !== 1 ? 's' : ''} listed</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {isExpanded && items.length > 0 && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-xs font-medium p-1">
                  <span className="text-muted-foreground">{item.menu_items?.name || 'Dish Item'} × {item.quantity}</span>
                  <span>₦{(Number(item.price) * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {order.notes && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-primary/50 pl-2">
              Note: {order.notes}
            </div>
          )}

          {(order as any).delivery_proof_url && (
            <div className="rounded-xl border border-border/40 p-4 bg-muted/10 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Rider Delivery Proof Photo
              </p>
              <a href={(order as any).delivery_proof_url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
                <img src={(order as any).delivery_proof_url} alt="Delivery proof" className="w-full max-h-36 rounded-lg object-contain bg-muted/30 border border-border/30 hover:opacity-90 transition-opacity" />
              </a>
            </div>
          )}

          {/* Live Rider Location Tracking Map for Vendor */}
          {['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'].includes(order.status) && ((order as any).rider_lat || (order as any).delivery_lat) && (
            <div className="rounded-xl border border-border/40 p-3 bg-muted/10 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary animate-pulse" /> Live Rider & Delivery Route
              </p>
              <Suspense fallback={<div className="h-44 bg-muted animate-pulse rounded-lg" />}>
                <DeliveryMap
                  riderLat={(order as any).rider_lat}
                  riderLng={(order as any).rider_lng}
                  customerLat={(order as any).delivery_lat}
                  customerLng={(order as any).delivery_lng}
                  height="180px"
                  className="rounded-lg border"
                  riderLabel="Rider 🏍️"
                  customerLabel="Customer 📍"
                />
              </Suspense>
            </div>
          )}

          {/* Active order chat link */}
          {['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'].includes(order.status) && (
            <div className="pt-2 border-t border-border/40">
              <DeliveryChat orderId={order.id} otherName="Rider & Student" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Manage Orders</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            Orders Pipeline
          </h1>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <VendorStatusToggle variant="compact" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? 'Mute Alerts' : 'Unmute Alerts'} className="h-9 w-9 border-border/40">
              {soundEnabled ? <Volume2 className="h-4.5 w-4.5 text-primary" /> : <VolumeX className="h-4.5 w-4.5 text-muted-foreground" />}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-9 border-border/40 font-semibold">
              <Download className="h-4 w-4" /> Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs lane */}
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 border border-border/40 p-1 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg font-semibold text-xs py-2">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg font-semibold text-xs py-2">
            Active ({active.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg font-semibold text-xs py-2">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending" className="mt-4 space-y-4 outline-none">
          {pending.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/40 rounded-2xl bg-card/10">
              <p className="text-sm text-muted-foreground">No pending orders. Good job! 🎉</p>
            </div>
          ) : (
            pending.map(o => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>
        
        <TabsContent value="active" className="mt-4 space-y-4 outline-none">
          {active.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/40 rounded-2xl bg-card/10">
              <p className="text-sm text-muted-foreground">No active orders in preparation.</p>
            </div>
          ) : (
            active.map(o => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4 space-y-4 outline-none">
          {completed.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/40 rounded-2xl bg-card/10">
              <p className="text-sm text-muted-foreground">No completed deliveries logged yet.</p>
            </div>
          ) : (
            completed.map(o => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorOrders;
