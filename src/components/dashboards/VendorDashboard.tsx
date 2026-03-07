import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppNavbar from '@/components/layout/AppNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, DollarSign, Clock, Trash2, Edit } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];
type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Order = Database['public']['Tables']['orders']['Row'];

const VendorDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'General' });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: v } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
      if (v) {
        setVendor(v);
        const [items, ords] = await Promise.all([
          supabase.from('menu_items').select('*').eq('vendor_id', v.id).order('category'),
          supabase.from('orders').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(50),
        ]);
        setMenuItems(items.data || []);
        setOrders(ords.data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const toggleActive = async () => {
    if (!vendor) return;
    const { error } = await supabase.from('vendors').update({ is_active: !vendor.is_active }).eq('id', vendor.id);
    if (!error) setVendor({ ...vendor, is_active: !vendor.is_active });
  };

  const addMenuItem = async () => {
    if (!vendor || !newItem.name || !newItem.price) return;
    const { data, error } = await supabase.from('menu_items').insert({
      vendor_id: vendor.id,
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      category: newItem.category,
    }).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (data) setMenuItems([...menuItems, data]);
    setNewItem({ name: '', description: '', price: '', category: 'General' });
    setShowAddItem(false);
    toast({ title: 'Menu item added!' });
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
    if (!error) setMenuItems(menuItems.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  };

  const deleteItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id);
    setMenuItems(menuItems.filter(i => i.id !== id));
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);
    if (!error) setOrders(orders.map(o => o.id === orderId ? { ...o, status: status as any } : o));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (!vendor) return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-20 text-center">
        <h1 className="font-heading text-2xl font-bold">Setting up your vendor profile...</h1>
        <p className="text-muted-foreground">Please wait while we set things up.</p>
      </div>
    </div>
  );

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status));
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">{vendor.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={vendor.is_approved ? 'default' : 'secondary'}>
                {vendor.is_approved ? 'Approved' : 'Pending Approval'}
              </Badge>
              <Badge variant={vendor.is_active ? 'default' : 'outline'}>
                {vendor.is_active ? 'Open' : 'Closed'}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="active" className="text-sm">Open for orders</Label>
            <Switch id="active" checked={vendor.is_active} onCheckedChange={toggleActive} />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Pending Orders</p><p className="font-heading text-2xl font-bold">{pendingOrders.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-secondary" />
            <div><p className="text-sm text-muted-foreground">Active Orders</p><p className="font-heading text-2xl font-bold">{activeOrders.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-accent" />
            <div><p className="text-sm text-muted-foreground">Total Revenue</p><p className="font-heading text-2xl font-bold">₦{totalRevenue.toLocaleString()}</p></div>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders {pendingOrders.length > 0 && `(${pendingOrders.length})`}</TabsTrigger>
            <TabsTrigger value="menu">Menu ({menuItems.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3 mt-4">
            {orders.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No orders yet</p>
            ) : (
              orders.slice(0, 20).map(order => (
                <Card key={order.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">₦{Number(order.total).toLocaleString()} · {order.payment_method.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={order.status === 'pending' ? 'destructive' : 'default'}>{order.status}</Badge>
                      {order.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => updateOrderStatus(order.id, 'accepted')}>Accept</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order.id, 'rejected')}>Reject</Button>
                        </div>
                      )}
                      {order.status === 'accepted' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing')}>Start Preparing</Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready')}>Mark Ready</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="menu" className="mt-4">
            <div className="mb-4">
              <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Menu Item</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Name</Label><Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Jollof Rice" /></div>
                    <div><Label>Description</Label><Textarea value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Delicious party jollof..." /></div>
                    <div><Label>Price (₦)</Label><Input type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="1500" /></div>
                    <div><Label>Category</Label><Input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Main, Drinks, Snacks..." /></div>
                    <Button onClick={addMenuItem} className="w-full">Add Item</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {menuItems.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No menu items yet. Add your first dish!</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {menuItems.map(item => (
                  <Card key={item.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.category} · ₦{Number(item.price).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={item.is_available} onCheckedChange={() => toggleItemAvailability(item)} />
                        <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VendorDashboard;
