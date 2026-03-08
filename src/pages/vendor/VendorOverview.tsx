import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Package, Clock, DollarSign } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

const VendorOverview = () => {
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: v } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
      if (v) {
        setVendor(v);
        const { data: o } = await supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(50);
        setOrders(o || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggleActive = async () => {
    if (!vendor) return;
    const { error } = await supabase.from('vendors').update({ is_active: !vendor.is_active }).eq('id', vendor.id);
    if (!error) setVendor({ ...vendor, is_active: !vendor.is_active });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!vendor) return <p className="py-20 text-center text-muted-foreground">Setting up your vendor profile...</p>;

  const pending = orders.filter(o => o.status === 'pending').length;
  const active = orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status)).length;
  const revenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + Number(o.total), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">{vendor.name}</h1>
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

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Package className="h-8 w-8 text-primary" />
          <div><p className="text-sm text-muted-foreground">Pending Orders</p><p className="font-heading text-2xl font-bold">{pending}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-8 w-8 text-secondary" />
          <div><p className="text-sm text-muted-foreground">Active Orders</p><p className="font-heading text-2xl font-bold">{active}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <DollarSign className="h-8 w-8 text-accent" />
          <div><p className="text-sm text-muted-foreground">Total Revenue</p><p className="font-heading text-2xl font-bold">₦{revenue.toLocaleString()}</p></div>
        </CardContent></Card>
      </div>

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
