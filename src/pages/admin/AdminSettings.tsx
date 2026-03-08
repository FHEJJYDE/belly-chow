import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const AdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    platform_fee: 500,
    rider_fee: 500,
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        const d = data as any;
        setSettings({
          platform_fee: Number(d.platform_fee) || 500,
          rider_fee: Number(d.rider_fee) || 500,
          bank_name: d.bank_name || '',
          bank_account_name: d.bank_account_name || '',
          bank_account_number: d.bank_account_number || '',
        });
        setSettingsId(data.id);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload: any = {
      platform_fee: settings.platform_fee,
      rider_fee: settings.rider_fee,
      bank_name: settings.bank_name,
      bank_account_name: settings.bank_account_name,
      bank_account_number: settings.bank_account_number,
    };
    if (settingsId) {
      const { error } = await supabase.from('platform_settings').update(payload).eq('id', settingsId);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Settings saved ✓' });
    } else {
      const { data, error } = await supabase.from('platform_settings').insert(payload).select().single();
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { setSettingsId(data.id); toast({ title: 'Settings created ✓' }); }
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Platform Settings</h1>

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader><CardTitle>Fixed Fee Model</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A fixed service fee is added on top of every order. This fee is split between the platform and the rider.
            </p>
            <div>
              <Label>Platform Fee (₦)</Label>
              <Input
                type="number"
                value={settings.platform_fee}
                onChange={e => setSettings({ ...settings, platform_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Your earnings per order</p>
            </div>
            <div>
              <Label>Rider Fee (₦)</Label>
              <Input
                type="number"
                value={settings.rider_fee}
                onChange={e => setSettings({ ...settings, rider_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Rider earnings per delivery</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium">Total service fee per order: <span className="text-primary">₦{(settings.platform_fee + settings.rider_fee).toLocaleString()}</span></p>
              <p className="text-xs text-muted-foreground mt-1">
                e.g. ₦2,500 food → customer pays ₦{(2500 + settings.platform_fee + settings.rider_fee).toLocaleString()} total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Students will see these details when paying via bank transfer.</p>
            <div>
              <Label>Bank Name</Label>
              <Input placeholder="e.g. GTBank, Access Bank" value={settings.bank_name} onChange={e => setSettings({ ...settings, bank_name: e.target.value })} />
            </div>
            <div>
              <Label>Account Name</Label>
              <Input placeholder="e.g. BellyChow Ltd" value={settings.bank_account_name} onChange={e => setSettings({ ...settings, bank_account_name: e.target.value })} />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input placeholder="e.g. 0123456789" value={settings.bank_account_number} onChange={e => setSettings({ ...settings, bank_account_number: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full" size="lg">
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;
