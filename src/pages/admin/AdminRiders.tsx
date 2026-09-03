import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Bike, Search, ShieldCheck, Clock, CheckCircle, XCircle, Eye, CreditCard, Ban, FileText } from 'lucide-react';

interface RiderData {
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  campus_location: string | null;
  created_at: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  settings?: {
    vehicle_type: string;
    plate_number: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
  verification?: {
    id: string;
    document_type: string;
    document_url: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes: string | null;
    created_at: string;
  } | null;
}

const docTypeLabels: Record<string, string> = {
  national_id: 'National ID (NIN)',
  student_id: 'Student ID Card',
  drivers_license: "Driver's License",
  passport: 'Passport',
};

export default function AdminRiders() {
  const { toast } = useToast();
  const [riders, setRiders] = useState<RiderData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Vetting Modal state
  const [selectedRider, setSelectedRider] = useState<RiderData | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRiders = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles with role 'rider'
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const riderProfiles = (profiles || []).filter((p: any) => p.role === 'rider');
      if (riderProfiles.length === 0) {
        setRiders([]);
        setLoading(false);
        return;
      }

      const userIds = riderProfiles.map(p => p.user_id);

      // 2. Fetch rider_settings and verifications in parallel
      const [settingsRes, verificationsRes] = await Promise.all([
        supabase.from('rider_settings' as any).select('*').in('user_id', userIds),
        supabase.from('verifications' as any).select('*').in('user_id', userIds).order('created_at', { ascending: false }),
      ]);

      const settingsMap = new Map((settingsRes.data || []).map((s: any) => [s.user_id, s]));
      
      // Map latest verification for each rider
      const verificationsMap = new Map();
      (verificationsRes.data || []).forEach((v: any) => {
        if (!verificationsMap.has(v.user_id)) {
          verificationsMap.set(v.user_id, v);
        }
      });

      const merged: RiderData[] = riderProfiles.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || 'Unnamed Rider',
        phone: p.phone || null,
        email: p.email || null,
        campus_location: p.campus_location || null,
        created_at: p.created_at,
        is_suspended: p.is_suspended || false,
        suspension_reason: p.suspension_reason || null,
        settings: settingsMap.get(p.user_id) || null,
        verification: verificationsMap.get(p.user_id) || null,
      }));

      setRiders(merged);
    } catch (err: any) {
      toast({ title: 'Error loading riders', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const openVettingModal = async (rider: RiderData) => {
    setSelectedRider(rider);
    setNewStatus(rider.verification?.status || 'approved');
    setAdminNotes(rider.verification?.admin_notes || '');
    setDocUrl(null);

    if (rider.verification?.document_url) {
      const { data } = await supabase.storage.from('verification-docs').createSignedUrl(rider.verification.document_url, 3600);
      setDocUrl(data?.signedUrl || null);
    }
  };

  const handleUpdateVetting = async () => {
    if (!selectedRider) return;
    setUpdating(true);
    try {
      if (selectedRider.verification?.id) {
        // Update existing verification record
        const { error } = await supabase.from('verifications' as any).update({
          status: newStatus,
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedRider.verification.id);

        if (error) throw error;
      } else {
        // Insert new verification record if none existed
        const { error } = await supabase.from('verifications' as any).insert({
          user_id: selectedRider.user_id,
          document_type: 'drivers_license',
          document_url: '',
          status: newStatus,
          admin_notes: adminNotes,
        });

        if (error) throw error;
      }

      toast({ title: `Rider Vetting Updated to ${newStatus.toUpperCase()}! 🚀` });
      setSelectedRider(null);
      fetchRiders();
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const toggleSuspend = async (userId: string, currentlySuspended: boolean) => {
    const newStatus = !currentlySuspended;
    const { error } = await supabase.from('profiles').update({
      is_suspended: newStatus,
      suspension_reason: newStatus ? 'Suspended by admin' : null,
    } as any).eq('user_id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setRiders(prev => prev.map(r => r.user_id === userId ? { ...r, is_suspended: newStatus } : r));
    toast({ title: newStatus ? 'Rider suspended ⛔' : 'Rider unsuspended ✅' });
  };

  const filteredRiders = riders.filter(r => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.phone?.includes(search) ||
      r.settings?.plate_number?.toLowerCase().includes(search.toLowerCase());

    const status = r.verification?.status || 'pending';
    if (filter === 'all') return matchesSearch;
    return matchesSearch && status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riders & Vetting Management</h1>
          <p className="text-sm text-muted-foreground">
            View, vet identity documents, inspect vehicle details, and manage delivery riders.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-sm py-1 px-3 gap-1.5 border-primary/30 text-primary">
          <Bike className="h-4 w-4" />
          {riders.length} Registered Riders
        </Badge>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by rider name, phone, email, or plate number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              variant={filter === st ? 'default' : 'outline'}
              onClick={() => setFilter(st)}
              className="capitalize text-xs"
            >
              {st} ({riders.filter(r => st === 'all' ? true : (r.verification?.status || 'pending') === st).length})
            </Button>
          ))}
        </div>
      </div>

      {/* Riders Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredRiders.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Bike className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-lg">No riders found</p>
          <p className="text-sm mt-1">No rider accounts match your search filters.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRiders.map((rider) => {
            const vStatus = rider.verification?.status || 'pending';
            return (
              <Card key={rider.user_id} className={`relative transition-all ${rider.is_suspended ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
                        {rider.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {rider.full_name}
                          {rider.is_suspended && <span className="text-xs text-destructive font-medium">⛔ Suspended</span>}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{rider.email || 'No email'} · {rider.phone || 'No phone'}</p>
                      </div>
                    </div>
                    <Badge className={
                      vStatus === 'approved' ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' :
                      vStatus === 'rejected' ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' :
                      'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
                    }>
                      {vStatus === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                      {vStatus === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                      {vStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {vStatus.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs border-t pt-3">
                  {/* Vehicle Details */}
                  <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Vehicle Type</span>
                      <span className="font-medium capitalize">{rider.settings?.vehicle_type || 'Not Set'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Plate Number</span>
                      <span className="font-medium">{rider.settings?.plate_number || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Bank/Payout Info */}
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      {rider.settings?.bank_name ? `${rider.settings.bank_name} (${rider.settings.account_number})` : 'No payout bank linked'}
                    </span>
                    <span>Joined {new Date(rider.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openVettingModal(rider)}
                      className="gap-1.5 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Vet Documents & Status
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant={rider.is_suspended ? 'outline' : 'destructive'} className="gap-1 text-xs">
                          {rider.is_suspended ? <CheckCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                          {rider.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{rider.is_suspended ? 'Unsuspend' : 'Suspend'} {rider.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {rider.is_suspended
                              ? 'This will restore the rider\'s access to accepting delivery orders.'
                              : 'This will temporarily block the rider from receiving order requests.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => toggleSuspend(rider.user_id, rider.is_suspended)}>
                            {rider.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vetting Dialog */}
      <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Vet Rider: {selectedRider?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedRider && (
            <div className="space-y-4 py-2 text-sm">
              {/* Identity Document Preview */}
              <div>
                <span className="font-semibold block mb-1">Uploaded Identity Document</span>
                {selectedRider.verification ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Document Type: <span className="font-medium text-foreground">{docTypeLabels[selectedRider.verification.document_type] || selectedRider.verification.document_type}</span>
                    </p>
                    {docUrl ? (
                      <div className="border rounded-lg overflow-hidden max-h-48 bg-muted flex items-center justify-center p-2">
                        <img src={docUrl} alt="Rider Document" className="max-h-44 object-contain rounded" />
                      </div>
                    ) : (
                      <div className="border rounded-lg p-3 text-xs text-muted-foreground flex items-center justify-between">
                        <span>Document filepath: {selectedRider.verification.document_url}</span>
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-muted/30 text-center text-xs text-muted-foreground">
                    No verification document uploaded yet by rider.
                  </div>
                )}
              </div>

              {/* Set Status */}
              <div className="space-y-1.5">
                <span className="font-semibold block">Set Vetting Status</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['pending', 'approved', 'rejected'] as const).map((st) => (
                    <Button
                      key={st}
                      type="button"
                      size="sm"
                      variant={newStatus === st ? (st === 'approved' ? 'default' : st === 'rejected' ? 'destructive' : 'secondary') : 'outline'}
                      onClick={() => setNewStatus(st)}
                      className="capitalize text-xs"
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="space-y-1.5">
                <span className="font-semibold block text-xs">Admin Vetting Notes</span>
                <Textarea
                  placeholder="Optional notes (e.g., Driver license verified, clear NIN photo...)"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedRider(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUpdateVetting} disabled={updating}>
                  {updating ? 'Saving...' : 'Save Vetting Status'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
