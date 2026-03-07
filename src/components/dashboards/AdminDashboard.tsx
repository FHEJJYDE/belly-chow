import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, Package, DollarSign, Store } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

const AdminDashboard = () => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [v, o] = await Promise.all([
        supabase.from('vendors').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setVendors(v.data || []);
      setOrders(o.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const approveVendor = async (id: string) => {
    const { error } = await supabase.from('vendors').update({ is_approved: true }).eq('id', id);
    if (!error) {
      setVendors(vendors.map(v => v.id === id ? { ...v, is_approved: true } : v));
      toast({ title: 'Vendor approved ✓' });
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total), 0);
  const pendingVendors = vendors.filter(v => !v.is_approved);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <h1 className="mb-6 font-heading text-2xl font-bold">Admin Dashboard 👑</h1>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Store className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Total Vendors</p><p className="font-heading text-2xl font-bold">{vendors.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-secondary" />
            <div><p className="text-sm text-muted-foreground">Total Orders</p><p className="font-heading text-2xl font-bold">{orders.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-accent" />
            <div><p className="text-sm text-muted-foreground">Revenue</p><p className="font-heading text-2xl font-bold">₦{totalRevenue.toLocaleString()}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Pending Approvals</p><p className="font-heading text-2xl font-bold">{pendingVendors.length}</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="vendors">
          <TabsList>
            <TabsTrigger value="vendors">Vendors {pendingVendors.length > 0 && `(${pendingVendors.length} pending)`}</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="mt-4 space-y-3">
            {vendors.map(vendor => (
              <Card key={vendor.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <h4 className="font-medium">{vendor.name}</h4>
                    <p className="text-sm text-muted-foreground">{vendor.address || 'No address'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vendor.is_approved ? 'default' : 'secondary'}>
                      {vendor.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                    {!vendor.is_approved && (
                      <Button size="sm" onClick={() => approveVendor(vendor.id)}>Approve</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="orders" className="mt-4 space-y-3">
            {orders.slice(0, 30).map(order => (
              <Card key={order.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      ₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')} · {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge>{order.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
