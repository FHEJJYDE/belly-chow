import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Dispute {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-yellow-500/10 text-yellow-700',
  investigating: 'bg-blue-500/10 text-blue-700',
  resolved: 'bg-green-500/10 text-green-700',
  dismissed: 'bg-muted text-muted-foreground',
};

const AdminDisputes = () => {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');

  const fetchDisputes = async () => {
    const { data } = await supabase
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });
    setDisputes((data as Dispute[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDisputes(); }, []);

  const handleUpdate = async () => {
    if (!selected) return;
    const updates: any = {};
    if (newStatus) updates.status = newStatus;
    if (adminNotes) updates.admin_notes = adminNotes;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('disputes').update(updates).eq('id', selected.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dispute updated' });
    setSelected(null);
    fetchDisputes();
  };

  const openDetail = (d: Dispute) => {
    setSelected(d);
    setAdminNotes(d.admin_notes || '');
    setNewStatus(d.status);
  };

  const filtered = filterStatus === 'all' ? disputes : disputes.filter(d => d.status === filterStatus);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const openCount = disputes.filter(d => d.status === 'open').length;

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">Disputes ⚠️</h1>
      <p className="mb-6 text-sm text-muted-foreground">{openCount} open dispute{openCount !== 1 ? 's' : ''} requiring attention</p>

      <div className="mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({disputes.length})</SelectItem>
            <SelectItem value="open">Open ({disputes.filter(d => d.status === 'open').length})</SelectItem>
            <SelectItem value="investigating">Investigating ({disputes.filter(d => d.status === 'investigating').length})</SelectItem>
            <SelectItem value="resolved">Resolved ({disputes.filter(d => d.status === 'resolved').length})</SelectItem>
            <SelectItem value="dismissed">Dismissed ({disputes.filter(d => d.status === 'dismissed').length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No disputes found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <p className="font-medium">Order #{d.order_id.slice(0, 8)}</p>
                  <p className="text-sm font-medium">{d.reason}</p>
                  {d.description && <p className="text-sm text-muted-foreground line-clamp-2">{d.description}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusColors[d.status]}`}>
                    {d.status}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openDetail(d)} className="gap-1">
                    <Eye className="h-3.5 w-3.5" /> Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute — Order #{selected?.order_id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="font-medium">{selected.reason}</p>
              </div>
              {selected.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Details</p>
                  <p className="text-sm">{selected.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Filed</p>
                <p className="text-sm">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">Update Status</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">Admin Notes</p>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Add resolution notes..." />
              </div>
              <Button onClick={handleUpdate} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDisputes;
