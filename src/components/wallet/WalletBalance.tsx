import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingUp, Download, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { walletService, type WalletBalance as WalletBalanceType } from '@/services/wallet';
import { formatCurrency } from '@/lib/paymentConfig';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WalletBalanceProps {
    onWithdrawClick?: () => void;
    onTopUpClick?: () => void;
    showActions?: boolean;
    compact?: boolean;
}

const WalletBalance: React.FC<WalletBalanceProps> = ({
    onWithdrawClick,
    onTopUpClick,
    showActions = true,
    compact = false,
}) => {
    const { user } = useAuth();
    const [balance, setBalance] = useState<WalletBalanceType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showBalance, setShowBalance] = useState(true);

    const fetchBalance = async () => {
        if (!user?.id) return;

        try {
            const walletBalance = await walletService.getWalletBalance(user.id);
            setBalance(walletBalance);
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            toast.error('Failed to load wallet balance');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchBalance();
    };

    useEffect(() => {
        fetchBalance();
    }, [user?.id]);

    if (isLoading) {
        return (
            <Card className={compact ? 'p-4' : ''}>
                <CardHeader className={compact ? 'p-0 pb-2' : ''}>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className={compact ? 'p-0 pt-2' : ''}>
                    <Skeleton className="h-8 w-24 mb-4" />
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!balance) {
        return (
            <Card className={compact ? 'p-4' : ''}>
                <CardContent className={compact ? 'p-0' : 'pt-6'}>
                    <div className="text-center py-4">
                        <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">Unable to load wallet balance</p>
                        <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const displayBalance = showBalance ? formatCurrency(balance.balance) : '••••••';
    const canWithdraw = balance.balance > 0;

    if (compact) {
        return (
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Wallet Balance</p>
                        <p className="font-semibold text-lg">{displayBalance}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBalance(!showBalance)}
                    >
                        {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {showActions && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onWithdrawClick}
                            disabled={!canWithdraw}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Withdraw
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        <CardTitle>Wallet Balance</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowBalance(!showBalance)}
                        >
                            {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
                <CardDescription>
                    Your available balance for payments and withdrawals
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <p className="text-3xl font-bold text-green-600">{displayBalance}</p>
                        {balance.pending_balance > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-orange-600 border-orange-200">
                                    Pending: {formatCurrency(balance.pending_balance)}
                                </Badge>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-600">Total Earned</p>
                            <p className="font-semibold">
                                {showBalance ? formatCurrency(balance.total_earned) : '••••••'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-600">Total Withdrawn</p>
                            <p className="font-semibold">
                                {showBalance ? formatCurrency(balance.total_withdrawn) : '••••••'}
                            </p>
                        </div>
                    </div>

                    {showActions && (
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={onWithdrawClick}
                                disabled={!canWithdraw}
                                className="flex-1"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Withdraw
                            </Button>
                            {onTopUpClick && (
                                <Button
                                    variant="outline"
                                    onClick={onTopUpClick}
                                    className="flex-1"
                                >
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Top Up
                                </Button>
                            )}
                        </div>
                    )}

                    {!canWithdraw && showActions && (
                        <p className="text-sm text-gray-500 text-center">
                            No funds available for withdrawal
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default WalletBalance;