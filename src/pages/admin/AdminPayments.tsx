import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { paymentService } from '@/services/payment';
import {
    CreditCard,
    Search,
    Filter,
    Download,
    RefreshCw,
    Eye,
    AlertCircle,
    CheckCircle,
    Clock,
    XCircle,
    DollarSign,
    TrendingUp,
    Users,
    Calendar
} from 'lucide-react';
import { format } from 'date-fns';

interface PaymentTransaction {
    id: string;
    korapay_reference: string;
    amount: number;
    currency: string;
    status: string;
    payment_status: string;
    escrow_status: string;
    payment_method: string;
    created_at: string;
    paid_at: string;
    orders: {
        id: string;
        customer_id: string;
    };
    profiles: {
        full_name: string;
        email: string;
    };
    vendors: {
        name: string;
    };
}

const AdminPayments = () => {
    const { toast } = useToast();
    const [payments, setPayments] = useState<PaymentTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [escrowFilter, setEscrowFilter] = useState('all');
    const [stats, setStats] = useState({
        totalTransactions: 0,
        totalAmount: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        escrowHeld: 0,
    });

    useEffect(() => {
        fetchPayments();
        fetchStats();
    }, []);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('payment_transactions')
                .select(`
                    *,
                    orders(id, student_id),
                    vendors(name)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setPayments(data || []);
        } catch (error: any) {
            console.error('Error fetching payments:', error);
            toast({
                title: 'Error',
                description: 'Failed to fetch payment transactions',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase
                .from('payment_transactions')
                .select('amount, status, payment_status, escrow_status');

            if (error) throw error;

            const stats = data.reduce(
                (acc, payment) => {
                    acc.totalTransactions++;
                    acc.totalAmount += payment.amount;

                    if (payment.payment_status === 'paid') acc.successfulPayments++;
                    else if (payment.payment_status === 'pending') acc.pendingPayments++;
                    else if (payment.payment_status === 'failed') acc.failedPayments++;

                    if (payment.escrow_status === 'held') acc.escrowHeld += payment.amount;

                    return acc;
                },
                {
                    totalTransactions: 0,
                    totalAmount: 0,
                    successfulPayments: 0,
                    pendingPayments: 0,
                    failedPayments: 0,
                    escrowHeld: 0,
                }
            );

            setStats(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const getStatusBadge = (status: string, type: 'payment' | 'escrow' = 'payment') => {
        const variants: Record<string, { variant: any; icon: any }> = {
            // Payment status
            paid: { variant: 'default', icon: CheckCircle },
            pending: { variant: 'secondary', icon: Clock },
            failed: { variant: 'destructive', icon: XCircle },
            refunded: { variant: 'outline', icon: RefreshCw },
            // Escrow status
            held: { variant: 'secondary', icon: Clock },
            released: { variant: 'default', icon: CheckCircle },
            disputed: { variant: 'destructive', icon: AlertCircle },
        };

        const config = variants[status] || { variant: 'outline', icon: AlertCircle };
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    const filteredPayments = payments.filter(payment => {
        const matchesSearch =
            payment.korapay_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            payment.vendors?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || payment.payment_status === statusFilter;
        const matchesEscrow = escrowFilter === 'all' || payment.escrow_status === escrowFilter;

        return matchesSearch && matchesStatus && matchesEscrow;
    });

    const exportPayments = () => {
        const csvContent = [
            ['Reference', 'Amount', 'Currency', 'Status', 'Escrow Status', 'Customer', 'Vendor', 'Date'].join(','),
            ...filteredPayments.map(payment => [
                payment.korapay_reference,
                payment.amount,
                payment.currency,
                payment.payment_status,
                payment.escrow_status,
                payment.profiles?.full_name || 'N/A',
                payment.vendors?.name || 'N/A',
                format(new Date(payment.created_at), 'yyyy-MM-dd HH:mm:ss')
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Payment Management</h1>
                    <p className="text-muted-foreground">Monitor and manage payment transactions</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportPayments} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button onClick={fetchPayments}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                                <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
                            </div>
                            <CreditCard className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Volume</p>
                                <p className="text-2xl font-bold">₦{stats.totalAmount.toLocaleString()}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Successful Payments</p>
                                <p className="text-2xl font-bold text-green-600">{stats.successfulPayments}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Escrow Held</p>
                                <p className="text-2xl font-bold text-orange-600">₦{stats.escrowHeld.toLocaleString()}</p>
                            </div>
                            <Clock className="h-8 w-8 text-orange-600" />
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
                                    placeholder="Search by reference, customer, or vendor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Payment Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={escrowFilter} onValueChange={setEscrowFilter}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Escrow Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Escrow</SelectItem>
                                <SelectItem value="held">Held</SelectItem>
                                <SelectItem value="released">Released</SelectItem>
                                <SelectItem value="disputed">Disputed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Payments Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Payment Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredPayments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No payment transactions found
                                </div>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <div key={payment.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <CreditCard className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{payment.korapay_reference}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">₦{payment.amount.toLocaleString()}</p>
                                                <p className="text-sm text-muted-foreground">{payment.currency}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <p className="text-sm font-medium">Customer</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {payment.profiles?.full_name || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Vendor</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {payment.vendors?.name || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Method</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {payment.payment_method || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(payment.payment_status, 'payment')}
                                                {getStatusBadge(payment.escrow_status, 'escrow')}
                                            </div>
                                        </div>
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

export default AdminPayments;