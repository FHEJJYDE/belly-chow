import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const AdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ delivery_fee: 0, commission_rate: 0 });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        setSettings({ delivery_fee: data.delivery_fee, commission_rate: data.commission_rate });
        setSettingsId(data.id);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from('platform_settings').update({
        delivery_fee: settings.delivery_fee,
        commission_rate: settings.commission_rate,
      }).eq('id', settingsId);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else toast({ title: 'Settings saved ✓' });
    } else {
      const { data, error } = await supabase.from('platform_settings').insert({
        delivery_fee: settings.delivery_fee,
        commission_rate: settings.commission_rate,
      }).select().single();
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
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Default Delivery Fee (₦)</Label>
              <Input
                type="number"
                value={settings.delivery_fee}
                onChange={e => setSettings({ ...settings, delivery_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Commission Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.commission_rate}
                onChange={e => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) || 0 })}
              />
              <p className="mt-1 text-xs text-muted-foreground">Percentage taken from each order</p>
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
