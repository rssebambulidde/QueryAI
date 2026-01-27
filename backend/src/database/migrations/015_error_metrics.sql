-- Error Metrics Tables
-- Tracks error rates and categorizes errors by type

-- Error Metrics Table
CREATE TABLE IF NOT EXISTS error_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type TEXT NOT NULL,
    error_category TEXT NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    query_id TEXT,
    error_message TEXT NOT NULL,
    error_code TEXT,
    status_code INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error Rate Alerts Table
CREATE TABLE IF NOT EXISTS error_rate_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type TEXT NOT NULL,
    error_category TEXT NOT NULL,
    error_rate NUMERIC(5, 2) NOT NULL, -- Percentage
    threshold NUMERIC(5, 2) NOT NULL, -- Threshold percentage
    alert_level TEXT NOT NULL CHECK (alert_level IN ('warning', 'critical')),
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for error_metrics
CREATE INDEX IF NOT EXISTS idx_error_metrics_service_type ON error_metrics(service_type);
CREATE INDEX IF NOT EXISTS idx_error_metrics_error_category ON error_metrics(error_category);
CREATE INDEX IF NOT EXISTS idx_error_metrics_user_id ON error_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_error_metrics_timestamp ON error_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_metrics_query_id ON error_metrics(query_id) WHERE query_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_metrics_status_code ON error_metrics(status_code) WHERE status_code IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_metrics_service_category ON error_metrics(service_type, error_category);
CREATE INDEX IF NOT EXISTS idx_error_metrics_service_timestamp ON error_metrics(service_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_metrics_user_timestamp ON error_metrics(user_id, timestamp DESC);

-- Indexes for error_rate_alerts
CREATE INDEX IF NOT EXISTS idx_error_rate_alerts_service_type ON error_rate_alerts(service_type);
CREATE INDEX IF NOT EXISTS idx_error_rate_alerts_timestamp ON error_rate_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_rate_alerts_alert_level ON error_rate_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_error_rate_alerts_service_timestamp ON error_rate_alerts(service_type, timestamp DESC);

-- Comments
COMMENT ON TABLE error_metrics IS 'Stores error metrics for all services';
COMMENT ON TABLE error_rate_alerts IS 'Stores error rate alerts when thresholds are exceeded';
COMMENT ON COLUMN error_metrics.service_type IS 'Type of service (e.g., rag, ai, embedding)';
COMMENT ON COLUMN error_metrics.error_category IS 'Category of error (e.g., network, rate_limit, validation)';
COMMENT ON COLUMN error_metrics.error_message IS 'Error message (truncated to 1000 characters)';
COMMENT ON COLUMN error_rate_alerts.error_rate IS 'Error rate percentage';
COMMENT ON COLUMN error_rate_alerts.alert_level IS 'Alert level: warning or critical';
