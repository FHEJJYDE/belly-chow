-- Create error logging tables for payment system monitoring
-- These tables will track webhook errors, payment failures, and system issues

-- Webhook errors table
CREATE TABLE IF NOT EXISTS webhook_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type TEXT NOT NULL, -- 'payment_success', 'payment_failure', 'settlement_error', etc.
    reference TEXT NOT NULL, -- Payment reference or transaction ID
    error_message TEXT NOT NULL,
    error_details JSONB, -- Additional error context
    webhook_payload JSONB, -- Original webhook payload for debugging
    http_status INTEGER, -- HTTP status code returned
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Payment system errors table
CREATE TABLE IF NOT EXISTS payment_system_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_category TEXT NOT NULL, -- 'payment', 'settlement', 'wallet', 'withdrawal'
    error_code TEXT, -- Custom error codes for categorization
    error_message TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id), -- User affected by the error
    order_id UUID REFERENCES orders(id), -- Order related to the error
    payment_transaction_id UUID REFERENCES payment_transactions(id),
    error_context JSONB, -- Additional context data
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES profiles(id)
);

-- System health metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL, -- 'payment_success_rate', 'settlement_time', etc.
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit TEXT, -- 'percentage', 'seconds', 'count'
    time_period TEXT, -- 'hourly', 'daily', 'weekly'
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_webhook_errors_type ON webhook_errors(error_type);
CREATE INDEX idx_webhook_errors_reference ON webhook_errors(reference);
CREATE INDEX idx_webhook_errors_created_at ON webhook_errors(created_at);
CREATE INDEX idx_webhook_errors_resolved ON webhook_errors(resolved);

CREATE INDEX idx_payment_system_errors_category ON payment_system_errors(error_category);
CREATE INDEX idx_payment_system_errors_severity ON payment_system_errors(severity);
CREATE INDEX idx_payment_system_errors_user_id ON payment_system_errors(user_id);
CREATE INDEX idx_payment_system_errors_created_at ON payment_system_errors(created_at);
CREATE INDEX idx_payment_system_errors_resolved ON payment_system_errors(resolved);

CREATE INDEX idx_system_health_metrics_name ON system_health_metrics(metric_name);
CREATE INDEX idx_system_health_metrics_recorded_at ON system_health_metrics(recorded_at);

-- Row Level Security
ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_system_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view all webhook errors" ON webhook_errors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all payment system errors" ON payment_system_errors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all system health metrics" ON system_health_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Function to log payment system errors
CREATE OR REPLACE FUNCTION log_payment_error(
    p_error_category TEXT,
    p_error_code TEXT,
    p_error_message TEXT,
    p_user_id UUID DEFAULT NULL,
    p_order_id UUID DEFAULT NULL,
    p_payment_transaction_id UUID DEFAULT NULL,
    p_error_context JSONB DEFAULT NULL,
    p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO payment_system_errors (
        error_category,
        error_code,
        error_message,
        user_id,
        order_id,
        payment_transaction_id,
        error_context,
        severity
    ) VALUES (
        p_error_category,
        p_error_code,
        p_error_message,
        p_user_id,
        p_order_id,
        p_payment_transaction_id,
        p_error_context,
        p_severity
    ) RETURNING id INTO v_error_id;
    
    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record system health metrics
CREATE OR REPLACE FUNCTION record_health_metric(
    p_metric_name TEXT,
    p_metric_value DECIMAL(10,4),
    p_metric_unit TEXT DEFAULT NULL,
    p_time_period TEXT DEFAULT 'instant'
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO system_health_metrics (
        metric_name,
        metric_value,
        metric_unit,
        time_period
    ) VALUES (
        p_metric_name,
        p_metric_value,
        p_metric_unit,
        p_time_period
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate payment success rate
CREATE OR REPLACE FUNCTION calculate_payment_success_rate(
    p_hours INTEGER DEFAULT 24
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_total_payments INTEGER;
    v_successful_payments INTEGER;
    v_success_rate DECIMAL(5,2);
BEGIN
    -- Count total payments in the last N hours
    SELECT COUNT(*) INTO v_total_payments
    FROM payment_transactions
    WHERE created_at >= NOW() - INTERVAL '1 hour' * p_hours;
    
    -- Count successful payments
    SELECT COUNT(*) INTO v_successful_payments
    FROM payment_transactions
    WHERE created_at >= NOW() - INTERVAL '1 hour' * p_hours
    AND payment_status = 'completed';
    
    -- Calculate success rate
    IF v_total_payments > 0 THEN
        v_success_rate := (v_successful_payments::DECIMAL / v_total_payments::DECIMAL) * 100;
    ELSE
        v_success_rate := 0;
    END IF;
    
    -- Record the metric
    PERFORM record_health_metric(
        'payment_success_rate',
        v_success_rate,
        'percentage',
        p_hours || '_hours'
    );
    
    RETURN v_success_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate average settlement time
CREATE OR REPLACE FUNCTION calculate_average_settlement_time(
    p_hours INTEGER DEFAULT 24
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_avg_settlement_time DECIMAL(10,2);
BEGIN
    -- Calculate average time between payment completion and settlement
    SELECT AVG(EXTRACT(EPOCH FROM (released_at - completed_at))) INTO v_avg_settlement_time
    FROM payment_transactions
    WHERE completed_at >= NOW() - INTERVAL '1 hour' * p_hours
    AND escrow_status = 'released'
    AND completed_at IS NOT NULL
    AND released_at IS NOT NULL;
    
    -- Record the metric
    IF v_avg_settlement_time IS NOT NULL THEN
        PERFORM record_health_metric(
            'average_settlement_time',
            v_avg_settlement_time,
            'seconds',
            p_hours || '_hours'
        );
    END IF;
    
    RETURN COALESCE(v_avg_settlement_time, 0);
END;
$$ LANGUAGE plpgsql;