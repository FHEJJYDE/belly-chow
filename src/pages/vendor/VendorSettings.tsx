import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const VendorSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: '', description: '', address: '', opening_time: '', closing_time: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
      if (data) {
        setVendor(data);
        setForm({
          name: data.name,
          description: data.description || '',
          address: data.address || '',
          opening_time: data.opening_time || '',
          closing_time: data.closing_time || '',
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const save = async () => {
    if (!vendor) return;
    setSaving(true);
    const { error } = await supabase.from('vendors').update({
      name: form.name,
      description: form.description,
      address: form.address,
      opening_time: form.opening_time,
      closing_time: form.closing_time,
    }).eq('id', vendor.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved ✓' });
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Store Settings</h1>
      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader><CardTitle>Store Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Store Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tell customers about your food..." /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. Behind SUB, Main Campus" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Opening Time</Label><Input type="time" value={form.opening_time} onChange={e => setForm({ ...form, opening_time: e.target.value })} /></div>
              <div><Label>Closing Time</Label><Input type="time" value={form.closing_time} onChange={e => setForm({ ...form, closing_time: e.target.value })} /></div>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving...' : 'Save Changes'}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorSettings;
