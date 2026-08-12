import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, ImageIcon, CheckCircle, XCircle, Volume2, VolumeX, Download } from 'lucide-react';
import DeliveryChat from '@/components/chat/DeliveryChat';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

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
    const rows = delivered.map(o => [o.id.slice(0, 8), new Date(o.created_at).toLocaleDateString(), Number(o.total), Number(o.delivery_fee), o.payment_method.replace('_', ' '), o.payment_status, o.delivery_location]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report downloaded' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;

  const pending = orders.filter(o => o.status === 'pending');
  const active = orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status));
  const completed = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status));

  const OrderCard = ({ order }: { order: Order }) => {
    const items = orderItems[order.id] || [];
    const isExpanded = expandedOrders.has(order.id);
    return (
      <Card className="premium-card">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-sm">#{order.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')}</p>
              <p className="text-xs text-muted-foreground">{order.delivery_location} · {new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={order.status === 'pending' ? 'destructive' : 'outline'} className="text-xs capitalize">{order.status}</Badge>
              {order.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => updateStatus(order.id, 'accepted')}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, 'rejected')}>Reject</Button>
                </>
              )}
              {order.status === 'accepted' && <Button size="sm" onClick={() => updateStatus(order.id, 'preparing')}>Start preparing</Button>}
              {order.status === 'preparing' && <Button size="sm" onClick={() => updateStatus(order.id, 'ready')}>Mark ready</Button>}
            </div>
          </div>

          {order.payment_method === 'bank_transfer' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={order.payment_status === 'confirmed' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'secondary'} className="gap-1 text-xs">
                {order.payment_status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
                {order.payment_status === 'failed' && <XCircle className="h-3 w-3" />}
                Payment: {order.payment_status}
              </Badge>
              {order.payment_status === 'pending' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(order.id, 'confirmed')} className="gap-1 h-7 text-xs">
                    <CheckCircle className="h-3 w-3" /> Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(order.id, 'failed')} className="gap-1 h-7 text-xs text-destructive">
                    <XCircle className="h-3 w-3" /> Reject
                  </Button>
                </>
              )}
            </div>
          )}

          <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground" onClick={() => toggleExpand(order.id)}>
            {items.length} item{items.length !== 1 ? 's' : ''}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {isExpanded && items.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.menu_items?.name || 'Item'} × {item.quantity}</span>
                  <span className="text-muted-foreground">₦{(Number(item.price) * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {order.notes && <p className="text-xs text-muted-foreground italic">Note: {order.notes}</p>}

          {order.payment_method === 'bank_transfer' && (order as any).payment_proof_url && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Payment proof</p>
              <a href={(order as any).payment_proof_url} target="_blank" rel="noopener noreferrer">
                <img src={(order as any).payment_proof_url} alt="Payment proof" className="w-full max-h-48 rounded-md object-contain bg-muted cursor-pointer hover:opacity-80 transition-opacity" />
              </a>
            </div>
          )}

          {(order as any).delivery_proof_url && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> Delivery proof</p>
              <a href={(order as any).delivery_proof_url} target="_blank" rel="noopener noreferrer">
                <img src={(order as any).delivery_proof_url} alt="Delivery proof" className="w-full max-h-48 rounded-md object-contain bg-muted cursor-pointer hover:opacity-80 transition-opacity" />
              </a>
            </div>
          )}

          {['accepted', 'preparing', 'ready', 'picked_up', 'delivering'].includes(order.status) && (
            <DeliveryChat orderId={order.id} otherName="Rider & Student" />
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Manage</p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">Orders</h1>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <VendorStatusToggle variant="compact" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? 'Mute' : 'Unmute'}>
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No pending orders</p> : pending.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="active" className="mt-4 space-y-3">
          {active.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No active orders</p> : active.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No completed orders</p> : completed.map(o => <OrderCard key={o.id} order={o} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VendorOrders;
