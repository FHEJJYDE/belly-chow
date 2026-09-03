import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';

interface Verification {
  id: string;
  user_id: string;
  document_url: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
}

interface VerificationWithProfile extends Verification {
  profile?: { full_name: string; phone: string | null } | null;
  role?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700',
  approved: 'bg-green-500/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-700',
};

const docTypeLabels: Record<string, string> = {
  national_id: 'National ID (NIN)',
  student_id: 'Student ID Card',
  drivers_license: "Driver's License",
  passport: 'International Passport',
};

const AdminVerifications = () => {
  const { toast } = useToast();
  const [verifications, setVerifications] = useState<VerificationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selected, setSelected] = useState<VerificationWithProfile | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const fetchVerifications = async () => {
    const { data } = await supabase.from('verifications').select('*').order('created_at', { ascending: false });
    const vData = (data as unknown as Verification[]) || [];

    // Fetch profiles and roles
    if (vData.length > 0) {
      const userIds = [...new Set(vData.map(v => v.user_id))];
      const { data: profilesData } = await supabase.from('profiles').select('*').in('user_id', userIds);
      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));

      setVerifications(vData.map(v => {
        const p = profileMap.get(v.user_id);
        return {
          ...v,
          profile: p ? { full_name: p.full_name, phone: p.phone } : null,
          role: p?.role || 'unknown',
        };
      }));
    } else {
      setVerifications([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVerifications(); }, []);

  const openDetail = async (v: VerificationWithProfile) => {
    setSelected(v);
    setNewStatus(v.status);
    setAdminNotes(v.admin_notes || '');

    // Get signed URL for the document
    const { data } = await supabase.storage.from('verification-docs').createSignedUrl(v.document_url, 3600);
    setDocUrl(data?.signedUrl || null);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase.from('verifications').update({
      status: newStatus,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    } as any).eq('id', selected.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Verification updated' });
    setSelected(null);
    setDocUrl(null);
    fetchVerifications();
  };

  const filtered = filterStatus === 'all' ? verifications : verifications.filter(v => v.status === filterStatus);
  const pendingCount = verifications.filter(v => v.status === 'pending').length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">Verifications 🛡️</h1>
      <p className="mb-6 text-sm text-muted-foreground">{pendingCount} pending verification{pendingCount !== 1 ? 's' : ''}</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Pending</p><p className="font-heading text-xl font-bold">{pendingCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Approved</p><p className="font-heading text-xl font-bold">{verifications.filter(v => v.status === 'approved').length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <XCircle className="h-8 w-8 text-destructive" />
          <div><p className="text-xs text-muted-foreground">Rejected</p><p className="font-heading text-xl font-bold">{verifications.filter(v => v.status === 'rejected').length}</p></div>
        </CardContent></Card>
      </div>

      <div className="mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({verifications.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No verifications found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => (
            <Card key={v.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{v.profile?.full_name || 'Unknown User'}</p>
                  <p className="text-sm text-muted-foreground">
                    {docTypeLabels[v.document_type] || v.document_type} · {v.profile?.phone || 'No phone'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{v.role}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[v.status]}`}>
                    {v.status}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openDetail(v)} className="gap-1">
                    <Eye className="h-3.5 w-3.5" /> Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setDocUrl(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Verification — {selected?.profile?.full_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div><span className="text-muted-foreground">Role:</span> <span className="capitalize font-medium">{selected.role}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{docTypeLabels[selected.document_type]}</span></div>
              </div>

              {/* Document preview */}
              {docUrl && (
                <div className="rounded-lg border bg-muted/30 p-2">
                  {selected.document_url.endsWith('.pdf') ? (
                    <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                      Open PDF Document ↗
                    </a>
                  ) : (
                    <img src={docUrl} alt="ID Document" className="max-h-64 w-full rounded object-contain" />
                  )}
                </div>
              )}

              <div>
                <p className="mb-1 text-sm font-medium">Decision</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approve ✅</SelectItem>
                    <SelectItem value="rejected">Reject ❌</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">Notes</p>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Reason for rejection or notes..." />
              </div>

              <Button onClick={handleUpdate} className="w-full">Save Decision</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVerifications;
