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
    platform_fee: 100,
    vendor_delivery_fee: 200,
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
          platform_fee: Number(d.platform_fee) || 100,
          vendor_delivery_fee: Number(d.vendor_delivery_fee) || 200,
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
      vendor_delivery_fee: settings.vendor_delivery_fee,
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
      <h1 className="mb-6 font-heading text-2xl font-bold">Platform Settings & Fee Structure</h1>

      <div className="max-w-lg space-y-6">
        <Card>
          <CardHeader><CardTitle>Fee Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Platform revenue is generated via order platform fees and vendor delivery charges.
            </p>
            <div>
              <Label>Platform Fee per Order (Customer Pays) (₦)</Label>
              <Input
                type="number"
                value={settings.platform_fee}
                onChange={e => setSettings({ ...settings, platform_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Fee charged to customer per order (Default: ₦100)</p>
            </div>
            <div>
              <Label>Vendor Delivery Fee (Vendor Pays) (₦)</Label>
              <Input
                type="number"
                value={settings.vendor_delivery_fee}
                onChange={e => setSettings({ ...settings, vendor_delivery_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Fee charged to vendor per completed delivery (Default: ₦200)</p>
            </div>
            <div>
              <Label>Base Rider Delivery Fee (₦)</Label>
              <Input
                type="number"
                value={settings.rider_fee}
                onChange={e => setSettings({ ...settings, rider_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Base delivery payout for riders</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-semibold">Total Platform Revenue per Order:</p>
              <p className="text-lg font-bold text-primary">₦{(settings.platform_fee + settings.vendor_delivery_fee).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                (Customer Platform Fee ₦{settings.platform_fee} + Vendor Delivery Charge ₦{settings.vendor_delivery_fee})
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
