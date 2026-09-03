import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Ban, CheckCircle, Store } from 'lucide-react';

interface VendorItem {
  id: string;
  user_id: string;
  name: string;
  description: string;
  address: string;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  phone?: string | null;
}

const AdminVendors = () => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles where role = 'vendor'
      const { data: vendorProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'vendor' as any);

      // 2. Fetch existing records from vendors table
      const { data: vendorRecords } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      const existingVendors = (vendorRecords || []).slice();
      const vendorMap = new Map(existingVendors.map(v => [v.user_id, v]));

      const combined: VendorItem[] = [];

      // Add all existing vendor table entries
      existingVendors.forEach(v => {
        combined.push({
          id: v.id,
          user_id: v.user_id,
          name: v.name,
          description: v.description || '',
          address: v.address || '',
          is_approved: v.is_approved || false,
          is_active: v.is_active ?? true,
          created_at: v.created_at,
        });
      });

      // Add vendor user profiles that don't have a row in vendors table yet
      (vendorProfiles || []).forEach((p: any) => {
        if (!vendorMap.has(p.user_id)) {
          combined.push({
            id: `temp-${p.user_id}`,
            user_id: p.user_id,
            name: p.full_name ? `${p.full_name}'s Kitchen` : 'Campus Vendor Store',
            description: 'Registered Vendor Account',
            address: p.campus_location || 'Campus Location',
            is_approved: false,
            is_active: true,
            created_at: p.created_at,
            phone: p.phone,
          });
        }
      });

      setVendors(combined);
    } catch (err: any) {
      toast({ title: 'Error loading vendors', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const approveVendor = async (v: VendorItem) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .upsert({
          user_id: v.user_id,
          name: v.name,
          is_approved: true,
          is_active: true,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: `Vendor "${v.name}" approved! ✓` });
      fetchVendors();
    } catch (err: any) {
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    }
  };

  const suspendVendor = async (v: VendorItem, currentlyActive: boolean) => {
    try {
      const newStatus = !currentlyActive;
      const { error } = await supabase
        .from('vendors')
        .upsert({
          user_id: v.user_id,
          name: v.name,
          is_active: newStatus,
          is_approved: v.is_approved,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;

      toast({ title: newStatus ? 'Vendor reactivated' : 'Vendor suspended' });
      fetchVendors();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
  const pending = filtered.filter(v => !v.is_approved);
  const approved = filtered.filter(v => v.is_approved);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const VendorCard = ({ vendor }: { vendor: VendorItem }) => (
    <Card className="transition-all hover:shadow-sm">
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-semibold text-base">{vendor.name}</h4>
            <p className="text-xs text-muted-foreground">{vendor.address || 'No address provided'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{vendor.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={vendor.is_approved ? 'default' : 'secondary'} className={vendor.is_approved ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'}>
                {vendor.is_approved ? 'Approved' : 'Pending Approval'}
              </Badge>
              <Badge variant={vendor.is_active ? 'outline' : 'destructive'} className="text-xs">
                {vendor.is_active ? 'Active' : 'Suspended'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          {!vendor.is_approved && (
            <Button size="sm" onClick={() => approveVendor(vendor)}>
              <CheckCircle className="mr-1.5 h-4 w-4" /> Approve Store
            </Button>
          )}
          {vendor.is_approved && (
            <Button size="sm" variant={vendor.is_active ? 'destructive' : 'outline'} onClick={() => suspendVendor(vendor, vendor.is_active)}>
              <Ban className="mr-1.5 h-4 w-4" /> {vendor.is_active ? 'Suspend' : 'Reactivate'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vendor Management</h1>
        <p className="text-sm text-muted-foreground">Approve, monitor, and manage vendor store accounts across the platform.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search vendors by store name..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="all">All Vendors ({filtered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No pending vendor applications</Card>
          ) : (
            pending.map(v => <VendorCard key={v.user_id} vendor={v} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-3">
          {approved.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No approved vendors yet</Card>
          ) : (
            approved.map(v => <VendorCard key={v.user_id} vendor={v} />)
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No vendors found</Card>
          ) : (
            filtered.map(v => <VendorCard key={v.user_id} vendor={v} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVendors;
