import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import VendorLogoUpload from '@/components/VendorLogoUpload';
import VendorStatusToggle from '@/components/VendorStatusToggle';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const VendorSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase.from('vendors').select('*').eq('user_id', user.id).single();
      if (data) {
        setVendor(data);
        setLogoUrl(data.logo_url || null);
        setForm({ name: data.name, description: data.description || '', address: data.address || '' });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const save = async () => {
    if (!vendor) return;
    setSaving(true);
    const { error } = await supabase.from('vendors').update({
      name: form.name, description: form.description, address: form.address,
    }).eq('id', vendor.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Settings saved' });
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Store Profile</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            Vendor Settings
          </h1>
        </div>
        <VendorStatusToggle variant="compact" />
      </div>

      <div className="max-w-2xl">
        <Card className="premium-card bg-card/30 border-border/40 overflow-hidden shadow-sm">
          <CardContent className="space-y-6 p-6">
            {vendor && user && (
              <div className="pb-4 border-b border-border/40">
                <VendorLogoUpload
                  vendorId={vendor.id}
                  userId={user.id}
                  currentUrl={logoUrl}
                  vendorName={vendor.name}
                  onUploaded={setLogoUrl}
                />
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Store Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-background/50" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Store Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tell campus customers what delicious meals you serve..." className="bg-background/50 resize-none h-24" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Physical Store Location (Address)</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. Beside SUB, Main Campus" className="bg-background/50" />
              </div>
            </div>

            <Button onClick={save} disabled={saving} className="w-full font-semibold mt-4 shadow-sm shadow-primary/10">
              {saving ? 'Saving changes...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorSettings;
