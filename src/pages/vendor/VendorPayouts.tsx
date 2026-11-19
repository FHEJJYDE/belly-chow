import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateVendor } from '@/lib/vendorUtils';
import {
  DollarSign,
  Clock,
  CheckCircle,
  RefreshCw,
  Calendar,
  AlertCircle,
  Building2,
  ArrowUpRight,
} from 'lucide-react';

interface WithdrawalRequest {
  id: string;
  amount: number;
  service_fee: number;
  net_amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: string;
}

interface EscrowTransaction {
  id: string;
  amount: number;
  vendor_amount: number;
  status: string;
  hold_until: string;
  created_at: string;
}

const VendorPayouts = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [escrowTransactions, setEscrowTransactions] = useState<EscrowTransaction[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bankForm, setBankForm] = useState({
    amount: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const vendor = await getOrCreateVendor(user.id, user.user_metadata?.full_name);

      const [{ data: wData }, { data: reqData }, { data: escData }] = await Promise.all([
        (supabase.rpc as any)('get_or_create_wallet', { p_user_id: user.id }),
        supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        vendor
          ? supabase
              .from('escrow_transactions')
              .select('*')
              .eq('vendor_id', vendor.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      if (wData) setWalletBalance(Number(wData.balance) || 0);
      setWithdrawals((reqData as any) || []);
      setEscrowTransactions((escData as any) || []);

      if (vendor?.bank_details) {
        const bd = vendor.bank_details as any;
        setBankForm((prev) => ({
          ...prev,
          bank_name: bd.bank_name || prev.bank_name,
          account_number: bd.account_number || prev.account_number,
          account_name: bd.account_name || prev.account_name,
        }));
      }
    } catch (error) {
      console.error('Error fetching vendor payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleOpenWithdraw = () => {
    if (walletBalance <= 0) {
      toast({
        title: 'No Available Balance',
        description: 'You have no available wallet funds to withdraw yet.',
        variant: 'destructive',
      });
      return;
    }
    setBankForm((prev) => ({ ...prev, amount: String(walletBalance) }));
    setWithdrawDialogOpen(true);
  };

  const submitPayoutRequest = async () => {
    if (!user) return;
    const reqAmount = Number(bankForm.amount);
    if (!reqAmount || reqAmount <= 0 || reqAmount > walletBalance) {
      toast({
        title: 'Invalid Amount',
        description: `Enter an amount up to ₦${walletBalance.toLocaleString()}.`,
        variant: 'destructive',
      });
      return;
    }
    if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.account_name.trim()) {
      toast({
        title: 'Bank Details Required',
        description: 'Please enter your bank name, account number, and account name.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const serviceFee = Math.floor(reqAmount / 1000) * 50;
      const netPayout = Math.max(0, reqAmount - serviceFee);

      const { error } = await supabase.from('withdrawal_requests').insert({
        user_id: user.id,
        amount: reqAmount,
        service_fee: serviceFee,
        net_amount: netPayout,
        status: 'pending',
        bank_name: bankForm.bank_name.trim(),
        account_number: bankForm.account_number.trim(),
        account_name: bankForm.account_name.trim(),
      } as any);

      if (error) throw error;

      const newBalance = Math.max(0, walletBalance - reqAmount);
      await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      setWalletBalance(newBalance);
      setWithdrawDialogOpen(false);
      fetchData();

      toast({
        title: 'Payout Requested! 🚀',
        description: `Requested ₦${reqAmount.toLocaleString()} (Net transfer: ₦${netPayout.toLocaleString()})`,
      });
    } catch (err: any) {
      toast({
        title: 'Withdrawal Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const lockedEscrowTotal = escrowTransactions
    .filter((e) => e.status === 'held' || e.status === 'locked')
    .reduce((sum, e) => sum + Number(e.vendor_amount || e.amount || 0), 0);

  const totalPaidOut = withdrawals
    .filter((w) => w.status === 'approved' || w.status === 'completed' || w.status === 'successful')
    .reduce((sum, w) => sum + Number(w.net_amount || w.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Payouts & Escrows</h1>
          <p className="text-sm text-muted-foreground">
            Manage your earnings, pending escrow balances, and bank withdrawal requests.
          </p>
        </div>
        <Button onClick={handleOpenWithdraw} className="w-full sm:w-auto gap-2">
          <ArrowUpRight className="h-4 w-4" /> Request Payout
        </Button>
      </div>

      {/* Metric grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="premium-card bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available for Payout</p>
              <p className="text-xl font-heading font-bold">₦{walletBalance.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Held in Escrow</p>
              <p className="text-xl font-heading font-bold">₦{lockedEscrowTotal.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid Out</p>
              <p className="text-xl font-heading font-bold">₦{totalPaidOut.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Escrow notice */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardContent className="p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-orange-500">Escrow Release Policy</h4>
            <p className="text-xs text-muted-foreground mt-1">
              When a student confirms delivery receipt, order funds (minus the ₦200 vendor delivery charge) are automatically released from escrow directly into your Available for Payout balance.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Escrow list */}
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Live Escrow Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {escrowTransactions.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No escrow transactions recorded yet.
              </p>
            ) : (
              escrowTransactions.map((escrow) => (
                <div
                  key={escrow.id}
                  className="flex justify-between items-center p-3 rounded-lg border bg-muted/20"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      ₦{Number(escrow.vendor_amount || escrow.amount).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Created: {new Date(escrow.created_at).toLocaleDateString()} · Auto-release:{' '}
                      {new Date(escrow.hold_until).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={escrow.status === 'released' ? 'default' : 'secondary'}
                    className="text-[10px] capitalize"
                  >
                    {escrow.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Withdrawal history */}
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" /> Withdrawal Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {withdrawals.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No payout requests submitted yet.
              </p>
            ) : (
              withdrawals.map((payout) => (
                <div
                  key={payout.id}
                  className="flex justify-between items-center p-3 rounded-lg border bg-muted/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      ₦{Number(payout.net_amount || payout.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {payout.bank_name} ({payout.account_number}) · {payout.account_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />{' '}
                      {new Date(payout.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      payout.status === 'approved' || payout.status === 'completed'
                        ? 'default'
                        : payout.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px] capitalize shrink-0"
                  >
                    {payout.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Payout Modal */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Request Bank Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Withdrawal Amount (₦)</Label>
              <Input
                type="number"
                max={walletBalance}
                value={bankForm.amount}
                onChange={(e) => setBankForm({ ...bankForm, amount: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Available balance: ₦{walletBalance.toLocaleString()} (Service fee: ₦50 per ₦1,000)
              </p>
            </div>
            <div>
              <Label>Bank Name *</Label>
              <Input
                placeholder="e.g. GTBank, Access Bank, OPay"
                value={bankForm.bank_name}
                onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Account Number *</Label>
              <Input
                placeholder="10-digit NUBAN account number"
                maxLength={10}
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input
                placeholder="Account holder name"
                value={bankForm.account_name}
                onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPayoutRequest} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Payout Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorPayouts;
