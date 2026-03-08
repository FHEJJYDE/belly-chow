import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Package, DollarSign, Store, TrendingUp, ShoppingCart } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalVendors: 0,
    pendingVendors: 0,
    totalOrders: 0,
    totalRevenue: 0,
    todayOrders: 0,
    activeOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [vendors, orders] = await Promise.all([
        supabase.from('vendors').select('id, is_approved'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200),
      ]);

      const allVendors = vendors.data || [];
      const allOrders = orders.data || [];
      const delivered = allOrders.filter(o => o.status === 'delivered');
      const todayOrd = allOrders.filter(o => o.created_at.startsWith(today));
      const active = allOrders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status));

      setStats({
        totalVendors: allVendors.length,
        pendingVendors: allVendors.filter(v => !v.is_approved).length,
        totalOrders: allOrders.length,
        totalRevenue: delivered.reduce((s, o) => s + Number(o.total), 0),
        todayOrders: todayOrd.length,
        activeOrders: active.length,
      });
      setRecentOrders(allOrders.slice(0, 10));
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const statCards = [
    { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
    { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'text-primary' },
    { label: 'Today\'s Orders', value: stats.todayOrders, icon: ShoppingCart, color: 'text-secondary' },
    { label: 'Active Orders', value: stats.activeOrders, icon: TrendingUp, color: 'text-primary' },
    { label: 'Total Vendors', value: stats.totalVendors, icon: Store, color: 'text-secondary' },
    { label: 'Pending Approvals', value: stats.pendingVendors, icon: Users, color: 'text-destructive' },
  ];

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Dashboard Overview 👑</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <h2 className="mb-4 font-heading text-lg font-semibold">Recent Orders</h2>
      <div className="space-y-2">
        {recentOrders.map(order => (
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
