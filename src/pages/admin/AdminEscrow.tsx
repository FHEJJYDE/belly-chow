import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { paymentService } from '@/services/payment';
import {
    Shield,
    Search,
    Clock,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    DollarSign,
    Calendar,
    User,
    Store,
    Unlock,
    AlertCircle
} from 'lucide-react';
import { format, isAfter } from 'date-fns';

interface EscrowTransaction {
    id: string;
    amount: number;
    currency: string;
    platform_fee: number;
    vendor_amount: number;
    status: string;
    hold_until: string;
    released_at: string;
    auto_release: boolean;
    manual_release_required: boolean;
    dispute_raised: boolean;
    release_reason: string;
    dispute_reason: string;
    created_at: string;
    payment_transactions: {
        korapay_reference: string;
        user_id: string;
    };
    orders: {
        id: string;
        customer_id: string;
    };
    vendors: {
        name: string;
        email: string;
    };
    profiles: {
        full_name: string;
        email: string;
    };
}

const AdminEscrow = () => {
    const { toast } = useToast();
    const [escrowTransactions, setEscrowTransactions] = useState<EscrowTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedTransaction, setSelectedTransaction] = useState<EscrowTransaction | null>(null);
    const [releaseReason, setReleaseReason] = useState('');
    const [isReleasing, setIsReleasing] = useState(false);
    const [stats, setStats] = useState({
        totalHeld: 0,
        totalReleased: 0,
        readyForRelease: 0,
        disputed: 0,
        manualReleaseRequired: 0,
    });

    useEffect(() => {
        fetchEscrowTransactions();
        fetchStats();
    }, []);

    const fetchEscrowTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('escrow_transactions')
                .select(`
                    *,
                    payment_transactions!inner(korapay_reference, user_id),
                    orders!inner(id, customer_id),
                    vendors!inner(name, email),
                    profiles!escrow_transactions_vendor_id_fkey(full_name, email)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEscrowTransactions(data || []);
        } catch (error: any) {
            console.error('Error fetching escrow transactions:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch escrow transactions',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase
                .from('escrow_transactions')
                .select('amount, status, hold_until, manual_release_required, dispute_raised');

            if (error) throw error;

            const now = new Date();
            const stats = data.reduce(
                (acc, escrow) => {
                    if (escrow.status === 'held') {
                        acc.totalHeld += escrow.amount;
                        if (isAfter(now, new Date(escrow.hold_until))) {
                            acc.readyForRelease += escrow.amount;
                        }
                        if (escrow.manual_release_required) {
                            acc.manualReleaseRequired += escrow.amount;
                        }
                    } else if (escrow.status === 'released') {
                        acc.totalReleased += escrow.amount;
                    } else if (escrow.status === 'disputed') {
                        acc.disputed += escrow.amount;
                    }
                    return acc;
                },
                {
                    totalHeld: 0,
                    totalReleased: 0,
                    readyForRelease: 0,
                    disputed: 0,
                    manualReleaseRequired: 0,
                }
            );

            setStats(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleReleaseEscrow = async () => {
        if (!selectedTransaction || !releaseReason.trim()) {
            toast({
                title: 'Error',
                description: 'Please provide a reason for releasing the escrow',
                variant: 'destructive',
            });
            return;
        }

        setIsReleasing(true);
        try {
            const result = await paymentService.releaseEscrow({
                paymentTransactionId: selectedTransaction.payment_transactions.korapay_reference,
                reason: releaseReason,
                manualRelease: true,
            });

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Escrow funds released successfully',
                });
                setSelectedTransaction(null);
                setReleaseReason('');
                fetchEscrowTransactions();
                fetchStats();
            } else {
                toast({
                    title: 'Error',
                    description: result.message || 'Failed to release escrow funds',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('Error releasing escrow:', error);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsReleasing(false);
        }
    };

    const getStatusBadge = (escrow: EscrowTransaction) => {
        if (escrow.status === 'held') {
            const now = new Date();
            const holdUntil = new Date(escrow.hold_until);
            const isReady = isAfter(now, holdUntil);

            if (escrow.dispute_raised) {
                return (
                    <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Disputed
                    </Badge>
                );
            }

            if (escrow.manual_release_required) {
                return (
                    <Badge variant="secondary" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Manual Release Required
                    </Badge>
                );
            }

            if (isReady) {
                return (
                    <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Ready for Release
                    </Badge>
                );
            }

            return (
                <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Held
                </Badge>
            );
        }

        if (escrow.status === 'released') {
            return (
                <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Released
                </Badge>
            );
        }

        return (
            <Badge variant="outline">
                {escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1)}
            </Badge>
        );
    };

    const filteredTransactions = escrowTransactions.filter(escrow => {
        const matchesSearch =
            escrow.payment_transactions?.korapay_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            escrow.vendors?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            escrow.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || escrow.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Escrow Management</h1>
                    <p className="text-muted-foreground">Monitor and manage escrow transactions</p>
                </div>
                <Button onClick={fetchEscrowTransactions}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Held</p>
                                <p className="text-2xl font-bold">₦{stats.totalHeld.toLocaleString()}</p>
                            </div>
                            <Shield className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Ready for Release</p>
                                <p className="text-2xl font-bold text-green-600">₦{stats.readyForRelease.toLocaleString()}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Manual Release</p>
                                <p className="text-2xl font-bold text-yellow-600">₦{stats.manualReleaseRequired.toLocaleString()}</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-yellow-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Disputed</p>
                                <p className="text-2xl font-bold text-red-600">₦{stats.disputed.toLocaleString()}</p>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Released</p>
                                <p className="text-2xl font-bold text-blue-600">₦{stats.totalReleased.toLocaleString()}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by reference, vendor, or customer..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Escrow Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="held">Held</SelectItem>
                                <SelectItem value="released">Released</SelectItem>
                                <SelectItem value="disputed">Disputed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Escrow Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle>Escrow Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredTransactions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No escrow transactions found
                                </div>
                            ) : (
                                filteredTransactions.map((escrow) => (
                                    <div key={escrow.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Shield className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{escrow.payment_transactions?.korapay_reference}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Created: {format(new Date(escrow.created_at), 'MMM dd, yyyy HH:mm')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">₦{escrow.amount.toLocaleString()}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Vendor: ₦{escrow.vendor_amount.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <p className="text-sm font-medium">Vendor</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {escrow.vendors?.name || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Hold Until</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {format(new Date(escrow.hold_until), 'MMM dd, yyyy HH:mm')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Platform Fee</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        ₦{escrow.platform_fee.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(escrow)}
                                                {escrow.status === 'held' && (
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setSelectedTransaction(escrow)}
                                                            >
                                                                <Unlock className="h-4 w-4 mr-1" />
                                                                Release
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Release Escrow Funds</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <p className="text-sm font-medium">Transaction Reference</p>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {selectedTransaction?.payment_transactions?.korapay_reference}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium">Amount to Release</p>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        ₦{selectedTransaction?.vendor_amount.toLocaleString()} to {selectedTransaction?.vendors?.name}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <label className="text-sm font-medium">Release Reason</label>
                                                                    <Textarea
                                                                        value={releaseReason}
                                                                        onChange={(e) => setReleaseReason(e.target.value)}
                                                                        placeholder="Enter reason for manual release..."
                                                                        className="mt-1"
                                                                    />
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        onClick={handleReleaseEscrow}
                                                                        disabled={isReleasing || !releaseReason.trim()}
                                                                        className="flex-1"
                                                                    >
                                                                        {isReleasing ? (
                                                                            <>
                                                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                                                Releasing...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Unlock className="h-4 w-4 mr-2" />
                                                                                Release Funds
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        onClick={() => {
                                                                            setSelectedTransaction(null);
                                                                            setReleaseReason('');
                                                                        }}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </div>
                                        </div>

                                        {escrow.release_reason && (
                                            <div className="bg-muted p-3 rounded-lg">
                                                <p className="text-sm font-medium">Release Reason</p>
                                                <p className="text-sm text-muted-foreground">{escrow.release_reason}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminEscrow;