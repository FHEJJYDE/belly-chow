import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Tag, Trash2 } from 'lucide-react';

interface PromoCode {
  id: string;
  code: string;
  discount_amount: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const AdminPromoCodes = () => {
  const { toast } = useToast();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discount_amount: 200,
    min_order: 0,
    max_uses: 100,
    expires_at: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchPromos = async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }) as any;
    setPromos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPromos(); }, []);

  const createPromo = async () => {
    if (!form.code.trim()) { toast({ title: 'Code is required', variant: 'destructive' }); return; }
    setSaving(true);
    const payload: any = {
      code: form.code.toUpperCase().trim(),
      discount_amount: form.discount_amount,
      min_order: form.min_order,
      max_uses: form.max_uses,
      expires_at: form.expires_at || null,
    };
    const { error } = await supabase.from('promo_codes').insert(payload) as any;
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Promo code created! 🎉' });
    setShowCreate(false);
    setForm({ code: '', discount_amount: 200, min_order: 0, max_uses: 100, expires_at: '' });
    fetchPromos();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await (supabase.from('promo_codes') as any).update({ is_active: active }).eq('id', id);
    setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: active } : p));
  };

  const deletePromo = async (id: string) => {
    await (supabase.from('promo_codes') as any).delete().eq('id', id);
    setPromos(prev => prev.filter(p => p.id !== id));
    toast({ title: 'Promo deleted' });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Promo Codes 🏷️</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Create Code</Button>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{promos.length}</p>
          <p className="text-sm text-muted-foreground">Total Codes</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{promos.filter(p => p.is_active).length}</p>
          <p className="text-sm text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{promos.reduce((s, p) => s + p.used_count, 0)}</p>
          <p className="text-sm text-muted-foreground">Total Uses</p>
        </CardContent></Card>
      </div>

      {promos.length === 0 ? (
        <div className="py-20 text-center">
          <Tag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No promo codes yet</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Min Order</TableHead>
                  <TableHead className="text-right">Used / Max</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="outline" className="font-mono">{p.code}</Badge></TableCell>
                    <TableCell className="text-right">₦{p.discount_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">₦{p.min_order.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{p.used_count} / {p.max_uses}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      <Switch checked={p.is_active} onCheckedChange={v => toggleActive(p.id, v)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deletePromo(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Promo Code</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input placeholder="e.g. WELCOME50" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="uppercase font-mono" />
            </div>
            <div>
              <Label>Discount Amount (₦)</Label>
              <Input type="number" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Minimum Order (₦)</Label>
              <Input type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Max Uses</Label>
              <Input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Expiry Date (optional)</Label>
              <Input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <Button onClick={createPromo} disabled={saving} className="w-full">
              {saving ? 'Creating...' : 'Create Promo Code'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPromoCodes;
