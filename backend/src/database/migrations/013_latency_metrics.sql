-- Latency Metrics Tables
-- Tracks latency for all major operations

-- Latency Metrics Table
CREATE TABLE IF NOT EXISTS latency_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type TEXT NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    query_id TEXT,
    duration INTEGER NOT NULL, -- Duration in milliseconds
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Latency Alerts Table
CREATE TABLE IF NOT EXISTS latency_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type TEXT NOT NULL,
    threshold INTEGER NOT NULL, -- Threshold in milliseconds
    current_latency INTEGER NOT NULL, -- Actual latency in milliseconds
    alert_level TEXT NOT NULL CHECK (alert_level IN ('warning', 'critical')),
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for latency_metrics
CREATE INDEX IF NOT EXISTS idx_latency_metrics_operation_type ON latency_metrics(operation_type);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_user_id ON latency_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_timestamp ON latency_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_query_id ON latency_metrics(query_id) WHERE query_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_latency_metrics_duration ON latency_metrics(duration);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_success ON latency_metrics(success);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_latency_metrics_operation_timestamp ON latency_metrics(operation_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_latency_metrics_user_timestamp ON latency_metrics(user_id, timestamp DESC);

-- Indexes for latency_alerts
CREATE INDEX IF NOT EXISTS idx_latency_alerts_operation_type ON latency_alerts(operation_type);
CREATE INDEX IF NOT EXISTS idx_latency_alerts_timestamp ON latency_alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_latency_alerts_alert_level ON latency_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_latency_alerts_operation_timestamp ON latency_alerts(operation_type, timestamp DESC);

-- Comments
COMMENT ON TABLE latency_metrics IS 'Stores latency metrics for all major operations';
COMMENT ON TABLE latency_alerts IS 'Stores latency alerts when thresholds are exceeded';
COMMENT ON COLUMN latency_metrics.operation_type IS 'Type of operation (e.g., rag_context_retrieval, ai_question_answering)';
COMMENT ON COLUMN latency_metrics.duration IS 'Operation duration in milliseconds';
COMMENT ON COLUMN latency_alerts.alert_level IS 'Alert level: warning or critical';
