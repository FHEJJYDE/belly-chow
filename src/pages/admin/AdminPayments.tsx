import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];

const AdminPayments = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_method', 'bank_transfer')
      .order('created_at', { ascending: false })
      .limit(500);
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updatePaymentStatus = async (orderId: string, status: 'confirmed' | 'failed') => {
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: status as any })
      .eq('id', orderId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status as any } : o));
    toast({ title: `Payment ${status}`, description: `Order #${orderId.slice(0, 8)} marked as ${status}` });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const pending = orders.filter(o => o.payment_status === 'pending');
  const confirmed = orders.filter(o => o.payment_status === 'confirmed');
  const failed = orders.filter(o => o.payment_status === 'failed');

  const PaymentCard = ({ order }: { order: Order }) => (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
          <p className="text-sm font-semibold text-primary">₦{(Number(order.total) + Number(order.delivery_fee)).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{order.delivery_location}</p>
          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={order.payment_status === 'confirmed' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'secondary'}
            className="gap-1"
          >
            {order.payment_status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
            {order.payment_status === 'failed' && <XCircle className="h-3 w-3" />}
            {order.payment_status === 'pending' && <Clock className="h-3 w-3" />}
            {order.payment_status}
          </Badge>
          {order.payment_status === 'pending' && (
            <>
              <Button size="sm" onClick={() => updatePaymentStatus(order.id, 'confirmed')} className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Confirm
              </Button>
              <Button size="sm" variant="destructive" onClick={() => updatePaymentStatus(order.id, 'failed')} className="gap-1">
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {order.payment_status !== 'pending' && (
            <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(order.id, 'confirmed')}>
              Re-confirm
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Payment Confirmations 💳</h1>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({confirmed.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? <p className="py-10 text-center text-muted-foreground">No pending payments</p> : pending.map(o => <PaymentCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="confirmed" className="mt-4 space-y-3">
          {confirmed.length === 0 ? <p className="py-10 text-center text-muted-foreground">No confirmed payments</p> : confirmed.map(o => <PaymentCard key={o.id} order={o} />)}
        </TabsContent>
        <TabsContent value="failed" className="mt-4 space-y-3">
          {failed.length === 0 ? <p className="py-10 text-center text-muted-foreground">No failed payments</p> : failed.map(o => <PaymentCard key={o.id} order={o} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPayments;
