import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { walletService, type WalletTransaction } from '@/services/wallet';
import AppNavbar from '@/components/layout/AppNavbar';
import WalletBalance from '@/components/wallet/WalletBalance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownLeft, Clock, Download, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/paymentConfig';
import { toast } from 'sonner';

const Wallet: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!user?.id) return;

            try {
                const walletTransactions = await walletService.getWalletTransactions(user.id, 20);
                setTransactions(walletTransactions);
            } catch (error) {
                console.error('Error fetching transactions:', error);
                toast.error('Failed to load transaction history');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [user?.id]);

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'credit':
            case 'escrow_release':
            case 'refund':
                return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
            case 'debit':
            case 'withdrawal':
                return <ArrowUpRight className="h-4 w-4 text-red-600" />;
            case 'escrow_hold':
                return <Clock className="h-4 w-4 text-orange-600" />;
            default:
                return <Clock className="h-4 w-4 text-gray-600" />;
        }
    };

    const getTransactionColor = (type: string) => {
        switch (type) {
            case 'credit':
            case 'escrow_release':
            case 'refund':
                return 'text-green-600';
            case 'debit':
            case 'withdrawal':
                return 'text-red-600';
            case 'escrow_hold':
                return 'text-orange-600';
            default:
                return 'text-gray-600';
        }
    };

    const handleWithdraw = () => {
        toast.info('Withdrawal feature coming soon! You\'ll be able to withdraw to your bank account.');
    };

    const handleTopUp = () => {
        toast.info('Top-up feature coming soon! You\'ll be able to add money via Paystack.');
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-background">
                <AppNavbar />
                <div className="container max-w-2xl py-8">
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-center text-gray-500">Please log in to view your wallet</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20 md:pb-0">
            <AppNavbar />
            <div className="container max-w-2xl py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">My Wallet</h1>
                    <p className="text-gray-600">Manage your balance and view transaction history</p>
                </div>

                {/* Wallet Balance */}
                <WalletBalance
                    onWithdrawClick={handleWithdraw}
                    onTopUpClick={handleTopUp}
                    showActions={true}
                />

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Button onClick={handleWithdraw} className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Withdraw
                    </Button>
                    <Button variant="outline" onClick={handleTopUp} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Top Up
                    </Button>
                </div>

                {/* Transaction History */}
                <Card>
                    <CardHeader>
                        <CardTitle>Transaction History</CardTitle>
                        <CardDescription>
                            Your recent wallet transactions and earnings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <div>
                                                <Skeleton className="h-4 w-32 mb-1" />
                                                <Skeleton className="h-3 w-24" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                ))}
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-8">
                                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">No transactions yet</p>
                                <p className="text-sm text-gray-400">Your wallet activity will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {transactions.map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-full">
                                                {getTransactionIcon(transaction.transaction_type)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {walletService.getTransactionTypeDisplay(transaction.transaction_type)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {transaction.description}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-semibold ${getTransactionColor(transaction.transaction_type)}`}>
                                                {transaction.transaction_type === 'debit' || transaction.transaction_type === 'withdrawal' ? '-' : '+'}
                                                {formatCurrency(transaction.amount)}
                                            </p>
                                            <Badge variant="outline" className="text-xs">
                                                {walletService.getReferenceTypeDisplay(transaction.reference_type)}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Info Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold">How Your Wallet Works</h3>
                            <div className="text-sm text-gray-600 space-y-1">
                                <p>• Earn money from completed orders automatically</p>
                                <p>• Withdraw to your bank account anytime</p>
                                <p>• Use wallet balance for faster payments</p>
                                <p>• All transactions are secure and tracked</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Wallet;