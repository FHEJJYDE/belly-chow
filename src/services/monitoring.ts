// Payment System Monitoring Service
// Provides real-time monitoring and health metrics for the payment system

import { supabase } from '@/integrations/supabase/client';

export interface SystemHealthMetrics {
    paymentSuccessRate: number;
    averageSettlementTime: number;
    totalPaymentsToday: number;
    totalRevenueToday: number;
    activeErrors: number;
    criticalErrors: number;
}

export interface WebhookError {
    id: string;
    error_type: string;
    reference: string;
    error_message: string;
    created_at: string;
    resolved: boolean;
    retry_count: number;
}

export interface PaymentSystemError {
    id: string;
    error_category: string;
    error_code: string;
    error_message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    user_id?: string;
    order_id?: string;
    created_at: string;
    resolved: boolean;
}

export interface HealthMetric {
    id: string;
    metric_name: string;
    metric_value: number;
    metric_unit: string;
    time_period: string;
    recorded_at: string;
}

class MonitoringService {
    /**
     * Get current system health metrics
     */
    async getSystemHealth(): Promise<SystemHealthMetrics> {
        try {
            // Calculate payment success rate for last 24 hours
            const { data: successRateData } = await supabase.rpc('calculate_payment_success_rate', { p_hours: 24 });

            // Calculate average settlement time
            const { data: settlementTimeData } = await supabase.rpc('calculate_average_settlement_time', { p_hours: 24 });

            // Get total payments today
            const { count: totalPayments } = await supabase
                .from('payment_transactions')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');

            // Get total revenue today
            const { data: revenueData } = await supabase
                .from('payment_transactions')
                .select('total_amount')
                .eq('payment_status', 'completed')
                .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00.000Z');

            const totalRevenue = revenueData?.reduce((sum, payment) => sum + parseFloat(payment.total_amount), 0) || 0;

            // Get active errors count
            const { count: activeErrors } = await supabase
                .from('payment_system_errors')
                .select('*', { count: 'exact', head: true })
                .eq('resolved', false);

            // Get critical errors count
            const { count: criticalErrors } = await supabase
                .from('payment_system_errors')
                .select('*', { count: 'exact', head: true })
                .eq('resolved', false)
                .eq('severity', 'critical');

            return {
                paymentSuccessRate: successRateData || 0,
                averageSettlementTime: settlementTimeData || 0,
                totalPaymentsToday: totalPayments || 0,
                totalRevenueToday: totalRevenue,
                activeErrors: activeErrors || 0,
                criticalErrors: criticalErrors || 0,
            };
        } catch (error) {
            console.error('Error fetching system health:', error);
            throw error;
        }
    }

    /**
     * Get recent webhook errors
     */
    async getWebhookErrors(limit: number = 50): Promise<WebhookError[]> {
        try {
            const { data, error } = await supabase
                .from('webhook_errors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching webhook errors:', error);
            throw error;
        }
    }

    /**
     * Get recent payment system errors
     */
    async getPaymentSystemErrors(limit: number = 50): Promise<PaymentSystemError[]> {
        try {
            const { data, error } = await supabase
                .from('payment_system_errors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching payment system errors:', error);
            throw error;
        }
    }

    /**
     * Get unresolved errors by severity
     */
    async getUnresolvedErrorsBySeverity(): Promise<Record<string, number>> {
        try {
            const { data, error } = await supabase
                .from('payment_system_errors')
                .select('severity')
                .eq('resolved', false);

            if (error) throw error;

            const counts = { low: 0, medium: 0, high: 0, critical: 0 };
            data?.forEach(error => {
                counts[error.severity as keyof typeof counts]++;
            });

            return counts;
        } catch (error) {
            console.error('Error fetching unresolved errors by severity:', error);
            throw error;
        }
    }

    /**
     * Mark error as resolved
     */
    async resolveError(errorId: string, errorType: 'webhook' | 'system'): Promise<boolean> {
        try {
            const table = errorType === 'webhook' ? 'webhook_errors' : 'payment_system_errors';

            const { error } = await supabase
                .from(table)
                .update({
                    resolved: true,
                    resolved_at: new Date().toISOString(),
                })
                .eq('id', errorId);

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Error resolving error:', error);
            return false;
        }
    }

    /**
     * Get health metrics history
     */
    async getHealthMetricsHistory(metricName: string, hours: number = 24): Promise<HealthMetric[]> {
        try {
            const { data, error } = await supabase
                .from('system_health_metrics')
                .select('*')
                .eq('metric_name', metricName)
                .gte('recorded_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
                .order('recorded_at', { ascending: true });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching health metrics history:', error);
            throw error;
        }
    }

    /**
     * Get payment processing statistics
     */
    async getPaymentStatistics(hours: number = 24) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

            // Get payment counts by status
            const { data: statusCounts } = await supabase
                .from('payment_transactions')
                .select('payment_status')
                .gte('created_at', startTime);

            // Get payment counts by method
            const { data: methodCounts } = await supabase
                .from('payment_transactions')
                .select('payment_method')
                .gte('created_at', startTime);

            // Get settlement statistics
            const { data: settlementStats } = await supabase
                .from('payment_transactions')
                .select('escrow_status, completed_at, released_at')
                .gte('created_at', startTime)
                .not('completed_at', 'is', null);

            // Process the data
            const statusBreakdown = statusCounts?.reduce((acc, payment) => {
                acc[payment.payment_status] = (acc[payment.payment_status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>) || {};

            const methodBreakdown = methodCounts?.reduce((acc, payment) => {
                acc[payment.payment_method] = (acc[payment.payment_method] || 0) + 1;
                return acc;
            }, {} as Record<string, number>) || {};

            // Calculate settlement times
            const settlementTimes = settlementStats?.filter(s => s.released_at).map(s => {
                const completed = new Date(s.completed_at).getTime();
                const released = new Date(s.released_at).getTime();
                return (released - completed) / 1000; // seconds
            }) || [];

            const avgSettlementTime = settlementTimes.length > 0
                ? settlementTimes.reduce((sum, time) => sum + time, 0) / settlementTimes.length
                : 0;

            return {
                statusBreakdown,
                methodBreakdown,
                avgSettlementTime,
                totalPayments: statusCounts?.length || 0,
                settledPayments: settlementStats?.filter(s => s.escrow_status === 'released').length || 0,
            };
        } catch (error) {
            console.error('Error fetching payment statistics:', error);
            throw error;
        }
    }

    /**
     * Log a custom error for monitoring
     */
    async logError(
        category: string,
        code: string,
        message: string,
        context: any = {},
        severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
    ): Promise<boolean> {
        try {
            const { error } = await supabase.rpc('log_payment_error', {
                p_error_category: category,
                p_error_code: code,
                p_error_message: message,
                p_user_id: context.user_id || null,
                p_order_id: context.order_id || null,
                p_payment_transaction_id: context.payment_transaction_id || null,
                p_error_context: context,
                p_severity: severity
            });

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Error logging custom error:', error);
            return false;
        }
    }

    /**
     * Record a custom health metric
     */
    async recordMetric(
        name: string,
        value: number,
        unit?: string,
        timePeriod: string = 'instant'
    ): Promise<boolean> {
        try {
            const { error } = await supabase.rpc('record_health_metric', {
                p_metric_name: name,
                p_metric_value: value,
                p_metric_unit: unit,
                p_time_period: timePeriod
            });

            if (error) throw error;

            return true;
        } catch (error) {
            console.error('Error recording metric:', error);
            return false;
        }
    }

    /**
     * Get real-time alerts (critical errors in last hour)
     */
    async getRealTimeAlerts(): Promise<PaymentSystemError[]> {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            const { data, error } = await supabase
                .from('payment_system_errors')
                .select('*')
                .eq('resolved', false)
                .in('severity', ['high', 'critical'])
                .gte('created_at', oneHourAgo)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching real-time alerts:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const monitoringService = new MonitoringService();