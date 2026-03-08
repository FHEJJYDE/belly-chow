import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, DollarSign, TrendingUp, Store, Wallet, Download } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type Vendor = Database['public']['Tables']['vendors']['Row'];

interface VendorPayout {
  vendor: Vendor;
  totalRevenue: number;
  platformFees: number;
  riderFees: number;
  netPayout: number;
  deliveredOrders: number;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_notes: string | null;
  created_at: string;
  rider_name?: string;
}

const AdminPayments = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [platformFee, setPlatformFee] = useState(500);
  const [riderFee, setRiderFee] = useState(500);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  const fetchData = async () => {
    const [ordersRes, vendorsRes, settingsRes, withdrawalsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('status', 'delivered').order('created_at', { ascending: false }),
      supabase.from('vendors').select('*').order('name'),
      supabase.from('platform_settings').select('*').limit(1).single(),
      (supabase.from('withdrawal_requests') as any).select('*').order('created_at', { ascending: false }),
    ]);
    setOrders(ordersRes.data || []);
    setVendors(vendorsRes.data || []);
    if (settingsRes.data) {
      const d = settingsRes.data as any;
      setPlatformFee(Number(d.platform_fee) || 500);
      setRiderFee(Number(d.rider_fee) || 500);
    }

    // Enrich withdrawals with rider names
    const wds = withdrawalsRes.data || [];
    if (wds.length > 0) {
      const userIds = [...new Set(wds.map((w: any) => w.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      setWithdrawals(wds.map((w: any) => ({ ...w, rider_name: profileMap.get(w.user_id) || 'Unknown' })));
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const payouts = useMemo<VendorPayout[]>(() => {
    return vendors.map(vendor => {
      const vendorOrders = orders.filter(o => o.vendor_id === vendor.id);
      const totalRevenue = vendorOrders.reduce((s, o) => s + Number(o.total), 0);
      const orderCount = vendorOrders.length;
      return {
        vendor,
        totalRevenue,
        platformFees: orderCount * platformFee,
        riderFees: orderCount * riderFee,
        netPayout: totalRevenue,
        deliveredOrders: orderCount,
      };
    }).filter(p => p.deliveredOrders > 0).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [orders, vendors, platformFee, riderFee]);

  const totals = useMemo(() => ({
    revenue: payouts.reduce((s, p) => s + p.totalRevenue, 0),
    platformFees: payouts.reduce((s, p) => s + p.platformFees, 0),
    riderFees: payouts.reduce((s, p) => s + p.riderFees, 0),
    vendorPayout: payouts.reduce((s, p) => s + p.netPayout, 0),
  }), [payouts]);

  // Bank transfer payment confirmation
  const [bankOrders, setBankOrders] = useState<Order[]>([]);

  useEffect(() => {
    supabase.from('orders').select('*').eq('payment_method', 'bank_transfer').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setBankOrders(data || []));
  }, []);

  const updatePaymentStatus = async (orderId: string, status: 'confirmed' | 'failed') => {
    const { error } = await supabase.from('orders').update({ payment_status: status as any }).eq('id', orderId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setBankOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: status as any } : o));
    toast({ title: `Payment ${status}` });
  };

  const updateWithdrawalStatus = async (id: string, status: string) => {
    const { error } = await (supabase.from('withdrawal_requests') as any).update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status } : w));
    toast({ title: `Withdrawal ${status}` });
  };

  const exportPayoutCSV = () => {
    if (payouts.length === 0) return;
    const headers = ['Vendor', 'Orders', 'Food Revenue', 'Platform Fee', 'Rider Fee', 'Vendor Gets'];
    const rows = payouts.map(p => [p.vendor.name, p.deliveredOrders, p.totalRevenue, p.platformFees, p.riderFees, p.netPayout]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Payout report downloaded' });
  };

  const bankPending = bankOrders.filter(o => o.payment_status === 'pending');
  const bankConfirmed = bankOrders.filter(o => o.payment_status === 'confirmed');
  const bankFailed = bankOrders.filter(o => o.payment_status === 'failed');

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const processedWithdrawals = withdrawals.filter(w => w.status !== 'pending');

  if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold">Payments & Payouts 💳</h1>

      <Tabs defaultValue="payouts">
        <TabsList>
          <TabsTrigger value="payouts">Vendor Payouts</TabsTrigger>
          <TabsTrigger value="confirmations">Payment Confirmations ({bankPending.length})</TabsTrigger>
          <TabsTrigger value="withdrawals">Rider Withdrawals ({pendingWithdrawals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="payouts" className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-8 w-8 text-primary" />
              <div><p className="text-xs text-muted-foreground">Total Food Revenue</p><p className="font-heading text-xl font-bold">₦{totals.revenue.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div><p className="text-xs text-muted-foreground">Platform Earnings (₦{platformFee}/order)</p><p className="font-heading text-xl font-bold">₦{totals.platformFees.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div><p className="text-xs text-muted-foreground">Rider Earnings (₦{riderFee}/order)</p><p className="font-heading text-xl font-bold">₦{totals.riderFees.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Store className="h-8 w-8 text-orange-500" />
              <div><p className="text-xs text-muted-foreground">Vendor Payouts</p><p className="font-heading text-xl font-bold">₦{totals.vendorPayout.toLocaleString()}</p></div>
            </CardContent></Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportPayoutCSV} className="gap-1">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

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
                      <TableHead className="text-right">Food Revenue</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Rider Fee</TableHead>
                      <TableHead className="text-right">Vendor Gets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map(p => (
                      <TableRow key={p.vendor.id}>
                        <TableCell className="font-medium">{p.vendor.name}</TableCell>
                        <TableCell className="text-right">{p.deliveredOrders}</TableCell>
                        <TableCell className="text-right">₦{p.totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">₦{p.platformFees.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">₦{p.riderFees.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">₦{p.netPayout.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

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
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                          {(order as any).payment_proof_url && (
                            <a href={(order as any).payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                              View payment proof
                            </a>
                          )}
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
                              <Button size="sm" onClick={() => updatePaymentStatus(order.id, 'confirmed')} className="gap-1"><CheckCircle className="h-3.5 w-3.5" /> Confirm</Button>
                              <Button size="sm" variant="destructive" onClick={() => updatePaymentStatus(order.id, 'failed')} className="gap-1"><XCircle className="h-3.5 w-3.5" /> Reject</Button>
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

        <TabsContent value="withdrawals" className="mt-6 space-y-4">
          <h2 className="font-heading text-lg font-semibold">Rider Withdrawal Requests</h2>
          {withdrawals.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No withdrawal requests yet</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map(w => (
                <Card key={w.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{w.rider_name}</p>
                      <p className="text-lg font-bold text-primary">₦{Number(w.amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{w.bank_name} · {w.account_number} · {w.account_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {w.status}
                      </Badge>
                      {w.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => updateWithdrawalStatus(w.id, 'approved')} className="gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateWithdrawalStatus(w.id, 'rejected')} className="gap-1">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPayments;
