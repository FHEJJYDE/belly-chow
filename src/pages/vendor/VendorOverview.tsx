import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Package, Clock, DollarSign, TrendingUp, Star, ShoppingBag } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LivePulse from '@/components/LivePulse';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string } | null;
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(142 71% 45%)',
  'hsl(0 84% 60%)',
  'hsl(47 96% 53%)',
];

const VendorOverview = () => {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    const { data: v } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
    if (v) {
      setVendor(v);
      const { data: o } = await supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(500);
      setOrders(o || []);

      if (o && o.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('*, menu_items(name)')
          .in('order_id', o.map(ord => ord.id));
        setOrderItems((items as unknown as OrderItem[]) || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel('vendor-overview-rt').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new as Order;
        if (order && order.vendor_id === vendor.id) {
          fetchData();
        }
      }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor?.id]);

  const toggleActive = async () => {
    if (!vendor) return;
    const { error } = await supabase.from('vendors').update({ is_active: !vendor.is_active }).eq('id', vendor.id);
    if (!error) setVendor({ ...vendor, is_active: !vendor.is_active });
  };

  // Analytics computations
  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);
  const pending = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);
  const active = useMemo(() => orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status)).length, [orders]);
  const revenue = useMemo(() => delivered.reduce((s, o) => s + Number(o.total), 0), [delivered]);

  // Revenue over last 7 days
  const revenueByDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      days[key] = 0;
    }
    delivered.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (key in days) days[key] += Number(o.total);
    });
    return Object.entries(days).map(([day, amount]) => ({ day, amount }));
  }, [delivered]);

  // Orders by hour of day
  const ordersByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 6; i <= 23; i++) hours[i] = 0;
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      if (h in hours) hours[h]++;
    });
    return Object.entries(hours).map(([hour, count]) => ({
      hour: `${Number(hour) % 12 || 12}${Number(hour) < 12 ? 'am' : 'pm'}`,
      count,
    }));
  }, [orders]);

  // Popular items
  const popularItems = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; revenue: number }> = {};
    orderItems.forEach(item => {
      const name = item.menu_items?.name || 'Unknown';
      if (!counts[name]) counts[name] = { name, qty: 0, revenue: 0 };
      counts[name].qty += item.quantity;
      counts[name].revenue += Number(item.price) * item.quantity;
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [orderItems]);

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, count]) => ({ status: status.replace('_', ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!vendor) return <p className="py-20 text-center text-muted-foreground">Setting up your vendor profile...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold">{vendor.name}</h1>
            <LivePulse />
          </div>
          <div className="mt-1 flex gap-2">
            <Badge variant={vendor.is_approved ? 'default' : 'secondary'}>{vendor.is_approved ? 'Approved' : 'Pending Approval'}</Badge>
            <Badge variant={vendor.is_active ? 'default' : 'outline'}>{vendor.is_active ? 'Open' : 'Closed'}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="active" className="text-sm">Open for orders</Label>
          <Switch id="active" checked={!!vendor.is_active} onCheckedChange={toggleActive} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Package className="h-8 w-8 text-primary" />
          <div><p className="text-sm text-muted-foreground">Pending</p><p className="font-heading text-2xl font-bold">{pending}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-8 w-8 text-orange-500" />
          <div><p className="text-sm text-muted-foreground">Active</p><p className="font-heading text-2xl font-bold">{active}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <DollarSign className="h-8 w-8 text-green-500" />
          <div><p className="text-sm text-muted-foreground">Revenue</p><p className="font-heading text-2xl font-bold">₦{revenue.toLocaleString()}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <ShoppingBag className="h-8 w-8 text-blue-500" />
          <div><p className="text-sm text-muted-foreground">Total Orders</p><p className="font-heading text-2xl font-bold">{orders.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-orange-500" /> Peak Order Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Popular Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-yellow-500" /> Popular Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {popularItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No order data yet</p>
            ) : (
              <div className="space-y-3">
                {popularItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.qty} sold</p>
                      <p className="text-xs text-muted-foreground">₦{item.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-blue-500" /> Order Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                      {statusBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {statusBreakdown.map((s, i) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize">{s.status}</span>
                      <span className="ml-auto font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <h2 className="mb-3 font-heading text-lg font-semibold">Recent Orders</h2>
      <div className="space-y-2">
        {orders.slice(0, 10).map(order => (
          <Card key={order.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">#{order.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">₦{Number(order.total).toLocaleString()} · {new Date(order.created_at).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{order.status}</span>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && <p className="py-10 text-center text-muted-foreground">No orders yet</p>}
      </div>
    </div>
  );
};

export default VendorOverview;
