import { useEffect, useState, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronDown, ChevronUp, MapPin, MessageSquare } from 'lucide-react';
import DeliveryChat from '@/components/chat/DeliveryChat';
import type { Database } from '@/integrations/supabase/types';

const DeliveryMap = lazy(() => import('@/components/maps/DeliveryMap'));

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string } | null;
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700',
  accepted: 'bg-blue-500/10 text-blue-700',
  preparing: 'bg-purple-500/10 text-purple-700',
  ready: 'bg-cyan-500/10 text-cyan-700',
  picked_up: 'bg-indigo-500/10 text-indigo-700',
  delivering: 'bg-orange-500/10 text-orange-700',
  delivered: 'bg-green-500/10 text-green-700',
  cancelled: 'bg-red-500/10 text-red-700',
  rejected: 'bg-red-500/10 text-red-700',
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
      const list = data || [];
      setOrders(list);
      if (list.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('*, menu_items(name)')
          .in('order_id', list.slice(0, 150).map(o => o.id));
        const grouped: Record<string, OrderItem[]> = {};
        (items || []).forEach((item: any) => {
          if (!grouped[item.order_id]) grouped[item.order_id] = [];
          grouped[item.order_id].push(item);
        });
        setOrderItems(grouped);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = orders.filter(o => {
    const matchSearch = o.id.includes(search) || o.delivery_location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">All Orders</h1>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by order ID or location..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="delivering">Delivering</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{filtered.length} orders found</p>

      <div className="space-y-3">
        {filtered.map(order => {
          const isExpanded = expandedOrder === order.id;
          const items = orderItems[order.id] || [];
          const drinkItems: { name: string; quantity: number; price: number }[] = Array.isArray((order as any).drink_items)
            ? (order as any).drink_items
            : [];
          const hasCoords = Boolean((order as any).rider_lat || (order as any).delivery_lat);

          return (
            <Card key={order.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[order.status] || ''}`}>
                        {order.status}
                      </span>
                      {order.rider_id && <Badge variant="outline" className="text-xs">Rider assigned</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ₦{Number(order.total).toLocaleString()} (+₦{Number(order.delivery_fee).toLocaleString()} delivery) · {order.delivery_location}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()} · Payment: {order.payment_method?.replace('_', ' ') || 'N/A'} ({order.payment_status})
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 self-start sm:self-center"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {isExpanded ? 'Hide Details & Chat' : 'Inspect Map & Chat'}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t pt-3 space-y-4">
                    {/* Items & Drinks */}
                    {(items.length > 0 || drinkItems.length > 0) && (
                      <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                        <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Order Items</p>
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.menu_items?.name || 'Meal Item'} × {item.quantity}</span>
                            <span className="font-medium">₦{(Number(item.price) * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                        {drinkItems.map((drink, i) => (
                          <div key={`d-${i}`} className="flex justify-between">
                            <span>🥤 {drink.name} × {drink.quantity}</span>
                            <span className="font-medium">₦{(Number(drink.price) * Number(drink.quantity)).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Map */}
                    {hasCoords && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> Order GPS & Rider Pin
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

                    {/* Live 3-Way Chat Inspection / Participation */}
                    <DeliveryChat orderId={order.id} otherName="Student, Vendor & Rider" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No orders found</p>}
      </div>
    </div>
  );
};

export default AdminOrders;
