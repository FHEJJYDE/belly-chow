import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GlassWater, Upload, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { compressImage } from '@/lib/imageUtils';

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
  const [form, setForm] = useState({ name: '', price: '' });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDrinks = async () => {
    const { data } = await supabase.from('drinks' as any).select('*').order('created_at', { ascending: false });
    setDrinks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDrinks(); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return '';
    setUploading(true);
    const compressed = await compressImage(imageFile);
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `drinks/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('food-images').upload(path, compressed, { upsert: true });
    setUploading(false);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('food-images').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const addDrink = async () => {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const image_url = await uploadImage();
      const { error } = await supabase.from('drinks').insert({
        name: form.name.trim(),
        price: parseFloat(form.price),
        image_url,
      });
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Drink added ✓' });
        setForm({ name: '', price: '' });
        setImageFile(null);
        setImagePreview(null);
        setDialogOpen(false);
        fetchDrinks();
      }
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
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
              <div>
                <Label>Image (optional)</Label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {imagePreview ? (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-lg object-cover" />
                    <Button variant="outline" size="sm" onClick={() => { setImageFile(null); setImagePreview(null); }}>Remove</Button>
                  </div>
                ) : (
                  <Button variant="outline" className="mt-1.5 w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload Image
                  </Button>
                )}
              </div>
              <Button onClick={addDrink} disabled={saving || uploading || !form.name.trim() || !form.price} className="w-full">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding...</> : 'Add Drink'}
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
