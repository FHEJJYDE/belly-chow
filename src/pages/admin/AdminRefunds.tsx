import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, DollarSign } from 'lucide-react';

interface RefundOrder {
  id: string;
  total: number;
  delivery_fee: number;
  delivery_location: string;
  created_at: string;
  status: string;
  refund_status: string;
  refund_amount: number;
  refund_notes: string | null;
  student_id: string;
}

const refundStatusColors: Record<string, string> = {
  requested: 'bg-yellow-500/10 text-yellow-700',
  approved: 'bg-blue-500/10 text-blue-700',
  processed: 'bg-green-500/10 text-green-700',
  rejected: 'bg-red-500/10 text-red-700',
};

const AdminRefunds = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<RefundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<RefundOrder | null>(null);
  const [newRefundStatus, setNewRefundStatus] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .neq('refund_status' as any, 'none')
      .order('created_at', { ascending: false });
    setOrders((data as unknown as RefundOrder[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleUpdate = async () => {
    if (!selected) return;
    const updates: any = {};
    if (newRefundStatus) updates.refund_status = newRefundStatus;
    if (refundAmount) updates.refund_amount = parseFloat(refundAmount);
    if (refundNotes) updates.refund_notes = refundNotes;

    const { error } = await supabase.from('orders').update(updates).eq('id', selected.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Refund updated' });
    setSelected(null);
    fetchOrders();
  };

  const openDetail = (o: RefundOrder) => {
    setSelected(o);
    setNewRefundStatus(o.refund_status);
    setRefundAmount(String(o.refund_amount || ''));
    setRefundNotes(o.refund_notes || '');
  };

  const filtered = filterStatus === 'all' ? orders : orders.filter(o => o.refund_status === filterStatus);

  const totalRefunded = orders.filter(o => o.refund_status === 'processed').reduce((s, o) => s + Number(o.refund_amount), 0);
  const pendingRefunds = orders.filter(o => o.refund_status === 'requested').length;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-bold">Refunds 💰</h1>
      <p className="mb-6 text-sm text-muted-foreground">{pendingRefunds} pending refund request{pendingRefunds !== 1 ? 's' : ''}</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <RefreshCw className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Pending</p><p className="font-heading text-xl font-bold">{pendingRefunds}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Processed</p><p className="font-heading text-xl font-bold">{orders.filter(o => o.refund_status === 'processed').length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <DollarSign className="h-8 w-8 text-primary" />
          <div><p className="text-xs text-muted-foreground">Total Refunded</p><p className="font-heading text-xl font-bold">₦{totalRefunded.toLocaleString()}</p></div>
        </CardContent></Card>
      </div>

      <div className="mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({orders.length})</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">No refund requests</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Order Total</TableHead>
                  <TableHead>Refund Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{o.id.slice(0, 8)}</TableCell>
                    <TableCell>₦{(Number(o.total) + Number(o.delivery_fee)).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">₦{Number(o.refund_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${refundStatusColors[o.refund_status] || ''}`}>
                        {o.refund_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetail(o)}>Manage</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Refund — Order #{selected?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-medium">₦{(Number(selected.total) + Number(selected.delivery_fee)).toLocaleString()}</span>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Refund Amount (₦)</p>
                <Input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="Enter refund amount" />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Status</p>
                <Select value={newRefundStatus} onValueChange={setNewRefundStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Notes</p>
                <Textarea value={refundNotes} onChange={e => setRefundNotes(e.target.value)} placeholder="Refund notes..." />
              </div>
              <Button onClick={handleUpdate} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRefunds;
