-- Row Level Security for Retrieval Metrics Table

-- Enable RLS on retrieval_metrics table
ALTER TABLE retrieval_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own metrics
CREATE POLICY "Users can view their own retrieval metrics"
ON retrieval_metrics
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own metrics
CREATE POLICY "Users can insert their own retrieval metrics"
ON retrieval_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to retrieval metrics"
ON retrieval_metrics
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Comments
COMMENT ON POLICY "Users can view their own retrieval metrics" ON retrieval_metrics IS 
'Allows users to view only their own retrieval quality metrics';

COMMENT ON POLICY "Users can insert their own retrieval metrics" ON retrieval_metrics IS 
'Allows users to insert retrieval quality metrics for their own queries';

COMMENT ON POLICY "Service role has full access to retrieval metrics" ON retrieval_metrics IS 
'Allows service role (backend) to perform all operations on retrieval metrics';
