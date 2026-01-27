-- Retrieval Quality Metrics Table
-- Tracks retrieval quality metrics (precision, recall, MRR, etc.)

CREATE TABLE IF NOT EXISTS retrieval_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    query TEXT NOT NULL,
    query_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Retrieval metrics
    total_retrieved INTEGER NOT NULL DEFAULT 0,
    total_relevant INTEGER NOT NULL DEFAULT 0,
    relevant_retrieved INTEGER NOT NULL DEFAULT 0,
    precision NUMERIC(5, 4) NOT NULL DEFAULT 0,
    recall NUMERIC(5, 4) NOT NULL DEFAULT 0,
    f1_score NUMERIC(5, 4) NOT NULL DEFAULT 0,
    
    -- Ranking metrics
    mean_reciprocal_rank NUMERIC(5, 4) NOT NULL DEFAULT 0,
    average_precision NUMERIC(5, 4) NOT NULL DEFAULT 0,
    ndcg NUMERIC(5, 4),
    
    -- Context metrics
    document_chunks_retrieved INTEGER NOT NULL DEFAULT 0,
    web_results_retrieved INTEGER NOT NULL DEFAULT 0,
    total_sources INTEGER NOT NULL DEFAULT 0,
    
    -- Quality indicators
    min_score NUMERIC(5, 4),
    max_score NUMERIC(5, 4),
    average_score NUMERIC(5, 4),
    
    -- Metadata
    search_types JSONB,
    topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    document_ids TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_user_id ON retrieval_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_timestamp ON retrieval_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_topic_id ON retrieval_metrics(topic_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_query_id ON retrieval_metrics(query_id) WHERE query_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_user_timestamp ON retrieval_metrics(user_id, timestamp DESC);

-- Comments
COMMENT ON TABLE retrieval_metrics IS 'Stores retrieval quality metrics for each query';
COMMENT ON COLUMN retrieval_metrics.precision IS 'Precision: relevant retrieved / total retrieved';
COMMENT ON COLUMN retrieval_metrics.recall IS 'Recall: relevant retrieved / total relevant';
COMMENT ON COLUMN retrieval_metrics.f1_score IS 'F1 Score: harmonic mean of precision and recall';
COMMENT ON COLUMN retrieval_metrics.mean_reciprocal_rank IS 'Mean Reciprocal Rank: average of 1/rank of first relevant document';
COMMENT ON COLUMN retrieval_metrics.average_precision IS 'Average Precision: average of precision at each relevant document position';
COMMENT ON COLUMN retrieval_metrics.ndcg IS 'Normalized Discounted Cumulative Gain';
