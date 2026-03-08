import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, Ban, CheckCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Vendor = Database['public']['Tables']['vendors']['Row'];

const AdminVendors = () => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
      setVendors(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const approveVendor = async (id: string) => {
    const { error } = await supabase.from('vendors').update({ is_approved: true }).eq('id', id);
    if (!error) {
      setVendors(vendors.map(v => v.id === id ? { ...v, is_approved: true } : v));
      toast({ title: 'Vendor approved ✓' });
    }
  };

  const suspendVendor = async (id: string, active: boolean) => {
    const { error } = await supabase.from('vendors').update({ is_active: !active }).eq('id', id);
    if (!error) {
      setVendors(vendors.map(v => v.id === id ? { ...v, is_active: !active } : v));
      toast({ title: active ? 'Vendor suspended' : 'Vendor reactivated' });
    }
  };

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()));
  const pending = filtered.filter(v => !v.is_approved);
  const approved = filtered.filter(v => v.is_approved);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const VendorCard = ({ vendor }: { vendor: Vendor }) => (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1">
          <h4 className="font-medium">{vendor.name}</h4>
          <p className="text-sm text-muted-foreground">{vendor.address || 'No address'}</p>
          <p className="text-xs text-muted-foreground">{vendor.description || 'No description'}</p>
          <div className="mt-2 flex gap-2">
            <Badge variant={vendor.is_approved ? 'default' : 'secondary'}>{vendor.is_approved ? 'Approved' : 'Pending'}</Badge>
            <Badge variant={vendor.is_active ? 'default' : 'outline'}>{vendor.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {!vendor.is_approved && (
            <Button size="sm" onClick={() => approveVendor(vendor.id)}>
              <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {vendor.is_approved && (
            <Button size="sm" variant={vendor.is_active ? 'destructive' : 'outline'} onClick={() => suspendVendor(vendor.id, !!vendor.is_active)}>
              <Ban className="mr-1 h-3.5 w-3.5" /> {vendor.is_active ? 'Suspend' : 'Reactivate'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Manage Vendors</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search vendors..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? <p className="py-10 text-center text-muted-foreground">No pending vendors</p> : pending.map(v => <VendorCard key={v.id} vendor={v} />)}
        </TabsContent>
        <TabsContent value="approved" className="mt-4 space-y-3">
          {approved.map(v => <VendorCard key={v.id} vendor={v} />)}
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-3">
          {filtered.map(v => <VendorCard key={v.id} vendor={v} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVendors;
