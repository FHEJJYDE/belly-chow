import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, DollarSign, Store, TrendingUp, ShoppingCart, Bike } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const PIE_COLORS = [
  'hsl(var(--foreground))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
  'hsl(var(--border))',
];

const AdminOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorCount, setVendorCount] = useState(0);
  const [pendingVendors, setPendingVendors] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [riderCount, setRiderCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [vendorsRes, ordersRes, rolesRes] = await Promise.all([
        supabase.from('vendors').select('id, is_approved'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('user_roles').select('role'),
      ]);
      const allVendors = vendorsRes.data || [];
      setVendorCount(allVendors.length);
      setPendingVendors(allVendors.filter(v => !v.is_approved).length);
      setOrders(ordersRes.data || []);
      const roles = rolesRes.data || [];
      setUserCount(roles.length);
      setRiderCount(roles.filter(r => r.role === 'rider').length);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const delivered = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = useMemo(() => orders.filter(o => o.created_at.startsWith(today)), [orders, today]);
  const activeOrders = useMemo(() => orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)), [orders]);
  const totalRevenue = useMemo(() => delivered.reduce((s, o) => s + Number(o.total), 0), [delivered]);
  const platformEarnings = useMemo(() => delivered.length * 500, [delivered]);

  const revenueByDay = useMemo(() => {
    const days: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      days[key] = { revenue: 0, orders: 0 };
    }
    delivered.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (key in days) { days[key].revenue += Number(o.total); days[key].orders++; }
    });
    return Object.entries(days).map(([day, data]) => ({ day, ...data }));
  }, [delivered]);

  const ordersByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 6; i <= 23; i++) hours[i] = 0;
    orders.forEach(o => { const h = new Date(o.created_at).getHours(); if (h in hours) hours[h]++; });
    return Object.entries(hours).map(([hour, count]) => ({ hour: `${Number(hour) % 12 || 12}${Number(hour) < 12 ? 'am' : 'pm'}`, count }));
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status: status.replace('_', ' '), count })).sort((a, b) => b.count - a.count);
  }, [orders]);

  const paymentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.payment_method] = (counts[o.payment_method] || 0) + 1; });
    return Object.entries(counts).map(([method, count]) => ({ method: method.replace('_', ' '), count })).sort((a, b) => b.count - a.count);
  }, [orders]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;

  const statCards = [
    { label: 'Total Revenue', value: `₦${totalRevenue.toLocaleString()}`, icon: DollarSign },
    { label: 'Platform Earnings', value: `₦${platformEarnings.toLocaleString()}`, icon: TrendingUp },
    { label: 'Total Orders', value: orders.length, icon: Package },
    { label: 'Today\'s Orders', value: todayOrders.length, icon: ShoppingCart },
    { label: 'Active Orders', value: activeOrders.length, icon: TrendingUp },
    { label: 'Vendors', value: vendorCount, icon: Store },
    { label: 'Users', value: userCount, icon: Users },
    { label: 'Riders', value: riderCount, icon: Bike },
  ];

  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Admin</p>
      <h1 className="mt-1 mb-8 font-heading text-2xl font-bold tracking-tight">Dashboard overview</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-heading text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Revenue · 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--foreground))" fill="url(#adminRevGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Peak hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Order status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No orders yet</p>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                      {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {statusBreakdown.map((s, i) => (
                    <div key={s.status} className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="capitalize text-muted-foreground">{s.status}</span>
                      <span className="ml-auto font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Payment methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-4">
                {paymentBreakdown.map((p) => (
                  <div key={p.method} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{p.method}</span>
                      <span className="font-medium">{p.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(p.count / orders.length) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">Recent orders</p>
      <div className="space-y-2">
        {orders.slice(0, 10).map(order => (
          <Card key={order.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">#{order.id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  ₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')} · {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-medium capitalize">{order.status}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
