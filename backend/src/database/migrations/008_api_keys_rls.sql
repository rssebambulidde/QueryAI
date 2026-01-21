-- Row Level Security for API Keys and Embedding Configs
-- Migration 008: Add RLS policies for API keys

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- API Keys Policies
-- Users can view their own API keys
CREATE POLICY "Users can view own api_keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own api_keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own api_keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own api_keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to api_keys"
    ON api_keys FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Embedding Configs Policies
-- Users can view their own embedding configs
CREATE POLICY "Users can view own embedding_configs"
    ON embedding_configs FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own embedding configs
CREATE POLICY "Users can create own embedding_configs"
    ON embedding_configs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own embedding configs
CREATE POLICY "Users can update own embedding_configs"
    ON embedding_configs FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own embedding configs
CREATE POLICY "Users can delete own embedding_configs"
    ON embedding_configs FOR DELETE
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access to embedding_configs"
    ON embedding_configs FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- API Key Usage Policies
-- Users can view usage for their own API keys (via join)
CREATE POLICY "Users can view own api_key_usage"
    ON api_key_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM api_keys
            WHERE api_keys.id = api_key_usage.api_key_id
            AND api_keys.user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to api_key_usage"
    ON api_key_usage FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
