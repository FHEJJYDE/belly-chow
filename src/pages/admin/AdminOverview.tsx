import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, DollarSign, Store, TrendingUp, ShoppingCart, Bike } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(142 71% 45%)',
  'hsl(0 84% 60%)',
  'hsl(47 96% 53%)',
  'hsl(280 65% 60%)',
  'hsl(200 80% 50%)',
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

  // Platform earnings (platform_fee * delivered orders)
  const platformEarnings = useMemo(() => delivered.length * 500, [delivered]); // default 500

  // Revenue over last 7 days
  const revenueByDay = useMemo(() => {
    const days: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      days[key] = { revenue: 0, orders: 0 };
    }
    delivered.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (key in days) {
        days[key].revenue += Number(o.total);
        days[key].orders++;
      }
    });
    return Object.entries(days).map(([day, data]) => ({ day, ...data }));
  }, [delivered]);

  // Orders by hour
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

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts)
      .map(([status, count]) => ({ status: status.replace('_', ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.payment_method] = (counts[o.payment_method] || 0) + 1; });
    return Object.entries(counts)
      .map(([method, count]) => ({ method: method.replace('_', ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const statCards = [
    { label: 'Total Revenue', value: `₦${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
    { label: 'Platform Earnings', value: `₦${platformEarnings.toLocaleString()}`, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Total Orders', value: orders.length, icon: Package, color: 'text-primary' },
    { label: 'Today\'s Orders', value: todayOrders.length, icon: ShoppingCart, color: 'text-secondary' },
    { label: 'Active Orders', value: activeOrders.length, icon: TrendingUp, color: 'text-primary' },
    { label: 'Total Vendors', value: vendorCount, icon: Store, color: 'text-secondary' },
    { label: 'Total Users', value: userCount, icon: Users, color: 'text-blue-500' },
    { label: 'Active Riders', value: riderCount, icon: Bike, color: 'text-orange-500' },
  ];

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Dashboard Overview 👑</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <s.icon className={`h-10 w-10 ${s.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="font-heading text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trend (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#adminRevGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-orange-500" /> Peak Order Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
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

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
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

        {/* Payment methods */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-3">
                {paymentBreakdown.map((p) => (
                  <div key={p.method} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{p.method}</span>
                      <span className="font-medium">{p.count} orders</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(p.count / orders.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <h2 className="mb-4 font-heading text-lg font-semibold">Recent Orders</h2>
      <div className="space-y-2">
        {orders.slice(0, 10).map(order => (
          <Card key={order.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  ₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')} · {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{order.status}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
