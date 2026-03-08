import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Store, Wallet } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Vendor = Database['public']['Tables']['vendors']['Row'];

interface VendorPayout {
  vendor: Vendor;
  totalRevenue: number;
  commission: number;
  netPayout: number;
  deliveredOrders: number;
  pendingPayment: number;
  confirmedPayment: number;
}

const AdminPayments = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [commissionRate, setCommissionRate] = useState(0.1);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [ordersRes, vendorsRes, settingsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('status', 'delivered').order('created_at', { ascending: false }),
      supabase.from('vendors').select('*').order('name'),
      supabase.from('platform_settings').select('commission_rate').limit(1).single(),
    ]);
    setOrders(ordersRes.data || []);
    setVendors(vendorsRes.data || []);
    if (settingsRes.data) setCommissionRate(settingsRes.data.commission_rate);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const payouts = useMemo<VendorPayout[]>(() => {
    return vendors.map(vendor => {
      const vendorOrders = orders.filter(o => o.vendor_id === vendor.id);
      const totalRevenue = vendorOrders.reduce((s, o) => s + Number(o.total), 0);
      const commission = totalRevenue * commissionRate;
      const netPayout = totalRevenue - commission;
      const pendingPayment = vendorOrders.filter(o => o.payment_status === 'pending').reduce((s, o) => s + Number(o.total), 0);
      const confirmedPayment = vendorOrders.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + Number(o.total), 0);
      return {
        vendor,
        totalRevenue,
        commission,
        netPayout,
        deliveredOrders: vendorOrders.length,
        pendingPayment,
        confirmedPayment,
      };
    }).filter(p => p.deliveredOrders > 0).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders, vendors, commissionRate]);

  const totals = useMemo(() => ({
    revenue: payouts.reduce((s, p) => s + p.totalRevenue, 0),
    commission: payouts.reduce((s, p) => s + p.commission, 0),
    netPayout: payouts.reduce((s, p) => s + p.netPayout, 0),
    pendingPayment: payouts.reduce((s, p) => s + p.pendingPayment, 0),
  }), [payouts]);

  // --- Bank transfer payment confirmation (original functionality) ---
  const [bankOrders, setBankOrders] = useState<Order[]>([]);

  useEffect(() => {
    supabase.from('orders').select('*').eq('payment_method', 'bank_transfer').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setBankOrders(data || []));
  }, []);

  const updatePaymentStatus = async (orderId: string, status: 'confirmed' | 'failed') => {
    const { error } = await supabase.from('orders').update({ payment_status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setBankOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status as any } : o));
    toast({ title: `Payment ${status}`, description: `Order #${orderId.slice(0, 8)} marked as ${status}` });
  };

  const bankPending = bankOrders.filter(o => o.payment_status === 'pending');
  const bankConfirmed = bankOrders.filter(o => o.payment_status === 'confirmed');
  const bankFailed = bankOrders.filter(o => o.payment_status === 'failed');

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Payments & Payouts 💳</h1>

      <Tabs defaultValue="payouts">
        <TabsList>
          <TabsTrigger value="payouts">Vendor Payouts</TabsTrigger>
          <TabsTrigger value="confirmations">Payment Confirmations ({bankPending.length})</TabsTrigger>
        </TabsList>

        {/* ─── Vendor Payouts Tab ─── */}
        <TabsContent value="payouts" className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-8 w-8 text-primary" />
              <div><p className="text-xs text-muted-foreground">Total Revenue</p><p className="font-heading text-xl font-bold">₦{totals.revenue.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div><p className="text-xs text-muted-foreground">Platform Commission ({(commissionRate * 100).toFixed(0)}%)</p><p className="font-heading text-xl font-bold">₦{totals.commission.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Store className="h-8 w-8 text-primary" />
              <div><p className="text-xs text-muted-foreground">Net Vendor Payouts</p><p className="font-heading text-xl font-bold">₦{totals.netPayout.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Wallet className="h-8 w-8 text-destructive" />
              <div><p className="text-xs text-muted-foreground">Pending Settlement</p><p className="font-heading text-xl font-bold">₦{totals.pendingPayment.toLocaleString()}</p></div>
            </CardContent></Card>
          </div>

          {/* Vendor payout table */}
          {payouts.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No delivered orders yet</p>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net Payout</TableHead>
                      <TableHead className="text-right">Confirmed</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map(p => (
                      <TableRow key={p.vendor.id}>
                        <TableCell className="font-medium">{p.vendor.name}</TableCell>
                        <TableCell className="text-right">{p.deliveredOrders}</TableCell>
                        <TableCell className="text-right">₦{p.totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">₦{p.commission.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">₦{p.netPayout.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">₦{p.confirmedPayment.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {p.pendingPayment > 0 ? (
                            <span className="text-yellow-600">₦{p.pendingPayment.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ─── Payment Confirmations Tab ─── */}
        <TabsContent value="confirmations" className="mt-6">
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending ({bankPending.length})</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed ({bankConfirmed.length})</TabsTrigger>
              <TabsTrigger value="failed">Failed ({bankFailed.length})</TabsTrigger>
            </TabsList>
            {(['pending', 'confirmed', 'failed'] as const).map(tab => {
              const list = tab === 'pending' ? bankPending : tab === 'confirmed' ? bankConfirmed : bankFailed;
              return (
                <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                  {list.length === 0 ? (
                    <p className="py-10 text-center text-muted-foreground">No {tab} payments</p>
                  ) : list.map(order => (
                    <Card key={order.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-sm font-semibold text-primary">₦{(Number(order.total) + Number(order.delivery_fee)).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_location}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={order.payment_status === 'confirmed' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'secondary'} className="gap-1">
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
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPayments;
