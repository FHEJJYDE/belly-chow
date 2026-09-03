import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateVendor } from '@/lib/vendorUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

const VendorMenu = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'General' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      try {
        const v = await getOrCreateVendor(user.id, user.user_metadata?.full_name);
        if (v) {
          setVendorId(v.id);
          const { data } = await supabase.from('menu_items').select('*').eq('vendor_id', v.id).order('category');
          setItems(data || []);
        }
      } catch (err) {
        console.error('Error fetching menu items:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, authLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const addItem = async () => {
    if (!vendorId || !newItem.name || !newItem.price) return;
    setUploading(true);
    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || 'jpg';
        const fileName = `menu-${vendorId}-${Date.now()}.${fileExt}`;

        // Attempt upload with 5-second timeout safety race so it never hangs
        const uploadTask = async () => {
          let bucketName = 'vendor-logos';
          let res = await supabase.storage.from('vendor-logos').upload(fileName, imageFile, { upsert: true });

          if (res.error) {
            bucketName = 'menu-items';
            res = await supabase.storage.from('menu-items').upload(fileName, imageFile, { upsert: true });
          }

          if (!res.error) {
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            return publicUrlData?.publicUrl || null;
          }
          return null;
        };

        const timeoutTask = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        imageUrl = await Promise.race([uploadTask(), timeoutTask]);
      }

      const { data, error } = await supabase.from('menu_items').insert({
        vendor_id: vendorId,
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category: newItem.category,
        image_url: imageUrl,
      }).select().single();

      if (error) throw error;
      if (data) setItems(prev => [...prev, data]);

      setNewItem({ name: '', description: '', price: '', category: 'General' });
      setImageFile(null);
      setImagePreview(null);
      setShowAdd(false);
      toast({ title: 'Item added successfully! 🍲' });
    } catch (err: any) {
      toast({ title: 'Error adding item', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
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
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Menu Catalog</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            {items.length} dishes listed
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <VendorStatusToggle variant="compact" />
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold shadow-sm shadow-primary/10">
                <Plus className="h-4 w-4" /> Add menu item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card/95 backdrop-blur-md border border-border/40 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl font-bold tracking-tight">Add Menu Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                {/* Meal Image Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meal Photo (Optional)</Label>
                  <div className="flex items-center gap-3">
                    {imagePreview ? (
                      <div className="relative h-16 w-16 rounded-lg overflow-hidden border bg-muted shrink-0">
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground shrink-0">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent">
                        <Upload className="h-3.5 w-3.5" />
                        {imageFile ? 'Change Photo' : 'Upload Meal Photo'}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item Name</Label>
                  <Input value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="Jollof Rice with Chicken" className="bg-background/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Spicy parboiled rice served with fried chicken and plantain..." className="bg-background/50 resize-none h-20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Price (₦)</Label>
                    <Input type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="1500" className="bg-background/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                    <Input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} placeholder="Mains, Sides, Drinks..." className="bg-background/50" />
                  </div>
                </div>
                <Button onClick={addItem} disabled={uploading} className="w-full font-semibold mt-2">
                  {uploading ? 'Uploading & Creating...' : 'Create Item'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border/40 rounded-2xl bg-card/10">
          <p className="text-sm text-muted-foreground">No menu items found. Add your first dish to start selling! 🍲</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(cat => (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {cat}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.filter(i => i.category === cat).map(item => (
                  <Card key={item.id} className="premium-card bg-card/30 border-border/40 hover:bg-card/40 transition-all overflow-hidden">
                    <CardContent className="flex items-start justify-between p-4.5 gap-3">
                      {item.image_url && (
                        <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden border bg-muted">
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm truncate">{item.name}</h4>
                        <p className="text-sm font-semibold text-primary mt-1">₦{Number(item.price).toLocaleString()}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold tracking-wider ${item.is_available ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {item.is_available ? 'Available' : 'Sold Out'}
                          </span>
                          <Switch checked={!!item.is_available} onCheckedChange={() => toggleAvail(item)} className="data-[state=checked]:bg-green-500" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors rounded-lg" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4.5 w-4.5" />
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
