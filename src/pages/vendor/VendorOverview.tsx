import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateVendor } from '@/lib/vendorUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LivePulse from '@/components/LivePulse';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_items?: { name: string } | null;
};

const PIE_COLORS = [
  'hsl(var(--foreground))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
];

const VendorOverview = () => {
  const { user, loading: authLoading } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const v = await getOrCreateVendor(user.id, user.user_metadata?.full_name);
      if (v) {
        setVendor(v);
        const { data: o } = await supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(500);
        setOrders(o || []);
        if (o && o.length > 0) {
          const { data: items } = await supabase.from('order_items').select('*, menu_items(name)').in('order_id', o.map(ord => ord.id));
          setOrderItems((items as unknown as OrderItem[]) || []);
        }
      }
    } catch (err) {
      console.error('Error fetching vendor overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  useEffect(() => {
    if (!vendor) return;
    const channel = supabase.channel('vendor-overview-rt').on(
      'postgres_changes', { event: '*', schema: 'public', table: 'orders' },
      (payload) => { const order = payload.new as Order; if (order && order.vendor_id === vendor.id) fetchData(); }
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor?.id]);

  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);
  const pending = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);
  const active = useMemo(() => orders.filter(o => ['accepted', 'preparing', 'ready', 'picked_up', 'delivering', 'arrived'].includes(o.status)).length, [orders]);
  const revenue = useMemo(() => delivered.reduce((s, o) => s + Number(o.total), 0), [delivered]);

  const revenueByDay = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })] = 0;
    }
    delivered.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (key in days) days[key] += Number(o.total);
    });
    return Object.entries(days).map(([day, amount]) => ({ day, amount }));
  }, [delivered]);

  const ordersByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 6; i <= 23; i++) hours[i] = 0;
    orders.forEach(o => { const h = new Date(o.created_at).getHours(); if (h in hours) hours[h]++; });
    return Object.entries(hours).map(([hour, count]) => ({ hour: `${Number(hour) % 12 || 12}${Number(hour) < 12 ? 'am' : 'pm'}`, count }));
  }, [orders]);

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

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status: status.replace('_', ' '), count })).sort((a, b) => b.count - a.count);
  }, [orders]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;
  if (!vendor) return <p className="py-20 text-center text-muted-foreground">Setting up your vendor profile...</p>;

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Merchant Portal</p>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {vendor.name}
            </h1>
            <LivePulse />
          </div>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <Badge variant={vendor.is_approved ? 'default' : 'secondary'} className="text-xs font-medium px-2.5 py-0.5 gap-1.5">
              <i className={`fa-solid ${vendor.is_approved ? 'fa-circle-check' : 'fa-clock'} text-[11px]`} />
              {vendor.is_approved ? 'Verified Merchant' : 'Pending Verification'}
            </Badge>
            <Badge variant="outline" className={`text-xs font-medium px-2.5 py-0.5 gap-1.5 ${vendor.is_active ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${vendor.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              {vendor.is_active ? 'Accepting Orders' : 'Kitchen Closed'}
            </Badge>
            {vendor.rating && Number(vendor.rating) > 0 ? (
              <Badge variant="outline" className="text-xs font-semibold gap-1 border-amber-500/30 text-amber-600 bg-amber-500/10">
                <i className="fa-solid fa-star text-[10px] text-amber-500" />
                {Number(vendor.rating).toFixed(1)}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Status Toggle control */}
        <div className="shrink-0">
          <VendorStatusToggle variant="full" />
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Awaiting Action', value: pending, sub: 'New incoming orders', icon: 'fa-solid fa-bell-concierge', colorClass: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
          { label: 'In Kitchen', value: active, sub: 'Preparing & ready', icon: 'fa-solid fa-fire-burner', colorClass: 'text-sky-600 bg-sky-500/10 border-sky-500/20' },
          { label: 'Gross Revenue', value: `₦${revenue.toLocaleString()}`, sub: `${delivered.length} delivered orders`, icon: 'fa-solid fa-sack-dollar', colorClass: 'text-primary bg-primary/10 border-primary/20' },
          { label: 'Total Orders', value: orders.length, sub: 'All-time volume', icon: 'fa-solid fa-receipt', colorClass: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
        ].map(s => (
          <Card key={s.label} className="border-border/60 shadow-sm">
            <CardContent className="flex items-start justify-between p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="font-heading text-2xl font-bold mt-1.5 tracking-tight text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${s.colorClass}`}>
                <i className={`${s.icon} text-sm`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Visualizations Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <i className="fa-solid fa-chart-area text-primary" /> Revenue Flow (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.5)', borderRadius: '12px' }}
                  formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} 
                />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <i className="fa-solid fa-clock text-primary" /> Peak Kitchen Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border) / 0.5)', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Popular Items & Status Breakdown */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <i className="fa-solid fa-ranking-star text-primary" /> Top Performing Dishes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {popularItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No dishes sold yet. Add items to your menu to begin selling.</div>
            ) : (
              <div className="space-y-3">
                {popularItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">#{i + 1}</span>
                      <span className="text-sm font-semibold">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{item.qty} portions</p>
                      <p className="text-xs text-muted-foreground">₦{item.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="premium-card bg-card/30 border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order Status Share</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {statusBreakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No orders captured yet.</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
                <ResponsiveContainer width={140} height={140} className="shrink-0">
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                      {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 w-full">
                  {statusBreakdown.map((s, i) => (
                    <div key={s.status} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize font-medium text-muted-foreground">{s.status}</span>
                      <span className="ml-auto font-bold">{s.count} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders log */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Orders Activity</p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {orders.slice(0, 6).map(order => (
            <Card key={order.id} className="premium-card bg-card/25 border-border/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-sm">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleDateString()} · {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant={order.status === 'delivered' ? 'default' : order.status === 'pending' ? 'destructive' : 'secondary'} className="text-[10px] uppercase font-bold tracking-wider shrink-0">
                    {order.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="font-semibold capitalize">{order.payment_method?.replace('_', ' ') || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Order Amount</span>
                  <span className="font-bold text-primary">₦{Number(order.total).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {orders.length === 0 && (
            <div className="col-span-full py-12 text-center border rounded-2xl bg-card/20 border-dashed border-border/40">
              <p className="text-sm text-muted-foreground">No orders logged yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorOverview;
