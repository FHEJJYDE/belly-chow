import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateVendor } from '@/lib/vendorUtils';
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    const fetch = async () => {
      try {
        const data = await getOrCreateVendor(user.id, user.user_metadata?.full_name);
        if (data) {
          setVendor(data);
          setLogoUrl(data.logo_url || null);
          setForm({ name: data.name, description: data.description || '', address: data.address || '' });
        }
      } catch (err) {
        console.error('Error fetching vendor settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, authLoading]);

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

        {/* Platform Fee Notice Card */}
        <Card className="mt-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-5 space-y-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span>💳</span> Vendor Order & Delivery Charges
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Belly-Chow charges a flat <strong className="text-primary font-bold">₦200 per delivery</strong> deducted directly from order payouts. Your food subtotal minus ₦200 is automatically credited to your vendor balance upon customer receipt.
            </p>
          </CardContent>
        </Card>

        {/* Store Promotion & Featured Tier Card */}
        <Card className="mt-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-6 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Boost Store Visibility</span>
              <h2 className="font-heading text-lg font-bold">Featured Vendor Promotions 🌟</h2>
              <p className="text-xs text-muted-foreground mt-1">Get featured at the top of campus food searches and increase daily orders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'Bronze', price: '₦1,000 / wk', desc: 'Featured Badge + Top 10 Search Placement', tier: 'bronze' },
                { name: 'Silver', price: '₦2,500 / wk', desc: 'Featured Badge + Top 5 Placement + Category Highlight', tier: 'silver' },
                { name: 'Gold', price: '₦5,000 / wk', desc: 'Top #1 Homepage Banner + Gold Badge', tier: 'gold' },
              ].map((plan) => (
                <div key={plan.tier} className="rounded-lg border p-4 bg-background/80 space-y-2 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{plan.name} Plan</h3>
                    <p className="font-extrabold text-primary text-base mt-1">{plan.price}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{plan.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={vendor?.featured_tier === plan.tier ? 'default' : 'outline'}
                    className="w-full mt-2 text-xs"
                    onClick={async () => {
                      if (!vendor) return;
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      const { error } = await supabase.from('vendors').update({
                        featured_tier: plan.tier,
                        featured_until: nextWeek.toISOString(),
                        is_featured: true,
                      }).eq('id', vendor.id);
                      if (error) {
                        if (error.message?.includes('column') || error.message?.includes('schema cache')) {
                          toast({
                            title: 'Database Setup Required',
                            description: 'Please run migration 20260408000004_add_featured_vendor_columns.sql in your Supabase SQL Editor to enable featured vendor promotions.',
                            variant: 'destructive',
                          });
                        } else {
                          toast({ title: 'Error', description: error.message, variant: 'destructive' });
                        }
                      } else {
                        setVendor({ ...vendor, featured_tier: plan.tier, is_featured: true });
                        toast({ title: `${plan.name} Promotion Activated! 🚀`, description: 'Your store is now featured for 1 week.' });
                      }
                    }}
                  >
                    {vendor?.featured_tier === plan.tier ? 'Active Tier ✓' : 'Promote Store'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorSettings;
