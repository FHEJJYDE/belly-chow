import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GlassWater } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Drink {
  id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

const AdminDrinks = () => {
  const { toast } = useToast();
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', image_url: '' });
  const [saving, setSaving] = useState(false);

  const fetchDrinks = async () => {
    const { data } = await supabase.from('drinks' as any).select('*').order('created_at', { ascending: false });
    setDrinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDrinks(); }, []);

  const addDrink = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const { error } = await supabase.from('drinks' as any).insert({
      name: form.name.trim(),
      price: parseFloat(form.price),
      image_url: form.image_url.trim(),
    } as any);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Drink added ✓' });
      setForm({ name: '', price: '', image_url: '' });
      setDialogOpen(false);
      fetchDrinks();
    }
    setSaving(false);
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await supabase.from('drinks' as any).update({ is_available: !current } as any).eq('id', id);
    setDrinks(prev => prev.map(d => d.id === id ? { ...d, is_available: !current } : d));
  };

  const deleteDrink = async (id: string) => {
    await supabase.from('drinks' as any).delete().eq('id', id);
    setDrinks(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Drink removed' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">Drink Catalog</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add Drink</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Drink</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input placeholder="e.g. Coca-Cola" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Price (₦)</Label><Input type="number" placeholder="e.g. 300" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Image URL (optional)</Label><Input placeholder="https://..." value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div>
              <Button onClick={addDrink} disabled={saving || !form.name.trim() || !form.price} className="w-full">
                {saving ? 'Adding...' : 'Add Drink'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {drinks.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <GlassWater className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium">No drinks yet</p>
          <p className="text-sm text-muted-foreground">Add drinks that will be offered to students at checkout</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drinks.map(drink => (
            <Card key={drink.id} className={!drink.is_available ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-3 p-4">
                {drink.image_url ? (
                  <img src={drink.image_url} alt={drink.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <GlassWater className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{drink.name}</p>
                  <p className="text-sm text-muted-foreground">₦{Number(drink.price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={drink.is_available} onCheckedChange={() => toggleAvailability(drink.id, drink.is_available)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDrink(drink.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDrinks;
