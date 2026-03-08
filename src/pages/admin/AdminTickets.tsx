import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const AdminTickets = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast({ title: 'Ticket updated' });
      setSelectedTicket(null);
    },
  });

  const openCount = tickets.filter((t: any) => t.status === 'open').length;
  const resolvedCount = tickets.filter((t: any) => t.status === 'resolved').length;

  const statusColor = (s: string) => {
    if (s === 'open') return 'bg-destructive/10 text-destructive';
    if (s === 'in_progress') return 'bg-secondary/20 text-secondary-foreground';
    return 'bg-accent/10 text-accent';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{tickets.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Open</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{openCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Resolved</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-accent">{resolvedCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : tickets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No tickets yet</TableCell></TableRow>
              ) : tickets.map((ticket: any) => (
                <TableRow key={ticket.id}>
                  <TableCell className="text-sm">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>{ticket.name}<br /><span className="text-xs text-muted-foreground">{ticket.email}</span></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{ticket.category}</Badge></TableCell>
                  <TableCell><Badge className={statusColor(ticket.status)}>{ticket.status}</Badge></TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedTicket(ticket); setAdminNotes(ticket.admin_notes || ''); setNewStatus(ticket.status); }}>
                          <MessageSquare className="h-4 w-4 mr-1" /> Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Ticket from {ticket.name}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Category</p>
                            <p className="capitalize">{ticket.category}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Message</p>
                            <p className="bg-muted p-3 rounded text-sm">{ticket.message}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                            <Select value={newStatus} onValueChange={setNewStatus}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</p>
                            <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes..." />
                          </div>
                          <Button className="w-full" onClick={() => updateMutation.mutate({ id: ticket.id, status: newStatus, notes: adminNotes })} disabled={updateMutation.isPending}>
                            Update Ticket
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTickets;
