-- Quality Metrics Table
-- Tracks answer quality and citation accuracy

CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    query_id TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('answer_quality', 'citation_accuracy', 'relevance', 'completeness', 'coherence')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    sources TEXT[],
    citations JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_metrics_user_id ON quality_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_metric_type ON quality_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_timestamp ON quality_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_query_id ON quality_metrics(query_id) WHERE query_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quality_metrics_score ON quality_metrics(score);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_quality_metrics_user_metric ON quality_metrics(user_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_user_timestamp ON quality_metrics(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_metric_timestamp ON quality_metrics(metric_type, timestamp DESC);

-- Comments
COMMENT ON TABLE quality_metrics IS 'Stores quality metrics for answers and citations';
COMMENT ON COLUMN quality_metrics.metric_type IS 'Type of quality metric (answer_quality, citation_accuracy, etc.)';
COMMENT ON COLUMN quality_metrics.score IS 'Quality score from 0-100';
COMMENT ON COLUMN quality_metrics.citations IS 'JSON array of citations with accuracy information';
