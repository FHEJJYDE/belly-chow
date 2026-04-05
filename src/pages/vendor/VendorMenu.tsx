import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

const VendorMenu = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'General' });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: v } = await supabase.from('vendors').select('id').eq('user_id', user.id).single();
      if (v) {
        setVendorId(v.id);
        const { data } = await supabase.from('menu_items').select('*').eq('vendor_id', v.id).order('category');
        setItems(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const addItem = async () => {
    if (!vendorId || !newItem.name || !newItem.price) return;
    const { data, error } = await supabase.from('menu_items').insert({
      vendor_id: vendorId, name: newItem.name, description: newItem.description,
      price: parseFloat(newItem.price), category: newItem.category,
    }).select().single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (data) setItems([...items, data]);
    setNewItem({ name: '', description: '', price: '', category: 'General' });
    setShowAdd(false);
    toast({ title: 'Item added' });
  };

  const toggleAvail = async (item: MenuItem) => {
    const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
    if (!error) setItems(items.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
  };

  const deleteItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
    toast({ title: 'Item removed' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Menu</p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">{items.length} items</h1>
        </div>
        <div className="flex items-center gap-4">
          <VendorStatusToggle variant="compact" />
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Add menu item</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label className="text-sm font-medium">Name</Label><Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Jollof Rice" /></div>
                <div className="space-y-2"><Label className="text-sm font-medium">Description</Label><Textarea value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Description..." /></div>
                <div className="space-y-2"><Label className="text-sm font-medium">Price (₦)</Label><Input type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="1500" /></div>
                <div className="space-y-2"><Label className="text-sm font-medium">Category</Label><Input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Main, Drinks, Snacks..." /></div>
                <Button onClick={addItem} className="w-full">Add item</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No menu items yet. Add your first dish.</p>
      ) : (
        <div className="space-y-8">
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground">{cat}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.filter(i => i.category === cat).map(item => (
                  <Card key={item.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">₦{Number(item.price).toLocaleString()}</p>
                        {item.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={!!item.is_available} onCheckedChange={() => toggleAvail(item)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorMenu;
